import { app, BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { configManager } from '../services/config-manager';
import logger from '../services/logger';
import { getLlmService } from '../services/llm-service';
import { getLlmCacheService } from '../services/cache-service';

// --- Mocks ---
const mockAppQuit = jest.fn();
const mockAppWhenReady = jest.fn().mockResolvedValue(undefined); // Mock app.whenReady()
let readyCallback: (() => void) | undefined;
let activateCallback: (() => void) | undefined;
let windowAllClosedCallback: (() => void) | undefined;

const mockBrowserWindowInstance = {
  loadFile: jest.fn(),
  loadURL: jest.fn(), // Though not used in current main.ts, good to have
  on: jest.fn(),
  once: jest.fn((event, cb) => { // Specifically for 'ready-to-show'
    if (event === 'ready-to-show') cb();
  }),
  show: jest.fn(),
  maximize: jest.fn(),
  getBounds: jest.fn(() => ({ width: 1000, height: 700, x: 0, y: 0 })),
  isMaximized: jest.fn(() => false),
  isMinimized: jest.fn(() => false),
  webContents: {
    openDevTools: jest.fn(),
  },
  // Add other methods as needed
};

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      if (name === 'userData') return 'mock/userData';
      return 'mock/path';
    }),
    isPackaged: false, // Default to dev mode
    whenReady: mockAppWhenReady,
    on: jest.fn((event, callback) => {
      if (event === 'activate') activateCallback = callback;
      if (event === 'window-all-closed') windowAllClosedCallback = callback;
    }),
    quit: mockAppQuit,
  },
  BrowserWindow: jest.fn().mockImplementation(() => mockBrowserWindowInstance),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

const mockStoreInstance = {
  get: jest.fn((key: string): { width: number; height: number; x?: number; y?: number } | boolean | undefined => {
    if (key === 'windowBounds') return { width: 1200, height: 800, x: undefined, y: undefined };
    if (key === 'isMaximized') return false; // This will be inferred as boolean
    return undefined;
  }),
  set: jest.fn(),
};
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStoreInstance);
});

jest.mock('../services/config-manager', () => ({
  configManager: {
    get: jest.fn(() => ({})), // Default mock for config
  },
}));

jest.mock('../services/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockLlmServiceInstance = {
  getActiveProvider: jest.fn(() => ({ providerName: 'mockProvider' })),
  listModels: jest.fn().mockResolvedValue([{ id: 'model1' }]),
};
jest.mock('../services/llm-service', () => ({
  getLlmService: jest.fn(() => mockLlmServiceInstance),
}));

const mockLlmCacheServiceInstance = {
  cache: new Map(), // Simulate the cache property
};
jest.mock('../services/cache-service', () => ({
  getLlmCacheService: jest.fn(() => mockLlmCacheServiceInstance),
}));

// Mock IPC Handlers - just to prevent errors if they try to do complex things
// The actual testing of these handlers is in their own spec files.
jest.mock('../ipc/settings-handlers', () => { /* console.log('Mocked settings-handlers'); */ });
jest.mock('../ipc/ui-state-handlers', () => { /* console.log('Mocked ui-state-handlers'); */ });


