import { ContentManager } from '../../document/content-manager';

// Mock Word.js API
const mockOoxmlValue = "<w:document>...</w:document>";
const mockTextValue = "This is document text.";

const mockBodyGetOoxml = jest.fn(() => ({ value: mockOoxmlValue }));
const mockBodyInsertOoxml = jest.fn();
const mockBodyLoad = jest.fn();
const mockBodyText = jest.fn(() => mockTextValue); // Changed to a function returning the value

const mockRangeGetOoxml = jest.fn(() => ({ value: mockOoxmlValue }));
const mockRangeInsertOoxml = jest.fn();
const mockRangeInsertText = jest.fn();

const mockSync = jest.fn().mockResolvedValue(undefined);

const mockRequestContext = {
  sync: mockSync,
  document: {
    body: {
      getOoxml: mockBodyGetOoxml,
      insertOoxml: mockBodyInsertOoxml,
      load: mockBodyLoad,
      // body.text is a property, not a function, after load('text')
      // We'll access it directly in tests after ensuring load was called.
      // For the mock, we can set it up to be populated by the 'load' mock.
    },
    getSelection: jest.fn(() => ({
      getOoxml: mockRangeGetOoxml,
      insertOoxml: mockRangeInsertOoxml,
      insertText: mockRangeInsertText,
      // Add other range properties/methods if ContentManager uses them
    })),
  },
};

// Setup body.text to be populated by the mockBodyLoad
Object.defineProperty(mockRequestContext.document.body, 'text', {
    get: mockBodyText, // Use the jest.fn() for the getter
    configurable: true // Allow redefining for tests if needed
});


global.Word = {
  run: jest.fn(async (callback) => {
    // Simulate the Word.run behavior: it calls the callback with a context object.
    await callback(mockRequestContext);
    // The return value of Word.run is the return value of the callback.
    // This is handled by the individual ContentManager methods.
  }),
  InsertLocation: { // Mock the enum directly
    replace: "Replace",
    // Add other locations if used by ContentManager
  },
} as any;

describe('ContentManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementations or states if necessary
    // For example, if body.text was modified in a test:
    // (mockRequestContext.document.body as any).text = mockTextValue; // Reset if needed
    // Or re-initialize the getter if it was changed:
    Object.defineProperty(mockRequestContext.document.body, 'text', {
        get: mockBodyText,
        configurable: true
    });
  });

  describe('getDocumentContentOoxml', () => {
    it('should call body.getOoxml and context.sync', async () => {
      await ContentManager.getDocumentContentOoxml();
      expect(Word.run).toHaveBeenCalled();
      expect(mockBodyGetOoxml).toHaveBeenCalled();
      expect(mockSync).toHaveBeenCalled();
    });

    it('should return the OOXML value from body.getOoxml', async () => {
      const result = await ContentManager.getDocumentContentOoxml();
      expect(result).toBe(mockOoxmlValue);
    });
  });

  describe('setDocumentContentOoxml', () => {
    it('should call body.insertOoxml with replace and context.sync', async () => {
      const ooxmlToSet = "<w:p>New Content</w:p>";
      await ContentManager.setDocumentContentOoxml(ooxmlToSet);
      expect(Word.run).toHaveBeenCalled();
      expect(mockBodyInsertOoxml).toHaveBeenCalledWith(ooxmlToSet, Word.InsertLocation.replace);
      expect(mockSync).toHaveBeenCalled();
    });
  });

  describe('getSelectedContentOoxml', () => {
    it('should call range.getOoxml and context.sync', async () => {
      await ContentManager.getSelectedContentOoxml();
      expect(Word.run).toHaveBeenCalled();
      expect(mockRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeGetOoxml).toHaveBeenCalled();
      expect(mockSync).toHaveBeenCalled();
    });

    it('should return the OOXML value from range.getOoxml', async () => {
      const result = await ContentManager.getSelectedContentOoxml();
      expect(result).toBe(mockOoxmlValue);
    });
  });

  describe('insertOoxmlAtSelection', () => {
    it('should call range.insertOoxml with replace and context.sync', async () => {
      const ooxmlToInsert = "<w:p>Inserted Content</w:p>";
      await ContentManager.insertOoxmlAtSelection(ooxmlToInsert);
      expect(Word.run).toHaveBeenCalled();
      expect(mockRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeInsertOoxml).toHaveBeenCalledWith(ooxmlToInsert, Word.InsertLocation.replace);
      expect(mockSync).toHaveBeenCalled();
    });
  });

  describe('getDocumentText', () => {
    it('should call body.load("text") and context.sync', async () => {
      await ContentManager.getDocumentText();
      expect(Word.run).toHaveBeenCalled();
      expect(mockBodyLoad).toHaveBeenCalledWith("text");
      expect(mockSync).toHaveBeenCalled();
    });

    it('should return the text from body.text', async () => {
      const result = await ContentManager.getDocumentText();
      expect(result).toBe(mockTextValue);
    });
  });

  describe('insertTextAtSelection', () => {
    it('should call range.insertText with replace and context.sync', async () => {
      const textToInsert = "Inserted Text.";
      await ContentManager.insertTextAtSelection(textToInsert);
      expect(Word.run).toHaveBeenCalled();
      expect(mockRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeInsertText).toHaveBeenCalledWith(textToInsert, Word.InsertLocation.replace);
      expect(mockSync).toHaveBeenCalled();
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    const mockError = new Error("Word API Error");

    it('getDocumentContentOoxml should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.getDocumentContentOoxml()).rejects.toThrow(mockError);
    });

    it('setDocumentContentOoxml should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.setDocumentContentOoxml("test")).rejects.toThrow(mockError);
    });

    it('getSelectedContentOoxml should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.getSelectedContentOoxml()).rejects.toThrow(mockError);
    });

    it('insertOoxmlAtSelection should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.insertOoxmlAtSelection("test")).rejects.toThrow(mockError);
    });

    it('getDocumentText should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.getDocumentText()).rejects.toThrow(mockError);
    });

    it('insertTextAtSelection should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });
      await expect(ContentManager.insertTextAtSelection("test")).rejects.toThrow(mockError);
    });
  });
});