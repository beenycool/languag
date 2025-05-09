import { FeatureExtractor } from '../feature-extractor';
import { IDocumentSegment, IDocumentContext } from '../../../shared/types/context'; // Updated import
import { sanitizeInput } from '../../../shared/utils/sanitization';

jest.mock('../../../shared/utils/sanitization', () => ({
  sanitizeInput: jest.fn(input => input), // Mock sanitizeInput to return input by default
}));


describe('FeatureExtractor', () => {
  let featureExtractor: FeatureExtractor;
  const defaultMaxSegmentSize = 10000;
  const defaultMaxKeywordsInputLength = 5000;
  const defaultSanitizeKeywords = true;


  beforeEach(() => {
    featureExtractor = new FeatureExtractor(defaultMaxSegmentSize, defaultMaxKeywordsInputLength, defaultSanitizeKeywords);
    (sanitizeInput as jest.Mock).mockClear(); // Clear mock calls
  });

  // Optional: Define a mockDocContext if you plan to pass it, otherwise 'undefined' is fine.
  // const mockDocContext: IDocumentContext = { uri: 'test-doc.txt' };

  describe('extractFeatures', () => {
    it('should throw an error if segment text exceeds maxSegmentSize', () => {
      const smallLimitExtractor = new FeatureExtractor(50, defaultMaxKeywordsInputLength, defaultSanitizeKeywords);
      const longSegment: IDocumentSegment = { id: 's-limit', text: 'a'.repeat(51), range: { start: 0, end: 51 } };
      expect(() => {
        smallLimitExtractor.extractFeatures(longSegment, undefined);
      }).toThrowError('Segment text size (51 characters) exceeds the configured limit of 50 characters.');
    });

    it('should not throw an error if segment text is within maxSegmentSize', () => {
      const smallLimitExtractor = new FeatureExtractor(50, defaultMaxKeywordsInputLength, defaultSanitizeKeywords);
      const shortSegment: IDocumentSegment = { id: 's-limit-ok', text: 'a'.repeat(50), range: { start: 0, end: 50 } };
      expect(() => {
        smallLimitExtractor.extractFeatures(shortSegment, undefined);
      }).not.toThrow();
    });

    it('should truncate text for keyword extraction if it exceeds maxKeywordsInputLength', () => {
      const keywordLimitedExtractor = new FeatureExtractor(defaultMaxSegmentSize, 10, defaultSanitizeKeywords);
      const segment: IDocumentSegment = { id: 's-kw-limit', text: 'keyword one two three four five', range: { start: 0, end: 30 } };
      const extractKeywordsSpy = jest.spyOn(keywordLimitedExtractor as any, 'extractKeywords');
      
      keywordLimitedExtractor.extractFeatures(segment, undefined);
      
      expect(extractKeywordsSpy).toHaveBeenCalledWith('keyword on');
      extractKeywordsSpy.mockRestore();
    });

    it('should call sanitizeInput for keywords if sanitizeKeywords is true', () => {
      const sanitizeSpyExtractor = new FeatureExtractor(defaultMaxSegmentSize, defaultMaxKeywordsInputLength, true);
      const segment: IDocumentSegment = { id: 's-sanitize', text: 'keyword1 keyword2', range: { start: 0, end: 17 } };
      (sanitizeInput as jest.Mock).mockImplementation(k => `sanitized_${k}`);

      const features = sanitizeSpyExtractor.extractFeatures(segment, undefined);
      
      expect(sanitizeInput).toHaveBeenCalledWith('keyword1');
      expect(sanitizeInput).toHaveBeenCalledWith('keyword2');
      expect(features.keywords).toEqual(expect.arrayContaining(['sanitized_keyword1', 'sanitized_keyword2']));
    });

    it('should NOT call sanitizeInput for keywords if sanitizeKeywords is false', () => {
      const noSanitizeExtractor = new FeatureExtractor(defaultMaxSegmentSize, defaultMaxKeywordsInputLength, false);
      const segment: IDocumentSegment = { id: 's-no-sanitize', text: 'keyword1 keyword2', range: { start: 0, end: 17 } };
      
      noSanitizeExtractor.extractFeatures(segment, undefined);
      
      expect(sanitizeInput).not.toHaveBeenCalled();
    });

    it('should return zero counts and empty keywords for an empty text segment', () => {
      const segment: IDocumentSegment = { id: 's1', text: '', range: { start: 0, end: 0 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.wordCount).toBe(0);
      expect(features.sentenceCount).toBe(0);
      expect(features.keywords).toEqual([]);
    });

    it('should return zero counts and empty keywords for a text segment with only whitespace', () => {
      const segment: IDocumentSegment = { id: 's2', text: '   \n \t ', range: { start: 0, end: 8 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.wordCount).toBe(0);
      expect(features.sentenceCount).toBe(0);
      expect(features.keywords).toEqual([]);
    });

    it('should correctly count words and sentences for a simple segment', () => {
      const segment: IDocumentSegment = { id: 's3', text: 'Hello world. This is a test!', range: { start: 0, end: 29 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.wordCount).toBe(7);
      expect(features.sentenceCount).toBe(2);
    });

    it('should handle multiple spaces between words for word count', () => {
      const segment: IDocumentSegment = { id: 's4', text: 'Word  one   two    three.', range: { start: 0, end: 26 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.wordCount).toBe(4);
      expect(features.sentenceCount).toBe(1);
    });

    it('should handle various sentence terminators for sentence count', () => {
      const segment: IDocumentSegment = { id: 's5', text: 'First sentence. Second sentence! Third sentence? End.', range: { start: 0, end: 52 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.sentenceCount).toBe(4);
    });

    it('should extract keywords correctly, ignoring case and stop words', () => {
      const segment: IDocumentSegment = {
        id: 's6',
        text: 'This is a test sentence with test keywords. Keywords are important for analysis, test analysis.',
        range: { start: 0, end: 95 }
      };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.keywords).toEqual(expect.arrayContaining(['test', 'keywords', 'analysis', 'sentence', 'important']));
      expect(features.keywords.length).toBeLessThanOrEqual(5);
      if (features.keywords.length > 0) {
        expect(['test', 'keywords', 'analysis'].includes(features.keywords[0]!)).toBe(true);
      }
    });

    it('should return empty keywords if no suitable words are found', () => {
      const segment: IDocumentSegment = { id: 's7', text: 'the a is of it', range: { start: 0, end: 14 } };
      const features = featureExtractor.extractFeatures(segment, undefined);
      expect(features.keywords).toEqual([]);
    });

    it('should handle text with numbers and punctuation for keyword extraction', () => {
        const segment: IDocumentSegment = { id: 's8', text: 'Item1 costs $25.99, item2 is cheaper. item1 item1.', range: {start: 0, end: 54} };
        const features = featureExtractor.extractFeatures(segment, undefined);
        expect(features.keywords).toEqual(expect.arrayContaining(['item1', 'cheaper']));
        if (features.keywords.length > 0) {
            expect(features.keywords[0]).toBe('item1');
        }
    });

    it('should limit keywords to top 5', () => {
        const segment: IDocumentSegment = {
            id: 's9',
            text: 'one one one one one two two two two three three three four four five six seven',
            range: {start: 0, end: 75}
        };
        const features = featureExtractor.extractFeatures(segment, undefined);
        expect(features.keywords).toHaveLength(5);
        expect(features.keywords).toEqual(['one', 'two', 'three', 'four', 'five']);
    });

    it('should extract keywords correctly when some words have same frequency', () => {
        const text = 'apple banana apple banana orange orange orange grape grape';
        const segment: IDocumentSegment = { id: 's10', text, range: {start: 0, end: text.length} };
        const features = featureExtractor.extractFeatures(segment, undefined);
        expect(features.keywords).toContain('orange');
        expect(features.keywords).toContain('apple');
        expect(features.keywords).toContain('banana');
        expect(features.keywords).toContain('grape');
        expect(features.keywords[0]).toBe('orange');
        expect(features.keywords.length).toBeLessThanOrEqual(5);
    });
  });
});