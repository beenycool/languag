// This class manages the overall state of the Word add-in.
// This could include user preferences, UI state, session data, etc.
// It might use Office.Settings for persistence or communicate with a backend.

interface AppSettings {
    [key: string]: any; // Allows for flexible settings
    // Example settings:
    // autoAnalysisEnabled?: boolean;
    // defaultLanguage?: string;
    // theme?: 'light' | 'dark';
}

export class AddinState {
    private static instance: AddinState;
    private settings: AppSettings = {};
    private onStateChangeCallbacks: Array<(newState: AppSettings) => void> = [];

    // Private constructor for Singleton pattern
    private constructor() {
        this.loadSettings();
    }

    /**
     * Gets the singleton instance of the AddinState.
     */
    public static getInstance(): AddinState {
        if (!AddinState.instance) {
            AddinState.instance = new AddinState();
        }
        return AddinState.instance;
    }

    /**
     * Loads settings from Office.Settings or defaults.
     * Office.Settings persists data in the document or mailbox.
     */
    private async loadSettings(): Promise<void> {
        // This is a simplified example. Office.Settings is asynchronous.
        // In a real scenario, you'd handle the async nature properly.
        // For now, we'll use a synchronous placeholder.

        // Example: Load a setting
        // const autoAnalysis = Office.context.roamingSettings.get("autoAnalysisEnabled");
        // if (autoAnalysis !== undefined) {
        //     this.settings.autoAnalysisEnabled = autoAnalysis;
        // } else {
        //     this.settings.autoAnalysisEnabled = true; // Default
        // }

        // Placeholder for initial default settings
        this.settings = {
            autoAnalysisEnabled: true,
            defaultLanguage: "en-US",
            theme: "light",
            // Add more default settings as needed
        };
        console.log("AddinState: Initial settings loaded/defaulted:", this.settings);
        // No need to call Office.context.roamingSettings.saveAsync here unless defaults are being saved for the first time.
    }

    /**
     * Gets the value of a specific setting.
     * @param key The key of the setting.
     * @returns The value of the setting, or undefined if not found.
     */
    public getSetting<T>(key: string): T | undefined {
        return this.settings[key] as T;
    }

    /**
     * Sets the value of a specific setting and persists it.
     * @param key The key of the setting.
     * @param value The new value for the setting.
     */
    public async setSetting(key: string, value: any): Promise<void> {
        this.settings[key] = value;
        // Office.context.roamingSettings.set(key, value);
        // await Office.context.roamingSettings.saveAsync(); // Persist the change

        // For this example, we'll just log and notify listeners without actual Office.Settings persistence.
        console.log(`AddinState: Setting '${key}' updated to:`, value);
        this.notifyStateChange();

        // Example of actual persistence (uncomment and adapt if Office.js is fully set up)
        /*
        return new Promise((resolve, reject) => {
            Office.context.roamingSettings.set(key, value);
            Office.context.roamingSettings.saveAsync((asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error(`AddinState: Failed to save setting '${key}'. Error: ${asyncResult.error.message}`);
                    reject(asyncResult.error);
                } else {
                    console.log(`AddinState: Setting '${key}' saved successfully.`);
                    this.notifyStateChange();
                    resolve();
                }
            });
        });
        */
    }

    /**
     * Gets all current settings.
     * This is useful for components like a settings panel.
     */
    public getAllSettings(): AppSettings {
        // Return a copy to prevent direct modification
        return { ...this.settings };
    }

    /**
     * Registers a callback function to be invoked when the state changes.
     * @param callback The function to call on state change.
     */
    public onStateChange(callback: (newState: AppSettings) => void): void {
        this.onStateChangeCallbacks.push(callback);
    }

    /**
     * Unregisters a state change callback.
     * @param callback The callback function to remove.
     */
    public offStateChange(callback: (newState: AppSettings) => void): void {
        this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(cb => cb !== callback);
    }

    private notifyStateChange(): void {
        const currentState = this.getAllSettings();
        this.onStateChangeCallbacks.forEach(cb => {
            try {
                cb(currentState);
            } catch (error) {
                console.error("AddinState: Error in onStateChange callback:", error);
            }
        });
    }

    // Example of how SettingsPanel might use this:
    // This would be part of the SettingsProvider interface implementation.
    /*
    async getSettingProviderSetting(key: string): Promise<any> {
        return AddinState.getInstance().getSetting(key);
    }

    async setSettingProviderSetting(key: string, value: any): Promise<void> {
        return AddinState.getInstance().setSetting(key, value);
    }

    async getAllSettingsProviderSettings(): Promise<AddinSetting[]> {
        const currentSettings = AddinState.getInstance().getAllSettings();
        // Transform currentSettings into AddinSetting[] structure
        // This requires defining what settings are available, their types, labels, etc.
        // This definition could come from a config file or be hardcoded.
        const definedSettings: AddinSetting[] = [
            { id: 'autoAnalysisEnabled', label: 'Enable Auto Analysis', type: 'boolean', currentValue: currentSettings.autoAnalysisEnabled },
            { id: 'defaultLanguage', label: 'Default Language', type: 'choice', choices: ['en-US', 'en-GB', 'de-DE'], currentValue: currentSettings.defaultLanguage },
            { id: 'theme', label: 'Theme', type: 'choice', choices: ['light', 'dark'], currentValue: currentSettings.theme, description: 'Select the visual theme for the add-in.' },
        ];
        return definedSettings;
    }
    */
}

// Initialize the singleton instance when the module loads
// AddinState.getInstance(); // This can be done here or explicitly when first needed.