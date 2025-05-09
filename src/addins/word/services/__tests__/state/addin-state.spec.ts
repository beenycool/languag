import { AddinState } from '../../state/addin-state';

// Define AppSettings interface matching the one in addin-state.ts
interface AppSettings {
    [key: string]: any;
    autoAnalysisEnabled?: boolean;
    defaultLanguage?: string;
    theme?: 'light' | 'dark';
}

// Default settings expected from the current implementation of loadSettings
const defaultSettings: AppSettings = {
    autoAnalysisEnabled: true,
    defaultLanguage: "en-US",
    theme: "light",
};

describe('AddinState', () => {

    // Helper function to reset the singleton instance for isolated tests
    const resetAddinStateSingleton = () => {
        (AddinState as any).instance = undefined;
    };

    beforeEach(() => {
        // Reset the singleton before each test to ensure isolation
        resetAddinStateSingleton();
        // Clear any mocks if Office context were mocked
        // jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple calls to getInstance', () => {
            const instance1 = AddinState.getInstance();
            const instance2 = AddinState.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Initialization', () => {
        it('should load default settings on first instantiation', () => {
            const instance = AddinState.getInstance();
            // Access internal state for verification (common in testing singletons)
            expect((instance as any).settings).toEqual(defaultSettings);
            // Or use getAllSettings() which should be initialized
            expect(instance.getAllSettings()).toEqual(defaultSettings);
        });

        // Add tests here if loadSettings were asynchronous or used Office.Settings
        // it('should load settings from Office.Settings if available', async () => { ... });
    });

    describe('getSetting', () => {
        let instance: AddinState;
        beforeEach(() => {
            instance = AddinState.getInstance();
        });

        it('should return the value of an existing setting', () => {
            expect(instance.getSetting<boolean>('autoAnalysisEnabled')).toBe(defaultSettings.autoAnalysisEnabled);
            expect(instance.getSetting<string>('defaultLanguage')).toBe(defaultSettings.defaultLanguage);
            expect(instance.getSetting<string>('theme')).toBe(defaultSettings.theme);
        });

        it('should return undefined for a non-existent setting', () => {
            expect(instance.getSetting('nonExistentKey')).toBeUndefined();
        });
    });

    describe('setSetting', () => {
        let instance: AddinState;
        beforeEach(() => {
            instance = AddinState.getInstance();
        });

        it('should update the value of an existing setting', async () => {
            const newTheme = 'dark';
            await instance.setSetting('theme', newTheme);
            expect(instance.getSetting('theme')).toBe(newTheme);
        });

        it('should add a new setting if the key does not exist', async () => {
            const newKey = 'newFeatureToggle';
            const newValue = false;
            expect(instance.getSetting(newKey)).toBeUndefined();
            await instance.setSetting(newKey, newValue);
            expect(instance.getSetting(newKey)).toBe(newValue);
        });

        it('should call notifyStateChange after setting a value', async () => {
            const notifySpy = jest.spyOn((instance as any), 'notifyStateChange');
            await instance.setSetting('theme', 'dark');
            expect(notifySpy).toHaveBeenCalled();
            notifySpy.mockRestore();
        });

        // Add tests here if setSetting used Office.Settings persistence
        // it('should call Office.context.roamingSettings.set and saveAsync', async () => { ... });
        // it('should handle errors during saveAsync', async () => { ... });
    });

    describe('getAllSettings', () => {
        let instance: AddinState;
        beforeEach(() => {
            instance = AddinState.getInstance();
        });

        it('should return an object containing all current settings', () => {
            expect(instance.getAllSettings()).toEqual(defaultSettings);
        });

        it('should return a copy of the settings, not the internal object', () => {
            const settings1 = instance.getAllSettings();
            const settings2 = instance.getAllSettings();
            expect(settings1).toEqual(settings2);
            expect(settings1).not.toBe(settings2); // Should be different objects (copies)
        });

        it('should reflect changes made via setSetting', async () => {
            await instance.setSetting('theme', 'dark');
            await instance.setSetting('newKey', 123);
            expect(instance.getAllSettings()).toEqual({
                ...defaultSettings,
                theme: 'dark',
                newKey: 123,
            });
        });
    });

    describe('State Change Notification (onStateChange / offStateChange / notifyStateChange)', () => {
        let instance: AddinState;
        let callback1: jest.Mock;
        let callback2: jest.Mock;

        beforeEach(() => {
            instance = AddinState.getInstance();
            callback1 = jest.fn();
            callback2 = jest.fn();
        });

        it('should register callbacks using onStateChange', () => {
            instance.onStateChange(callback1);
            // Access private member for verification
            expect((instance as any).onStateChangeCallbacks).toContain(callback1);
        });

        it('should call registered callbacks when notifyStateChange is invoked', () => {
            instance.onStateChange(callback1);
            instance.onStateChange(callback2);
            (instance as any).notifyStateChange(); // Trigger manually for test
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith(instance.getAllSettings());
        });

        it('should call registered callbacks when setSetting triggers notifyStateChange', async () => {
            instance.onStateChange(callback1);
            await instance.setSetting('theme', 'dark');
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
        });

        it('should unregister callbacks using offStateChange', () => {
            instance.onStateChange(callback1);
            instance.onStateChange(callback2);
            instance.offStateChange(callback1);
            expect((instance as any).onStateChangeCallbacks).not.toContain(callback1);
            expect((instance as any).onStateChangeCallbacks).toContain(callback2);

            (instance as any).notifyStateChange();
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should not throw if offStateChange is called with an unregistered callback', () => {
            const unregisteredCallback = jest.fn();
            expect(() => instance.offStateChange(unregisteredCallback)).not.toThrow();
        });

        it('should handle errors within callbacks without stopping other callbacks', () => {
            const errorCallback = jest.fn(() => { throw new Error("Callback failed"); });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            instance.onStateChange(errorCallback);
            instance.onStateChange(callback2);

            (instance as any).notifyStateChange();

            expect(errorCallback).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1); // Should still be called
            expect(consoleErrorSpy).toHaveBeenCalledWith("AddinState: Error in onStateChange callback:", expect.any(Error));

            consoleErrorSpy.mockRestore();
        });
    });
});