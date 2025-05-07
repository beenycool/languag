import { contextBridge, ipcRenderer } from 'electron';

// Add any APIs you want to expose to the renderer process here
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: any) => {
    // whitelist channels
    const validChannels = ['ping'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = ['pong'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});

console.log('Preload script loaded.');