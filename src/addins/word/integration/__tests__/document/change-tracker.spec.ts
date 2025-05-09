import { ChangeTracker } from '../../document/change-tracker';

// Use Jest's fake timers
jest.useFakeTimers();

// Mock Word.js API
const mockOoxmlValues: string[] = ["<ooxml>initial</ooxml>", "<ooxml>changed</ooxml>", "<ooxml>changed again</ooxml>"];
let ooxmlCallCount = 0;
const mockBodyGetOoxml = jest.fn(() => {
  const val = mockOoxmlValues[ooxmlCallCount % mockOoxmlValues.length];
  // Do not increment here, getCurrentOoxml will be called multiple times initially
  return { value: val };
});
const mockSyncChangeTracker = jest.fn().mockResolvedValue(undefined);

const mockChangeTrackerRequestContext = {
  sync: mockSyncChangeTracker,
  document: {
    body: {
      getOoxml: mockBodyGetOoxml,
    },
  },
};

global.Word = {
  run: jest.fn(async (callback) => {
    await callback(mockChangeTrackerRequestContext);
    // The actual return value (ooxml.value) is handled by the callback in getCurrentOoxml
  }),
} as any;

// Mock Office.js API for event handlers (though ChangeTracker's current implementation uses polling)
const mockAddHandlerAsyncChangeTracker = jest.fn();
const mockRemoveHandlerAsyncChangeTracker = jest.fn();

global.Office = {
  context: {
    document: {
      addHandlerAsync: mockAddHandlerAsyncChangeTracker,
      removeHandlerAsync: mockRemoveHandlerAsyncChangeTracker,
    },
  },
  EventType: {
    DocumentSelectionChanged: "documentSelectionChanged",
  },
  AsyncResultStatus: {
    Succeeded: "succeeded",
    Failed: "failed",
  },
} as any;


