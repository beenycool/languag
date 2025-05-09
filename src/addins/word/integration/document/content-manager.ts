/* global Word */

export class ContentManager {
    /**
     * Gets the entire document content as OOXML.
     */
    public static async getDocumentContentOoxml(): Promise<string> {
        return Word.run(async (context) => {
            const body = context.document.body;
            const ooxml = body.getOoxml();
            await context.sync();
            return ooxml.value;
        });
    }

    /**
     * Sets the entire document content from an OOXML string.
     * @param ooxml The OOXML string to set.
     */
    public static async setDocumentContentOoxml(ooxml: string): Promise<void> {
        return Word.run(async (context) => {
            const body = context.document.body;
            body.insertOoxml(ooxml, Word.InsertLocation.replace);
            await context.sync();
        });
    }

    /**
     * Gets the selected content as OOXML.
     */
    public static async getSelectedContentOoxml(): Promise<string> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            const ooxml = range.getOoxml();
            await context.sync();
            return ooxml.value;
        });
    }

    /**
     * Inserts OOXML into the current selection.
     * @param ooxml The OOXML string to insert.
     */
    public static async insertOoxmlAtSelection(ooxml: string): Promise<void> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            range.insertOoxml(ooxml, Word.InsertLocation.replace);
            await context.sync();
        });
    }

    /**
     * Gets the plain text of the entire document.
     */
    public static async getDocumentText(): Promise<string> {
        return Word.run(async (context) => {
            const body = context.document.body;
            body.load("text");
            await context.sync();
            return body.text;
        });
    }

    /**
     * Inserts plain text at the current selection.
     * @param text The text to insert.
     */
    public static async insertTextAtSelection(text: string): Promise<void> {
        return Word.run(async (context) => {
            const range = context.document.getSelection();
            range.insertText(text, Word.InsertLocation.replace);
            await context.sync();
        });
    }
}