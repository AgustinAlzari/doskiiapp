const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  characters: {
    list: () => ipcRenderer.invoke('characters:list'),
    save: (c) => ipcRenderer.invoke('characters:save', c),
    delete: (id) => ipcRenderer.invoke('characters:delete', id),
  },
  strips: {
    list: () => ipcRenderer.invoke('strips:list'),
    save: (s) => ipcRenderer.invoke('strips:save', s),
    delete: (id) => ipcRenderer.invoke('strips:delete', id),
  },
  backgrounds: {
    list: () => ipcRenderer.invoke('backgrounds:list'),
    save: (b) => ipcRenderer.invoke('backgrounds:save', b),
    delete: (id) => ipcRenderer.invoke('backgrounds:delete', id),
  },
  objects: {
    list: () => ipcRenderer.invoke('objects:list'),
    save: (o) => ipcRenderer.invoke('objects:save', o),
    delete: (id) => ipcRenderer.invoke('objects:delete', id),
  },
  balloons: {
    list: () => ipcRenderer.invoke('balloons:list'),
    save: (b) => ipcRenderer.invoke('balloons:save', b),
    delete: (id) => ipcRenderer.invoke('balloons:delete', id),
  },
  palettes: {
    list: () => ipcRenderer.invoke('palettes:list'),
    save: (p) => ipcRenderer.invoke('palettes:save', p),
    delete: (id) => ipcRenderer.invoke('palettes:delete', id),
  },
  authors: {
    list: () => ipcRenderer.invoke('authors:list'),
    save: (a) => ipcRenderer.invoke('authors:save', a),
    delete: (id) => ipcRenderer.invoke('authors:delete', id),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    save: (p) => ipcRenderer.invoke('projects:save', p),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
    deleteAll: (id) => ipcRenderer.invoke('projects:deleteAll', id),
    duplicate: (id) => ipcRenderer.invoke('projects:duplicate', id),
    export: (data) => ipcRenderer.invoke('projects:export', data),
    import: (filePath) => ipcRenderer.invoke('projects:import', filePath),
  },
  dialog: {
    save: (opts) => ipcRenderer.invoke('dialog:save', opts),
    open: (opts) => ipcRenderer.invoke('dialog:open', opts),
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text),
    writeImage: (data) => ipcRenderer.invoke('clipboard:write-image', data),
    readImage: () => ipcRenderer.invoke('clipboard:read-image'),
  },
  references: {
    choose: () => ipcRenderer.invoke('references:choose'),
    import: (data) => ipcRenderer.invoke('references:import', data),
    read: (filePath) => ipcRenderer.invoke('references:read', filePath),
    openFolder: () => ipcRenderer.invoke('references:open-folder'),
    openUsedFolder: (fileNames) => ipcRenderer.invoke('references:open-used-folder', fileNames),
    saveSvg: (data) => ipcRenderer.invoke('references:save-svg', data),
    saveFile: (data) => ipcRenderer.invoke('references:save-file', data),
    paste: (data) => ipcRenderer.invoke('references:paste', data),
    startDrag: (filePath) => ipcRenderer.send('references:startDrag', filePath),
  },
  export: {
    save: (data) => ipcRenderer.invoke('export:save', data),
  },
  chat: {
    openExternal: (url) => ipcRenderer.invoke('chat:open-external', url),
  },
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    syncNow: () => ipcRenderer.invoke('backup:sync-now'),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status)
      ipcRenderer.on('backup:status-changed', listener)
      return () => ipcRenderer.removeListener('backup:status-changed', listener)
    },
  },
});
