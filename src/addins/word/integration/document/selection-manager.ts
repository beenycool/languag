/* global Word */

export class SelectionManager {
    /**
     * Gets the current selection's text.
     */
    public static async getSelectedText(): Promise<string> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            range.load("text");
            await context.sync();
            return range.text;
        });
    }

    /**
     * Replaces the current selection with new text.
     * @param text The text to replace the selection with.
     */
    public static async setSelectedText(text: string): Promise<void> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            range.insertText(text, Word.InsertLocation.replace);
            await context.sync();
        });
    }

    /**
     * Clears the current selection.
     */
    public static async clearSelection(): Promise<void> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            range.clear();
            await context.sync();
        });
    }

    /**
     * Subscribes to selection change events.
     * @param handler The event handler function.
     */
    public static async onSelectionChanged(handler: (event: Office.DocumentSelectionChangedEventArgs) => void): Promise<void> {
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
     * Unsubscribes from selection change events.
     * @param handler The event handler function to remove.
     */
    public static async offSelectionChanged(handler: (event: Office.DocumentSelectionChangedEventArgs) => void): Promise<void> {
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