import { SuggestionManager } from '../../analysis/suggestion-manager';
import { AnalysisBridge } from '../../analysis/analysis-bridge'; // Import to mock its methods

// Mock AnalysisBridge
jest.mock('../../analysis/analysis-bridge');
const mockAnalyzeContent = AnalysisBridge.analyzeContent as jest.Mock;

// Mock Word.js API
const mockRangeInsertTextSuggestion = jest.fn();
const mockSearchResultsLoad = jest.fn();
const mockSearch = jest.fn(() => ({
  load: mockSearchResultsLoad,
  items: [] as any[], // Initialize with empty array
}));
const mockSyncSuggestion = jest.fn().mockResolvedValue(undefined);

const mockSuggestionRequestContext = {
  sync: mockSyncSuggestion,
  document: {
    body: {
      search: mockSearch,
    },
  },
};

global.Word = {
  run: jest.fn(async (callback) => {
    await callback(mockSuggestionRequestContext);
  }),
  InsertLocation: {
    replace: "Replace",
  },
} as any;

// Define mock suggestions
const mockSuggestion1 = { id: "s1", originalText: "eror", suggestedText: "error", description: "Spelling" };
const mockSuggestion2 = { id: "s2", originalText: "veri good", suggestedText: "very good", description: "Typo" };
const mockAnalysisResult = { suggestions: [mockSuggestion1, mockSuggestion2] };

