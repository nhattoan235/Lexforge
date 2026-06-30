const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbConnect: (config) => ipcRenderer.invoke('db-connect', config),
  dbQuery:   (query, params) => ipcRenderer.invoke('db-query', query, params),
  dbStatus:  () => ipcRenderer.invoke('db-status'),
  dbGetPath: () => ipcRenderer.invoke('db-get-path'),
  getVersion: () => process.env.npm_package_version || '1.0.0',
  platform: process.platform,
});
