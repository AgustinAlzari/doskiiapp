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
  dialog: {
    save: (opts) => ipcRenderer.invoke('dialog:save', opts),
  },
  references: {
    choose: () => ipcRenderer.invoke('references:choose'),
    import: (data) => ipcRenderer.invoke('references:import', data),
    read: (filePath) => ipcRenderer.invoke('references:read', filePath),
    openFolder: () => ipcRenderer.invoke('references:open-folder'),
    saveSvg: (data) => ipcRenderer.invoke('references:save-svg', data),
  },
  prompts: {
    open: (data) => ipcRenderer.invoke('prompts:open', data),
    getData: () => ipcRenderer.invoke('prompts:getData'),
  },
});
