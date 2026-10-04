const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('writingPopupAPI', {
  getTheme: () => ipcRenderer.invoke('assistant:get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('assistant:set-theme', theme),
  onThemeChange: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('assistant:theme-changed', listener);
    return () => ipcRenderer.removeListener('assistant:theme-changed', listener);
  },
  onSuggestion: (callback) => ipcRenderer.on('assistant:writing-suggestion', (_event, value) => callback(value)),
  reportHeight: (height, revision) => ipcRenderer.send('assistant:writing-popup-height', height, revision),
  beginDrag: () => ipcRenderer.send('assistant:writing-drag-start'),
  moveDrag: () => ipcRenderer.send('assistant:writing-drag-move'),
  endDrag: () => ipcRenderer.send('assistant:writing-drag-end'),
  dismiss: (revision) => ipcRenderer.invoke('assistant:writing-dismiss', revision),
  translate: (revision, text) => ipcRenderer.invoke('assistant:writing-translate', revision, text),
  apply: (revision, mode, text) => ipcRenderer.invoke('assistant:writing-apply', revision, mode, text),
});
