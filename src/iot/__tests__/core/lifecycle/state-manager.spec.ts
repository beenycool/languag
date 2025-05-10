// Mock for a persistent state storage (e.g., Redis, database)
const mockPersistentStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock for an in-memory cache (optional, for faster reads)
const mockMemoryCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
};

// Mock for an event emitter
// Mock for an event emitter, ensuring on and off are defined
const mockStateEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(), // Added for subscription
  off: jest.fn(), // Added for unsubscription
};

// Placeholder for actual StateManager implementation
// import { StateManager } from '../../../../core/lifecycle/state-manager';

type StateUpdateListener = (deviceId: string, newState: DeviceState, oldState: DeviceState | null) => void;

class StateManager {
  private storage: typeof mockPersistentStorage;
  private cache: typeof mockMemoryCache;
  private emitter: typeof mockStateEventEmitter;
  private readonly STATE_CHANGE_EVENT = 'deviceStateUpdated';

  constructor(
    storage: typeof mockPersistentStorage,
    cache: typeof mockMemoryCache,
    emitter: typeof mockStateEventEmitter
  ) {
    this.storage = storage;
    this.cache = cache;
    this.emitter = emitter;
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    if (!deviceId) throw new Error('Device ID is required for getState');

    const cachedState = this.cache.get(deviceId);
    if (cachedState !== undefined) {
      return cachedState;
    }

    const storedState = await this.storage.getItem(deviceId);
    if (storedState !== null) {
      this.cache.set(deviceId, storedState);
    }
    return storedState;
  }

  async setDeviceState(deviceId: string, newState: DeviceState): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required for setState');
    if (!newState || !Object.values(DeviceState).includes(newState)) {
      throw new Error(`Invalid state value: ${newState}`);
    }

    const oldState = await this.getDeviceState(deviceId); // Get current state (from cache or storage)

    if (oldState === newState) {
      return; // No change, do nothing
    }

    await this.storage.setItem(deviceId, newState);
    this.cache.set(deviceId, newState);

    this.emitter.emit(this.STATE_CHANGE_EVENT, deviceId, newState, oldState);
  }

  async removeDeviceState(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required for removeState');
    const oldState = await this.getDeviceState(deviceId);

    await this.storage.removeItem(deviceId);
    this.cache.delete(deviceId);

    if (oldState !== null) { // Only emit if there was a state to remove
        this.emitter.emit(this.STATE_CHANGE_EVENT, deviceId, null, oldState); //newState is null after removal
    }
  }

  subscribeToStateChanges(listener: StateUpdateListener): void {
    this.emitter.on(this.STATE_CHANGE_EVENT, listener);
  }

  unsubscribeFromStateChanges(listener: StateUpdateListener): void {
    this.emitter.off(this.STATE_CHANGE_EVENT, listener);
  }
}

