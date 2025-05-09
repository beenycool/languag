/* global Office, Word */

// This class facilitates communication FROM the add-in TO the Word host application.
// While many interactions are direct (e.g., Word.run), this bridge can
// centralize more complex or specific host interactions, or manage event listeners
// related to the host environment.

// Basic HTML escaping utility
function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "&amp;quot;")
         .replace(/'/g, "&#039;");
}

export class HostBridge {

    /**
     * Checks if the current host is Microsoft Word.
     * @returns True if the host is Word, false otherwise.
     */
    public static isWordHost(): boolean {
        return Office.context.host === Office.HostType.Word;
    }

    /**
     * Gets information about the host environment.
     * @returns A promise that resolves to host information.
     */
    public static getHostInfo(): Promise<Office.ContextInformation> {
        return new Promise((resolve) => {
            // Office.context provides basic info directly.
            const hostInfo: Office.ContextInformation = {
                host: Office.context.host,
                platform: Office.context.platform,
                version: Office.context.diagnostics ? Office.context.diagnostics.version : "N/A",
            };
            resolve(hostInfo);
        });
    }

    /**
     * Displays a message to the user, potentially using a dialog for simplicity.
     * True host notifications are more complex and often manifest-driven.
     * @param message The message to display.
     * @param title An optional title for the message dialog.
     */
    public static async showMessage(message: string, title: string = "Notification"): Promise<void> {
        // Create a simple HTML string for the dialog content
        const dialogContent = `<html><head><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,sans-serif;padding:10px;}</style></head><body><p>${escapeHtml(message)}</p></body></html>`;
        const dialogUrl = "data:text/html;charset=utf-8," + encodeURIComponent(dialogContent);

        return new Promise((resolve, reject) => {
            Office.context.ui.displayDialogAsync(dialogUrl, { height: 15, width: 30, displayInIframe: true }, (asyncResult: Office.AsyncResult<Office.Dialog>) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error("Error displaying message dialog:", asyncResult.error.message);
                    reject(asyncResult.error);
                } else {
                    const dialog = asyncResult.value;
                    // Dialogs typically require a messageParent call from the dialog to close,
                    // or they can be closed by the user. For a simple notification,
                    // we might not need to interact further, or auto-close it after a timeout from within the dialog.
                    // For this example, we'll assume it's a transient notification.
                    // To auto-close, the dialog's HTML would need script to call messageParent.
                    // For now, we resolve, and the user closes it.
                    // To make it auto-close, the dialog's HTML would need:
                    // <script> Office.onReady(() => { setTimeout(() => Office.context.ui.messageParent('close'), 3000); }); </script>
                    // And the caller would listen for the 'close' message.
                    // This is simplified here.
                    dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg: any) => { // Office.DialogParentMessageReceivedEventArgs
                        if(arg.message === 'close') {
                           dialog.close();
                           resolve();
                        }
                    });
                     // If we don't expect a message back to close it, resolve immediately.
                     // resolve(); // Or resolve after a timeout if we want to simulate auto-close without complex dialog script
                     // For a simple notification, let's resolve and let user close it.
                     // Or, if we want to programmatically close it after a delay without complex dialog logic:
                     setTimeout(() => {
                        try {
                            dialog.close();
                        } catch (e) {
                            // ignore if already closed
                        }
                        resolve();
                     }, 3000); // Auto-close after 3 seconds
                }
            });
        });
    }

    // closeNotification is removed as the new showMessage uses a dialog that auto-closes or is user-closed.

    /**
     * Prompts the user with a dialog.
     * @param url The URL of the dialog page.
     * @param options Dialog options (height, width, displayInIframe).
     * @returns A promise that resolves to the dialog object.
     */
    public static async openDialog(url: string, options?: Office.DialogOptions): Promise<Office.Dialog> {
        return new Promise((resolve, reject) => {
            Office.context.ui.displayDialogAsync(url, options || { height: 50, width: 50 }, (asyncResult: Office.AsyncResult<Office.Dialog>) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error("Error opening dialog:", asyncResult.error.message);
                    reject(asyncResult.error);
                } else {
                    resolve(asyncResult.value);
                }
            });
        });
    }

    // Removing theme change handlers as they caused type errors and might not be universally supported
    // or require more specific typings/setup.
    // /**
    //  * Registers a handler for Office theme changes.
    //  * @param handler Callback function to execute when the theme changes.
    //  */
    // public static onOfficeThemeChanged(handler: (args: { officeTheme: Office.OfficeTheme }) => void): void {
    //     if (Office.context.officeThemeChanged) {
    //         Office.context.officeThemeChanged.addHandler(handler);
    //     } else {
    //         console.warn("HostBridge: Office theme change events are not supported in this host or version.");
    //     }
    // }

    // /**
    //  * Removes a handler for Office theme changes.
    //  * @param handler The callback function to remove.
    //  */
    // public static offOfficeThemeChanged(handler: (args: { officeTheme: Office.OfficeTheme }) => void): void {
    //      if (Office.context.officeThemeChanged) {
    //         Office.context.officeThemeChanged.removeHandler(handler);
    //     }
    // }
}