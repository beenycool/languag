import { AppBridge } from '../../communication/app-bridge';

// Use Jest fake timers
jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');

// Define interfaces matching AppBridge
interface AppMessage {
    type: string;
    payload?: any;
}
interface AppResponse {
    success: boolean;
    data?: any;
    error?: string;
}
type MessageHandler = (payload: any) => void | Promise<any>;

describe('AppBridge', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Reset internal state of AppBridge (accessing private static for testing)
        (AppBridge as any).messageHandlers = new Map<string, MessageHandler[]>();
    });

    describe('sendMessageToApp', () => {
        it('should return a promise', () => {
            const result = AppBridge.sendMessageToApp("testType");
            expect(result).toBeInstanceOf(Promise);
            // Clear the timer started by the promise
            jest.runAllTimers();
        });

        it('should resolve with a mock success response after timeout', async () => {
            const type = "getData";
            const promise = AppBridge.sendMessageToApp(type);
            expect(setTimeout).toHaveBeenCalledTimes(1);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);

            jest.runAllTimers(); // Complete the timeout

            await expect(promise).resolves.toEqual({
                success: true,
                data: `Mock response for ${type}`
            });
        });

        it('should resolve with specific mock data for "requestMainAppSettings"', async () => {
            const promise = AppBridge.sendMessageToApp("requestMainAppSettings");
            jest.runAllTimers();
            await expect(promise).resolves.toEqual({
                success: true,
                data: { mainFeatureEnabled: true, userTier: "premium" }
            });
        });

         it('should resolve with success: true for "logErrorToMainApp"', async () => {
            const errorPayload = { message: "Something failed", stack: "..." };
            const promise = AppBridge.sendMessageToApp("logErrorToMainApp", errorPayload);
            jest.runAllTimers();
            await expect(promise).resolves.toEqual({ success: true });
        });

        // Add tests for actual communication channel if implemented (e.g., spy on ipcRenderer.send)
    });

    describe('onMessageFromApp / offMessageFromApp / triggerMessageHandlers', () => {
        const messageType = "testMessage";
        const handler1 = jest.fn();
        const handler2 = jest.fn();
        const payload = { data: "some data" };

        it('should register a handler for a message type', () => {
            AppBridge.onMessageFromApp(messageType, handler1);
            const handlers = (AppBridge as any).messageHandlers.get(messageType);
            expect(handlers).toBeDefined();
            expect(handlers).toContain(handler1);
            expect(handlers?.length).toBe(1);
        });

        it('should register multiple handlers for the same message type', () => {
            AppBridge.onMessageFromApp(messageType, handler1);
            AppBridge.onMessageFromApp(messageType, handler2);
            const handlers = (AppBridge as any).messageHandlers.get(messageType);
            expect(handlers).toContain(handler1);
            expect(handlers).toContain(handler2);
            expect(handlers?.length).toBe(2);
        });

        it('should call registered handlers when triggerMessageHandlers is called', async () => {
            AppBridge.onMessageFromApp(messageType, handler1);
            AppBridge.onMessageFromApp(messageType, handler2);
            await (AppBridge as any).triggerMessageHandlers(messageType, payload);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler1).toHaveBeenCalledWith(payload);
            expect(handler2).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledWith(payload);
        });

        it('should handle async handlers correctly in triggerMessageHandlers', async () => {
            const asyncPayload = { value: 0 };
            const asyncHandler = jest.fn(async (pld) => {
                await new Promise(res => setTimeout(res, 10)); // Simulate async work
                pld.value = 1;
            });
            AppBridge.onMessageFromApp(messageType, asyncHandler);
            await (AppBridge as any).triggerMessageHandlers(messageType, asyncPayload);
            expect(asyncHandler).toHaveBeenCalledWith(asyncPayload);
            expect(asyncPayload.value).toBe(1); // Check if async operation completed
        });


        it('should unregister a specific handler', () => {
            AppBridge.onMessageFromApp(messageType, handler1);
            AppBridge.onMessageFromApp(messageType, handler2);
            AppBridge.offMessageFromApp(messageType, handler1);
            const handlers = (AppBridge as any).messageHandlers.get(messageType);
            expect(handlers).not.toContain(handler1);
            expect(handlers).toContain(handler2);
            expect(handlers?.length).toBe(1);
        });

        it('should not throw when unregistering a non-existent handler', () => {
            const nonExistentHandler = jest.fn();
            AppBridge.onMessageFromApp(messageType, handler1);
            expect(() => AppBridge.offMessageFromApp(messageType, nonExistentHandler)).not.toThrow();
            expect((AppBridge as any).messageHandlers.get(messageType)).toContain(handler1);
        });

         it('should not throw when unregistering from a non-existent message type', () => {
            expect(() => AppBridge.offMessageFromApp("nonExistentType", handler1)).not.toThrow();
        });

        it('should warn if triggerMessageHandlers is called for a type with no handlers', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            await (AppBridge as any).triggerMessageHandlers("unregisteredType", {});
            expect(consoleWarnSpy).toHaveBeenCalledWith("AppBridge: No handlers registered for message type 'unregisteredType'.");
            consoleWarnSpy.mockRestore();
        });

        it('should handle errors within handlers during triggerMessageHandlers', async () => {
            const errorMsg = "Handler failed!";
            const failingHandler = jest.fn(() => { throw new Error(errorMsg); });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            AppBridge.onMessageFromApp(messageType, failingHandler);
            AppBridge.onMessageFromApp(messageType, handler2); // Add a working handler

            await (AppBridge as any).triggerMessageHandlers(messageType, payload);

            expect(failingHandler).toHaveBeenCalledWith(payload);
            expect(handler2).toHaveBeenCalledWith(payload); // Ensure other handlers still run
            expect(consoleErrorSpy).toHaveBeenCalledWith(`AppBridge: Error in handler for message type '${messageType}':`, expect.any(Error));
            expect(consoleErrorSpy.mock.calls[0][1].message).toBe(errorMsg);

            consoleErrorSpy.mockRestore();
        });

        it('should simulate receiving "mainAppSettingsUpdated" after registration', () => {
            const updateHandler = jest.fn();
            AppBridge.onMessageFromApp("mainAppSettingsUpdated", updateHandler);

            // Check if the timeout was set
            expect(setTimeout).toHaveBeenCalledTimes(1);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

            // Run the timer
            jest.runAllTimers();

            // Check if the handler was called via triggerMessageHandlers (which is called by the timeout callback)
            expect(updateHandler).toHaveBeenCalledTimes(1);
            expect(updateHandler).toHaveBeenCalledWith({ theme: "dark", notificationsEnabled: false });
        });
    });

    describe('initialize', () => {
        it('should log initialization message', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            AppBridge.initialize();
            expect(consoleLogSpy).toHaveBeenCalledWith("AppBridge: Initialized (simulated listeners).");
            consoleLogSpy.mockRestore();
        });

        // Add tests here if initialize actually sets up listeners (e.g., spy on window.addEventListener)
    });
});