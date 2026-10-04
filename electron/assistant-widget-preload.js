const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assistantAPI', {
  getState: () => ipcRenderer.invoke('assistant:get-state'),
  getTheme: () => ipcRenderer.invoke('assistant:get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('assistant:set-theme', theme),
  onThemeChange: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('assistant:theme-changed', listener);
    return () => ipcRenderer.removeListener('assistant:theme-changed', listener);
  },
  setEnabled: (enabled) => ipcRenderer.invoke('assistant:set-enabled', Boolean(enabled)),
  openPanel: () => ipcRenderer.invoke('assistant:open-panel'),
  collapsePanel: () => ipcRenderer.invoke('assistant:collapse-panel'),
  pointerDown: () => ipcRenderer.send('assistant:pointer-down'),
  beginWidgetDrag: () => ipcRenderer.send('assistant:drag-start'),
  moveWidget: () => ipcRenderer.send('assistant:drag-move'),
  endWidgetDrag: (moved) => ipcRenderer.send('assistant:drag-end', Boolean(moved)),
  onWidgetDragFinished: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, moved) => callback(Boolean(moved));
    ipcRenderer.on('assistant:drag-finished', listener);
    return () => ipcRenderer.removeListener('assistant:drag-finished', listener);
  },
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
