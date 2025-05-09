import { SettingsPanel } from '../../panels/settings-panel';

// Define interfaces matching those in settings-panel.ts
interface AddinSetting {
    id: string;
    label: string;
    type: 'boolean' | 'string' | 'number' | 'choice';
    currentValue: any;
    choices?: string[];
    description?: string;
}

interface SettingsProvider {
    getSetting(key: string): Promise<any>;
    setSetting(key: string, value: any): Promise<void>;
    getAllSettings(): Promise<AddinSetting[]>;
}

// Mock SettingsProvider
const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn().mockResolvedValue(undefined);
const mockGetAllSettings = jest.fn();

const mockProvider: SettingsProvider = {
    getSetting: mockGetSetting,
    setSetting: mockSetSetting,
    getAllSettings: mockGetAllSettings,
};

// Mock settings data
const mockSettingsData: AddinSetting[] = [
    { id: "enableFeatureX", label: "Enable Feature X", type: 'boolean', currentValue: true, description: "Toggles feature X" },
    { id: "apiKey", label: "API Key", type: 'string', currentValue: "abc-123", description: "Your secret API key" },
    { id: "threshold", label: "Threshold", type: 'number', currentValue: 42 },
    { id: "mode", label: "Operating Mode", type: 'choice', currentValue: "Advanced", choices: ["Basic", "Advanced", "Expert"] },
];

