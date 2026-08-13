// backup.js — autobackup automático de los datos de la app hacia la nube.
//
// Por defecto el destino es Google Drive vía rclone (carpeta `gdrive:doski-backup`).
// Config en `~/Library/Application Support/dibuweb/backup.json`:
//   {
//     "enabled": true,
//     "mode": "online",            // "online" | "local"
//     "prompted": false,           // ¿ya se preguntó el modo al iniciar?
//     "provider": "rclone",
//     "rclone": { "remote": "gdrive:doski-backup" }
//   }
//
// Sincronización BIDIRECCIONAL segura (modo en línea):
//   - subir: cada cambio (`markDirty`) espeja el "conjunto nube" (excluye
//     proyectos `cloudBackup:false`) y ejecuta `rclone copy --update`
//     (más nuevo gana; nunca pisa un archivo más actual, nunca borra en la nube).
//   - bajar (`refresh`): antes de abrir un proyecto, `rclone copy --update
//     --files-from=<conjunto permitido>` descarga solo lo más nuevo sin pisar
//     trabajo local más actual.
//   - borrados: al borrar algo que está en la nube se registra un "tombstone"
//     (`.tombstones.json` en la nube) para que el borrado no reviva en otra
//     máquina; si el trabajo local es más nuevo que el borrado, gana lo local.

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const SUBDIRS = ['authors', 'backgrounds', 'balloons', 'characters', 'objects', 'palettes', 'projects', 'references', 'strips'];
const OWNED = ['characters', 'backgrounds', 'objects', 'balloons', 'strips'];
const TOMB_FILE = '.tombstones.json';

const DEFAULTS = {
  enabled: true,
  mode: 'online',
  prompted: false,
  provider: 'rclone',
  rclone: {
    remote: 'gdrive:doski-backup',
  },
  git: {
    remote: 'https://github.com/AgustinAlzari/doskiiapp.git',
    subfolder: 'data',
    branch: 'main',
  },
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => {
    if (name === '.DS_Store') return false;
    try { return fs.statSync(path.join(dir, name)).isFile(); } catch { return false; }
  });
}

function readJsonFiles(dir) {
  return listFiles(dir).filter(n => n.endsWith('.json')).map(n => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')); } catch { return null; }
  }).filter(Boolean);
}

function copyIfChanged(src, dst) {
  const a = fs.statSync(src);
  let b = null;
  try { b = fs.statSync(dst); } catch { /* no existe */ }
  if (b && b.size === a.size && Math.abs(b.mtimeMs - a.mtimeMs) < 2) return;
  fs.copyFileSync(src, dst);
  try { fs.utimesSync(dst, a.atime, a.mtime); } catch { /* best-effort */ }
}

