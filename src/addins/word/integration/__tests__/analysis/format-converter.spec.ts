import { FormatConverter } from '../../analysis/format-converter';

// Mock Word.js API
const mockPlainText = "Converted plain text.";
const mockOoxml = "<w:p><w:r><w:t>Converted OOXML</w:t></w:r></w:p>";

const mockParagraphInsertOoxml = jest.fn();
const mockParagraphLoad = jest.fn();
const mockParagraphDelete = jest.fn();
const mockParagraphGetOoxml = jest.fn(() => ({ value: mockOoxml }));
// Mock the text property getter
const mockParagraphTextGetter = jest.fn(() => mockPlainText);

const mockParagraph = {
  insertOoxml: mockParagraphInsertOoxml,
  load: mockParagraphLoad,
  delete: mockParagraphDelete,
  getOoxml: mockParagraphGetOoxml,
  // Define 'text' using Object.defineProperty to mock the getter
};
Object.defineProperty(mockParagraph, 'text', {
    get: mockParagraphTextGetter,
    configurable: true // Important for resetting in beforeEach
});


const mockBodyInsertParagraph = jest.fn(() => mockParagraph);
const mockSyncFormatConverter = jest.fn().mockResolvedValue(undefined);

const mockFormatConverterRequestContext = {
  sync: mockSyncFormatConverter,
  document: {
    body: {
      insertParagraph: mockBodyInsertParagraph,
      // Body doesn't need delete in this mock, paragraph does
    },
  },
};

global.Word = {
  run: jest.fn(async (callback) => {
    await callback(mockFormatConverterRequestContext);
    // Return value is handled by the specific converter methods
  }),
  InsertLocation: { // Mock the enum directly
    start: "Start",
    replace: "Replace",
  },
} as any;

describe('FormatConverter', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the getter mock if needed
     Object.defineProperty(mockParagraph, 'text', {
        get: mockParagraphTextGetter,
        configurable: true
    });
    mockParagraphTextGetter.mockClear(); // Clear calls to the getter mock itself
  });

  describe('ooxmlToPlainText', () => {
    const inputOoxml = "<w:p>Input OOXML</w:p>";

    it('should call Word.run', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(Word.run).toHaveBeenCalled();
    });

    it('should insert a temporary paragraph', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(mockBodyInsertParagraph).toHaveBeenCalledWith("", Word.InsertLocation.start);
    });

    it('should insert OOXML into the temporary paragraph', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(mockParagraphInsertOoxml).toHaveBeenCalledWith(inputOoxml, Word.InsertLocation.replace);
    });

    it('should load the text of the temporary paragraph', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(mockParagraphLoad).toHaveBeenCalledWith("text");
    });

    it('should call sync after load', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      // Sync is called after load and after delete
      expect(mockSyncFormatConverter).toHaveBeenCalledTimes(2);
    });

    it('should delete the temporary paragraph', async () => {
      await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(mockParagraphDelete).toHaveBeenCalled();
    });

    it('should return the text from the temporary paragraph', async () => {
      const result = await FormatConverter.ooxmlToPlainText(inputOoxml);
      expect(mockParagraphTextGetter).toHaveBeenCalled(); // Check if getter was accessed
      expect(result).toBe(mockPlainText);
    });

    it('should propagate errors from Word.run', async () => {
        const mockError = new Error("Conversion failed");
        (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
        await expect(FormatConverter.ooxmlToPlainText(inputOoxml)).rejects.toThrow(mockError);
    });
  });

  describe('plainTextToOoxml', () => {
    const inputText = "Input plain text";

    it('should call Word.run', async () => {
      await FormatConverter.plainTextToOoxml(inputText);
      expect(Word.run).toHaveBeenCalled();
    });

    it('should insert a temporary paragraph with the input text', async () => {
      await FormatConverter.plainTextToOoxml(inputText);
      expect(mockBodyInsertParagraph).toHaveBeenCalledWith(inputText, Word.InsertLocation.start);
    });

    it('should get OOXML from the temporary paragraph', async () => {
      await FormatConverter.plainTextToOoxml(inputText);
      expect(mockParagraphGetOoxml).toHaveBeenCalled();
    });

    it('should call sync after getOoxml', async () => {
      await FormatConverter.plainTextToOoxml(inputText);
      // Sync is called after getOoxml and after delete
      expect(mockSyncFormatConverter).toHaveBeenCalledTimes(2);
    });

    it('should delete the temporary paragraph', async () => {
      await FormatConverter.plainTextToOoxml(inputText);
      expect(mockParagraphDelete).toHaveBeenCalled();
    });

    it('should return the OOXML from the temporary paragraph', async () => {
      const result = await FormatConverter.plainTextToOoxml(inputText);
      expect(result).toBe(mockOoxml);
    });

     it('should propagate errors from Word.run', async () => {
        const mockError = new Error("Conversion failed");
        (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
        await expect(FormatConverter.plainTextToOoxml(inputText)).rejects.toThrow(mockError);
    });
  });
});