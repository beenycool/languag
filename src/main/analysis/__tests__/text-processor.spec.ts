import { TextProcessor } from '../text-processor';
import { IDocumentSegment, IDocumentContext } from '../../../shared/types/context';
import { ParagraphSegmenter, IParagraphSegmenterConfig } from '../context/paragraph-segmenter';

// Mock ParagraphSegmenter
jest.mock('../context/paragraph-segmenter');

describe('TextProcessor', () => {
  let textProcessor: TextProcessor;
  let mockParagraphSegmenterInstance: jest.Mocked<ParagraphSegmenter>;
  const defaultMaxSize = 1000000;
  const mockDocContext: IDocumentContext = { uri: 'test-doc.txt', language: 'en' };

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    (ParagraphSegmenter as jest.Mock).mockClear();

    // Create a new mock instance for each test
    mockParagraphSegmenterInstance = new ParagraphSegmenter() as jest.Mocked<ParagraphSegmenter>;
    // Ensure the mock constructor returns our specific mock instance
    (ParagraphSegmenter as jest.Mock).mockImplementation(() => mockParagraphSegmenterInstance);
    
    textProcessor = new TextProcessor(defaultMaxSize);
  });

  describe('Constructor', () => {
    it('should instantiate ParagraphSegmenter with undefined config if none provided', () => {
      new TextProcessor(defaultMaxSize);
      expect(ParagraphSegmenter).toHaveBeenCalledWith(undefined);
    });

    it('should instantiate ParagraphSegmenter with provided config', () => {
      const segmenterConfig: IParagraphSegmenterConfig = { minLength: 5 };
      new TextProcessor(defaultMaxSize, segmenterConfig);
      expect(ParagraphSegmenter).toHaveBeenCalledWith(segmenterConfig);
    });
  });

  describe('segmentText', () => {
    it('should throw an error if input text exceeds maxInputSize', () => {
      const smallLimitProcessor = new TextProcessor(100);
      const longText = 'a'.repeat(101);
      expect(() => {
        smallLimitProcessor.segmentText(longText, mockDocContext);
      }).toThrowError('Input text size (101 characters) exceeds the configured limit of 100 characters.');
    });

    it('should not throw an error if input text is within maxInputSize', () => {
      const smallLimitProcessor = new TextProcessor(100);
      const shortText = 'a'.repeat(100);
      expect(() => {
        smallLimitProcessor.segmentText(shortText, mockDocContext);
      }).not.toThrow();
    });

    it('should call paragraphSegmenter.segment with rawText and docContext', () => {
      const rawText = 'Paragraph one.\n\nParagraph two.';
      const expectedSegments: IDocumentSegment[] = [
        { id: 'uuid-1', text: 'Paragraph one.', range: {start: 0, end: 14}, context: mockDocContext },
        { id: 'uuid-2', text: 'Paragraph two.', range: {start: 16, end: 30}, context: mockDocContext },
      ];
      mockParagraphSegmenterInstance.segment.mockReturnValue(expectedSegments);

      const segments = textProcessor.segmentText(rawText, mockDocContext);

      expect(mockParagraphSegmenterInstance.segment).toHaveBeenCalledWith(rawText, mockDocContext);
      expect(segments).toEqual(expectedSegments);
    });

    it('should return empty array if paragraphSegmenter returns empty array', () => {
        mockParagraphSegmenterInstance.segment.mockReturnValue([]);
        const segments = textProcessor.segmentText('some text', mockDocContext);
        expect(segments).toEqual([]);
    });
  });

  describe('normalizeSegment', () => {
    it('should trim text of the segment and preserve other properties', () => {
      const segment: IDocumentSegment = {
        id: 'seg1',
        text: '  Some text with spaces.  ',
        range: { start: 0, end: 28 },
        context: { uri: 'doc1.txt', language: 'en' },
      };
      const normalizedSegment = textProcessor.normalizeSegment(segment);
      expect(normalizedSegment.text).toBe('Some text with spaces.');
      expect(normalizedSegment.id).toBe('seg1');
      expect(normalizedSegment.range).toEqual({ start: 0, end: 28 });
      expect(normalizedSegment.context).toEqual({ uri: 'doc1.txt', language: 'en' });
    });

    it('should handle segment with no context property', () => {
        const segment: IDocumentSegment = {
          id: 'seg2',
          text: '  Another text.  ',
          range: { start: 0, end: 19 },
        };
        const normalizedSegment = textProcessor.normalizeSegment(segment);
        expect(normalizedSegment.text).toBe('Another text.');
        expect(normalizedSegment.id).toBe('seg2');
        expect(normalizedSegment.context).toBeUndefined();
      });
  });
});