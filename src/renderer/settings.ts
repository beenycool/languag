import { ElectronAPI } from '../preload'; // Assuming preload.ts is one level up

// Augment the Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const analysisEngineToggle = document.getElementById('analysis-engine-toggle') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveSettingsButton = document.getElementById('save-settings-button') as HTMLButtonElement;
const settingsStatus = document.getElementById('settings-status') as HTMLParagraphElement;

// Configuration keys used in the UI
const CONFIG_KEYS = {
  ANALYSIS_ENGINE_ENABLED: 'analysis.engineEnabled', // Example key
  API_KEY: 'llm.apiKey', // Example key
};

async function loadSettings() {
  try {
    settingsStatus.textContent = 'Loading settings...';
    // Fetch multiple settings at once if your getSettings can handle an array or specific structure
    // For simplicity, fetching one by one or a root object.
    // Assuming getSettings without a key fetches all, or a relevant section.
    const allSettings = await window.electronAPI.getSettings<any>(); // Or a more specific type

    if (allSettings) {
        const analysisEnabled = allSettings[CONFIG_KEYS.ANALYSIS_ENGINE_ENABLED];
        if (typeof analysisEnabled === 'boolean') {
            analysisEngineToggle.checked = analysisEnabled;
        }

        const apiKey = allSettings[CONFIG_KEYS.API_KEY];
        if (typeof apiKey === 'string') {
            apiKeyInput.value = apiKey;
        }
    }
    settingsStatus.textContent = 'Settings loaded.';
  } catch (error) {
    console.error('Failed to load settings:', error);
    settingsStatus.textContent = `Error loading settings: ${(error as Error).message}`;
  }
}

async function saveSettings() {
  try {
    settingsStatus.textContent = 'Saving settings...';
    const settingsToUpdate = {
      [CONFIG_KEYS.ANALYSIS_ENGINE_ENABLED]: analysisEngineToggle.checked,
      [CONFIG_KEYS.API_KEY]: apiKeyInput.value,
    };
    const result = await window.electronAPI.updateSettings(settingsToUpdate);
    if (result.success) {
      settingsStatus.textContent = 'Settings saved successfully!';
    } else {
      settingsStatus.textContent = `Failed to save settings: ${result.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    settingsStatus.textContent = `Error saving settings: ${(error as Error).message}`;
  }
}

function initializeSettings() {
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', saveSettings);
  }

  // Load initial settings when the module is initialized
  loadSettings();

  // Listen for changes pushed from main process (if implemented)
  const cleanupSettingsListener = window.electronAPI.onSettingsChanged((newSettings) => {
    console.log('Settings changed by main process:', newSettings);
    // Optionally, re-populate UI fields if necessary, though typically user input drives changes from renderer.
    // This is more useful if another renderer window or the main process itself changes settings.
    const analysisEnabled = newSettings[CONFIG_KEYS.ANALYSIS_ENGINE_ENABLED];
    if (typeof analysisEnabled === 'boolean' && analysisEngineToggle.checked !== analysisEnabled) {
        analysisEngineToggle.checked = analysisEnabled;
    }

    const apiKey = newSettings[CONFIG_KEYS.API_KEY];
    if (typeof apiKey === 'string' && apiKeyInput.value !== apiKey) {
        apiKeyInput.value = apiKey;
    }
    settingsStatus.textContent = 'Settings updated by main process.';
  });

  // Example of how to clean up listener if this module were to be "destroyed"
  // window.addEventListener('beforeunload', () => {
  //   cleanupSettingsListener();
  // });
}

export { initializeSettings, loadSettings, saveSettings };