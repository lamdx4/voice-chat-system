import { contextBridge, ipcRenderer } from 'electron';

// Expose electron-store API and notification methods
contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear'),
    has: (key: string) => ipcRenderer.invoke('store:has', key),
  },
  // Notification and window control
  notifyIncomingCall: (callerName: string, callType: 'direct' | 'group') => 
    ipcRenderer.send('incoming-call', { callerName, callType }),
  showWindow: () => ipcRenderer.send('show-window'),
  getScreenSources: (opts: any) => ipcRenderer.invoke('desktop-capturer-get-sources', opts),
});

// You can also expose Node.js APIs here if needed
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});
