import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPCChannels, UiStatePayload, WindowState } from './shared/types/ipc'; // Adjust path as necessary

export interface ElectronAPI {
  // Settings
  getSettings: <T>(key?: string) => Promise<T>;
  updateSettings: (settings: { [key: string]: any }) => Promise<{ success: boolean; error?: string }>;
  onSettingsChanged: (callback: (settings: any) => void) => () => void; // Returns a cleanup function

  // UI State
  getUiState: () => Promise<UiStatePayload | null>;
  updateUiState: (payload: UiStatePayload) => Promise<{ success: boolean; error?: string }>;
  onWindowStateChange: (callback: (event: any) => void) => () => void; // Returns a cleanup function

  // Example Ping/Pong (can be removed if not needed)
  sendPing: () => void;
  onPong: (callback: (message: string) => void) => () => void;
}

const exposedAPI: ElectronAPI = {
  // Settings
  getSettings: <T>(key?: string): Promise<T> => ipcRenderer.invoke(IPCChannels.GET_SETTINGS, key),
  updateSettings: (settings: { [key: string]: any }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPCChannels.UPDATE_SETTINGS, settings),
  onSettingsChanged: (callback: (settings: any) => void) => {
    const handler = (_event: IpcRendererEvent, settings: any) => callback(settings);
    ipcRenderer.on(IPCChannels.SETTINGS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPCChannels.SETTINGS_CHANGED, handler);
    };
  },

  // UI State
  getUiState: (): Promise<UiStatePayload | null> => ipcRenderer.invoke(IPCChannels.GET_UI_STATE),
  updateUiState: (payload: UiStatePayload): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPCChannels.UPDATE_UI_STATE, payload),
  onWindowStateChange: (callback: (event: any) => void) => {
    const handler = (_event: IpcRendererEvent, eventData: any) => callback(eventData);
    ipcRenderer.on(IPCChannels.WINDOW_STATE_CHANGE, handler);
    return () => {
      ipcRenderer.removeListener(IPCChannels.WINDOW_STATE_CHANGE, handler);
    };
  },

  // Example Ping/Pong
  sendPing: () => ipcRenderer.send('ping'),
  onPong: (callback: (message: string) => void) => {
    const handler = (_event: IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('pong', handler);
    return () => {
      ipcRenderer.removeListener('pong', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', exposedAPI);

console.log('Preload script loaded and electronAPI exposed.');