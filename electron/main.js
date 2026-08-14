const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, clipboard, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const initBackup = require('./backup');

const isDev = !app.isPackaged;
let mainWindow;
let flushed = false;

// --- Version check (GitHub releases) ---
const UPDATE_REPO = 'AgustinAlzari/doskiiapp';
const UPDATE_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;

function parseVersion(v) {
  const parts = String(v || '').replace(/^v/i, '').split('.');
  return parts.map(p => parseInt(p, 10) || 0);
}

function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function checkForUpdates() {
  if (isDev) return;
  const request = net.request(UPDATE_URL);
  request.setHeader('Accept', 'application/vnd.github.v3+json');
  request.setHeader('User-Agent', 'doski');
  let body = '';
  request.on('response', (response) => {
    if (response.statusCode !== 200) return;
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      try {
        const release = JSON.parse(body);
        const latest = release.tag_name;
        if (!isNewer(latest, app.getVersion()) || !mainWindow) return;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Nueva versión disponible',
          message: `Hay una versión nueva de doski: ${latest}`,
          detail: `Estás usando la ${app.getVersion()}. Podés descargar la actualización desde la página de releases.`,
          buttons: ['Descargar', 'Después'],
          defaultId: 0,
          cancelId: 1,
        }).then(({ response }) => {
          if (response === 0) shell.openExternal(`https://github.com/${UPDATE_REPO}/releases/latest`);
        });
      } catch (e) {
        console.error('update check parse error:', e);
      }
    });
  });
  request.on('error', () => {});
  request.end();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'doskii',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Permite el tag <webview> para el chat de IA embarcado en la vista de prompts.
      webviewTag: true,
    },
    titleBarStyle: 'hiddenInset',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(checkForUpdates, 3000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', async (e) => {
  if (flushed) return;
  e.preventDefault();
  flushed = true;
  await Promise.race([
    backup.flush(),
    new Promise(res => setTimeout(res, 10000)),
  ]);
  app.quit();
});

// --- Data directory ---
const DATA_DIR = path.join(app.getPath('appData'), 'dibuweb', 'data');
const APP_DATA_DIR = path.join(app.getPath('appData'), 'dibuweb');
const backup = initBackup({
  dataDir: DATA_DIR,
  appDataDir: APP_DATA_DIR,
  getWindow: () => mainWindow,
});
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function ensureDataDirs() {
  ensureDir(DATA_DIR);
  ensureDir(path.join(DATA_DIR, 'projects'));
  ensureDir(path.join(DATA_DIR, 'characters'));
  ensureDir(path.join(DATA_DIR, 'strips'));
  ensureDir(path.join(DATA_DIR, 'backgrounds'));
  ensureDir(path.join(DATA_DIR, 'objects'));
  ensureDir(path.join(DATA_DIR, 'balloons'));
  ensureDir(path.join(DATA_DIR, 'palettes'));
  ensureDir(path.join(DATA_DIR, 'authors'));
  ensureDir(path.join(DATA_DIR, 'references'));
}

