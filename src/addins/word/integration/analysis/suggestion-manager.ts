/* global Word */

import { AnalysisBridge } from "./analysis-bridge"; // Assuming AnalysisBridge provides suggestion types

// Re-declaring for clarity within this module, ideally import from a shared types location
interface AnalysisSuggestion {
    id: string;
    originalText: string; // The text segment in the document that this suggestion targets
    suggestedText: string;
    description: string;
    // Potentially add:
    // range?: { startIndex: number, endIndex: number }; // If suggestions are tied to specific text ranges
    // type?: 'spelling' | 'grammar' | 'style';
}

export class SuggestionManager {
    private static activeSuggestions: AnalysisSuggestion[] = [];

    /**
     * Fetches suggestions for the current document or a specific text content.
     * @param content The content to analyze. Can be plain text or OOXML.
     * @param contentType The type of the content.
     */
    public static async fetchSuggestions(content: string, contentType: 'text' | 'ooxml'): Promise<AnalysisSuggestion[]> {
        try {
            const result = await AnalysisBridge.analyzeContent({ text: content, contentType });
            this.activeSuggestions = result.suggestions;
            console.log("Suggestions fetched:", this.activeSuggestions);
            return this.activeSuggestions;
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            this.activeSuggestions = [];
            return [];
        }
    }

    /**
     * Gets the currently active suggestions.
     */
    public static getActiveSuggestions(): AnalysisSuggestion[] {
        return this.activeSuggestions;
    }

    /**
     * Clears all active suggestions.
     */
    public static clearSuggestions(): void {
        this.activeSuggestions = [];
        console.log("Suggestions cleared.");
    }

    /**
     * Applies a specific suggestion to the document.
     * This is a complex operation and requires careful handling of ranges and content replacement.
     * The current implementation is a placeholder and needs to be robustly implemented.
     * @param suggestionId The ID of the suggestion to apply.
     */
    public static async applySuggestion(suggestionId: string): Promise<void> {
        const suggestion = this.activeSuggestions.find(s => s.id === suggestionId);
        if (!suggestion) {
            console.error("Suggestion not found:", suggestionId);
            return;
        }

        console.log("Applying suggestion:", suggestion);

        // This is a simplified placeholder.
        // A real implementation would need to:
        // 1. Find the 'originalText' in the document. This can be tricky if the text appears multiple times
        //    or if the document has changed since suggestions were fetched.
        //    - Using Word.Range.search might be an option.
        //    - If suggestions are tied to specific ranges (e.g., from content controls or precise indexing),
        //      that would be more reliable.
        // 2. Replace the found range with 'suggestedText'.
        //    - Word.Range.insertText(suggestion.suggestedText, Word.InsertLocation.replace)

        return Word.run(async (context) => {
            // Placeholder: find the first occurrence of the original text and replace it.
            // This is NOT robust for real-world use.
            const searchResults = context.document.body.search(suggestion.originalText, { matchCase: true, matchWholeWord: true });
            searchResults.load("items");
            await context.sync();

            if (searchResults.items.length > 0) {
                // Apply to the first found instance.
                // A more sophisticated approach would be needed to handle multiple occurrences
                // or to ensure the correct instance is targeted.
                searchResults.items[0].insertText(suggestion.suggestedText, Word.InsertLocation.replace);
                await context.sync();
                console.log(`Suggestion '${suggestionId}' applied.`);

                // Remove the applied suggestion from the active list
                this.activeSuggestions = this.activeSuggestions.filter(s => s.id !== suggestionId);
            } else {
                console.warn(`Could not find text "${suggestion.originalText}" to apply suggestion.`);
            }
        }).catch(error => {
            console.error("Error applying suggestion:", error);
        });
    }

    // Future enhancements:
    // - Highlight suggestions in the document.
    // - Navigate to suggestion locations.
    // - Handle overlapping suggestions.
}