describe('SettingsPanel', () => {
    let container: HTMLElement;
    let panel: SettingsPanel;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        jest.clearAllMocks();
        // Default mock implementation for getAllSettings
        mockGetAllSettings.mockResolvedValue([...mockSettingsData]); // Return a copy
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('Constructor', () => {
        it('should throw an error if container element is not provided', () => {
            expect(() => new SettingsPanel(null as any, mockProvider)).toThrow("Container element not provided.");
        });

        it('should throw an error if settings provider is not provided', () => {
            expect(() => new SettingsPanel(container, null as any)).toThrow("Settings provider not provided.");
        });

        it('should clear the container and add a header', () => {
            container.innerHTML = '<p>Old content</p>';
            panel = new SettingsPanel(container, mockProvider);
            expect(container.innerHTML).toContain('<h3>Add-in Settings</h3>');
            expect(container.innerHTML).not.toContain('<p>Old content</p>');
            expect(container.children.length).toBe(1); // Header only
        });
    });

    describe('loadAndRenderSettings', () => {
        beforeEach(() => {
            panel = new SettingsPanel(container, mockProvider);
        });

        it('should call provider.getAllSettings', async () => {
            await panel.loadAndRenderSettings();
            expect(mockGetAllSettings).toHaveBeenCalled();
        });

        it('should display a message if no settings are returned', async () => {
            mockGetAllSettings.mockResolvedValueOnce([]); // Override default mock
            await panel.loadAndRenderSettings();
            const messageElement = container.querySelector('p');
            expect(messageElement).not.toBeNull();
            expect(messageElement?.textContent).toBe("No configurable settings available.");
            expect(container.querySelector('.settings-list')).toBeNull();
        });

        it('should render a setting item for each setting returned', async () => {
            await panel.loadAndRenderSettings();
            const settingItems = container.querySelectorAll('.setting-item');
            expect(settingItems.length).toBe(mockSettingsData.length);
        });

        it('should render a checkbox for boolean settings', async () => {
            await panel.loadAndRenderSettings();
            const checkbox = container.querySelector('#setting-enableFeatureX') as HTMLInputElement;
            expect(checkbox).not.toBeNull();
            expect(checkbox.type).toBe('checkbox');
            expect(checkbox.checked).toBe(mockSettingsData[0].currentValue);
            expect(container.querySelector('label[for="setting-enableFeatureX"]')?.textContent).toBe(mockSettingsData[0].label);
            expect(container.querySelector('.setting-description')?.textContent).toBe(mockSettingsData[0].description);
        });

        it('should render a text input for string settings', async () => {
            await panel.loadAndRenderSettings();
            const textInput = container.querySelector('#setting-apiKey') as HTMLInputElement;
            expect(textInput).not.toBeNull();
            expect(textInput.type).toBe('text');
            expect(textInput.value).toBe(mockSettingsData[1].currentValue);
            expect(container.querySelector('label[for="setting-apiKey"]')?.textContent).toBe(mockSettingsData[1].label);
        });

        it('should render a number input for number settings', async () => {
            await panel.loadAndRenderSettings();
            const numInput = container.querySelector('#setting-threshold') as HTMLInputElement;
            expect(numInput).not.toBeNull();
            expect(numInput.type).toBe('number');
            expect(numInput.value).toBe(mockSettingsData[2].currentValue.toString());
            expect(container.querySelector('label[for="setting-threshold"]')?.textContent).toBe(mockSettingsData[2].label);
        });

        it('should render a select dropdown for choice settings', async () => {
            await panel.loadAndRenderSettings();
            const select = container.querySelector('#setting-mode') as HTMLSelectElement;
            expect(select).not.toBeNull();
            expect(select.tagName).toBe('SELECT');
            expect(select.options.length).toBe(mockSettingsData[3].choices?.length);
            expect(select.value).toBe(mockSettingsData[3].currentValue);
            expect(container.querySelector('label[for="setting-mode"]')?.textContent).toBe(mockSettingsData[3].label);
            // Check options
            const options = Array.from(select.options);
            expect(options.map(o => o.value)).toEqual(mockSettingsData[3].choices);
        });

        it('should display an error message if provider.getAllSettings fails', async () => {
            const mockError = new Error("Failed to fetch settings");
            mockGetAllSettings.mockRejectedValueOnce(mockError);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await panel.loadAndRenderSettings();

            const errorElement = container.querySelector('p');
            expect(errorElement).not.toBeNull();
            expect(errorElement?.textContent).toBe("Could not load settings.");
            expect(errorElement?.style.color).toBe("red");
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error loading settings:", mockError);

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Setting Interaction', () => {
        beforeEach(async () => {
            panel = new SettingsPanel(container, mockProvider);
            await panel.loadAndRenderSettings(); // Render the settings first
        });

        it('should call provider.setSetting when boolean checkbox is changed', () => {
            const checkbox = container.querySelector('#setting-enableFeatureX') as HTMLInputElement;
            checkbox.checked = false; // Change the value
            checkbox.dispatchEvent(new Event('change')); // Trigger event
            expect(mockSetSetting).toHaveBeenCalledWith("enableFeatureX", false);
        });

        it('should call provider.setSetting when string input is changed', () => {
            const textInput = container.querySelector('#setting-apiKey') as HTMLInputElement;
            const newValue = "def-456";
            textInput.value = newValue;
            textInput.dispatchEvent(new Event('change'));
            expect(mockSetSetting).toHaveBeenCalledWith("apiKey", newValue);
        });

        it('should call provider.setSetting when number input is changed', () => {
            const numInput = container.querySelector('#setting-threshold') as HTMLInputElement;
            const newValue = 99;
            numInput.value = newValue.toString();
            numInput.dispatchEvent(new Event('change'));
            expect(mockSetSetting).toHaveBeenCalledWith("threshold", newValue); // Should parse to number
        });

        it('should call provider.setSetting when choice select is changed', () => {
            const select = container.querySelector('#setting-mode') as HTMLSelectElement;
            const newValue = "Expert";
            select.value = newValue;
            select.dispatchEvent(new Event('change'));
            expect(mockSetSetting).toHaveBeenCalledWith("mode", newValue);
        });
    });

     describe('clear', () => {
        beforeEach(() => {
            panel = new SettingsPanel(container, mockProvider);
        });

        it('should remove all setting items from the panel', async () => {
            await panel.loadAndRenderSettings();
            expect(container.querySelectorAll('.setting-item').length).toBeGreaterThan(0);
            panel.clear();
            expect(container.querySelectorAll('.setting-item').length).toBe(0);
        });

        it('should display a "Settings cleared" message', async () => {
            await panel.loadAndRenderSettings();
            panel.clear();
            const message = container.querySelector('p');
            expect(message).not.toBeNull();
            expect(message?.textContent).toBe("Settings cleared.");
            // Header should still be present
            expect(container.querySelector('h3')?.textContent).toBe("Add-in Settings");
        });
    });
});