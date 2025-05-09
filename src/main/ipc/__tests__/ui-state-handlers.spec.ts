import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { IPCChannels, WindowState, UiStatePayload } from '../../../shared/types/ipc';

// Mock Electron
const mockBrowserWindowInstance = {
  setBounds: jest.fn(),
  maximize: jest.fn(),
  unmaximize: jest.fn(),
  isMaximized: jest.fn(() => false),
  isMinimized: jest.fn(() => false),
  // Add other BrowserWindow methods if ui-state-handlers uses them
};
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(), // For SET_WINDOW_STATE
  },
  BrowserWindow: {
    fromWebContents: jest.fn(() => mockBrowserWindowInstance),
  },
}));

// Mock electron-store
const mockStoreInstance = {
  get: jest.fn(),
  set: jest.fn(),
  // Add other Store methods if used
};
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStoreInstance);
});

// Mock Logger
jest.mock('../../services/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Import the module that registers handlers. This MUST be AFTER the mocks.
import '../ui-state-handlers';

describe('UI State IPC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear ipcMain mock calls specifically
    (ipcMain.handle as jest.Mock).mockClear();
    (ipcMain.on as jest.Mock).mockClear();
    (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(mockBrowserWindowInstance); // Reset to default mock
  });

  describe(IPCChannels.GET_UI_STATE, () => {
    const defaultBounds = { width: 1200, height: 800, x: undefined, y: undefined };
    const defaultIsMaximized = false;

    it('should retrieve UI state from store and return it', async () => {
      const storedBounds: WindowState = { width: 1024, height: 768, x: 10, y: 20, isMaximized: false, isFullScreen: false };
      const storedIsMaximized = true;
      mockStoreInstance.get.mockImplementation((key: string) => {
        if (key === 'windowBounds') return storedBounds;
        if (key === 'isMaximized') return storedIsMaximized;
        return undefined;
      });

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.GET_UI_STATE);
      expect(handlerCall).toBeDefined();
      const handler = handlerCall[1];

      const mockEvent = { sender: {} }; // Mock IpcMainEvent
      const result = await handler(mockEvent);

      expect(mockStoreInstance.get).toHaveBeenCalledWith('windowBounds');
      expect(mockStoreInstance.get).toHaveBeenCalledWith('isMaximized');
      expect(result).toEqual({
        windowBounds: storedBounds,
        isMaximized: storedIsMaximized,
      });
    });

    it('should return null if BrowserWindow.fromWebContents returns null', async () => {
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.GET_UI_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };
      const result = await handler(mockEvent);
      expect(result).toBeNull();
    });

    it('should handle errors during state retrieval and re-throw', async () => {
      const errorMessage = 'Store access failed';
      mockStoreInstance.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.GET_UI_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };
      await expect(handler(mockEvent)).rejects.toThrow(errorMessage);
    });
  });

  describe(IPCChannels.UPDATE_UI_STATE, () => {
    it('should update windowBounds in store and apply to window if not maximized/minimized', async () => {
      const payload: UiStatePayload = {
        windowBounds: { width: 800, height: 600, x: 50, y: 50 },
      };
      mockBrowserWindowInstance.isMaximized.mockReturnValue(false);
      mockBrowserWindowInstance.isMinimized.mockReturnValue(false);

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.UPDATE_UI_STATE);
      expect(handlerCall).toBeDefined();
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      const result = await handler(mockEvent, payload);

      expect(mockStoreInstance.set).toHaveBeenCalledWith('windowBounds', payload.windowBounds);
      expect(mockBrowserWindowInstance.setBounds).toHaveBeenCalledWith(payload.windowBounds);
      expect(result).toEqual({ success: true });
    });

    it('should update isMaximized in store and maximize window', async () => {
      const payload: UiStatePayload = { isMaximized: true };
      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.UPDATE_UI_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      const result = await handler(mockEvent, payload);

      expect(mockStoreInstance.set).toHaveBeenCalledWith('isMaximized', true);
      expect(mockBrowserWindowInstance.maximize).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should update isMaximized to false, unmaximize window, and restore bounds', async () => {
      const payload: UiStatePayload = { isMaximized: false };
      const storedBounds: WindowState = { width: 900, height: 700, x: 0, y: 0, isMaximized: false, isFullScreen: false };
      mockStoreInstance.get.mockReturnValue(storedBounds); // For restoring bounds

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.UPDATE_UI_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      const result = await handler(mockEvent, payload);

      expect(mockStoreInstance.set).toHaveBeenCalledWith('isMaximized', false);
      expect(mockStoreInstance.get).toHaveBeenCalledWith('windowBounds');
      expect(mockBrowserWindowInstance.setBounds).toHaveBeenCalledWith(storedBounds);
      expect(result).toEqual({ success: true });
    });

     it('should handle errors during state update and return error object', async () => {
      const payload: UiStatePayload = { isMaximized: true };
      const errorMessage = 'Failed to set store value';
      mockStoreInstance.set.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.UPDATE_UI_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      const result = await handler(mockEvent, payload);
      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe(IPCChannels.SET_WINDOW_STATE, () => {
    it('should maximize window if state.isMaximized is true', () => {
      const state: Partial<WindowState> = { isMaximized: true };
      const handlerCall = (ipcMain.on as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.SET_WINDOW_STATE);
      expect(handlerCall).toBeDefined();
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      handler(mockEvent, state);
      expect(mockBrowserWindowInstance.maximize).toHaveBeenCalled();
    });

    it('should unmaximize window if state.isMaximized is false', () => {
      const state: Partial<WindowState> = { isMaximized: false };
      const handlerCall = (ipcMain.on as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.SET_WINDOW_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      handler(mockEvent, state);
      expect(mockBrowserWindowInstance.unmaximize).toHaveBeenCalled();
    });

    it('should do nothing if BrowserWindow.fromWebContents returns null', () => {
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
      const state: Partial<WindowState> = { isMaximized: true };
      const handlerCall = (ipcMain.on as jest.Mock).mock.calls.find(call => call[0] === IPCChannels.SET_WINDOW_STATE);
      const handler = handlerCall[1];
      const mockEvent = { sender: {} };

      handler(mockEvent, state);
      expect(mockBrowserWindowInstance.maximize).not.toHaveBeenCalled();
      expect(mockBrowserWindowInstance.unmaximize).not.toHaveBeenCalled();
    });
  });
});