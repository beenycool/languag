import { ipcMain } from 'electron';
// Import IPCChannels from the correct path and with the correct name
import { IPCChannels } from '../../../shared/types/ipc';

// Mock Electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => 'mock/user/data/path'), // Mock app.getPath if ConfigManager instantiation needs it
  }
}));

// Mock Logger
jest.mock('../../services/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock ConfigManager instance (configManager)
const mockConfigManagerInstance = {
  get: jest.fn(),
  set: jest.fn(),
  save: jest.fn(),
  // Add any other methods of ConfigurationManager that settings-handlers.ts might call
};
jest.mock('../../services/config-manager', () => ({
  configManager: mockConfigManagerInstance,
  // ConfigurationManager class itself is not directly used by settings-handlers.ts
}));

// Import the module that registers handlers. This MUST be AFTER the mocks.
// This will execute the code in settings-handlers.ts, registering the handlers.
import '../settings-handlers';

describe('Settings IPC Handlers', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // ipcMain.handle should be cleared if it's not reset by jest.clearAllMocks() on its own mock.calls
    (ipcMain.handle as jest.Mock).mockClear();

    // Re-import or re-trigger handler registration if necessary,
    // but since it's top-level in settings-handlers.ts,
    // we need to ensure the mocks are set correctly *before* the initial import.
    // For these tests, we'll rely on finding the initially registered handlers.
    // If settings-handlers.ts was a function, we'd call it here.
    // Since it's not, we need to ensure the module is re-evaluated if we want fresh registrations for each test,
    // or ensure our tests can find the correct handler from the single registration.
    // The current approach of finding the handler from mock.calls should work if ipcMain.handle is cleared.

    // To ensure handlers are "re-registered" with fresh mocks for each test,
    // we might need to use jest.resetModules() and re-import.
    // For now, let's assume finding the handler from the initial registration is sufficient
    // if we clear mock calls on ipcMain.handle and the mocked configManagerInstance.
  });

  describe(IPCChannels.GET_SETTINGS, () => {
    it('should retrieve all settings from configManager when no key is provided and return them', async () => {
      const mockSettings = { theme: 'dark', fontSize: 14 };
      mockConfigManagerInstance.get.mockReturnValue(mockSettings);

      // Find the handler registered for GET_SETTINGS
      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPCChannels.GET_SETTINGS
      );
      expect(handlerCall).toBeDefined();
      const handler = handlerCall[1];

      const result = await handler({}, undefined); // No key provided
      expect(mockConfigManagerInstance.get).toHaveBeenCalledWith('/'); // As per settings-handlers.ts logic
      expect(result).toEqual(mockSettings);
    });

    it('should retrieve a specific setting from configManager if a key is provided', async () => {
      const mockThemeSetting = 'dark_theme';
      mockConfigManagerInstance.get.mockReturnValue(mockThemeSetting);

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPCChannels.GET_SETTINGS
      );
      const handler = handlerCall[1];

      const result = await handler({}, 'theme');
      expect(mockConfigManagerInstance.get).toHaveBeenCalledWith('theme');
      expect(result).toBe(mockThemeSetting);
    });

    it('should handle errors when configManager.get fails and re-throw the error', async () => {
      const errorMessage = 'Failed to get settings';
      mockConfigManagerInstance.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPCChannels.GET_SETTINGS
      );
      const handler = handlerCall[1];

      await expect(handler({}, 'theme')).rejects.toThrow(errorMessage);
    });
  });

  describe(IPCChannels.UPDATE_SETTINGS, () => {
    it('should save settings using configManager and return success', async () => {
      const settingsToSet = { theme: 'light', fontSize: 12 };
      // set is synchronous, save is asynchronous
      mockConfigManagerInstance.set.mockReturnValue(undefined);
      mockConfigManagerInstance.save.mockResolvedValue(undefined);

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPCChannels.UPDATE_SETTINGS
      );
      expect(handlerCall).toBeDefined();
      const handler = handlerCall[1];

      const result = await handler({}, settingsToSet);

      expect(mockConfigManagerInstance.set).toHaveBeenCalledWith('theme', 'light');
      expect(mockConfigManagerInstance.set).toHaveBeenCalledWith('fontSize', 12);
      expect(mockConfigManagerInstance.set).toHaveBeenCalledTimes(Object.keys(settingsToSet).length);
      expect(mockConfigManagerInstance.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('should handle errors if configManager.set fails and return error object', async () => {
      const settingsToSet = { theme: 'light' };
      const errorMessage = 'Failed to set setting';
      mockConfigManagerInstance.set.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call) => call[0] === IPCChannels.UPDATE_SETTINGS
      );
      const handler = handlerCall[1];

      const result = await handler({}, settingsToSet);
      expect(mockConfigManagerInstance.set).toHaveBeenCalledWith('theme', 'light');
      expect(mockConfigManagerInstance.save).not.toHaveBeenCalled(); // Save should not be called if set fails
      expect(result).toEqual({ success: false, error: errorMessage });
    });

    it('should handle errors if configManager.save fails and return error object', async () => {
        const settingsToSet = { theme: 'light' };
        const errorMessage = 'Failed to save settings';
        mockConfigManagerInstance.set.mockReturnValue(undefined); // set succeeds
        mockConfigManagerInstance.save.mockRejectedValue(new Error(errorMessage)); // save fails

        const handlerCall = (ipcMain.handle as jest.Mock).mock.calls.find(
            (call) => call[0] === IPCChannels.UPDATE_SETTINGS
        );
        const handler = handlerCall[1];

        const result = await handler({}, settingsToSet);
        expect(mockConfigManagerInstance.set).toHaveBeenCalledWith('theme', 'light');
        expect(mockConfigManagerInstance.save).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ success: false, error: errorMessage });
    });
  });
});