function readJsonDir(dir) {
  ensureDir(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

function writeJsonFile(dir, entity) {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${entity.id}.json`), JSON.stringify(entity, null, 2), 'utf-8');
}

function remapStripReferences(strip, idMap) {
  const mapped = {
    ...strip,
    projectId: idMap[strip.projectId] || strip.projectId,
  };
  mapped.panels = (strip.panels || []).map(p => ({
    ...p,
    characters: (p.characters || []).map(c => ({
      ...c,
      characterId: idMap[c.characterId] || c.characterId,
      gazeTarget: c.gazeTarget && c.gazeTarget.id && idMap[c.gazeTarget.id]
        ? { ...c.gazeTarget, id: idMap[c.gazeTarget.id] }
        : c.gazeTarget,
    })),
    objects: (p.objects || []).map(o => ({ ...o, objectId: idMap[o.objectId] || o.objectId })),
    backgroundId: idMap[p.backgroundId] || p.backgroundId,
    connections: (p.connections || []).map(conn => ({
      ...conn,
      from: idMap[conn.from] || conn.from,
      to: idMap[conn.to] || conn.to,
    })),
  }));
  return mapped;
}

function safeRefName(entity, ref) {
  const raw = String(ref.fileName || (ref.path ? path.basename(ref.path) : 'referencia') || 'referencia');
  const clean = raw.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
  return clean || 'referencia';
}

function fixRefPaths(entity) {
  return {
    ...entity,
    referenceImages: (entity.referenceImages || []).map(r => {
      const fileName = safeRefName(entity, r);
      return { fileName, path: path.join(DATA_DIR, 'references', fileName) };
    }),
  };
}

function fixProjectBalloonPaths(project) {
  const { balloons, ...rest } = project;
  return rest;
}

ipcMain.handle('references:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('references:import', async (_, { sourcePath, entityId, entityName }) => {
  ensureDataDirs();
  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  const safeName = String(entityName || 'referencia').replace(/[^a-z0-9áéíóúüñ_-]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
  const fileName = `${safeName || 'referencia'}${ext}`;
  const destination = path.join(DATA_DIR, 'references', fileName);
  fs.copyFileSync(sourcePath, destination);
  backup.markDirty();
  return { fileName, path: destination };
});

ipcMain.handle('references:read', async (_, filePath) => {
  let resolved = filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    if (filePath) {
      const candidate = path.join(DATA_DIR, 'references', path.basename(filePath));
      if (fs.existsSync(candidate)) resolved = candidate;
    }
  }
  if (!resolved || !fs.existsSync(resolved)) return null;
  const ext = path.extname(resolved).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(resolved).toString('base64')}`;
});

ipcMain.handle('references:open-folder', async () => shell.openPath(path.join(DATA_DIR, 'references')));

// --- IPC: Open a temporary folder with the used references (symlinks, no duplication) ---
ipcMain.handle('references:open-used-folder', async (_, fileNames) => {
  ensureDataDirs();
  const folder = path.join(DATA_DIR, 'refs-usadas');
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  const seen = new Set();
  (fileNames || []).forEach(name => {
    const clean = path.basename(String(name || ''));
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    const src = path.join(DATA_DIR, 'references', clean);
    if (!fs.existsSync(src)) return;
    try {
      fs.symlinkSync(src, path.join(folder, clean));
    } catch {
      try { fs.copyFileSync(src, path.join(folder, clean)); } catch {}
    }
  });
  await shell.openPath(folder);
  return { ok: true, folder };
});

// --- IPC: Backup a la nube ---
ipcMain.handle('backup:get-status', async () => backup.getStatus());
ipcMain.handle('backup:get-config', async () => backup.getConfig());
ipcMain.handle('backup:set-mode', async (_, payload) => {
  backup.setMode(payload || {});
  return backup.getStatus();
});
ipcMain.handle('backup:set-active-project', async (_, payload) => {
  backup.setActiveProject(payload || {});
  return backup.getStatus();
});
ipcMain.handle('backup:sync-now', async () => {
  await backup.syncNow();
  return backup.getStatus();
});
ipcMain.handle('backup:refresh', async () => {
  await backup.refresh();
  return backup.getStatus();
});
ipcMain.handle('backup:delete-remote', async (_, paths) => {
  backup.handleDeleted(Array.isArray(paths) ? paths : []);
  return backup.getStatus();
});

// --- IPC: wizard de sincronización ---
ipcMain.handle('backup:setup-status', async () => backup.setupStatus());
ipcMain.handle('backup:download-rclone', async () => {
  const res = await backup.downloadRclone();
  return { ...res, ...(await backup.setupStatus()) };
});
ipcMain.handle('backup:create-remote', async () => {
  const res = await backup.createRemote();
  return { ...res, ...(await backup.setupStatus()) };
});
ipcMain.handle('backup:test-connection', async () => {
  const res = await backup.testConnection();
  return { ...res, ...(await backup.setupStatus()) };
});
// Fallback: si el OAuth de rclone no pudo completarse desde la app, abre una
// terminal con `rclone config` para que el usuario lo termine a mano.
ipcMain.handle('backup:open-rclone-config', async () => {
  try {
    const script = 'tell application "Terminal" to activate\rdo script "rclone config" in front window';
    execFile('osascript', ['-e', script], (err) => { if (err) console.error(err); });
  } catch {}
  return { ok: true };
});

// --- IPC: Characters ---
ipcMain.handle('characters:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'characters');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('characters:save', async (_, character) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'characters', `${character.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(character, null, 2), 'utf-8');
  backup.markDirty();
  return character;
});

