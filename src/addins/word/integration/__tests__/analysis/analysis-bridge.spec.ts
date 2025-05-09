import { AnalysisBridge } from '../../analysis/analysis-bridge';

// Use Jest's fake timers to control setTimeout
jest.useFakeTimers();

describe('AnalysisBridge', () => {

  beforeEach(() => {
    // Clear any pending timers before each test
    jest.clearAllTimers();
    // Spy on console.log if needed, but not essential for functionality testing
  });

  describe('analyzeContent', () => {
    it('should return a promise', () => {
      const request = { text: "Some text", contentType: 'text' as 'text' };
      const result = AnalysisBridge.analyzeContent(request);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve with mock suggestions after timeout', async () => {
      const request = { text: "This has an eror and is veri good.", contentType: 'text' as 'text' };
      const promise = AnalysisBridge.analyzeContent(request);

      // Fast-forward time until the timeout completes
      jest.runAllTimers();

      // Wait for the promise to resolve
      const result = await promise;

      expect(result).toBeDefined();
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "sugg1", originalText: "eror", suggestedText: "error" }),
          expect.objectContaining({ id: "sugg2", originalText: "veri good", suggestedText: "very good" })
        ])
      );
    });

    it('should return suggestions based on input text (mock logic)', async () => {
      // Test case 1: Contains "eror"
      const request1 = { text: "Fix this eror.", contentType: 'text' as 'text' };
      const promise1 = AnalysisBridge.analyzeContent(request1);
      jest.runAllTimers();
      const result1 = await promise1;
      expect(result1.suggestions.length).toBe(1);
      expect(result1.suggestions[0]).toEqual(expect.objectContaining({ id: "sugg1" }));

      // Test case 2: Contains "veri good"
      const request2 = { text: "This is veri good.", contentType: 'text' as 'text' };
      const promise2 = AnalysisBridge.analyzeContent(request2);
      jest.runAllTimers();
      const result2 = await promise2;
      expect(result2.suggestions.length).toBe(1);
      expect(result2.suggestions[0]).toEqual(expect.objectContaining({ id: "sugg2" }));

      // Test case 3: Contains both
      const request3 = { text: "Fix this eror it is veri good.", contentType: 'text' as 'text' };
      const promise3 = AnalysisBridge.analyzeContent(request3);
      jest.runAllTimers();
      const result3 = await promise3;
      expect(result3.suggestions.length).toBe(2);

      // Test case 4: Contains neither
      const request4 = { text: "This is correct.", contentType: 'text' as 'text' };
      const promise4 = AnalysisBridge.analyzeContent(request4);
      jest.runAllTimers();
      const result4 = await promise4;
      expect(result4.suggestions.length).toBe(0);
    });

    it('should handle different content types in the request (though mock logic doesnt use it)', async () => {
        const requestOoxml = { text: "<w:p><w:r><w:t>Has eror</w:t></w:r></w:p>", contentType: 'ooxml' as 'ooxml' };
        const promise = AnalysisBridge.analyzeContent(requestOoxml);
        jest.runAllTimers();
        const result = await promise;
        // The mock logic only checks the text string, regardless of contentType
        expect(result.suggestions.length).toBe(1);
        expect(result.suggestions[0]).toEqual(expect.objectContaining({ id: "sugg1" }));
    });

    // Add tests for potential error handling if the bridge implementation changes
    // e.g., it('should reject the promise if the underlying communication fails', async () => { ... });
  });

});