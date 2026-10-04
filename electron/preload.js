const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbConnect: (config) => ipcRenderer.invoke('db-connect', config),
  dbQuery:   (query, params) => ipcRenderer.invoke('db-query', query, params),
  dbStatus:  () => ipcRenderer.invoke('db-status'),
  dbGetPath: () => ipcRenderer.invoke('db-get-path'),
  uiReady: () => ipcRenderer.send('lexforge-ui-ready'),
  openAssistant: () => ipcRenderer.invoke('assistant:show-from-main'),
  getTheme: () => ipcRenderer.invoke('assistant:get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('assistant:set-theme', theme),
  onThemeChange: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('assistant:theme-changed', listener);
    return () => ipcRenderer.removeListener('assistant:theme-changed', listener);
  },
  getVersion: () => process.env.npm_package_version || '1.0.0',
  platform: process.platform,
});