describe('ChangeTracker', () => {
  let onChangeCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers(); // Clear any pending timers
    ooxmlCallCount = 0; // Reset call count for mockBodyGetOoxml
    ChangeTracker.stopTracking(); // Ensure tracking is stopped before each test
    onChangeCallback = jest.fn();
  });

  afterEach(() => {
    ChangeTracker.stopTracking(); // Ensure tracking is stopped after each test
  });

  describe('startTracking and stopTracking', () => {
    it('should start polling for changes at the specified interval', async () => {
      const interval = 500;
      // Mock getCurrentOoxml to control its return for this test
      const mockGetCurrentOoxml = jest.spyOn(ChangeTracker as any, 'getCurrentOoxml')
        .mockResolvedValueOnce(mockOoxmlValues[0]) // Initial call
        .mockResolvedValueOnce(mockOoxmlValues[0]) // First interval check (no change)
        .mockResolvedValueOnce(mockOoxmlValues[1]); // Second interval check (change)

      await ChangeTracker.startTracking(onChangeCallback, interval);
      expect(ChangeTracker['isTracking']).toBe(true);
      expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(1); // Initial fetch

      // Advance time by less than one interval, no callback yet
      jest.advanceTimersByTime(interval - 1);
      expect(onChangeCallback).not.toHaveBeenCalled();
      expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(1);

      // Advance time to trigger the first interval check
      jest.advanceTimersByTime(1);
      await Promise.resolve(); // Allow promises to settle
      expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(2);
      expect(onChangeCallback).not.toHaveBeenCalled(); // No change yet

      // Advance time for the second interval check
      jest.advanceTimersByTime(interval);
      await Promise.resolve(); // Allow promises to settle
      expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(3);
      expect(onChangeCallback).toHaveBeenCalledWith(mockOoxmlValues[1], mockOoxmlValues[0]);
      expect(ChangeTracker['previousOoxml']).toBe(mockOoxmlValues[1]);

      mockGetCurrentOoxml.mockRestore();
    });

    it('should stop polling when stopTracking is called', async () => {
      const interval = 500;
      await ChangeTracker.startTracking(onChangeCallback, interval);
      expect(ChangeTracker['isTracking']).toBe(true);

      ChangeTracker.stopTracking();
      expect(ChangeTracker['isTracking']).toBe(false);

      // Advance timers to see if polling continues
      jest.advanceTimersByTime(interval * 2);
      // onChangeCallback should not have been called after stopping
      expect(onChangeCallback).not.toHaveBeenCalled();
    });

    it('should warn if startTracking is called when already tracking', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await ChangeTracker.startTracking(onChangeCallback, 1000); // First call
      await ChangeTracker.startTracking(onChangeCallback, 1000); // Second call
      expect(consoleWarnSpy).toHaveBeenCalledWith("Change tracking is already active.");
      consoleWarnSpy.mockRestore();
    });

    it('should warn if stopTracking is called when not tracking', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      ChangeTracker.stopTracking();
      expect(consoleWarnSpy).toHaveBeenCalledWith("Change tracking is not active.");
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getCurrentOoxml', () => {
    it('should call Word.run and body.getOoxml', async () => {
      // Access private method for testing (common in Jest for static classes)
      await (ChangeTracker as any).getCurrentOoxml();
      expect(Word.run).toHaveBeenCalled();
      expect(mockBodyGetOoxml).toHaveBeenCalled();
      expect(mockSyncChangeTracker).toHaveBeenCalled();
    });

    it('should return the OOXML value', async () => {
      ooxmlCallCount = 0; // Ensure it gets the first value
      const result = await (ChangeTracker as any).getCurrentOoxml();
      expect(result).toBe(mockOoxmlValues[0]);
    });
  });

  describe('Change Detection Logic', () => {
    it('should call onChange with new and old OOXML when a change is detected', async () => {
        const mockGetCurrentOoxml = jest.spyOn(ChangeTracker as any, 'getCurrentOoxml')
            .mockResolvedValueOnce(mockOoxmlValues[0]) // Initial
            .mockResolvedValueOnce(mockOoxmlValues[1]); // Changed

        await ChangeTracker.startTracking(onChangeCallback, 100);
        expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(1); // Initial fetch

        jest.advanceTimersByTime(100);
        await Promise.resolve(); // Allow promises to settle

        expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(2);
        expect(onChangeCallback).toHaveBeenCalledWith(mockOoxmlValues[1], mockOoxmlValues[0]);
        expect(ChangeTracker['previousOoxml']).toBe(mockOoxmlValues[1]);
        mockGetCurrentOoxml.mockRestore();
    });

    it('should not call onChange if OOXML has not changed', async () => {
        const mockGetCurrentOoxml = jest.spyOn(ChangeTracker as any, 'getCurrentOoxml')
            .mockResolvedValue(mockOoxmlValues[0]); // Always returns initial

        await ChangeTracker.startTracking(onChangeCallback, 100);
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();

        expect(onChangeCallback).not.toHaveBeenCalled();
        mockGetCurrentOoxml.mockRestore();
    });

    it('should handle errors during getCurrentOoxml in the polling loop', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error("Failed to get OOXML");

        const mockGetCurrentOoxml = jest.spyOn(ChangeTracker as any, 'getCurrentOoxml')
            .mockResolvedValueOnce(mockOoxmlValues[0]) // Initial successful fetch
            .mockRejectedValueOnce(mockError);       // Subsequent fetch fails

        await ChangeTracker.startTracking(onChangeCallback, 100);
        expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(100);
        await Promise.resolve(); // Allow promises to settle, including the rejected one

        expect(mockGetCurrentOoxml).toHaveBeenCalledTimes(2);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error during change tracking:", mockError);
        expect(onChangeCallback).not.toHaveBeenCalled(); // Should not call on change if error occurs

        // Tracking should continue if not explicitly stopped on error
        expect(ChangeTracker['isTracking']).toBe(true);

        consoleErrorSpy.mockRestore();
        mockGetCurrentOoxml.mockRestore();
    });
  });

  // Tests for onDocumentChanged and offDocumentChanged (placeholder event handlers)
  describe('onDocumentChanged (Placeholder)', () => {
    const mockEventHandler = jest.fn();
    it('should call document.addHandlerAsync for DocumentSelectionChanged', async () => {
      mockAddHandlerAsyncChangeTracker.mockImplementationOnce((eventType, handler, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await ChangeTracker.onDocumentChanged(mockEventHandler);
      expect(mockAddHandlerAsyncChangeTracker).toHaveBeenCalledWith(
        Office.EventType.DocumentSelectionChanged,
        mockEventHandler,
        expect.any(Function)
      );
    });
  });

  describe('offDocumentChanged (Placeholder)', () => {
    const mockEventHandler = jest.fn();
    it('should call document.removeHandlerAsync for DocumentSelectionChanged', async () => {
      mockRemoveHandlerAsyncChangeTracker.mockImplementationOnce((eventType, options, callback) => {
        callback({ status: Office.AsyncResultStatus.Succeeded });
      });
      await ChangeTracker.offDocumentChanged(mockEventHandler);
      expect(mockRemoveHandlerAsyncChangeTracker).toHaveBeenCalledWith(
        Office.EventType.DocumentSelectionChanged,
        { handler: mockEventHandler },
        expect.any(Function)
      );
    });
  });
});