const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectionPreviewAPI', {
  onTranslation: (callback) => {
    ipcRenderer.on('assistant:quick-translation', (_event, payload) => callback(payload));
  },
  reportHeight: (height, version) => ipcRenderer.send('assistant:quick-preview-height', height, version),
});
