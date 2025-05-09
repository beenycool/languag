import { SelectionManager } from '../../document/selection-manager';

// Mock Word.js API
const mockSelectedTextValue = "Selected text";
const mockRangeLoad = jest.fn();
const mockRangeInsertText = jest.fn();
const mockRangeClear = jest.fn();
const mockSyncSelection = jest.fn().mockResolvedValue(undefined);

const mockSelectionRequestContext = {
  sync: mockSyncSelection,
  document: {
    getSelection: jest.fn(() => ({
      load: mockRangeLoad,
      insertText: mockRangeInsertText,
      clear: mockRangeClear,
      // text property will be set after load('text')
    })),
  },
};

// Setup range.text to be populated by the mockRangeLoad
Object.defineProperty(mockSelectionRequestContext.document.getSelection(), 'text', {
    get: jest.fn(() => mockSelectedTextValue), // Getter for range.text
    configurable: true
});

global.Word = {
  run: jest.fn(async (callback) => {
    await callback(mockSelectionRequestContext);
  }),
  InsertLocation: {
    replace: "Replace",
  },
} as any;

// Mock Office.js API
const mockAddHandlerAsync = jest.fn();
const mockRemoveHandlerAsync = jest.fn();

global.Office = {
  context: {
    document: {
      addHandlerAsync: mockAddHandlerAsync,
      removeHandlerAsync: mockRemoveHandlerAsync,
    },
  },
  EventType: {
    DocumentSelectionChanged: "documentSelectionChanged", // Mocking the enum value
  },
  AsyncResultStatus: { // Mocking the enum
    Succeeded: "succeeded",
    Failed: "failed",
  },
} as any;

describe('SelectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the getter for range.text in case a test modifies it
    Object.defineProperty(mockSelectionRequestContext.document.getSelection(), 'text', {
        get: jest.fn(() => mockSelectedTextValue),
        configurable: true
    });
  });

  describe('getSelectedText', () => {
    it('should call range.load("text") and context.sync', async () => {
      await SelectionManager.getSelectedText();
      expect(Word.run).toHaveBeenCalled();
      expect(mockSelectionRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeLoad).toHaveBeenCalledWith("text");
      expect(mockSyncSelection).toHaveBeenCalled();
    });

    it('should return the text from range.text', async () => {
      const result = await SelectionManager.getSelectedText();
      expect(result).toBe(mockSelectedTextValue);
    });
  });

  describe('setSelectedText', () => {
    it('should call range.insertText with replace and context.sync', async () => {
      const textToSet = "New selected text";
      await SelectionManager.setSelectedText(textToSet);
      expect(Word.run).toHaveBeenCalled();
      expect(mockSelectionRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeInsertText).toHaveBeenCalledWith(textToSet, Word.InsertLocation.replace);
      expect(mockSyncSelection).toHaveBeenCalled();
    });
  });

  describe('clearSelection', () => {
    it('should call range.clear and context.sync', async () => {
      await SelectionManager.clearSelection();
      expect(Word.run).toHaveBeenCalled();
      expect(mockSelectionRequestContext.document.getSelection).toHaveBeenCalled();
      expect(mockRangeClear).toHaveBeenCalled();
      expect(mockSyncSelection).toHaveBeenCalled();
    });
  });

  describe('onSelectionChanged', () => {
    const mockHandler = jest.fn();

    it('should call document.addHandlerAsync with DocumentSelectionChanged event type', async () => {
      mockAddHandlerAsync.mockImplementationOnce((eventType, handler, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await SelectionManager.onSelectionChanged(mockHandler);
      expect(mockAddHandlerAsync).toHaveBeenCalledWith(
        Office.EventType.DocumentSelectionChanged,
        mockHandler,
        expect.any(Function)
      );
    });

    it('should resolve on successful handler registration', async () => {
      mockAddHandlerAsync.mockImplementationOnce((eventType, handler, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await expect(SelectionManager.onSelectionChanged(mockHandler)).resolves.toBeUndefined();
    });

    it('should reject on failed handler registration', async () => {
      const mockError = { code: 123, name: "TestError", message: "Handler registration failed" };
      mockAddHandlerAsync.mockImplementationOnce((eventType, handler, callback) => {
        callback({ status: Office.AsyncResultStatus.Failed, error: mockError });
      });
      await expect(SelectionManager.onSelectionChanged(mockHandler)).rejects.toEqual(mockError);
    });
  });

  describe('offSelectionChanged', () => {
    const mockHandlerToRemove = jest.fn();

    it('should call document.removeHandlerAsync with DocumentSelectionChanged event type', async () => {
      mockRemoveHandlerAsync.mockImplementationOnce((eventType, options, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await SelectionManager.offSelectionChanged(mockHandlerToRemove);
      expect(mockRemoveHandlerAsync).toHaveBeenCalledWith(
        Office.EventType.DocumentSelectionChanged,
        { handler: mockHandlerToRemove },
        expect.any(Function)
      );
    });

    it('should resolve on successful handler removal', async () => {
      mockRemoveHandlerAsync.mockImplementationOnce((eventType, options, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await expect(SelectionManager.offSelectionChanged(mockHandlerToRemove)).resolves.toBeUndefined();
    });

    it('should reject on failed handler removal', async () => {
      const mockError = { code: 456, name: "TestErrorRemove", message: "Handler removal failed" };
      mockRemoveHandlerAsync.mockImplementationOnce((eventType, options, callback) => {
        callback({ status: Office.AsyncResultStatus.Failed, error: mockError });
      });
      await expect(SelectionManager.offSelectionChanged(mockHandlerToRemove)).rejects.toEqual(mockError);
    });
  });

  // Error Handling Tests for Word.run methods
  describe('Error Handling for Word.run methods', () => {
    const mockWordError = new Error("Word API Error in SelectionManager");

    it('getSelectedText should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockWordError; });
      await expect(SelectionManager.getSelectedText()).rejects.toThrow(mockWordError);
    });

    it('setSelectedText should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockWordError; });
      await expect(SelectionManager.setSelectedText("test")).rejects.toThrow(mockWordError);
    });

    it('clearSelection should propagate errors from Word.run', async () => {
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockWordError; });
      await expect(SelectionManager.clearSelection()).rejects.toThrow(mockWordError);
    });
  });
});