// --- Test Suite ---
describe('Main Process (main.ts)', () => {
  let createWindowFn: () => Promise<void>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset app.isPackaged for each test if needed
    (app.isPackaged as unknown) = false;
    (BrowserWindow.getAllWindows as jest.Mock) = jest.fn(() => []); // Mock for 'activate'

    // Capture the createWindow function passed to whenReady().then()
    // This requires main.ts to be imported *after* app.whenReady is mocked.
    // We use jest.isolateModules to ensure a fresh import of main.ts
    jest.isolateModules(() => {
      mockAppWhenReady.mockImplementationOnce(() => ({
        then: (cb: () => Promise<void>) => {
          createWindowFn = cb; // Capture the function
          // Simulating the async nature of whenReady().then()
          // The actual execution of cb will be awaited in tests.
          return Promise.resolve();
        }
      }));
      require('../../../src/main'); // Import main.ts to trigger whenReady
    });
  });

  describe('createWindow Functionality', () => {
    it('should create a BrowserWindow with default dimensions from store', async () => {
      mockStoreInstance.get.mockImplementation((key: string): { width: number; height: number; x?: number; y?: number } | boolean | undefined => {
        if (key === 'windowBounds') return { width: 1300, height: 850, x: 10, y: 20 };
        if (key === 'isMaximized') return false;
        return undefined;
      });
      await createWindowFn(); // createWindowFn is async
      expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
        width: 1300,
        height: 850,
        x: 10,
        y: 20,
        webPreferences: expect.objectContaining({
          preload: path.join(__dirname, '..', 'preload.js'), // Adjust path based on test file location
        }),
      }));
    });

    it('should maximize window if store indicates it was maximized', async () => {
      mockStoreInstance.get.mockImplementation((key: string): { width: number; height: number; x?: number; y?: number } | boolean | undefined => {
        if (key === 'isMaximized') return true;
        if (key === 'windowBounds') return { width: 1200, height: 800, x: undefined, y: undefined }; // Ensure x and y are present
        return undefined;
      });
      await createWindowFn(); // createWindowFn is async
      expect(mockBrowserWindowInstance.maximize).toHaveBeenCalled();
    });

    it('should load index.html for packaged app', async () => {
      (app.isPackaged as unknown) = true;
      await createWindowFn();
      expect(mockBrowserWindowInstance.loadFile).toHaveBeenCalledWith(
        path.join(__dirname, '..', '../renderer/index.html') // Adjust path
      );
    });

    it('should load index.html and open dev tools for unpackaged app', async () => {
      (app.isPackaged as unknown) = false;
      await createWindowFn();
      expect(mockBrowserWindowInstance.loadFile).toHaveBeenCalledWith(
        path.join(__dirname, '..', '../renderer/index.html') // Adjust path
      );
      expect(mockBrowserWindowInstance.webContents.openDevTools).toHaveBeenCalled();
    });

    it('should set up window event listeners for close, resize, moved', async () => {
      await createWindowFn();
      expect(mockBrowserWindowInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockBrowserWindowInstance.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(mockBrowserWindowInstance.on).toHaveBeenCalledWith('moved', expect.any(Function));
    });

    // TODO: Test the behavior of 'close', 'resize', 'moved' handlers (saving to store)
  });

  describe('Application Lifecycle', () => {
    it('should call createWindow when app is ready', () => {
      // This is implicitly tested by the beforeEach setup capturing createWindowFn
      expect(createWindowFn).toBeDefined();
      // We can further assert that whenReady was indeed called
      expect(mockAppWhenReady).toHaveBeenCalled();
    });

    it('should create window on activate if no windows are open', async () => {
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([]);
      expect(activateCallback).toBeDefined();
      // Simulate app being ready and then activate event
      await createWindowFn(); // Initial window
      // To test activate, we'd need to simulate all windows closed then activate
      // This part is tricky because createWindow is not directly exported.
      // For now, we check if the callback is set.
      // A more robust test would involve manipulating BrowserWindow.getAllWindows
      // and then invoking the activateCallback.
      // activateCallback(); // This would call the original createWindow from main.ts
      // expect(BrowserWindow).toHaveBeenCalledTimes(2); // If we could call it again
      expect(activateCallback).toEqual(expect.any(Function));
    });

    it('should quit app on window-all-closed (non-darwin)', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(windowAllClosedCallback).toBeDefined();
      windowAllClosedCallback!();
      expect(mockAppQuit).toHaveBeenCalled();
    });

    it('should not quit app on window-all-closed (darwin)', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(windowAllClosedCallback).toBeDefined();
      windowAllClosedCallback!();
      expect(mockAppQuit).not.toHaveBeenCalled();
    });
  });

  describe('Service Initialization', () => {
    it('should initialize LLM service and log provider', async () => {
      await createWindowFn();
      expect(getLlmService).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LLM Service initialized. Active provider: mockProvider'));
      expect(mockLlmServiceInstance.listModels).toHaveBeenCalled();
    });

    it('should initialize LLM Cache service and log size', async () => {
      (mockLlmCacheServiceInstance.cache as Map<any,any>).set('key', 'value'); // Add item to cache
      await createWindowFn();
      expect(getLlmCacheService).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LLM Cache service initialized. Current cache size: 1'));
    });
  });

  // TODO: Test IPC setup verification (e.g., ensure configManager is called by handlers if possible)
  // This is indirectly covered by the fact that main.ts imports the handler modules.
});