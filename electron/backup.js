// backup.js — autobackup automático de los datos de la app hacia la nube.
//
// Por defecto el destino es el repositorio git github.com/AgustinAlzari/doskiiapp
// (carpeta `data/`). El destino y el comportamiento se pueden personalizar desde
// el archivo de configuración `backup.json` junto a los datos de la app:
//   ~/Library/Application Support/dibuweb/backup.json
//
//   {
//     "enabled": true,
//     "provider": "git",
//     "git": {
//       "remote": "https://github.com/AgustinAlzari/doskiiapp.git",
//       "subfolder": "data",
//       "branch": "main"
//     }
//   }
//
// Cada escritura/borrado (`markDirty`) dispara una sincronización inmediata:
// espeja los datos locales (solo el "conjunto nube", ver computeAllowed) en un
// clone dedicado dentro de appData y hace commit + push. El botón manual de la
// UI (`syncNow`) fuerza la misma operación.

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const SUBDIRS = ['authors', 'backgrounds', 'balloons', 'characters', 'objects', 'palettes', 'projects', 'references', 'strips'];
const OWNED = ['characters', 'backgrounds', 'objects', 'balloons', 'strips'];

const DEFAULTS = {
  enabled: true,
  provider: 'git',
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

  let config = loadConfig();
  let status = { state: 'pending', lastSync: null, message: 'inicio' };

  let running = false;
  let dirty = false;

  // --- config ---
  function loadConfig() {
    let cfg = { ...DEFAULTS };
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      cfg = { ...cfg, ...parsed, git: { ...cfg.git, ...(parsed.git || {}) } };
    } catch { writeDefaultConfig(); }
    return cfg;
  }

  function writeDefaultConfig() {
    try {
      ensureDir(BASE);
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    } catch { /* best-effort */ }
  }

  function reloadConfig() {
    config = loadConfig();
  }

  // --- estado / broadcast ---
  function setStatus(state, extra = {}) {
    status = { ...status, ...extra, state, updatedAt: new Date().toISOString() };
    const win = getWindow();
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('backup:status-changed', status);
    }
  }

  function getStatus() {
    return { ...status };
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
  function computeAllowed() {
    const localOnly = new Set();
    readJsonFiles(path.join(dataDir, 'projects')).forEach(p => {
      if (p.cloudBackup === false) localOnly.add(p.id);
    });

    const excludeIds = new Set();
    const refLocal = new Set();
    const refCloud = new Set();

    OWNED.forEach(sub => {
      readJsonFiles(path.join(dataDir, sub)).forEach(e => {
        const excluded = e.projectId && localOnly.has(e.projectId);
        if (excluded) excludeIds.add(e.id);
        const target = excluded ? refLocal : refCloud;
        (e.referenceImages || []).forEach(r => {
          if (r.fileName) target.add(r.fileName);
        });
      });
    });

    const allowed = {};
    allowed.projects = new Set(
      readJsonFiles(path.join(dataDir, 'projects')).filter(p => !localOnly.has(p.id)).map(p => `${p.id}.json`)
    );
    OWNED.forEach(sub => {
      allowed[sub] = new Set(
        readJsonFiles(path.join(dataDir, sub)).filter(e => !excludeIds.has(e.id)).map(e => `${e.id}.json`)
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

  // --- espejar los datos permitidos en el staging ---
  function reconcile(allowed) {
    const relData = path.join(STAGING, config.git.subfolder);
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

  async function runSync() {
    if (!config.enabled) {
      setStatus('disabled', { message: 'backup desactivado en backup.json' });
      return;
    }
    if (!(await ensureClone())) {
      setStatus('offline', { message: 'no se pudo clonar el repositorio (sin conexión o sin permisos)' });
      return;
    }
    setStatus('syncing', { message: 'espejando datos...' });
    try {
      const relData = config.git.subfolder;
      const allowed = computeAllowed();
      reconcile(allowed);

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

  function markDirty() {
    if (!config.enabled) return;
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
    flush,
    setStatus,
  };
};
