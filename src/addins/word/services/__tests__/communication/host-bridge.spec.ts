import { HostBridge } from '../../communication/host-bridge';

// Use Jest fake timers for showMessage timeout
jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');

// Mock Office.js API parts used by HostBridge
const mockDisplayDialogAsync = jest.fn();
const mockDialogClose = jest.fn();
const mockDialogAddEventHandler = jest.fn();

const mockDialog = {
    close: mockDialogClose,
    addEventHandler: mockDialogAddEventHandler,
};

// Mock Enums (remove individual casts)
const mockHostBridgeHostType = {
    Word: "Word", Excel: "Excel", PowerPoint: "PowerPoint", Outlook: "Outlook",
    OneNote: "OneNote", Project: "Project", Access: "Access",
};
const mockHostBridgePlatformType = {
    PC: "PC", OfficeOnline: "OfficeOnline", Mac: "Mac", iOS: "iOS",
    Android: "Android", Universal: "Universal",
};
const mockHostBridgeAsyncStatus = {
    Succeeded: "succeeded", Failed: "failed",
};
const mockHostBridgeEventType = {
    DialogMessageReceived: "dialogMessageReceived",
    // Add other event types if needed
};
const OWAViewTypeHostBridge = { // Define OWAView values if needed by Diagnostics
    OneColumn: "OneColumn", TwoColumns: "TwoColumns", ThreeColumns: "ThreeColumns",
} as const;


// Setup global Office mock
global.Office = {
    context: {
        host: mockHostBridgeHostType.Word as unknown as Office.HostType,
        platform: mockHostBridgePlatformType.PC as unknown as Office.PlatformType,
        diagnostics: { // Cast diagnostics object to 'any' to bypass complex type error
            version: "16.0.12345.67890",
            hostName: 'Word',
            hostVersion: '16.0.12345.67890',
            OWAView: OWAViewTypeHostBridge.OneColumn as "OneColumn" | "TwoColumns" | "ThreeColumns",
            // Include host/platform/version here if needed by Diagnostics type itself, but casting to any avoids the check
        } as any, // Cast diagnostics to any
        ui: { // Add missing properties
            displayDialogAsync: mockDisplayDialogAsync,
            addHandlerAsync: jest.fn(),
            messageParent: jest.fn(),
            closeContainer: jest.fn(),
            openBrowserWindow: jest.fn(),
        } as Office.UI,
        // Add other missing context properties
        commerceAllowed: false,
        contentLanguage: 'en-US',
        displayLanguage: 'en-US',
        document: { // Add basic document mock if needed by context type
             settings: { get: jest.fn(), set: jest.fn(), saveAsync: jest.fn() }
        } as any, // Cast document to any for simplicity
        auth: { getAccessToken: jest.fn() } as any,
        license: { getIsTrial: jest.fn(() => false) } as any,
        mailbox: undefined as any,
        officeTheme: { bodyBackgroundColor: '#FFFFFF' } as any,
        partitionKey: '',
        roamingSettings: undefined as any,
        requirements: { isSetSupported: jest.fn() } as any,
        sensitivityLabelsCatalog: undefined as any,
        touchEnabled: false,
        urls: { AppDomain: undefined } as any,
    } as Office.Context,
    // Cast enums via unknown
    HostType: mockHostBridgeHostType as unknown as typeof Office.HostType,
    PlatformType: mockHostBridgePlatformType as unknown as typeof Office.PlatformType,
    AsyncResultStatus: mockHostBridgeAsyncStatus as unknown as typeof Office.AsyncResultStatus,
    EventType: mockHostBridgeEventType as unknown as typeof Office.EventType,
} as any;


