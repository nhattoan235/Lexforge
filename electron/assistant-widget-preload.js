const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assistantAPI', {
  getState: () => ipcRenderer.invoke('assistant:get-state'),
  setEnabled: (enabled) => ipcRenderer.invoke('assistant:set-enabled', Boolean(enabled)),
  openPanel: () => ipcRenderer.invoke('assistant:open-panel'),
  collapsePanel: () => ipcRenderer.invoke('assistant:collapse-panel'),
  beginWidgetDrag: () => ipcRenderer.send('assistant:drag-start'),
  moveWidget: () => ipcRenderer.send('assistant:drag-move'),
  endWidgetDrag: (moved) => ipcRenderer.send('assistant:drag-end', Boolean(moved)),
  openMain: () => ipcRenderer.invoke('assistant:open-main'),
  quit: () => ipcRenderer.invoke('assistant:quit'),
  runWritingTask: (input) => ipcRenderer.invoke('assistant:run-writing-task', input),
  copyText: (text) => ipcRenderer.invoke('assistant:copy-text', text),
  onStateChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('assistant:state-changed', listener);
    return () => ipcRenderer.removeListener('assistant:state-changed', listener);
  },
});