module.exports = function initBackup({ dataDir, appDataDir, getWindow }) {
  const BASE = appDataDir;
  const CONFIG_PATH = path.join(BASE, 'backup.json');
  const STAGING = path.join(BASE, 'backup');
  const STAGING_R = path.join(BASE, 'backup-rclone');
  const FILES_LIST = path.join(BASE, 'backup-files.txt');
  const TOMB_LOCAL = path.join(BASE, TOMB_FILE);

  let config = loadConfig();
  let activeCloud = true; // el proyecto activo sube a la nube (cloudBackup !== false)
  let status = { state: 'pending', lastSync: null, message: 'inicio' };

  let running = false;
  let dirty = false;

  // --- config ---
  function writeConfig(cfg) {
    try {
      ensureDir(BASE);
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch { /* best-effort */ }
  }

  function loadConfig() {
    let cfg = { ...DEFAULTS };
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      cfg = {
        ...cfg,
        ...parsed,
        git: { ...cfg.git, ...(parsed.git || {}) },
        rclone: { ...cfg.rclone, ...(parsed.rclone || {}) },
      };
      // migración: el backup apuntaba al repo de código (git) → ahora rclone/Google Drive
      if (cfg.provider === 'git' && cfg.git.remote === 'https://github.com/AgustinAlzari/doskiiapp.git') {
        cfg = { ...DEFAULTS };
        writeConfig(cfg);
      }
    } catch { writeDefaultConfig(); }
    return cfg;
  }

  function writeDefaultConfig() {
    writeConfig(DEFAULTS);
  }

  function reloadConfig() {
    config = loadConfig();
  }

  // --- estado / broadcast ---
  function setStatus(state, extra = {}) {
    status = {
      ...status,
      ...extra,
      state,
      mode: config.mode,
      prompted: config.prompted,
      activeCloud,
      enabled: config.enabled,
      effective: isEnabled(),
      updatedAt: new Date().toISOString(),
    };
    const win = getWindow();
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('backup:status-changed', status);
    }
  }

  function getStatus() {
    return { ...status, mode: config.mode, prompted: config.prompted, activeCloud, enabled: config.enabled, effective: isEnabled() };
  }

  function getConfig() {
    return {
      enabled: config.enabled,
      mode: config.mode,
      prompted: config.prompted,
      provider: config.provider,
      remote: config.rclone.remote,
    };
  }

  // Autoback efectivo: config.enabled Y modo en línea Y proyecto activo no solo local.
  function isEnabled() {
    return config.enabled && config.mode !== 'local' && activeCloud;
  }

  function setMode({ mode, prompted }) {
    config = { ...config, mode: mode === 'local' ? 'local' : 'online' };
    if (typeof prompted === 'boolean') config.prompted = prompted;
    writeConfig(config);
    refreshStatus();
  }

  function setActiveProject({ cloudBackup }) {
    activeCloud = cloudBackup !== false;
    refreshStatus();
  }

  function refreshStatus() {
    const reason = !config.enabled
      ? 'backup desactivado en backup.json'
      : config.mode === 'local'
        ? 'modo local: autobackup apagado'
        : !activeCloud
          ? 'proyecto solo local: autobackup apagado'
          : null;
    if (reason) return setStatus('disabled', { message: reason });
    setStatus(status.state === 'syncing' || status.state === 'error' ? status.state : 'idle', {
      message: status.state === 'error' ? status.message : 'al día',
    });
  }

  // --- git helpers ---
  function git(...args) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: STAGING, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { err.stderr = stderr; reject(err); return; }
        resolve(String(stdout).trim());
      });
    });
  }

  // --- rclone helpers ---
  function rclone(...args) {
    return new Promise((resolve, reject) => {
      execFile('rclone', args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { err.stderr = stderr; reject(err); return; }
        resolve(String(stdout).trim());
      });
    });
  }

  async function rcloneAvailable() {
    try { await rclone('version'); return true; } catch { return false; }
  }

  function resetDir(dir) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
  }

  async function ensureClone() {
    if (fs.existsSync(path.join(STAGING, '.git'))) return true;
    try {
      ensureDir(BASE);
      await new Promise((resolve, reject) => {
        execFile('git', ['clone', config.git.remote, STAGING], { maxBuffer: 64 * 1024 * 1024 }, (err) => err ? reject(err) : resolve());
      });
      await git('config', 'user.name', 'doski backup');
      await git('config', 'user.email', 'doski@localhost');
      return true;
    } catch {
      return false;
    }
  }

  // --- conjunto nube (excluye proyectos "solo local") ---
  function computeCloudSets() {
    const localOnly = new Set();
    readJsonFiles(path.join(dataDir, 'projects')).forEach(p => {
      if (p.cloudBackup === false) localOnly.add(p.id);
    });

    const excludedBySub = {};
    const refLocal = new Set();
    const refCloud = new Set();
    OWNED.forEach(sub => { excludedBySub[sub] = new Set(); });

    OWNED.forEach(sub => {
      readJsonFiles(path.join(dataDir, sub)).forEach(e => {
        const excluded = e.projectId && localOnly.has(e.projectId);
        if (excluded) excludedBySub[sub].add(e.id);
        const target = excluded ? refLocal : refCloud;
        (e.referenceImages || []).forEach(r => {
          if (r.fileName) target.add(r.fileName);
        });
      });
    });

    return { localOnly, excludedBySub, refLocal, refCloud };
  }

  function computeAllowed() {
    const { localOnly, excludedBySub, refLocal, refCloud } = computeCloudSets();
    const allowed = {};
    allowed.projects = new Set(
      readJsonFiles(path.join(dataDir, 'projects')).filter(p => !localOnly.has(p.id)).map(p => `${p.id}.json`)
    );
    OWNED.forEach(sub => {
      allowed[sub] = new Set(
        readJsonFiles(path.join(dataDir, sub)).filter(e => !excludedBySub[sub].has(e.id)).map(e => `${e.id}.json`)
      );
    });
    allowed.references = new Set(
      listFiles(path.join(dataDir, 'references')).filter(name => {
        if (refLocal.has(name) && !refCloud.has(name)) return false;
        return true;
      })
    );
    ['palettes', 'authors'].forEach(sub => {
      allowed[sub] = new Set(listFiles(path.join(dataDir, sub)));
    });
    return allowed;
  }

  // Rutas relativas que NO se deben descargar: archivos de proyectos "solo local"
  // y referencias que solo usan proyectos locales.
  function computeExcludedPaths() {
    const { localOnly, excludedBySub, refLocal, refCloud } = computeCloudSets();
    const ex = new Set([TOMB_FILE]);
    localOnly.forEach(id => ex.add(`projects/${id}.json`));
    Object.entries(excludedBySub).forEach(([sub, ids]) => ids.forEach(id => ex.add(`${sub}/${id}.json`)));
    refLocal.forEach(n => { if (!refCloud.has(n)) ex.add(`references/${n}`); });
    return ex;
  }

  function isCloudPath(sub, name) {
    const allowed = computeAllowed();
    return (allowed[sub] || new Set()).has(name);
  }

  // --- espejar los datos permitidos en el destino (staging) ---
  function reconcile(allowed, relData) {
    SUBDIRS.forEach(sub => {
      const srcDir = path.join(dataDir, sub);
      const dstDir = path.join(relData, sub);
      ensureDir(dstDir);
      const allowedNames = allowed[sub] || new Set();
      allowedNames.forEach(name => {
        const src = path.join(srcDir, name);
        if (!fs.existsSync(src)) return;
        copyIfChanged(src, path.join(dstDir, name));
      });
      listFiles(dstDir).forEach(name => {
        if (!allowedNames.has(name)) fs.unlinkSync(path.join(dstDir, name));
      });
    });
  }

  function writeFilesFrom(allowed) {
    const lines = [];
    SUBDIRS.forEach(sub => {
      (allowed[sub] || new Set()).forEach(name => lines.push(`${sub}/${name}`));
    });
    fs.writeFileSync(FILES_LIST, lines.join('\n'), 'utf-8');
    return FILES_LIST;
  }

  function writePathsToFile(paths, file) {
    fs.writeFileSync(file, paths.join('\n'), 'utf-8');
    return file;
  }

  async function listCloudFiles() {
    const out = await rclone('lsf', '-R', '--files-only', '--format', 'p', config.rclone.remote);
    return String(out).split('\n').map(s => s.trim()).filter(Boolean);
  }

  function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else n++;
      }
    };
    walk(dir);
    return n;
  }

  // --- tombstones ---
  function loadTombstones() {
    try { return JSON.parse(fs.readFileSync(TOMB_LOCAL, 'utf-8')); } catch { return { version: 1, files: [] }; }
  }

  function saveTombstones(ts) {
    try { fs.writeFileSync(TOMB_LOCAL, JSON.stringify(ts, null, 2), 'utf-8'); } catch { /* best-effort */ }
  }

  function addTombstones(paths, deletedAt = new Date().toISOString()) {
    const ts = loadTombstones();
    for (const p of paths) {
      const hit = ts.files.find(t => t.path === p);
      if (hit) hit.deletedAt = deletedAt;
      else ts.files.push({ path: p, deletedAt });
    }
    saveTombstones(ts);
  }

  function uploadTombstones() {
    return rclone('copyto', TOMB_LOCAL, `${config.rclone.remote}/${TOMB_FILE}`).catch(() => {});
  }

  // Aplica tombstones descargados: borra local salvo que el trabajo local sea más nuevo.
  function applyTombstones() {
    const ts = loadTombstones();
    const keep = [];
    for (const t of ts.files) {
      const local = path.join(dataDir, t.path);
      let exists = false;
      let mtime = 0;
      try { mtime = fs.statSync(local).mtimeMs; exists = true; } catch { exists = false; }
      const delAt = new Date(t.deletedAt).getTime();
      if (!exists || mtime <= delAt) {
        if (exists) { try { fs.unlinkSync(local); } catch {} }
        keep.push(t);
      }
      // si el local es más nuevo que el borrado, gana el trabajo local (se descarta el tombstone)
    }
    ts.files = keep;
    saveTombstones(ts);
  }

  async function deleteRemoteFiles(paths) {
    const remote = config.rclone.remote;
    for (const p of paths) {
      try { await rclone('deletefile', `${remote}/${p}`); } catch { /* el archivo puede no existir */ }
    }
  }

  // Se llama desde main cuando se borra un archivo que estaba en la nube.
  function handleDeleted(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return;
    addTombstones(paths);
    if (config.enabled && config.mode !== 'local') {
      Promise.resolve()
        .then(() => deleteRemoteFiles(paths))
        .then(() => uploadTombstones())
        .catch(() => {});
    }
  }

  // --- subir (autoback) ---
  async function runRcloneSync() {
    if (!(await rcloneAvailable())) {
      setStatus('offline', { message: 'rclone no está instalado (instalá con: brew install rclone)' });
      return;
    }
    setStatus('syncing', { message: 'subiendo datos a la nube...' });
    try {
      resetDir(STAGING_R);
      const allowed = computeAllowed();
      reconcile(allowed, STAGING_R);
      await rclone('copy', '--update', STAGING_R, config.rclone.remote, '--transfers', '4', '--stats', '0');
      await uploadTombstones();
      setStatus('idle', { message: 'al día', lastSync: new Date().toISOString() });
    } catch (err) {
      setStatus('error', { message: `rclone: ${String(err && err.message || err)}` });
    }
  }

  // --- bajar (refrescar antes de abrir) ---
  // Lista la nube, excluye tombstones y proyectos "solo local", y descarga lo
  // más nuevo SIN pisar trabajo local más actual (`--update`). Los archivos
  // locales que la nube reemplaza quedan respaldados en .sync-backup/cloud.
  async function refresh() {
    if (!config.enabled) {
      setStatus('disabled', { message: 'backup desactivado en backup.json' });
      return;
    }
    if (!(await rcloneAvailable())) {
      setStatus('offline', { message: 'rclone no está instalado (instalá con: brew install rclone)' });
      return;
    }
    setStatus('syncing', { message: 'actualizando desde la nube...' });
    try {
      await rclone('copyto', `${config.rclone.remote}/${TOMB_FILE}`, TOMB_LOCAL).catch(() => {});
      const excluded = computeExcludedPaths();
      const cloudFiles = await listCloudFiles();
      const files = cloudFiles.filter(p => !excluded.has(p));
      const backupDir = path.join(BASE, '.sync-backup', 'cloud');
      if (files.length) {
        const list = writePathsToFile(files, FILES_LIST);
        await rclone(
          'copy', '--update', `--backup-dir=${backupDir}`, `--files-from=${list}`,
          config.rclone.remote, dataDir, '--transfers', '4', '--stats', '0'
        );
      }
      applyTombstones();
      const replaced = countFiles(backupDir);
      setStatus('idle', {
        message: replaced > 0 ? `actualizado (${replaced} reemplazados, respaldados en .sync-backup)` : 'actualizado',
        lastSync: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('error', { message: `rclone: ${String(err && err.message || err)}` });
    }
  }

  async function runGitSync() {
    if (!(await ensureClone())) {
      setStatus('offline', { message: 'no se pudo clonar el repositorio (sin conexión o sin permisos)' });
      return;
    }
    setStatus('syncing', { message: 'espejando datos...' });
    try {
      const relData = config.git.subfolder;
      const allowed = computeAllowed();
      reconcile(allowed, path.join(STAGING, relData));

      await git('add', '--', relData);
      const changed = await git('status', '--porcelain', '--', relData);
      if (changed.trim()) {
        await git('commit', '-m', `backup ${new Date().toISOString()}`);
        try {
          await git('push', 'origin', config.git.branch);
        } catch (pushErr) {
          try {
            await git('pull', '--rebase', '--autostash', 'origin', config.git.branch);
            await git('push', 'origin', config.git.branch);
          } catch (retryErr) {
            setStatus('error', { message: 'falló el push (revisá conexión y credenciales de git)' });
            return;
          }
        }
      }
      setStatus('idle', { message: 'al día', lastSync: new Date().toISOString() });
    } catch (err) {
      setStatus('error', { message: String(err && err.message || err) });
    }
  }

  async function runSync() {
    if (!config.enabled) {
      setStatus('disabled', { message: 'backup desactivado en backup.json' });
      return;
    }
    if (config.provider === 'rclone') return runRcloneSync();
    return runGitSync();
  }

  // Manual (botón "sincronizar"): sube siempre que config.enabled, aunque sea modo local.
  function syncNow() {
    reloadConfig();
    if (running) {
      dirty = true;
      return Promise.resolve();
    }
    running = true;
    dirty = false;
    return runSync()
      .catch(() => { /* el estado de error ya quedó registrado */ })
      .finally(() => {
        running = false;
        if (dirty) {
          dirty = false;
          return syncNow();
        }
      });
  }

  // Automático: solo si la regla "modo Y proyecto" se cumple.
  function markDirty() {
    if (!isEnabled()) return;
    if (running) {
      dirty = true;
      return;
    }
    syncNow();
  }

  async function flush() {
    if (running || status.state === 'pending') {
      await syncNow().catch(() => {});
    }
  }

  return {
    markDirty,
    syncNow,
    getStatus,
    getConfig,
    flush,
    setStatus,
    setMode,
    setActiveProject,
    refresh,
    handleDeleted,
    isCloudPath,
  };
};
