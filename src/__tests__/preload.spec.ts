import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannels, UiStatePayload } from '../shared/types/ipc'; // Adjust path if necessary
// Import the interface for type checking, though the actual API is on window
import type { ElectronAPI } from '../preload';


// --- Mocks ---
const mockIpcRendererInvoke = jest.fn();
const mockIpcRendererOn = jest.fn();
const mockIpcRendererSend = jest.fn();
const mockIpcRendererRemoveListener = jest.fn();

// Mock Electron's contextBridge and ipcRenderer
jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    invoke: mockIpcRendererInvoke,
    on: mockIpcRendererOn,
    send: mockIpcRendererSend,
    removeListener: mockIpcRendererRemoveListener,
  },
}));

// --- Test Suite ---
describe('Preload Script (preload.ts)', () => {
  let exposedApi: ElectronAPI;

  beforeAll(() => {
    // Load the preload script. This will call contextBridge.exposeInMainWorld.
    // We need to capture the exposed API.
    require('../preload'); // Assuming preload.ts is in src/

    // Capture the arguments to exposeInMainWorld
    const [apiKey, apiObject] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0];
    expect(apiKey).toBe('electronAPI');
    exposedApi = apiObject as ElectronAPI;
  });

  beforeEach(() => {
    // Clear all mock function calls before each test
    jest.clearAllMocks();
  });

  describe('API Exposure', () => {
    it('should expose "electronAPI" to the main world', () => {
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object));
    });

    it('should have all expected methods on the exposed API', () => {
      expect(exposedApi.getSettings).toBeInstanceOf(Function);
      expect(exposedApi.updateSettings).toBeInstanceOf(Function);
      expect(exposedApi.onSettingsChanged).toBeInstanceOf(Function);
      expect(exposedApi.getUiState).toBeInstanceOf(Function);
      expect(exposedApi.updateUiState).toBeInstanceOf(Function);
      expect(exposedApi.onWindowStateChange).toBeInstanceOf(Function);
      expect(exposedApi.sendPing).toBeInstanceOf(Function);
      expect(exposedApi.onPong).toBeInstanceOf(Function);
    });
  });

  describe('Settings API', () => {
    it('getSettings should invoke IPCChannels.GET_SETTINGS', async () => {
      const mockReturnValue = { theme: 'dark' };
      mockIpcRendererInvoke.mockResolvedValue(mockReturnValue);
      const result = await exposedApi.getSettings('theme');
      expect(mockIpcRendererInvoke).toHaveBeenCalledWith(IPCChannels.GET_SETTINGS, 'theme');
      expect(result).toEqual(mockReturnValue);
    });

    it('updateSettings should invoke IPCChannels.UPDATE_SETTINGS', async () => {
      const settings = { theme: 'light' };
      const mockReturnValue = { success: true };
      mockIpcRendererInvoke.mockResolvedValue(mockReturnValue);
      const result = await exposedApi.updateSettings(settings);
      expect(mockIpcRendererInvoke).toHaveBeenCalledWith(IPCChannels.UPDATE_SETTINGS, settings);
      expect(result).toEqual(mockReturnValue);
    });

    it('onSettingsChanged should register and unregister listener for IPCChannels.SETTINGS_CHANGED', () => {
      const callback = jest.fn();
      const cleanup = exposedApi.onSettingsChanged(callback);

      expect(mockIpcRendererOn).toHaveBeenCalledWith(IPCChannels.SETTINGS_CHANGED, expect.any(Function));
      
      // Simulate an IPC event
      const handler = mockIpcRendererOn.mock.calls.find(call => call[0] === IPCChannels.SETTINGS_CHANGED)[1];
      const mockEventData = { newSetting: 'value' };
      handler({}, mockEventData); // First arg is event, second is data
      expect(callback).toHaveBeenCalledWith(mockEventData);

      cleanup();
      expect(mockIpcRendererRemoveListener).toHaveBeenCalledWith(IPCChannels.SETTINGS_CHANGED, handler);
    });
  });

  describe('UI State API', () => {
    it('getUiState should invoke IPCChannels.GET_UI_STATE', async () => {
      const mockUiState: UiStatePayload = { windowBounds: { width: 800, height: 600, x:0, y:0 }, isMaximized: false };
      mockIpcRendererInvoke.mockResolvedValue(mockUiState);
      const result = await exposedApi.getUiState();
      expect(mockIpcRendererInvoke).toHaveBeenCalledWith(IPCChannels.GET_UI_STATE);
      expect(result).toEqual(mockUiState);
    });

    it('updateUiState should invoke IPCChannels.UPDATE_UI_STATE', async () => {
      const payload: UiStatePayload = { isMaximized: true };
      const mockReturnValue = { success: true };
      mockIpcRendererInvoke.mockResolvedValue(mockReturnValue);
      const result = await exposedApi.updateUiState(payload);
      expect(mockIpcRendererInvoke).toHaveBeenCalledWith(IPCChannels.UPDATE_UI_STATE, payload);
      expect(result).toEqual(mockReturnValue);
    });

    it('onWindowStateChange should register and unregister listener for IPCChannels.WINDOW_STATE_CHANGE', () => {
      const callback = jest.fn();
      const cleanup = exposedApi.onWindowStateChange(callback);
      expect(mockIpcRendererOn).toHaveBeenCalledWith(IPCChannels.WINDOW_STATE_CHANGE, expect.any(Function));
      
      const handler = mockIpcRendererOn.mock.calls.find(call => call[0] === IPCChannels.WINDOW_STATE_CHANGE)[1];
      const mockEventData = { type: 'maximized' };
      handler({}, mockEventData);
      expect(callback).toHaveBeenCalledWith(mockEventData);

      cleanup();
      expect(mockIpcRendererRemoveListener).toHaveBeenCalledWith(IPCChannels.WINDOW_STATE_CHANGE, handler);
    });
  });

  describe('Ping/Pong API', () => {
    it('sendPing should send "ping" message', () => {
      exposedApi.sendPing();
      expect(mockIpcRendererSend).toHaveBeenCalledWith('ping');
    });

    it('onPong should register and unregister listener for "pong"', () => {
      const callback = jest.fn();
      const cleanup = exposedApi.onPong(callback);
      expect(mockIpcRendererOn).toHaveBeenCalledWith('pong', expect.any(Function));

      const handler = mockIpcRendererOn.mock.calls.find(call => call[0] === 'pong')[1];
      const mockMessage = 'hello from main';
      handler({}, mockMessage);
      expect(callback).toHaveBeenCalledWith(mockMessage);
      
      cleanup();
      expect(mockIpcRendererRemoveListener).toHaveBeenCalledWith('pong', handler);
    });
  });

  describe('Security Constraints', () => {
    it('should not expose unintended Electron or Node.js modules', () => {
      // This is a conceptual test. In a real preload script, you ensure only `exposedApi` is bridged.
      // `contextBridge` itself is designed for this.
      // We can check that no other keys were added to `window` by our script,
      // though Jest's environment might not perfectly mimic a browser's `window`.
      // The primary check is that `exposeInMainWorld` was called with the correct API key and object.
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1); // Only our API
    });

    it('ipcRenderer methods should not be directly exposed', () => {
        // Verify that the raw ipcRenderer is not part of the exposedApi
        expect((exposedApi as any).invoke).toBeUndefined();
        expect((exposedApi as any).send).toBeUndefined();
        expect((exposedApi as any).on).toBeUndefined();
    });
  });
});