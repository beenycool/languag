// This class would be responsible for rendering suggestions in the task pane.
// It would interact with the SuggestionManager to get suggestions and
// provide UI elements for users to accept, reject, or ignore them.

// Assuming suggestions have this structure (ideally from a shared types file)
interface AnalysisSuggestion {
    id: string;
    originalText: string;
    suggestedText: string;
    description: string;
    // type?: 'spelling' | 'grammar' | 'style';
}

export class SuggestionPanel {
    private panelElement: HTMLElement;
    private onApplySuggestion: (suggestionId: string) => Promise<void>;
    private onDismissSuggestion?: (suggestionId: string) => void; // Optional: if suggestions can be dismissed

    /**
     * Initializes the suggestion panel.
     * @param containerElement The HTML element in the task pane where suggestions will be rendered.
     * @param applySuggestionCallback Callback function to apply a suggestion.
     * @param dismissSuggestionCallback Optional callback to dismiss a suggestion.
     */
    constructor(
        containerElement: HTMLElement,
        applySuggestionCallback: (suggestionId: string) => Promise<void>,
        dismissSuggestionCallback?: (suggestionId: string) => void
    ) {
        if (!containerElement) {
            throw new Error("SuggestionPanel: Container element not provided.");
        }
        this.panelElement = containerElement;
        this.onApplySuggestion = applySuggestionCallback;
        this.onDismissSuggestion = dismissSuggestionCallback;

        this.panelElement.innerHTML = ""; // Clear any existing content
        const header = document.createElement("h3");
        header.textContent = "Suggestions";
        this.panelElement.appendChild(header);
    }

    /**
     * Renders a list of suggestions in the panel.
     * @param suggestions Array of suggestions to display.
     */
    public renderSuggestions(suggestions: AnalysisSuggestion[]): void {
        // Clear previous suggestions, but keep the header
        while (this.panelElement.children.length > 1) {
            this.panelElement.removeChild(this.panelElement.lastChild!);
        }

        if (suggestions.length === 0) {
            const noSuggestionsMessage = document.createElement("p");
            noSuggestionsMessage.textContent = "No suggestions at the moment.";
            noSuggestionsMessage.className = "suggestion-panel-message";
            this.panelElement.appendChild(noSuggestionsMessage);
            return;
        }

        const suggestionList = document.createElement("ul");
        suggestionList.className = "suggestion-list";

        suggestions.forEach(suggestion => {
            const listItem = document.createElement("li");
            listItem.className = "suggestion-item";
            listItem.setAttribute("data-suggestion-id", suggestion.id);

            const description = document.createElement("p");
description.className = "suggestion-description";
            description.textContent = suggestion.description;

            const original = document.createElement("span");
            original.className = "suggestion-original";
            original.textContent = `Original: "${suggestion.originalText}"`;

            const suggested = document.createElement("span");
            suggested.className = "suggestion-suggested";
            suggested.textContent = `Suggested: "${suggestion.suggestedText}"`;

            const applyButton = document.createElement("button");
            applyButton.textContent = "Apply";
            applyButton.className = "suggestion-apply-button";
            applyButton.onclick = async () => {
                applyButton.disabled = true; // Prevent double-clicks
                await this.onApplySuggestion(suggestion.id);
                // Optionally, re-render or remove this item after applying
                // For now, we assume the main logic will refresh suggestions if needed.
                // If not, this item should be removed from the UI here.
                listItem.remove(); // Basic removal
            };

            listItem.appendChild(description);
            listItem.appendChild(original);
            listItem.appendChild(suggested);
            listItem.appendChild(applyButton);

            if (this.onDismissSuggestion) {
                const dismissButton = document.createElement("button");
                dismissButton.textContent = "Dismiss";
                dismissButton.className = "suggestion-dismiss-button";
                dismissButton.onclick = () => {
                    this.onDismissSuggestion!(suggestion.id);
                    listItem.remove(); // Remove from UI
                };
                listItem.appendChild(dismissButton);
            }

            suggestionList.appendChild(listItem);
        });

        this.panelElement.appendChild(suggestionList);
    }

    /**
     * Clears all suggestions from the panel and shows a default message.
     */
    public clear(): void {
        this.renderSuggestions([]);
    }
}

// CSS for this panel would typically be in taskpane.css or a dedicated CSS file.
// Example CSS (to be added to a .css file):
/*
.suggestion-list {
    list-style-type: none;
    padding: 0;
}

.suggestion-item {
    border: 1px solid #ccc;
    padding: 10px;
    margin-bottom: 10px;
    background-color: #f9f9f9;
}

.suggestion-description {
    font-weight: bold;
    margin-bottom: 5px;
}

.suggestion-original, .suggestion-suggested {
    display: block;
    font-size: 0.9em;
    margin-bottom: 3px;
}

.suggestion-original {
    color: #d9534f; // Reddish
}

.suggestion-suggested {
    color: #5cb85c; // Greenish
}

.suggestion-apply-button, .suggestion-dismiss-button {
    margin-top: 8px;
    margin-right: 5px;
    padding: 5px 10px;
    cursor: pointer;
}
.suggestion-panel-message {
    color: #777;
    font-style: italic;
}
*/