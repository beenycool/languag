/* global Word */

// This class handles conversion between different content formats
// that might be needed for the Analysis Pipeline or for displaying suggestions.

export class FormatConverter {

    /**
     * Converts OOXML to plain text.
     * This is a simplified conversion. For more complex scenarios,
     * a more robust OOXML parser might be needed on the server-side or via a library.
     * Word.js API itself doesn't offer a direct OOXML to plain text conversion locally
     * without inserting it into a (hidden) document.
     *
     * @param ooxml The OOXML string.
     * @returns A promise that resolves to the plain text.
     */
    public static async ooxmlToPlainText(ooxml: string): Promise<string> {
        return Word.run(async (context) => {
            // Create a temporary, hidden document or a temporary range to convert OOXML.
            // For simplicity, this example inserts into a new paragraph in the current body,
            // gets the text, and then deletes it. This is not ideal for performance or if the document is large.
            // A better approach might involve a hidden document if the API supports it,
            // or sending OOXML to a service that can convert it.

            const tempParagraph = context.document.body.insertParagraph("", Word.InsertLocation.start);
            tempParagraph.insertOoxml(ooxml, Word.InsertLocation.replace);
            tempParagraph.load("text");
            await context.sync();

            const text = tempParagraph.text;
            tempParagraph.delete(); // Clean up the temporary paragraph
            await context.sync();

            return text;
        });
    }

    /**
     * Converts plain text to a simple OOXML paragraph.
     * @param text The plain text.
     * @returns A promise that resolves to an OOXML string representing the text in a paragraph.
     */
    public static async plainTextToOoxml(text: string): Promise<string> {
        return Word.run(async (context) => {
            // Create a temporary paragraph, set its text, then get its OOXML.
            const tempParagraph = context.document.body.insertParagraph(text, Word.InsertLocation.start);
            const ooxml = tempParagraph.getOoxml();
            await context.sync();

            const ooxmlValue = ooxml.value;
            tempParagraph.delete(); // Clean up
            await context.sync();

            return ooxmlValue;
        });
    }

    // Add other conversion methods as needed, for example:
    // - HTML to OOXML (might require a server-side component or a robust library)
    // - OOXML to HTML (similarly, might require external processing)
    // - Markdown to OOXML, etc.
}