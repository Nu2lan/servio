import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Examples of secure IPC channels
    // sendMessage: (msg: string) => ipcRenderer.send('message', msg),
    // onReply: (callback: (args: any) => void) => ipcRenderer.on('reply', (_event, value) => callback(value))
});