describe('StateManager', () => {
  let stateManager: StateManager;
  const deviceId = 'device-stateful-1';

  beforeEach(() => {
    mockPersistentStorage.getItem.mockReset();
    mockPersistentStorage.setItem.mockReset();
    mockPersistentStorage.removeItem.mockReset();
    mockMemoryCache.get.mockReset();
    mockMemoryCache.set.mockReset();
    mockMemoryCache.delete.mockReset();
    mockMemoryCache.clear.mockReset();
    mockStateEventEmitter.emit.mockReset();
    mockStateEventEmitter.on.mockReset();
    mockStateEventEmitter.off.mockReset();

    stateManager = new StateManager(mockPersistentStorage, mockMemoryCache, mockStateEventEmitter);
  });

  describe('getDeviceState', () => {
    it('should return state from cache if available', async () => {
      mockMemoryCache.get.mockReturnValue(DeviceState.ONLINE);
      const state = await stateManager.getDeviceState(deviceId);
      expect(state).toBe(DeviceState.ONLINE);
      expect(mockMemoryCache.get).toHaveBeenCalledWith(deviceId);
      expect(mockPersistentStorage.getItem).not.toHaveBeenCalled();
    });

    it('should return state from storage if not in cache, and then cache it', async () => {
      mockMemoryCache.get.mockReturnValue(undefined); // Not in cache
      mockPersistentStorage.getItem.mockResolvedValue(DeviceState.OFFLINE);
      const state = await stateManager.getDeviceState(deviceId);
      expect(state).toBe(DeviceState.OFFLINE);
      expect(mockPersistentStorage.getItem).toHaveBeenCalledWith(deviceId);
      expect(mockMemoryCache.set).toHaveBeenCalledWith(deviceId, DeviceState.OFFLINE);
    });

    it('should return null if state is not in cache or storage', async () => {
      mockMemoryCache.get.mockReturnValue(undefined);
      mockPersistentStorage.getItem.mockResolvedValue(null);
      const state = await stateManager.getDeviceState(deviceId);
      expect(state).toBeNull();
    });

    it('should throw error if device ID is not provided', async () => {
      // @ts-expect-error testing invalid input
      await expect(stateManager.getDeviceState(null)).rejects.toThrow('Device ID is required for getState');
    });
  });

  describe('setDeviceState', () => {
    it('should set state in storage and cache, and emit event', async () => {
      mockMemoryCache.get.mockReturnValue(DeviceState.OFFLINE); // Old state
      mockPersistentStorage.getItem.mockResolvedValue(DeviceState.OFFLINE); // To ensure oldState is correctly fetched if cache miss

      await stateManager.setDeviceState(deviceId, DeviceState.ONLINE);

      expect(mockPersistentStorage.setItem).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE);
      expect(mockMemoryCache.set).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE);
      expect(mockStateEventEmitter.emit).toHaveBeenCalledWith('deviceStateUpdated', deviceId, DeviceState.ONLINE, DeviceState.OFFLINE);
    });

    it('should not emit event or update storage/cache if state is the same', async () => {
      mockMemoryCache.get.mockReturnValue(DeviceState.ONLINE);
      mockPersistentStorage.getItem.mockResolvedValue(DeviceState.ONLINE);

      await stateManager.setDeviceState(deviceId, DeviceState.ONLINE);

      expect(mockPersistentStorage.setItem).not.toHaveBeenCalled();
      // Cache might be set again depending on implementation, but emit should not happen
      // For this impl, cache.set is called before the check, so it might be called.
      // The critical part is no storage write and no emit.
      expect(mockStateEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle setting initial state (oldState is null)', async () => {
      mockMemoryCache.get.mockReturnValue(undefined);
      mockPersistentStorage.getItem.mockResolvedValue(null); // No old state

      await stateManager.setDeviceState(deviceId, DeviceState.PROVISIONING);

      expect(mockPersistentStorage.setItem).toHaveBeenCalledWith(deviceId, DeviceState.PROVISIONING);
      expect(mockMemoryCache.set).toHaveBeenCalledWith(deviceId, DeviceState.PROVISIONING);
      expect(mockStateEventEmitter.emit).toHaveBeenCalledWith('deviceStateUpdated', deviceId, DeviceState.PROVISIONING, null);
    });

    it('should throw error for invalid state value', async () => {
      // @ts-expect-error testing invalid input
      await expect(stateManager.setDeviceState(deviceId, 'non-existent-state')).rejects.toThrow('Invalid state value: non-existent-state');
    });

    it('should throw error if device ID is not provided for setState', async () => {
        // @ts-expect-error testing invalid input
        await expect(stateManager.setDeviceState(null, DeviceState.ONLINE)).rejects.toThrow('Device ID is required for setState');
    });
  });

  describe('removeDeviceState', () => {
    it('should remove state from storage and cache, and emit event if state existed', async () => {
        mockMemoryCache.get.mockReturnValue(DeviceState.ERROR); // Assume it was in cache
        mockPersistentStorage.getItem.mockResolvedValue(DeviceState.ERROR); // And storage

        await stateManager.removeDeviceState(deviceId);

        expect(mockPersistentStorage.removeItem).toHaveBeenCalledWith(deviceId);
        expect(mockMemoryCache.delete).toHaveBeenCalledWith(deviceId);
        expect(mockStateEventEmitter.emit).toHaveBeenCalledWith('deviceStateUpdated', deviceId, null, DeviceState.ERROR);
    });

    it('should not emit event if state did not exist', async () => {
        mockMemoryCache.get.mockReturnValue(undefined);
        mockPersistentStorage.getItem.mockResolvedValue(null);

        await stateManager.removeDeviceState(deviceId);

        expect(mockPersistentStorage.removeItem).toHaveBeenCalledWith(deviceId);
        expect(mockMemoryCache.delete).toHaveBeenCalledWith(deviceId);
        expect(mockStateEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw error if device ID is not provided for removeState', async () => {
        // @ts-expect-error testing invalid input
        await expect(stateManager.removeDeviceState(null)).rejects.toThrow('Device ID is required for removeState');
    });
  });


  describe('subscribeToStateChanges & unsubscribeFromStateChanges', () => {
    it('should allow subscribing and unsubscribing to state changes', () => {
      const listener1: StateUpdateListener = jest.fn();
      const listener2: StateUpdateListener = jest.fn();

      stateManager.subscribeToStateChanges(listener1);
      stateManager.subscribeToStateChanges(listener2);

      expect(mockStateEventEmitter.on).toHaveBeenCalledWith('deviceStateUpdated', listener1);
      expect(mockStateEventEmitter.on).toHaveBeenCalledWith('deviceStateUpdated', listener2);

      // Simulate an event emission by directly calling the registered listeners
      // This part is tricky to test without actually triggering setDeviceState
      // and relying on the mockEventEmitter.on to capture the listener.
      // A more direct test of emitter.on would be to check its internal list of listeners if possible.
      // For now, we trust jest.fn() captures calls.

      stateManager.unsubscribeFromStateChanges(listener1);
      expect(mockStateEventEmitter.off).toHaveBeenCalledWith('deviceStateUpdated', listener1);

      // If we could trigger an emit here, listener1 should not be called, listener2 should.
    });

    it('listeners should be called on state change', async () => {
        const listener = jest.fn();
        stateManager.subscribeToStateChanges(listener);

        // Manually set up the mock emitter to call the listener when 'deviceStateUpdated' is emitted
        // This is a common pattern for testing event emitters.
        mockStateEventEmitter.emit.mockImplementation((event, ...args) => {
            if (event === 'deviceStateUpdated') {
                const registeredListeners = mockStateEventEmitter.on.mock.calls.filter(call => call[0] === event);
                registeredListeners.forEach(regCall => regCall[1](...args));
            }
        });


        mockPersistentStorage.getItem.mockResolvedValue(DeviceState.OFFLINE); // Old state
        await stateManager.setDeviceState(deviceId, DeviceState.ONLINE);

        expect(listener).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE, DeviceState.OFFLINE);
    });
  });
});