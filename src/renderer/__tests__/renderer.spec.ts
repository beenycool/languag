import { initializeSettings } from '../settings';
import { ElectronAPI } from '../../preload'; // Adjust path if necessary

// --- Mocks ---
// Mock the settings module
jest.mock('../settings', () => ({
  initializeSettings: jest.fn(),
}));

// Mock the global window.electronAPI
const mockCleanupFn = jest.fn(); // A single mock for all cleanup functions

const mockElectronApi: DeepMocked<ElectronAPI> = {
  getSettings: jest.fn().mockResolvedValue({}),
  updateSettings: jest.fn().mockResolvedValue({ success: true }),
  onSettingsChanged: jest.fn().mockReturnValue(mockCleanupFn),
  getUiState: jest.fn().mockResolvedValue(null),
  updateUiState: jest.fn().mockResolvedValue({ success: true }),
  onWindowStateChange: jest.fn().mockReturnValue(mockCleanupFn),
  sendPing: jest.fn(),
  onPong: jest.fn().mockReturnValue(mockCleanupFn),
};

// Helper type for deep mocking
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.MockedFunction<T[K]>
    : T[K] extends object
    ? DeepMocked<T[K]>
    : T[K];
};

// --- Test Setup ---
let domContentLoadedCallback: (() => void) | null = null;

// --- Test Suite ---
describe('Renderer Process (renderer.ts)', () => {
  beforeAll(() => {
    // Setup global window and document mocks
    global.window = Object.create(window);
    Object.defineProperty(global.window, 'electronAPI', {
      value: mockElectronApi,
      writable: true,
    });
    Object.defineProperty(global.window, 'addEventListener', {
        value: jest.fn(), // Mock addEventListener
        writable: true,
    });


    // Mock document and its methods used in renderer.ts
    global.document = {
      addEventListener: jest.fn((event, callback) => {
        if (event === 'DOMContentLoaded') {
          domContentLoadedCallback = callback as () => void;
        }
      }),
      querySelector: jest.fn(),
      getElementById: jest.fn(),
    } as any; // Use 'as any' to simplify mocking complex DOM types
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset DOM mocks for each test
    (document.querySelector as jest.Mock).mockReturnValue(null);
    (document.getElementById as jest.Mock).mockReturnValue(null);
    domContentLoadedCallback = null;

    // Re-require renderer.ts to re-register DOMContentLoaded listener
    // and capture the new callback.
    jest.isolateModules(() => {
        require('../renderer');
    });
    expect(domContentLoadedCallback).not.toBeNull();
  });

  describe('DOM Initialization', () => {
    it('should set textContent of the app info paragraph if found', () => {
      const mockParagraph = { textContent: '' };
      (document.querySelector as jest.Mock).mockReturnValue(mockParagraph);
      
      domContentLoadedCallback!(); // Trigger DOMContentLoaded

      expect(document.querySelector).toHaveBeenCalledWith('p');
      expect(mockParagraph.textContent).toBe('Renderer process loaded. Initializing UI...');
    });

    it('should call initializeSettings', () => {
      domContentLoadedCallback!();
      expect(initializeSettings).toHaveBeenCalled();
    });
  });

  describe('IPC Communication (Ping/Pong Example)', () => {
    let mockPingButton: { addEventListener: jest.Mock };
    let mockPongResponse: { textContent: string };

    beforeEach(() => {
      mockPingButton = { addEventListener: jest.fn() };
      mockPongResponse = { textContent: '' };
      (document.getElementById as jest.Mock).mockImplementation((id: string) => {
        if (id === 'ping-button') return mockPingButton;
        if (id === 'pong-response') return mockPongResponse;
        return null;
      });
    });

    it('should add click listener to ping button and call sendPing', () => {
      domContentLoadedCallback!();
      expect(document.getElementById).toHaveBeenCalledWith('ping-button');
      expect(mockPingButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Simulate click
      const clickHandler = mockPingButton.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(window.electronAPI.sendPing).toHaveBeenCalled();
      expect(mockPongResponse.textContent).toBe('Ping sent. Waiting for pong...');
    });

    it('should register onPong listener and update pongResponse textContent', () => {
      domContentLoadedCallback!();
      expect(window.electronAPI.onPong).toHaveBeenCalledWith(expect.any(Function));

      // Simulate pong event
      const pongHandler = (window.electronAPI.onPong as jest.Mock).mock.calls[0][0];
      const testMessage = 'Test Pong Message';
      pongHandler(testMessage);

      expect(mockPongResponse.textContent).toBe(`Pong received: ${testMessage}`);
    });

    it('should log a warning if ping/pong UI elements are not found', () => {
        (document.getElementById as jest.Mock).mockReturnValue(null); // Ensure elements are not found
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        domContentLoadedCallback!();
        expect(consoleWarnSpy).toHaveBeenCalledWith('Ping/pong UI elements not found.');
        consoleWarnSpy.mockRestore();
    });
  });

  describe('UI State Handling', () => {
    it('should call getUiState and log the result', async () => {
      const mockState = { windowBounds: { width: 100, height: 100, x:0, y:0 }, isMaximized: false };
      mockElectronApi.getUiState.mockResolvedValueOnce(mockState);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      domContentLoadedCallback!();
      // Need to wait for the promise from getUiState to resolve
      await Promise.resolve(); // Flushes the microtask queue

      expect(window.electronAPI.getUiState).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Initial UI State from main:', mockState);
      consoleLogSpy.mockRestore();
    });

    it('should log if no UI state is received', async () => {
      mockElectronApi.getUiState.mockResolvedValueOnce(null);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      domContentLoadedCallback!();
      await Promise.resolve();

      expect(window.electronAPI.getUiState).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('No UI state received from main.');
      consoleLogSpy.mockRestore();
    });

    it('should log an error if getUiState fails', async () => {
      const errorMessage = 'Failed to fetch';
      mockElectronApi.getUiState.mockRejectedValueOnce(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      domContentLoadedCallback!();
      await Promise.resolve(); // Wait for rejection to be processed

      expect(window.electronAPI.getUiState).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get UI state:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});