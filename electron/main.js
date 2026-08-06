const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
let promptWindow;
let pendingPromptData = null;

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
  ensureDir(path.join(DATA_DIR, 'characters'));
  ensureDir(path.join(DATA_DIR, 'strips'));
  ensureDir(path.join(DATA_DIR, 'backgrounds'));
  ensureDir(path.join(DATA_DIR, 'objects'));
  ensureDir(path.join(DATA_DIR, 'references'));
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

// --- IPC: Save SVG layout reference ---
ipcMain.handle('references:save-svg', async (_, { fileName, svgContent }) => {
  ensureDataDirs();
  const filePath = path.join(DATA_DIR, 'references', fileName);
  fs.writeFileSync(filePath, svgContent, 'utf-8');
  return { fileName, path: filePath };
});

// --- IPC: Prompts window ---
ipcMain.handle('prompts:open', async (_, { strip, characters }) => {
  if (promptWindow && !promptWindow.isDestroyed()) {
    promptWindow.focus();
    return;
  }
  pendingPromptData = { strip, characters };
  const baseUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
  promptWindow = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 500,
    minHeight: 400,
    title: 'prompts',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
  });
  promptWindow.loadURL(baseUrl + '?view=prompts');
  promptWindow.on('closed', () => { promptWindow = null; pendingPromptData = null; });
});

ipcMain.handle('prompts:getData', async () => {
  return pendingPromptData;
});
