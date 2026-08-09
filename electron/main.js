const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const isDev = !app.isPackaged;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '@doski',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// --- Data directory ---
const DATA_DIR = path.join(app.getPath('appData'), 'dibuweb', 'data');
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function ensureDataDirs() {
  ensureDir(DATA_DIR);
  ensureDir(path.join(DATA_DIR, 'projects'));
  ensureDir(path.join(DATA_DIR, 'characters'));
  ensureDir(path.join(DATA_DIR, 'strips'));
  ensureDir(path.join(DATA_DIR, 'backgrounds'));
  ensureDir(path.join(DATA_DIR, 'objects'));
  ensureDir(path.join(DATA_DIR, 'balloons'));
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
  return { fileName, path: destination };
});

ipcMain.handle('references:read', async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
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
  return character;
});

ipcMain.handle('characters:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'characters', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
  return strip;
});

ipcMain.handle('strips:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'strips', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
  return background;
});

ipcMain.handle('backgrounds:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'backgrounds', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
  return object;
});

ipcMain.handle('objects:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'objects', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
  return balloon;
});

ipcMain.handle('balloons:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'balloons', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

// --- IPC: Projects ---
ipcMain.handle('projects:list', async () => {
  ensureDataDirs();
  return readJsonDir(path.join(DATA_DIR, 'projects'));
});

ipcMain.handle('projects:save', async (_, project) => {
  ensureDataDirs();
  writeJsonFile(path.join(DATA_DIR, 'projects'), project);
  return project;
});

ipcMain.handle('projects:delete', async (_, id) => {
  const filePath = path.join(DATA_DIR, 'projects', `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle('projects:deleteAll', async (_, projectId) => {
  const deleteOwned = (dir) => {
    readJsonDir(dir).filter(e => e.projectId === projectId).forEach(e => {
      const p = path.join(dir, `${e.id}.json`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  };
  deleteOwned(path.join(DATA_DIR, 'characters'));
  deleteOwned(path.join(DATA_DIR, 'backgrounds'));
  deleteOwned(path.join(DATA_DIR, 'objects'));
  deleteOwned(path.join(DATA_DIR, 'balloons'));
  deleteOwned(path.join(DATA_DIR, 'strips'));
  const p = path.join(DATA_DIR, 'projects', `${projectId}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
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
  return newProject;
});

// --- IPC: Save SVG layout reference ---
ipcMain.handle('references:save-svg', async (_, { fileName, svgContent }) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'references', fileName);
  fs.writeFileSync(filePath, svgContent, 'utf-8');
  return { fileName, path: filePath };
});

// --- IPC: Save binary file (JPG) to references ---
ipcMain.handle('references:save-file', async (_, { fileName, data }) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'references', fileName);
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(filePath, buffer);
  return { fileName, path: filePath };
});

// --- IPC: Native file drag for reference images ---
ipcMain.on('references:startDrag', (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    event.sender.startDrag({
      file: filePath,
      icon: nativeImage.createFromPath(filePath),
    });
  }
});