describe('SuggestionManager', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the state of SuggestionManager before each test
    SuggestionManager.clearSuggestions();
    // Reset mock return values and implementations
    mockAnalyzeContent.mockResolvedValue(mockAnalysisResult); // Default mock response
    // Reset search results mock for applySuggestion
    mockSearch.mockImplementation(() => ({
        load: mockSearchResultsLoad,
        items: [] // Start with no items found
    }));
  });

  describe('fetchSuggestions', () => {
    it('should call AnalysisBridge.analyzeContent with the provided content and type', async () => {
      const content = "Test content with eror.";
      const contentType = 'text';
      await SuggestionManager.fetchSuggestions(content, contentType);
      expect(mockAnalyzeContent).toHaveBeenCalledWith({ text: content, contentType });
    });

    it('should store the fetched suggestions internally', async () => {
      const content = "Test content with eror.";
      await SuggestionManager.fetchSuggestions(content, 'text');
      expect(SuggestionManager.getActiveSuggestions()).toEqual(mockAnalysisResult.suggestions);
    });

    it('should return the fetched suggestions', async () => {
      const content = "Test content with eror.";
      const suggestions = await SuggestionManager.fetchSuggestions(content, 'text');
      expect(suggestions).toEqual(mockAnalysisResult.suggestions);
    });

    it('should clear previous suggestions when fetching new ones', async () => {
      // Fetch initial suggestions
      await SuggestionManager.fetchSuggestions("First eror", 'text');
      expect(SuggestionManager.getActiveSuggestions().length).toBeGreaterThan(0);

      // Fetch new suggestions (mock returns different result)
      const newMockResult = { suggestions: [{ id: "s3", originalText: "anothr", suggestedText: "another", description: "New" }] };
      mockAnalyzeContent.mockResolvedValue(newMockResult);
      await SuggestionManager.fetchSuggestions("Second anothr", 'text');

      expect(SuggestionManager.getActiveSuggestions()).toEqual(newMockResult.suggestions);
    });

    it('should handle errors from AnalysisBridge.analyzeContent', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error("Analysis failed");
      mockAnalyzeContent.mockRejectedValue(mockError);

      const suggestions = await SuggestionManager.fetchSuggestions("Error case", 'text');

      expect(suggestions).toEqual([]); // Should return empty array on error
      expect(SuggestionManager.getActiveSuggestions()).toEqual([]); // Internal state should be empty
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching suggestions:", mockError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getActiveSuggestions', () => {
    it('should return the currently stored suggestions', async () => {
      await SuggestionManager.fetchSuggestions("Some eror", 'text');
      const active = SuggestionManager.getActiveSuggestions();
      expect(active).toEqual(mockAnalysisResult.suggestions);
    });

    it('should return an empty array if no suggestions have been fetched', () => {
      const active = SuggestionManager.getActiveSuggestions();
      expect(active).toEqual([]);
    });
  });

  describe('clearSuggestions', () => {
    it('should clear the internally stored suggestions', async () => {
      await SuggestionManager.fetchSuggestions("Some eror", 'text');
      expect(SuggestionManager.getActiveSuggestions().length).toBeGreaterThan(0);
      SuggestionManager.clearSuggestions();
      expect(SuggestionManager.getActiveSuggestions()).toEqual([]);
    });
  });

  describe('applySuggestion', () => {
    beforeEach(async () => {
      // Ensure suggestions are loaded before tests that apply them
      await SuggestionManager.fetchSuggestions("Test with eror and veri good", 'text');
    });

    it('should call Word.run', async () => {
      await SuggestionManager.applySuggestion(mockSuggestion1.id);
      expect(Word.run).toHaveBeenCalled();
    });

    it('should search for the originalText of the suggestion', async () => {
      await SuggestionManager.applySuggestion(mockSuggestion1.id);
      expect(mockSearch).toHaveBeenCalledWith(mockSuggestion1.originalText, { matchCase: true, matchWholeWord: true });
      expect(mockSearchResultsLoad).toHaveBeenCalledWith("items");
      expect(mockSyncSuggestion).toHaveBeenCalledTimes(2); // Once for search load, once for insert
    });

    it('should call insertText on the found range item if search is successful', async () => {
      // Mock search result for this test
      const mockFoundRange = { insertText: mockRangeInsertTextSuggestion };
      mockSearch.mockImplementationOnce(() => ({
          load: mockSearchResultsLoad,
          items: [mockFoundRange] // Simulate finding one item
      }));

      await SuggestionManager.applySuggestion(mockSuggestion1.id);

      expect(mockRangeInsertTextSuggestion).toHaveBeenCalledWith(mockSuggestion1.suggestedText, Word.InsertLocation.replace);
      expect(mockSyncSuggestion).toHaveBeenCalledTimes(2); // load + insert
    });

     it('should remove the applied suggestion from the active list', async () => {
        const mockFoundRange = { insertText: mockRangeInsertTextSuggestion };
        mockSearch.mockImplementationOnce(() => ({
            load: mockSearchResultsLoad,
            items: [mockFoundRange]
        }));

        expect(SuggestionManager.getActiveSuggestions()).toContainEqual(mockSuggestion1);
        await SuggestionManager.applySuggestion(mockSuggestion1.id);
        expect(SuggestionManager.getActiveSuggestions()).not.toContainEqual(mockSuggestion1);
        expect(SuggestionManager.getActiveSuggestions()).toContainEqual(mockSuggestion2); // Ensure others remain
    });

    it('should log a warning and not call insertText if the search finds no items', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // Ensure search returns no items (default mock behavior in beforeEach)
      mockSearch.mockImplementationOnce(() => ({
          load: mockSearchResultsLoad,
          items: []
      }));

      await SuggestionManager.applySuggestion(mockSuggestion1.id);

      expect(mockRangeInsertTextSuggestion).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(`Could not find text "${mockSuggestion1.originalText}" to apply suggestion.`);
      expect(mockSyncSuggestion).toHaveBeenCalledTimes(1); // Only for search load
      // Suggestion should NOT be removed if not applied
      expect(SuggestionManager.getActiveSuggestions()).toContainEqual(mockSuggestion1);

      consoleWarnSpy.mockRestore();
    });

    it('should log an error if the suggestion ID is not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await SuggestionManager.applySuggestion("nonexistent-id");
      expect(Word.run).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Suggestion not found:", "nonexistent-id");
      consoleErrorSpy.mockRestore();
    });

    it('should handle errors during Word.run when applying suggestion', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockWordError = new Error("Word failed during apply");
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockWordError; });

      await SuggestionManager.applySuggestion(mockSuggestion1.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error applying suggestion:", mockWordError);
      // Suggestion should ideally not be removed if application failed
      expect(SuggestionManager.getActiveSuggestions()).toContainEqual(mockSuggestion1);

      consoleErrorSpy.mockRestore();
    });
  });
});