describe('HostBridge', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Reset context host/platform if tests modify it
        Office.context.host = mockHostBridgeHostType.Word as unknown as Office.HostType;
        Office.context.platform = mockHostBridgePlatformType.PC as unknown as Office.PlatformType;
         // Ensure diagnostics is reset if tests modify it
        (Office.context as any).diagnostics = {
            version: "16.0.12345.67890",
            hostName: 'Word',
            hostVersion: '16.0.12345.67890',
            OWAView: OWAViewTypeHostBridge.OneColumn as "OneColumn" | "TwoColumns" | "ThreeColumns",
        } as any;
    });

    describe('isWordHost', () => {
        it('should return true if host is Word', () => {
            Office.context.host = mockHostBridgeHostType.Word as unknown as Office.HostType;
            expect(HostBridge.isWordHost()).toBe(true);
        });

        it('should return false if host is not Word', () => {
            Office.context.host = mockHostBridgeHostType.Excel as unknown as Office.HostType;
            expect(HostBridge.isWordHost()).toBe(false);
        });
    });

    describe('getHostInfo', () => {
        it('should return a promise resolving to host information', async () => {
            const expectedInfo: Office.ContextInformation = {
                host: Office.context.host,
                platform: Office.context.platform,
                version: Office.context.diagnostics.version,
            };
            await expect(HostBridge.getHostInfo()).resolves.toEqual(expectedInfo);
        });

        it('should handle missing diagnostics version', async () => {
             const originalDiagnostics = Office.context.diagnostics;
             (Office.context as any).diagnostics = undefined; // Simulate missing diagnostics
             const info = await HostBridge.getHostInfo();
             expect(info.version).toBe("N/A");
             (Office.context as any).diagnostics = originalDiagnostics; // Restore
        });
    });

    describe('showMessage', () => {
        const message = "Test message";
        const title = "Test Title";

        it('should call displayDialogAsync with generated data URL and options', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            await HostBridge.showMessage(message, title);
            expect(mockDisplayDialogAsync).toHaveBeenCalledWith(
                expect.stringContaining("data:text/html;charset=utf-8,"),
                { height: 15, width: 30, displayInIframe: true },
                expect.any(Function)
            );
            const calledUrl = mockDisplayDialogAsync.mock.calls[0][0];
            const decodedContent = decodeURIComponent(calledUrl.split(',')[1]);
            expect(decodedContent).toContain(`<title>${title}</title>`);
            expect(decodedContent).toContain(`<p>${message}</p>`);
        });

        it('should resolve after dialog is displayed and timeout completes', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            const promise = HostBridge.showMessage(message, title);
            await Promise.resolve(); // Allow asyncResult callback to execute
            expect(setTimeout).toHaveBeenCalledTimes(1);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);

            jest.runAllTimers(); // Run the timeout
            await expect(promise).resolves.toBeUndefined();
            expect(mockDialogClose).toHaveBeenCalled();
        });

         it('should add event handler for DialogMessageReceived', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            await HostBridge.showMessage(message, title);
            expect(mockDialogAddEventHandler).toHaveBeenCalledWith(
                Office.EventType.DialogMessageReceived,
                expect.any(Function)
            );
             jest.runAllTimers(); // Ensure timeout completes for promise resolution
        });

        it('should reject if displayDialogAsync fails', async () => {
            const mockError = { code: 789, name: "DialogError", message: "Failed to display" };
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Failed, error: mockError });
            });
            await expect(HostBridge.showMessage(message, title)).rejects.toEqual(mockError);
        });

        it('should handle dialog close errors gracefully within timeout', async () => {
             mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
             mockDialogClose.mockImplementationOnce(() => { throw new Error("Already closed"); });

             const promise = HostBridge.showMessage(message, title);
             jest.runAllTimers();

             await expect(promise).resolves.toBeUndefined();
        });
    });

    describe('openDialog', () => {
        const url = "https://example.com/dialog.html";
        const options = { height: 60, width: 60 };

        it('should call displayDialogAsync with the provided URL and options', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            await HostBridge.openDialog(url, options);
            expect(mockDisplayDialogAsync).toHaveBeenCalledWith(
                url,
                options,
                expect.any(Function)
            );
        });

         it('should use default options if none are provided', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            await HostBridge.openDialog(url);
            expect(mockDisplayDialogAsync).toHaveBeenCalledWith(
                url,
                { height: 50, width: 50 }, // Default options
                expect.any(Function)
            );
        });

        it('should resolve with the dialog object on success', async () => {
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Succeeded, value: mockDialog });
            });
            await expect(HostBridge.openDialog(url, options)).resolves.toBe(mockDialog);
        });

        it('should reject if displayDialogAsync fails', async () => {
            const mockError = { code: 999, name: "OpenDialogError", message: "Cannot open" };
            mockDisplayDialogAsync.mockImplementationOnce((url, options, callback) => {
                callback({ status: Office.AsyncResultStatus.Failed, error: mockError });
            });
            await expect(HostBridge.openDialog(url, options)).rejects.toEqual(mockError);
        });
    });
});