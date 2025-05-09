import { SuggestionPanel } from '../../panels/suggestion-panel';

// Define mock suggestion type matching the one in suggestion-panel.ts
interface AnalysisSuggestion {
    id: string;
    originalText: string;
    suggestedText: string;
    description: string;
}

// Mock callbacks
const mockApplySuggestionCallback = jest.fn().mockResolvedValue(undefined);
const mockDismissSuggestionCallback = jest.fn();

// Mock suggestions data
const mockSuggestions: AnalysisSuggestion[] = [
    { id: "s1", originalText: "teh", suggestedText: "the", description: "Spelling" },
    { id: "s2", originalText: "wierd", suggestedText: "weird", description: "Spelling" },
    { id: "s3", originalText: "go to store", suggestedText: "go to the store", description: "Grammar" },
];

describe('SuggestionPanel', () => {
    let container: HTMLElement;
    let panel: SuggestionPanel;

    beforeEach(() => {
        // Create a fresh container element for each test
        container = document.createElement('div');
        document.body.appendChild(container); // Add to document body for element selection

        // Clear mocks before each test
        mockApplySuggestionCallback.mockClear();
        mockDismissSuggestionCallback.mockClear();
    });

    afterEach(() => {
        // Clean up the container element
        document.body.removeChild(container);
    });

    describe('Constructor', () => {
        it('should throw an error if container element is not provided', () => {
            expect(() => new SuggestionPanel(null as any, mockApplySuggestionCallback)).toThrow("Container element not provided.");
        });

        it('should clear the container and add a header', () => {
            container.innerHTML = '<p>Old content</p>';
            panel = new SuggestionPanel(container, mockApplySuggestionCallback);
            expect(container.innerHTML).toContain('<h3>Suggestions</h3>');
            expect(container.innerHTML).not.toContain('<p>Old content</p>');
            expect(container.children.length).toBe(1); // Only the header initially
        });

        it('should store the provided callbacks', () => {
            panel = new SuggestionPanel(container, mockApplySuggestionCallback, mockDismissSuggestionCallback);
            expect((panel as any).onApplySuggestion).toBe(mockApplySuggestionCallback);
            expect((panel as any).onDismissSuggestion).toBe(mockDismissSuggestionCallback);
        });
    });

    describe('renderSuggestions', () => {
        beforeEach(() => {
            // Initialize panel for rendering tests
            panel = new SuggestionPanel(container, mockApplySuggestionCallback, mockDismissSuggestionCallback);
        });

        it('should display a message if no suggestions are provided', () => {
            panel.renderSuggestions([]);
            const messageElement = container.querySelector('.suggestion-panel-message');
            expect(messageElement).not.toBeNull();
            expect(messageElement?.textContent).toBe("No suggestions at the moment.");
            expect(container.querySelector('.suggestion-list')).toBeNull();
        });

        it('should render a list item for each suggestion', () => {
            panel.renderSuggestions(mockSuggestions);
            const listItems = container.querySelectorAll('.suggestion-item');
            expect(listItems.length).toBe(mockSuggestions.length);
        });

        it('should set the suggestion ID as a data attribute', () => {
            panel.renderSuggestions(mockSuggestions);
            const firstItem = container.querySelector('.suggestion-item');
            expect(firstItem?.getAttribute('data-suggestion-id')).toBe(mockSuggestions[0].id);
        });

        it('should display suggestion description, original, and suggested text', () => {
            panel.renderSuggestions([mockSuggestions[0]]);
            const item = container.querySelector('.suggestion-item');
            expect(item?.querySelector('.suggestion-description')?.textContent).toBe(mockSuggestions[0].description);
            expect(item?.querySelector('.suggestion-original')?.textContent).toContain(mockSuggestions[0].originalText);
            expect(item?.querySelector('.suggestion-suggested')?.textContent).toContain(mockSuggestions[0].suggestedText);
        });

        it('should create an "Apply" button for each suggestion', () => {
            panel.renderSuggestions(mockSuggestions);
            const applyButtons = container.querySelectorAll('.suggestion-apply-button');
            expect(applyButtons.length).toBe(mockSuggestions.length);
        });

        it('should call onApplySuggestion with the correct ID when "Apply" is clicked', async () => {
            panel.renderSuggestions([mockSuggestions[0]]);
            const applyButton = container.querySelector('.suggestion-apply-button') as HTMLButtonElement;
            expect(applyButton).not.toBeNull();

            applyButton.click();

            // Check if button is disabled immediately
            expect(applyButton.disabled).toBe(true);

            // Wait for the async callback to potentially resolve
            await mockApplySuggestionCallback.mock.results[0].value; // Wait for the promise

            expect(mockApplySuggestionCallback).toHaveBeenCalledWith(mockSuggestions[0].id);
        });

         it('should remove the list item after "Apply" is clicked and callback resolves', async () => {
            panel.renderSuggestions([mockSuggestions[0]]);
            const listItem = container.querySelector('.suggestion-item');
            const applyButton = listItem?.querySelector('.suggestion-apply-button') as HTMLButtonElement;

            expect(listItem).not.toBeNull();
            applyButton.click();
            await mockApplySuggestionCallback.mock.results[0].value; // Wait for promise

            // Check if the item was removed from the container
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[0].id}"]`)).toBeNull();
        });


        it('should create a "Dismiss" button if onDismissSuggestion callback is provided', () => {
            // Panel initialized with dismiss callback in beforeEach
            panel.renderSuggestions(mockSuggestions);
            const dismissButtons = container.querySelectorAll('.suggestion-dismiss-button');
            expect(dismissButtons.length).toBe(mockSuggestions.length);
        });

        it('should NOT create a "Dismiss" button if callback is not provided', () => {
            // Initialize without dismiss callback
            panel = new SuggestionPanel(container, mockApplySuggestionCallback);
            panel.renderSuggestions(mockSuggestions);
            const dismissButtons = container.querySelectorAll('.suggestion-dismiss-button');
            expect(dismissButtons.length).toBe(0);
        });

        it('should call onDismissSuggestion with the correct ID when "Dismiss" is clicked', () => {
            panel.renderSuggestions([mockSuggestions[1]]);
            const dismissButton = container.querySelector('.suggestion-dismiss-button') as HTMLButtonElement;
            expect(dismissButton).not.toBeNull();

            dismissButton.click();

            expect(mockDismissSuggestionCallback).toHaveBeenCalledWith(mockSuggestions[1].id);
        });

         it('should remove the list item after "Dismiss" is clicked', () => {
            panel.renderSuggestions([mockSuggestions[1]]);
            const listItem = container.querySelector('.suggestion-item');
            const dismissButton = listItem?.querySelector('.suggestion-dismiss-button') as HTMLButtonElement;

            expect(listItem).not.toBeNull();
            dismissButton.click();

            // Check if the item was removed from the container
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[1].id}"]`)).toBeNull();
        });

        it('should clear previous suggestions before rendering new ones', () => {
            // Render first set
            panel.renderSuggestions([mockSuggestions[0]]);
            expect(container.querySelectorAll('.suggestion-item').length).toBe(1);
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[0].id}"]`)).not.toBeNull();

            // Render second set
            panel.renderSuggestions([mockSuggestions[1], mockSuggestions[2]]);
            expect(container.querySelectorAll('.suggestion-item').length).toBe(2);
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[0].id}"]`)).toBeNull(); // Should be gone
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[1].id}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-suggestion-id="${mockSuggestions[2].id}"]`)).not.toBeNull();
        });
    });

    describe('clear', () => {
        it('should call renderSuggestions with an empty array', () => {
            panel = new SuggestionPanel(container, mockApplySuggestionCallback);
            const renderSpy = jest.spyOn(panel, 'renderSuggestions');
            panel.clear();
            expect(renderSpy).toHaveBeenCalledWith([]);
        });

        it('should result in the "no suggestions" message being displayed', () => {
            panel = new SuggestionPanel(container, mockApplySuggestionCallback);
            panel.renderSuggestions(mockSuggestions); // Add some suggestions first
            panel.clear();
            const messageElement = container.querySelector('.suggestion-panel-message');
            expect(messageElement).not.toBeNull();
            expect(messageElement?.textContent).toBe("No suggestions at the moment.");
            expect(container.querySelector('.suggestion-list')).toBeNull();
        });
    });
});