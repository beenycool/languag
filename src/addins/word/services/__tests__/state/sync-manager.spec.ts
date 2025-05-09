import { SyncManager } from '../../state/sync-manager';
import { AddinState } from '../../state/addin-state';

// Mock AddinState
const mockGetAllSettings = jest.fn();
jest.mock('../../state/addin-state', () => ({
  AddinState: {
    getInstance: jest.fn(() => ({
      getAllSettings: mockGetAllSettings,
      // Mock other AddinState methods if SyncManager uses them directly
    })),
  },
}));

// Use Jest's fake timers
jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'setInterval');
jest.spyOn(global, 'clearInterval');

describe('SyncManager', () => {
  const mockCurrentState = { setting1: 'value1', setting2: true };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Reset SyncManager internal state (accessing private static members for testing)
    (SyncManager as any).lastSyncTimestamp = null;
    (SyncManager as any).isSyncing = false;
    if ((SyncManager as any).syncInterval !== undefined) {
        window.clearInterval((SyncManager as any).syncInterval);
    }
    (SyncManager as any).syncInterval = undefined;
    // Setup default mock return value for AddinState
    mockGetAllSettings.mockReturnValue(mockCurrentState);
  });

  afterEach(() => {
     // Ensure timers are cleared after each test
     jest.clearAllTimers();
     // Ensure periodic sync is stopped if running
     SyncManager.stopPeriodicSync();
  });

  describe('syncStateWithBackend', () => {
    it('should set isSyncing to true during sync', async () => {
      const promise = SyncManager.syncStateWithBackend(mockCurrentState);
      expect((SyncManager as any).isSyncing).toBe(true);
      jest.runAllTimers(); // Complete the simulated API call
      await promise; // Wait for the promise to resolve
      expect((SyncManager as any).isSyncing).toBe(false);
    });

    it('should return success: false if already syncing', async () => {
      // Start a sync but don't complete it yet
      SyncManager.syncStateWithBackend(mockCurrentState);
      expect((SyncManager as any).isSyncing).toBe(true);

      // Try to start another sync
      const result = await SyncManager.syncStateWithBackend(mockCurrentState);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Sync in progress");

      // Clean up the first sync
      jest.runAllTimers();
    });

    it('should resolve with success: true and timestamp on successful sync', async () => {
      const promise = SyncManager.syncStateWithBackend(mockCurrentState);
      const beforeSync = Date.now();
      jest.runAllTimers(); // Complete the simulated API call
      const result = await promise;
      const afterSync = Date.now();

      expect(result.success).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp!.getTime()).toBeGreaterThanOrEqual(beforeSync);
      expect(result.timestamp!.getTime()).toBeLessThanOrEqual(afterSync);
      expect(SyncManager.getLastSyncTimestamp()).toEqual(result.timestamp);
    });

    it('should handle simulated errors during sync', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error("Backend unavailable");

        // Mock the setTimeout promise to reject
        jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback, ms) => {
            // Immediately reject the promise simulation
            throw mockError;
            // return 0 as any; // setTimeout returns a number ID
        });

        // Need to wrap the call in a try/catch because the error is thrown inside the promise executor
        let result: any;
        try {
            // We expect the syncStateWithBackend to catch the error and return a failure object
             result = await SyncManager.syncStateWithBackend(mockCurrentState);
        } catch (e) {
             // This catch block might not be reached if syncStateWithBackend handles the error internally
             result = { success: false, error: (e as Error).message };
        }


        expect(result.success).toBe(false);
        expect(result.error).toContain("Backend unavailable"); // Or check against mockError.message
        expect((SyncManager as any).isSyncing).toBe(false); // Should reset on error
        expect(SyncManager.getLastSyncTimestamp()).toBeNull(); // Timestamp should not be updated
        expect(consoleErrorSpy).toHaveBeenCalledWith("SyncManager: Error during state synchronization:", mockError);

        consoleErrorSpy.mockRestore();
        (setTimeout as any).mockRestore(); // Restore original setTimeout
    });
  });

  describe('startPeriodicSync', () => {
    it('should call setInterval with the specified interval', () => {
      const interval = 10000;
      SyncManager.startPeriodicSync(interval);
      expect(setInterval).toHaveBeenCalledTimes(1);
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), interval);
    });

     it('should perform an initial sync immediately', () => {
        const syncSpy = jest.spyOn(SyncManager, 'syncStateWithBackend');
        SyncManager.startPeriodicSync(10000);
        expect(syncSpy).toHaveBeenCalledTimes(1);
        expect(syncSpy).toHaveBeenCalledWith(mockCurrentState);
        syncSpy.mockRestore();
    });

    it('should call syncStateWithBackend periodically', () => {
      const syncSpy = jest.spyOn(SyncManager, 'syncStateWithBackend');
      const interval = 10000;
      SyncManager.startPeriodicSync(interval);

      // Initial call
      expect(syncSpy).toHaveBeenCalledTimes(1);

      // Advance time by one interval
      jest.advanceTimersByTime(interval);
      expect(syncSpy).toHaveBeenCalledTimes(2);
      expect(syncSpy).toHaveBeenNthCalledWith(2, mockCurrentState);

      // Advance time by another interval
      jest.advanceTimersByTime(interval);
      expect(syncSpy).toHaveBeenCalledTimes(3);
      expect(syncSpy).toHaveBeenNthCalledWith(3, mockCurrentState);

      syncSpy.mockRestore();
    });

    it('should warn if periodic sync is already running', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      SyncManager.startPeriodicSync(10000); // Start first time
      SyncManager.startPeriodicSync(10000); // Try starting again
      expect(consoleWarnSpy).toHaveBeenCalledWith("SyncManager: Periodic sync is already running.");
      consoleWarnSpy.mockRestore();
    });
  });

  describe('stopPeriodicSync', () => {
    it('should call clearInterval with the stored interval ID', () => {
      const interval = 10000;
      const mockIntervalId = 12345; // Example interval ID
      (setInterval as jest.Mock).mockReturnValue(mockIntervalId);

      SyncManager.startPeriodicSync(interval);
      expect((SyncManager as any).syncInterval).toBe(mockIntervalId);

      SyncManager.stopPeriodicSync();
      expect(clearInterval).toHaveBeenCalledTimes(1);
      expect(clearInterval).toHaveBeenCalledWith(mockIntervalId);
      expect((SyncManager as any).syncInterval).toBeUndefined();
    });

    it('should warn if periodic sync is not running', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      SyncManager.stopPeriodicSync(); // Try stopping when not started
      expect(consoleWarnSpy).toHaveBeenCalledWith("SyncManager: Periodic sync is not running.");
      expect(clearInterval).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getLastSyncTimestamp', () => {
    it('should return null initially', () => {
      expect(SyncManager.getLastSyncTimestamp()).toBeNull();
    });

    it('should return the timestamp of the last successful sync', async () => {
      const promise = SyncManager.syncStateWithBackend(mockCurrentState);
      jest.runAllTimers();
      const result = await promise;

      expect(SyncManager.getLastSyncTimestamp()).toEqual(result.timestamp);
    });
  });
});