// Borra un archivo de entidad y, si estaba en la nube, registra el tombstone
// (el borrado se propaga a la nube y no revive en otras máquinas).
function deleteEntityCloud(sub, id) {
  const filePath = path.join(DATA_DIR, sub, `${id}.json`);
  let cloud = false;
  if (fs.existsSync(filePath)) {
    try {
      const entity = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (sub === 'projects') {
        cloud = entity.cloudBackup !== false;
      } else if (entity && entity.projectId) {
        try {
          const proj = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects', `${entity.projectId}.json`), 'utf-8'));
          cloud = proj.cloudBackup !== false;
        } catch {}
      }
    } catch {}
    fs.unlinkSync(filePath);
  }
  if (cloud) backup.handleDeleted([`${sub}/${id}.json`]);
  backup.markDirty();
}

ipcMain.handle('characters:delete', async (_, id) => {
  deleteEntityCloud('characters', id);
  return true;
});

// --- IPC: Strips ---
ipcMain.handle('strips:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'strips');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('strips:save', async (_, strip) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'strips', `${strip.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(strip, null, 2), 'utf-8');
  backup.markDirty();
  return strip;
});

ipcMain.handle('strips:delete', async (_, id) => {
  deleteEntityCloud('strips', id);
  return true;
});

// --- IPC: Save file dialog ---
ipcMain.handle('dialog:save', async (_, { defaultPath, filters }) => {
  return await dialog.showSaveDialog(mainWindow, { defaultPath, filters });
});

// --- IPC: Open file dialog ---
ipcMain.handle('dialog:open', async (_, { filters } = {}) => {
  return await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters });
});

// --- IPC: Backgrounds ---
ipcMain.handle('backgrounds:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'backgrounds');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('backgrounds:save', async (_, background) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'backgrounds', `${background.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(background, null, 2), 'utf-8');
  backup.markDirty();
  return background;
});

ipcMain.handle('backgrounds:delete', async (_, id) => {
  deleteEntityCloud('backgrounds', id);
  return true;
});

// --- IPC: Objects ---
ipcMain.handle('objects:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'objects');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('objects:save', async (_, object) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'objects', `${object.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(object, null, 2), 'utf-8');
  backup.markDirty();
  return object;
});

ipcMain.handle('objects:delete', async (_, id) => {
  deleteEntityCloud('objects', id);
  return true;
});

// --- IPC: Balloons ---
ipcMain.handle('balloons:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'balloons');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('balloons:save', async (_, balloon) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'balloons', `${balloon.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(balloon, null, 2), 'utf-8');
  backup.markDirty();
  return balloon;
});

ipcMain.handle('balloons:delete', async (_, id) => {
  deleteEntityCloud('balloons', id);
  return true;
});

// --- IPC: Palettes ---
ipcMain.handle('palettes:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'palettes');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('palettes:save', async (_, palette) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'palettes', `${palette.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(palette, null, 2), 'utf-8');
  backup.markDirty();
  return palette;
});

ipcMain.handle('palettes:delete', async (_, id) => {
  deleteEntityCloud('palettes', id);
  return true;
});

// --- IPC: Authors ---
ipcMain.handle('authors:list', async () => {
  ensureDataDirs();
  const dir = path.join(DATA_DIR, 'authors');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
});

ipcMain.handle('authors:save', async (_, author) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'authors', `${author.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(author, null, 2), 'utf-8');
  backup.markDirty();
  return author;
});

ipcMain.handle('authors:delete', async (_, id) => {
  deleteEntityCloud('authors', id);
  return true;
});

// --- IPC: Read image from clipboard (for paste-to-hex) ---
ipcMain.handle('clipboard:read-image', async () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  return { dataUrl: `data:image/png;base64,${image.toPNG().toString('base64')}` };
});

// --- IPC: Projects ---
ipcMain.handle('projects:list', async () => {
  ensureDataDirs();
  return readJsonDir(path.join(DATA_DIR, 'projects'));
});

ipcMain.handle('projects:save', async (_, project) => {
  ensureDataDirs();
  writeJsonFile(path.join(DATA_DIR, 'projects'), project);
  backup.markDirty();
  return project;
});

ipcMain.handle('projects:delete', async (_, id) => {
  deleteEntityCloud('projects', id);
  return true;
});

ipcMain.handle('projects:deleteAll', async (_, projectId) => {
  const cloudPaths = [];
  let projectCloud = false;
  try {
    const proj = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects', `${projectId}.json`), 'utf-8'));
    projectCloud = proj.cloudBackup !== false;
  } catch {}
  const deleteOwned = (dir, sub) => {
    readJsonDir(dir).filter(e => e.projectId === projectId).forEach(e => {
      const p = path.join(dir, `${e.id}.json`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      if (projectCloud) cloudPaths.push(`${sub}/${e.id}.json`);
    });
  };
  deleteOwned(path.join(DATA_DIR, 'characters'), 'characters');
  deleteOwned(path.join(DATA_DIR, 'backgrounds'), 'backgrounds');
  deleteOwned(path.join(DATA_DIR, 'objects'), 'objects');
  deleteOwned(path.join(DATA_DIR, 'balloons'), 'balloons');
  deleteOwned(path.join(DATA_DIR, 'strips'), 'strips');
  const p = path.join(DATA_DIR, 'projects', `${projectId}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  if (projectCloud) cloudPaths.push(`projects/${projectId}.json`);
  if (cloudPaths.length) backup.handleDeleted(cloudPaths);
  backup.markDirty();
  return true;
});

