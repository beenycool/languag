import { initializeSettings, loadSettings, saveSettings } from '../settings';
import { ElectronAPI } from '../../preload'; // Adjust path

// --- Mocks ---
const mockCleanupFn = jest.fn();
const mockElectronApi: DeepMocked<ElectronAPI> = {
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
  onSettingsChanged: jest.fn().mockReturnValue(mockCleanupFn),
  // Mock other ElectronAPI methods if they were to be called by settings.ts
  getUiState: jest.fn(),
  updateUiState: jest.fn(),
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

// Mock DOM elements
let mockAnalysisEngineToggle: HTMLInputElement;
let mockApiKeyInput: HTMLInputElement;
let mockSaveSettingsButton: HTMLButtonElement;
let mockSettingsStatus: HTMLParagraphElement;

// --- Test Setup ---
describe('Settings UI (settings.ts)', () => {
  beforeAll(() => {
    // Setup global window
    global.window = Object.create(window);
    Object.defineProperty(global.window, 'electronAPI', {
      value: mockElectronApi,
      writable: true,
    });

    // Mock document.getElementById
    global.document = {
      getElementById: jest.fn(),
    } as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mocks for DOM elements for each test
    mockAnalysisEngineToggle = { checked: false } as HTMLInputElement;
    mockApiKeyInput = { value: '' } as HTMLInputElement;
    mockSaveSettingsButton = { addEventListener: jest.fn() } as unknown as HTMLButtonElement;
    mockSettingsStatus = { textContent: '' } as HTMLParagraphElement;

    (document.getElementById as jest.Mock).mockImplementation((id: string) => {
      if (id === 'analysis-engine-toggle') return mockAnalysisEngineToggle;
      if (id === 'api-key-input') return mockApiKeyInput;
      if (id === 'save-settings-button') return mockSaveSettingsButton;
      if (id === 'settings-status') return mockSettingsStatus;
      return null;
    });
  });

  describe('initializeSettings', () => {
    it('should add click listener to saveSettingsButton', () => {
      initializeSettings();
      expect(mockSaveSettingsButton.addEventListener).toHaveBeenCalledWith('click', saveSettings);
    });

    it('should call loadSettings', () => {
      // loadSettings is called within initializeSettings. We need a way to spy on it or test its effects.
      // For now, we'll trust it's called and test loadSettings separately.
      // Or, we can mock loadSettings to check if it's called.
      const loadSettingsSpy = jest.spyOn(require('../settings'), 'loadSettings').mockResolvedValue(undefined);
      initializeSettings();
      expect(loadSettingsSpy).toHaveBeenCalled();
      loadSettingsSpy.mockRestore();
    });

    it('should register onSettingsChanged listener', () => {
      initializeSettings();
      expect(window.electronAPI.onSettingsChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it('onSettingsChanged callback should update UI elements and status', () => {
      initializeSettings();
      const callback = (window.electronAPI.onSettingsChanged as jest.Mock).mock.calls[0][0];
      
      const newSettings = {
        'analysis.engineEnabled': true,
        'llm.apiKey': 'new-key-from-main',
      };
      callback(newSettings);

      expect(mockAnalysisEngineToggle.checked).toBe(true);
      expect(mockApiKeyInput.value).toBe('new-key-from-main');
      expect(mockSettingsStatus.textContent).toBe('Settings updated by main process.');
    });
  });

  describe('loadSettings', () => {
    it('should fetch settings and populate UI elements', async () => {
      const mockFetchedSettings = {
        'analysis.engineEnabled': true,
        'llm.apiKey': 'test-key',
      };
      mockElectronApi.getSettings.mockResolvedValue(mockFetchedSettings);

      await loadSettings();

      expect(window.electronAPI.getSettings).toHaveBeenCalled();
      expect(mockAnalysisEngineToggle.checked).toBe(true);
      expect(mockApiKeyInput.value).toBe('test-key');
      expect(mockSettingsStatus.textContent).toBe('Settings loaded.');
    });

    it('should handle errors during fetch and update status', async () => {
      const errorMessage = 'Fetch failed';
      mockElectronApi.getSettings.mockRejectedValue(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await loadSettings();

      expect(mockSettingsStatus.textContent).toBe(`Error loading settings: ${errorMessage}`);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load settings:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveSettings', () => {
    it('should get values from UI and call updateSettings', async () => {
      mockAnalysisEngineToggle.checked = true;
      mockApiKeyInput.value = 'updated-key';
      mockElectronApi.updateSettings.mockResolvedValue({ success: true });

      await saveSettings();

      expect(window.electronAPI.updateSettings).toHaveBeenCalledWith({
        'analysis.engineEnabled': true,
        'llm.apiKey': 'updated-key',
      });
      expect(mockSettingsStatus.textContent).toBe('Settings saved successfully!');
    });

    it('should handle save failure from updateSettings result and update status', async () => {
      mockElectronApi.updateSettings.mockResolvedValue({ success: false, error: 'Main process error' });
      
      await saveSettings();

      expect(mockSettingsStatus.textContent).toBe('Failed to save settings: Main process error');
    });

    it('should handle errors during save operation and update status', async () => {
      const errorMessage = 'Update failed';
      mockElectronApi.updateSettings.mockRejectedValue(new Error(errorMessage));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await saveSettings();

      expect(mockSettingsStatus.textContent).toBe(`Error saving settings: ${errorMessage}`);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});