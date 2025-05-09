/* global Word, Office */

export class ChangeTracker {
    private static isTracking = false;
    private static previousOoxml: string | null = null;

    /**
     * Starts tracking document content changes.
     * @param onChange Callback function when a change is detected.
     * @param interval Check interval in milliseconds.
     */
    public static async startTracking(onChange: (newOoxml: string, oldOoxml: string | null) => void, interval: number = 1000): Promise<void> {
        if (this.isTracking) {
            console.warn("Change tracking is already active.");
            return;
        }

        this.isTracking = true;
        this.previousOoxml = await this.getCurrentOoxml();

        const track = async () => {
            if (!this.isTracking) {
                return;
            }

            try {
                const currentOoxml = await this.getCurrentOoxml();
                if (currentOoxml !== this.previousOoxml) {
                    onChange(currentOoxml, this.previousOoxml);
                    this.previousOoxml = currentOoxml;
                }
            } catch (error) {
                console.error("Error during change tracking:", error);
                // Optionally, stop tracking on error or implement retry logic
            }

            if (this.isTracking) {
                setTimeout(track, interval);
            }
        };

        setTimeout(track, interval);
        console.log("Document change tracking started.");
    }

    /**
     * Stops tracking document content changes.
     */
    public static stopTracking(): void {
        if (!this.isTracking) {
            console.warn("Change tracking is not active.");
            return;
        }
        this.isTracking = false;
        this.previousOoxml = null;
        console.log("Document change tracking stopped.");
    }

    private static async getCurrentOoxml(): Promise<string> {
        return Word.run(async (context) => {
            const body = context.document.body;
            const ooxml = body.getOoxml();
            await context.sync();
            return ooxml.value;
        });
    }

    /**
     * Subscribes to document content change events using Office.js events if available.
     * This is a more efficient way to track changes if the host supports it.
     * Note: Word specific `onDataChanged` for the document body is not directly available.
     * This example demonstrates a general approach for `BindingDataChangedEventArgs`.
     * For document-wide changes, polling (like `startTracking`) or more specific eventing
     * (e.g., on paragraphs or content controls) might be needed.
     *
     * @param handler The event handler function.
     */
    public static async onDocumentChanged(handler: (event: Office.DocumentSelectionChangedEventArgs) => void): Promise<void> {
        // This is a placeholder for a more specific document change event if one becomes available
        // or if using bindings to track specific parts of the document.
        // For now, it uses DocumentSelectionChanged as an example, which is not ideal for content changes.
        // Consider using the polling method `startTracking` for reliable content change detection.
        console.warn("onDocumentChanged is using DocumentSelectionChangedEventArgs as a placeholder. For reliable content change detection, use startTracking or specific content control events.");
        return new Promise<void>((resolve, reject) => {
            Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, handler, (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    reject(asyncResult.error);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Unsubscribes from document content change events.
     * @param handler The event handler function to remove.
     */
    public static async offDocumentChanged(handler: (event: Office.DocumentSelectionChangedEventArgs) => void): Promise<void> {
         return new Promise<void>((resolve, reject) => {
            Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler: handler as (eventArgs?: any) => void }, (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    reject(asyncResult.error);
                } else {
                    resolve();
                }
            });
        });
    }
}