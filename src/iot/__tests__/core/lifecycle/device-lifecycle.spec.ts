// Mock for a state storage (e.g., a simple key-value store or a more complex state DB)
const mockStateStorage = {
  getState: jest.fn(),
  setState: jest.fn(),
  removeState: jest.fn(),
};

// Mock for an event emitter or similar notification mechanism
const mockEventEmitter = {
  emit: jest.fn(),
};

// Placeholder for actual DeviceLifecycleManager implementation
// Replace with actual import if DeviceLifecycleManager exists
// import { DeviceLifecycleManager, DeviceState } from '../../../../core/lifecycle/device-lifecycle';

enum DeviceState {
  PROVISIONING = 'provisioning',
  ONLINE = 'online',
  OFFLINE = 'offline',
  UPDATING = 'updating',
  ERROR = 'error',
  DECOMMISSIONED = 'decommissioned',
}

interface Device {
  id: string;
  // other device properties
}

class DeviceLifecycleManager {
  private stateStorage: typeof mockStateStorage;
  private eventEmitter: typeof mockEventEmitter;

  constructor(stateStorage: typeof mockStateStorage, eventEmitter: typeof mockEventEmitter) {
    this.stateStorage = stateStorage;
    this.eventEmitter = eventEmitter;
  }

  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    if (!deviceId) throw new Error('Device ID is required');
    return this.stateStorage.getState(deviceId);
  }

  private async _updateDeviceState(deviceId: string, newState: DeviceState, oldState?: DeviceState | null): Promise<void> {
    await this.stateStorage.setState(deviceId, newState);
    this.eventEmitter.emit('deviceStateChanged', {
      deviceId,
      newState,
      oldState: oldState !== undefined ? oldState : await this.getDeviceState(deviceId) /* re-fetch if not passed */,
    });
  }

  async provisionDevice(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    if (currentState && currentState !== DeviceState.OFFLINE && currentState !== DeviceState.DECOMMISSIONED) { // Allow reprovisioning from offline/decommissioned
      throw new Error(`Device ${deviceId} cannot be provisioned from state: ${currentState}`);
    }
    await this._updateDeviceState(deviceId, DeviceState.PROVISIONING, currentState);
    // Simulate provisioning steps...
    await this._updateDeviceState(deviceId, DeviceState.OFFLINE, DeviceState.PROVISIONING); // Typically goes offline after provisioning, ready to connect
  }

  async deviceOnline(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    if (currentState !== DeviceState.OFFLINE && currentState !== DeviceState.PROVISIONING) { // Can come online from provisioning or offline
      throw new Error(`Device ${deviceId} cannot go online from state: ${currentState}`);
    }
    await this._updateDeviceState(deviceId, DeviceState.ONLINE, currentState);
  }

  async deviceOffline(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    if (currentState !== DeviceState.ONLINE && currentState !== DeviceState.UPDATING && currentState !== DeviceState.ERROR) {
      // Can go offline from online, updating, or error states
      throw new Error(`Device ${deviceId} cannot go offline from state: ${currentState}`);
    }
    await this._updateDeviceState(deviceId, DeviceState.OFFLINE, currentState);
  }

  async startFirmwareUpdate(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    if (currentState !== DeviceState.ONLINE) {
      throw new Error(`Device ${deviceId} must be online to start firmware update. Current state: ${currentState}`);
    }
    await this._updateDeviceState(deviceId, DeviceState.UPDATING, currentState);
  }

  async finishFirmwareUpdate(deviceId: string, success: boolean): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    if (currentState !== DeviceState.UPDATING) {
      throw new Error(`Device ${deviceId} is not in updating state. Current state: ${currentState}`);
    }
    const nextState = success ? DeviceState.ONLINE : DeviceState.ERROR;
    await this._updateDeviceState(deviceId, nextState, currentState);
    if (!success) {
        this.eventEmitter.emit('firmwareUpdateFailed', { deviceId, reason: 'Update process reported failure.' });
    }
  }

  async reportError(deviceId: string, errorCode: string, errorMessage: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    // Allow reporting error from most states, except perhaps decommissioned
    if (currentState === DeviceState.DECOMMISSIONED) {
        throw new Error(`Cannot report error for decommissioned device: ${deviceId}`);
    }
    await this._updateDeviceState(deviceId, DeviceState.ERROR, currentState);
    this.eventEmitter.emit('deviceError', { deviceId, errorCode, errorMessage, previousState: currentState });
  }

  async decommissionDevice(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required');
    const currentState = await this.getDeviceState(deviceId);
    // Can be decommissioned from most states, but typically offline or error
    await this._updateDeviceState(deviceId, DeviceState.DECOMMISSIONED, currentState);
    await this.stateStorage.removeState(deviceId); // Optionally remove state entirely after decommissioning
    this.eventEmitter.emit('deviceDecommissioned', { deviceId });
  }
}

