const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectionPreviewAPI', {
  getTheme: () => ipcRenderer.invoke('assistant:get-theme'),
  onThemeChange: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('assistant:theme-changed', listener);
    return () => ipcRenderer.removeListener('assistant:theme-changed', listener);
  },
  onTranslation: (callback) => {
    ipcRenderer.on('assistant:quick-translation', (_event, payload) => callback(payload));
  },
  reportHeight: (height, version) => ipcRenderer.send('assistant:quick-preview-height', height, version),
});