ipcMain.handle('projects:duplicate', async (_, projectId) => {
  ensureDataDirs();
  const src = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects', `${projectId}.json`), 'utf-8'));
  const idMap = {};
  const newProjectId = crypto.randomUUID();
  idMap[projectId] = newProjectId;
  const newProject = {
    ...src,
    id: newProjectId,
    name: `Copia de ${src.name}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(path.join(DATA_DIR, 'projects'), newProject);

  const cloneEntities = (dir) => {
    readJsonDir(dir).filter(e => e.projectId === projectId).forEach(e => {
      const newId = crypto.randomUUID();
      idMap[e.id] = newId;
      writeJsonFile(dir, {
        ...e,
        id: newId,
        projectId: newProjectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  };
  cloneEntities(path.join(DATA_DIR, 'characters'));
  cloneEntities(path.join(DATA_DIR, 'backgrounds'));
  cloneEntities(path.join(DATA_DIR, 'objects'));
  cloneEntities(path.join(DATA_DIR, 'balloons'));

  readJsonDir(path.join(DATA_DIR, 'strips')).filter(s => s.projectId === projectId).forEach(strip => {
    const newId = crypto.randomUUID();
    idMap[strip.id] = newId;
    writeJsonFile(path.join(DATA_DIR, 'strips'), {
      ...remapStripReferences(strip, idMap),
      id: newId,
      projectId: newProjectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  backup.markDirty();
  return newProject;
});

ipcMain.handle('projects:export', async (_, { projectId, filePath }) => {
  ensureDataDirs();
  const project = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects', `${projectId}.json`), 'utf-8'));
  const strips = readJsonDir(path.join(DATA_DIR, 'strips')).filter(s => s.projectId === projectId);
  const characters = readJsonDir(path.join(DATA_DIR, 'characters')).filter(c => c.projectId === projectId);
  const backgrounds = readJsonDir(path.join(DATA_DIR, 'backgrounds')).filter(b => b.projectId === projectId);
  const objects = readJsonDir(path.join(DATA_DIR, 'objects')).filter(o => o.projectId === projectId);
  const balloons = readJsonDir(path.join(DATA_DIR, 'balloons')).filter(b => b.projectId === projectId);

  const refNames = new Set();
  [...characters, ...backgrounds, ...objects, ...balloons].forEach(e => (e.referenceImages || []).forEach(r => {
    const name = safeRefName(e, r);
    if (name) refNames.add(name);
  }));

  const references = {};
  refNames.forEach(name => {
    const p = path.join(DATA_DIR, 'references', name);
    if (fs.existsSync(p)) references[name] = fs.readFileSync(p).toString('base64');
  });

  const bundle = {
    format: 'doski-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    strips,
    characters,
    backgrounds,
    objects,
    balloons,
    references,
  };
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf-8');
  return { ok: true, filePath };
});

// --- IPC: Export de TODO doski (respaldo completo) ---
ipcMain.handle('data:export-all', async (_, filePath) => {
  ensureDataDirs();
  const readDir = (sub) => readJsonDir(path.join(DATA_DIR, sub));
  const references = {};
  fs.readdirSync(path.join(DATA_DIR, 'references')).forEach(name => {
    if (name === '.DS_Store') return;
    const p = path.join(DATA_DIR, 'references', name);
    try { if (fs.statSync(p).isFile()) references[name] = fs.readFileSync(p).toString('base64'); } catch {}
  });
  const bundle = {
    format: 'doski-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    authors: readDir('authors'),
    backgrounds: readDir('backgrounds'),
    balloons: readDir('balloons'),
    characters: readDir('characters'),
    objects: readDir('objects'),
    palettes: readDir('palettes'),
    projects: readDir('projects'),
    strips: readDir('strips'),
    references,
  };
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf-8');
  return { ok: true, filePath };
});

ipcMain.handle('projects:import', async (_, filePath) => {
  ensureDataDirs();
  const bundle = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (bundle.format !== 'doski-project') throw new Error('Formato de proyecto no válido');

  const idMap = {};
  const newProjectId = crypto.randomUUID();
  idMap[bundle.project.id] = newProjectId;

  if (bundle.references) {
    Object.entries(bundle.references).forEach(([name, data]) => {
      const clean = String(name).replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'referencia';
      fs.writeFileSync(path.join(DATA_DIR, 'references', clean), Buffer.from(data, 'base64'));
    });
  }

  const importEntities = (dir, list) => {
    (list || []).forEach(e => {
      const newId = crypto.randomUUID();
      idMap[e.id] = newId;
      writeJsonFile(dir, fixRefPaths({ ...e, id: newId, projectId: newProjectId }));
    });
  };
  importEntities(path.join(DATA_DIR, 'characters'), bundle.characters);
  importEntities(path.join(DATA_DIR, 'backgrounds'), bundle.backgrounds);
  importEntities(path.join(DATA_DIR, 'objects'), bundle.objects);
  importEntities(path.join(DATA_DIR, 'balloons'), bundle.balloons);

  (bundle.strips || []).forEach(s => {
    const newId = crypto.randomUUID();
    idMap[s.id] = newId;
    writeJsonFile(path.join(DATA_DIR, 'strips'), fixRefPaths({
      ...remapStripReferences(s, idMap),
      id: newId,
      projectId: newProjectId,
    }));
  });

  const newProject = fixProjectBalloonPaths({
    ...bundle.project,
    id: newProjectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  writeJsonFile(path.join(DATA_DIR, 'projects'), newProject);
  backup.markDirty();
  return newProject;
});

// --- IPC: Save SVG layout reference ---
ipcMain.handle('references:save-svg', async (_, { fileName, svgContent }) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'references', fileName);
  fs.writeFileSync(filePath, svgContent, 'utf-8');
  backup.markDirty();
  return { fileName, path: filePath };
});

// --- IPC: Save exported image to an arbitrary path chosen by the user ---
ipcMain.handle('export:save', async (_, { filePath, data }) => {
  if (!filePath) return { ok: false };
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return { ok: true, filePath };
});

// --- IPC: Save binary file (JPG) to references ---
ipcMain.handle('references:save-file', async (_, { fileName, data }) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'references', fileName);
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(filePath, buffer);
  backup.markDirty();
  return { fileName, path: filePath };
});

// --- IPC: Open external URL (popups/links del chat embarcado) ---
ipcMain.handle('chat:open-external', async (_, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) shell.openExternal(url)
  return true;
});

// --- IPC: Write text to clipboard ---
ipcMain.handle('clipboard:write', async (_, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

// --- IPC: Write image (base64) to clipboard ---
ipcMain.handle('clipboard:write-image', async (_, data) => {
  if (!data) return false;
  const image = nativeImage.createFromBuffer(Buffer.from(data, 'base64'));
  if (image.isEmpty()) return false;
  clipboard.writeImage(image);
  return true;
});

// --- IPC: Paste image from clipboard to references ---
ipcMain.handle('references:paste', async (_, { fileName }) => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  ensureDataDirs();
  const base = String(fileName || 'pegado').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'pegado';
  const safeName = base.endsWith('.png') ? base : `${base}.png`;
  const filePath = path.join(DATA_DIR, 'references', safeName);
  fs.writeFileSync(filePath, image.toPNG());
  backup.markDirty();
  return { fileName: safeName, path: filePath };
});

// --- IPC: Native file drag for reference images ---
ipcMain.on('references:startDrag', (event, filePath) => {
  let resolved = filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    if (filePath) {
      const candidate = path.join(DATA_DIR, 'references', path.basename(filePath));
      if (fs.existsSync(candidate)) resolved = candidate;
    }
  }
  if (resolved && fs.existsSync(resolved)) {
    event.sender.startDrag({
      file: resolved,
      icon: nativeImage.createFromPath(resolved),
    });
  }
});