describe('DeviceLifecycleManager', () => {
  let lifecycleManager: DeviceLifecycleManager;
  const deviceId = 'test-device-123';

  beforeEach(() => {
    mockStateStorage.getState.mockReset();
    mockStateStorage.setState.mockReset();
    mockStateStorage.removeState.mockReset();
    mockEventEmitter.emit.mockReset();

    lifecycleManager = new DeviceLifecycleManager(mockStateStorage, mockEventEmitter);
  });

  describe('provisionDevice', () => {
    it('should provision a new device (no prior state) and set it to OFFLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(null); // No existing state
      await lifecycleManager.provisionDevice(deviceId);

      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.PROVISIONING);
      expect(mockStateStorage.setState).toHaveBeenLastCalledWith(deviceId, DeviceState.OFFLINE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.PROVISIONING, oldState: null }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.OFFLINE, oldState: DeviceState.PROVISIONING }));
    });

    it('should re-provision an OFFLINE device', async () => {
        mockStateStorage.getState.mockResolvedValue(DeviceState.OFFLINE);
        await lifecycleManager.provisionDevice(deviceId);
        expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.PROVISIONING);
        expect(mockStateStorage.setState).toHaveBeenLastCalledWith(deviceId, DeviceState.OFFLINE);
    });


    it('should throw error if trying to provision an ONLINE device', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await expect(lifecycleManager.provisionDevice(deviceId)).rejects.toThrow(`Device ${deviceId} cannot be provisioned from state: ${DeviceState.ONLINE}`);
    });

    it('should throw error if device ID is not provided', async () => {
        // @ts-expect-error testing invalid input
        await expect(lifecycleManager.provisionDevice(null)).rejects.toThrow('Device ID is required');
    });
  });

  describe('deviceOnline', () => {
    it('should set an OFFLINE device to ONLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.OFFLINE);
      await lifecycleManager.deviceOnline(deviceId);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.ONLINE, oldState: DeviceState.OFFLINE }));
    });

    it('should set a PROVISIONING device to ONLINE', async () => {
        mockStateStorage.getState.mockResolvedValue(DeviceState.PROVISIONING);
        await lifecycleManager.deviceOnline(deviceId);
        expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.ONLINE, oldState: DeviceState.PROVISIONING }));
      });

    it('should throw error if device is already ONLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await expect(lifecycleManager.deviceOnline(deviceId)).rejects.toThrow(`Device ${deviceId} cannot go online from state: ${DeviceState.ONLINE}`);
    });
  });

  describe('deviceOffline', () => {
    it('should set an ONLINE device to OFFLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await lifecycleManager.deviceOffline(deviceId);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.OFFLINE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.OFFLINE, oldState: DeviceState.ONLINE }));
    });

    it('should set an UPDATING device to OFFLINE (e.g. update interrupted)', async () => {
        mockStateStorage.getState.mockResolvedValue(DeviceState.UPDATING);
        await lifecycleManager.deviceOffline(deviceId);
        expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.OFFLINE);
    });

    it('should throw error if device is already OFFLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.OFFLINE);
      await expect(lifecycleManager.deviceOffline(deviceId)).rejects.toThrow(`Device ${deviceId} cannot go offline from state: ${DeviceState.OFFLINE}`);
    });
  });

  describe('startFirmwareUpdate', () => {
    it('should set an ONLINE device to UPDATING', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await lifecycleManager.startFirmwareUpdate(deviceId);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.UPDATING);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.UPDATING, oldState: DeviceState.ONLINE }));
    });

    it('should throw error if device is not ONLINE', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.OFFLINE);
      await expect(lifecycleManager.startFirmwareUpdate(deviceId)).rejects.toThrow(`Device ${deviceId} must be online to start firmware update. Current state: ${DeviceState.OFFLINE}`);
    });
  });

  describe('finishFirmwareUpdate', () => {
    it('should set UPDATING device to ONLINE on success', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.UPDATING);
      await lifecycleManager.finishFirmwareUpdate(deviceId, true);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.ONLINE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.ONLINE, oldState: DeviceState.UPDATING }));
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('firmwareUpdateFailed', expect.anything());
    });

    it('should set UPDATING device to ERROR on failure', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.UPDATING);
      await lifecycleManager.finishFirmwareUpdate(deviceId, false);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.ERROR);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.ERROR, oldState: DeviceState.UPDATING }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('firmwareUpdateFailed', { deviceId, reason: 'Update process reported failure.' });
    });

    it('should throw error if device is not UPDATING', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await expect(lifecycleManager.finishFirmwareUpdate(deviceId, true)).rejects.toThrow(`Device ${deviceId} is not in updating state. Current state: ${DeviceState.ONLINE}`);
    });
  });

  describe('reportError', () => {
    it('should set device to ERROR state and emit event', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      const errorCode = 'E-101';
      const errorMessage = 'Sensor communication failed';
      await lifecycleManager.reportError(deviceId, errorCode, errorMessage);

      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.ERROR);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.ERROR, oldState: DeviceState.ONLINE }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceError', { deviceId, errorCode, errorMessage, previousState: DeviceState.ONLINE });
    });

     it('should throw error if reporting error for a DECOMMISSIONED device', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.DECOMMISSIONED);
      await expect(lifecycleManager.reportError(deviceId, 'E-500', 'test error')).rejects.toThrow(`Cannot report error for decommissioned device: ${deviceId}`);
    });
  });

  describe('decommissionDevice', () => {
    it('should set device to DECOMMISSIONED, remove state, and emit event', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.OFFLINE);
      await lifecycleManager.decommissionDevice(deviceId);

      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.DECOMMISSIONED);
      expect(mockStateStorage.removeState).toHaveBeenCalledWith(deviceId);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceStateChanged', expect.objectContaining({ deviceId, newState: DeviceState.DECOMMISSIONED, oldState: DeviceState.OFFLINE }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('deviceDecommissioned', { deviceId });
    });

     it('can decommission an ONLINE device', async () => {
      mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
      await lifecycleManager.decommissionDevice(deviceId);
      expect(mockStateStorage.setState).toHaveBeenCalledWith(deviceId, DeviceState.DECOMMISSIONED);
      expect(mockStateStorage.removeState).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('getDeviceState', () => {
    it('should return the current state of the device', async () => {
        mockStateStorage.getState.mockResolvedValue(DeviceState.ONLINE);
        const state = await lifecycleManager.getDeviceState(deviceId);
        expect(state).toBe(DeviceState.ONLINE);
        expect(mockStateStorage.getState).toHaveBeenCalledWith(deviceId);
    });

    it('should return null if device has no state', async () => {
        mockStateStorage.getState.mockResolvedValue(null);
        const state = await lifecycleManager.getDeviceState(deviceId);
        expect(state).toBeNull();
    });

    it('should throw error if device ID is not provided', async () => {
        // @ts-expect-error testing invalid input
        await expect(lifecycleManager.getDeviceState(null)).rejects.toThrow('Device ID is required');
    });
  });
});