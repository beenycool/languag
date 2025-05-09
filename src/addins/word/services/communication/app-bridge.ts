// This class facilitates communication FROM the Word add-in TO the main application shell
// (e.g., if the add-in is hosted within a larger Electron app or a web application).
// The communication mechanism will depend heavily on the architecture.
// Examples:
// - Electron: IPC (ipcRenderer.send, ipcRenderer.on)
// - Web (iframe): window.parent.postMessage, window.addEventListener('message')
// - Shared Context (rare for Office Add-ins unless very tightly coupled): Direct function calls

// This will be a placeholder as the actual implementation is highly dependent on the main app's structure.

interface AppMessage {
    type: string; // e.g., 'requestAnalysis', 'settingsChanged', 'userAction'
    payload?: any;
}

interface AppResponse {
    success: boolean;
    data?: any;
    error?: string;
}

type MessageHandler = (payload: any) => void | Promise<any>;

export class AppBridge {
    private static messageHandlers: Map<string, MessageHandler[]> = new Map();

    /**
     * Sends a message to the main application.
     * @param type The type of message.
     * @param payload Optional data to send with the message.
     * @returns A promise that resolves with the response from the main application.
     */
    public static async sendMessageToApp(type: string, payload?: any): Promise<AppResponse> {
        const message: AppMessage = { type, payload };
        console.log("AppBridge: Sending message to main app", message);

        // Placeholder: Simulate sending and receiving a message.
        // In a real scenario, this would use the appropriate communication channel.
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate a response based on message type
                if (type === "requestMainAppSettings") {
                    resolve({ success: true, data: { mainFeatureEnabled: true, userTier: "premium" } });
                } else if (type === "logErrorToMainApp") {
                    console.log("AppBridge: Error logged to main app (simulated)", payload);
                    resolve({ success: true });
                } else {
                    resolve({ success: true, data: `Mock response for ${type}` });
                }
            }, 500);
        });
    }

    /**
     * Registers a handler for messages received from the main application.
     * @param messageType The type of message to handle.
     * @param handler The function to execute when a message of this type is received.
     */
    public static onMessageFromApp(messageType: string, handler: MessageHandler): void {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType)!.push(handler);
        console.log(`AppBridge: Handler registered for message type '${messageType}' from main app.`);

        // Placeholder: Simulate receiving a message (e.g., after add-in initialization)
        // This would typically be triggered by an event listener for the chosen communication channel.
        if (messageType === "mainAppSettingsUpdated") {
            setTimeout(() => {
                const mockPayload = { theme: "dark", notificationsEnabled: false };
                console.log("AppBridge: Simulating 'mainAppSettingsUpdated' message from main app", mockPayload);
                this.triggerMessageHandlers("mainAppSettingsUpdated", mockPayload);
            }, 2000);
        }
    }

    /**
     * Unregisters a message handler.
     * @param messageType The type of message.
     * @param handler The handler function to remove.
     */
    public static offMessageFromApp(messageType: string, handler: MessageHandler): void {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
                console.log(`AppBridge: Handler removed for message type '${messageType}'.`);
            }
        }
    }

    // Internal method to simulate triggering handlers
    private static async triggerMessageHandlers(messageType: string, payload: any): Promise<void> {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            console.log(`AppBridge: Triggering ${handlers.length} handler(s) for message type '${messageType}'`);
            for (const handler of handlers) {
                try {
                    await handler(payload);
                } catch (error) {
                    console.error(`AppBridge: Error in handler for message type '${messageType}':`, error);
                }
            }
        } else {
            console.warn(`AppBridge: No handlers registered for message type '${messageType}'.`);
        }
    }

    // Example: Initialize listeners when the add-in loads
    public static initialize(): void {
        // For iframe:
        // window.addEventListener('message', (event) => {
        //   if (event.origin === 'expected_main_app_origin') {
        //     const message = event.data as AppMessage;
        //     this.triggerMessageHandlers(message.type, message.payload);
        //   }
        // });

        // For Electron IPC:
        // ipcRenderer.on('message-from-main', (event, message: AppMessage) => {
        //   this.triggerMessageHandlers(message.type, message.payload);
        // });
        console.log("AppBridge: Initialized (simulated listeners).");
    }
}

// Call initialize when the add-in loads its scripts.
// AppBridge.initialize(); // This would typically be called in your taskpane.ts or similar entry point.