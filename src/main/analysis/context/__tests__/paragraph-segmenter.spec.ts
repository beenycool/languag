// src/main/analysis/context/__tests__/paragraph-segmenter.spec.ts

import { ParagraphSegmenter, IParagraphSegmenterConfig } from '../paragraph-segmenter';
import { IDocumentContext, IDocumentSegment } from '../document-context';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('ParagraphSegmenter', () => {
  let segmenter: ParagraphSegmenter;
  const mockDocContext: IDocumentContext = { uri: 'test-doc.txt', language: 'en' };
  let uuidCounter: number;

  beforeEach(() => {
    uuidCounter = 0;
    (uuidv4 as jest.Mock).mockImplementation(() => `uuid-${++uuidCounter}`);
    segmenter = new ParagraphSegmenter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      const defaultSegmenter = new ParagraphSegmenter();
      // Test behaviorally or inspect config if made accessible for tests
      expect(defaultSegmenter).toBeDefined();
    });

    it('should initialize with provided config', () => {
      const config: IParagraphSegmenterConfig = {
        delimiterRegex: /\n{2,}/, // Example: two or more newlines
        minLength: 5,
      };
      const configuredSegmenter = new ParagraphSegmenter(config);
      // Test behavior with this config
      const text = "Hi\n\nHello"; // Shorter than minLength
      const segments = configuredSegmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(1); // "Hello" should be segmented
      expect(segments[0].text).toBe("Hello");
    });
  });

  describe('segment', () => {
    it('should return an empty array for empty or whitespace-only text', () => {
      expect(segmenter.segment('', mockDocContext)).toEqual([]);
      expect(segmenter.segment('   \n   ', mockDocContext)).toEqual([]);
    });

    it('should segment by default delimiter (one or more blank lines)', () => {
      const text = "Paragraph 1.\n\nParagraph 2.\n\n\nParagraph 3.";
      const segments = segmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(3);
      expect(segments[0].text).toBe("Paragraph 1.");
      expect(segments[0].id).toBe('uuid-1');
      expect(segments[0].context).toEqual(mockDocContext);
      expect(segments[1].text).toBe("Paragraph 2.");
      expect(segments[1].id).toBe('uuid-2');
      expect(segments[2].text).toBe("Paragraph 3.");
      expect(segments[2].id).toBe('uuid-3');
    });

    it('should respect minLength config', () => {
      const config: IParagraphSegmenterConfig = { minLength: 15 };
      const customSegmenter = new ParagraphSegmenter(config);
      const text = "Short one.\n\nThis is a longer paragraph that should be included.";
      const segments = customSegmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe("This is a longer paragraph that should be included.");
    });

    it('should correctly calculate ranges', () => {
      const text = "First.\n\nSecond paragraph."; // "First." length 6, "\n\n" length 2
      const segments = segmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(2);
      expect(segments[0].text).toBe("First.");
      expect(segments[0].range).toEqual({ start: 0, end: 6 }); // "First."
      expect(segments[1].text).toBe("Second paragraph.");
      expect(segments[1].range).toEqual({ start: 8, end: 25 }); // "Second paragraph."
    });
    
    it('should handle text with leading/trailing delimiters', () => {
      const text = "\n\nParagraph A.\n\nParagraph B.\n\n";
      const segments = segmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(2);
      expect(segments[0].text).toBe("Paragraph A.");
      expect(segments[1].text).toBe("Paragraph B.");
    });

    it('should handle segments with only spaces if they meet minLength after trim (but trim happens)', () => {
      const config: IParagraphSegmenterConfig = { minLength: 1 }; // Effectively any non-empty after trim
      const customSegmenter = new ParagraphSegmenter(config);
      const text = "Content\n\n          \n\nMore content"; // The middle part is just spaces
      const segments = customSegmenter.segment(text, mockDocContext);
      expect(segments.length).toBe(2); // The empty (after trim) paragraph is skipped
      expect(segments[0].text).toBe("Content");
      expect(segments[1].text).toBe("More content");
    });

    it('should use provided documentContext for each segment', () => {
      const text = "Hello.\n\nWorld.";
      const segments = segmenter.segment(text, mockDocContext);
      expect(segments[0].context).toEqual(mockDocContext);
      expect(segments[1].context).toEqual(mockDocContext);
    });

     it('should handle no documentContext provided', () => {
      const text = "Hello.\n\nWorld.";
      const segments = segmenter.segment(text);
      expect(segments.length).toBe(2);
      expect(segments[0].context).toBeUndefined();
      expect(segments[1].context).toBeUndefined();
    });
  });

  describe('segmentByLine', () => {
    it('should return an empty array for empty or whitespace-only text', () => {
      expect(segmenter.segmentByLine('', mockDocContext)).toEqual([]);
      expect(segmenter.segmentByLine('   \n   ', mockDocContext)).toEqual([]);
    });

    it('should segment by single newlines', () => {
      const text = "Line 1.\nLine 2.\nLine 3.";
      const segments = segmenter.segmentByLine(text, mockDocContext);
      expect(segments.length).toBe(3);
      expect(segments[0].text).toBe("Line 1.");
      expect(segments[0].id).toBe('uuid-1');
      expect(segments[1].text).toBe("Line 2.");
      expect(segments[1].id).toBe('uuid-2');
      expect(segments[2].text).toBe("Line 3.");
      expect(segments[2].id).toBe('uuid-3');
    });

    it('should trim lines', () => {
      const text = "  Line A  \n  Line B  ";
      const segments = segmenter.segmentByLine(text, mockDocContext);
      expect(segments.length).toBe(2);
      expect(segments[0].text).toBe("Line A");
      expect(segments[1].text).toBe("Line B");
    });

    it('should correctly calculate ranges for segmentByLine', () => {
      const text = "LineX\nLineY"; // LineX length 5, \n length 1
      const segments = segmenter.segmentByLine(text, mockDocContext);
      expect(segments.length).toBe(2);
      expect(segments[0].text).toBe("LineX");
      expect(segments[0].range).toEqual({ start: 0, end: 5 });
      expect(segments[1].text).toBe("LineY");
      expect(segments[1].range).toEqual({ start: 6, end: 11 });
    });
    
    it('should handle multiple empty lines correctly in segmentByLine', () => {
      const text = "Line 1\n\n\nLine 4";
      const segments = segmenter.segmentByLine(text, mockDocContext);
      expect(segments.length).toBe(2);
      expect(segments[0].text).toBe("Line 1");
      expect(segments[0].range).toEqual({ start: 0, end: 6});
      expect(segments[1].text).toBe("Line 4");
      expect(segments[1].range).toEqual({ start: 9, end: 15}); // start is after \n\n\n
    });

    it('should handle text ending with newlines in segmentByLine', () => {
      const text = "Final line.\n";
      const segments = segmenter.segmentByLine(text, mockDocContext);
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe("Final line.");
      expect(segments[0].range).toEqual({ start: 0, end: 11 });
    });
  });
});