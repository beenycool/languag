// Mock for a persistent configuration storage (e.g., database, S3, Git)
const mockConfigStorage = {
  getConfig: jest.fn(), // (deviceId, version?) => Promise<DeviceConfig | null>
  setConfig: jest.fn(), // (deviceId, config, version?) => Promise<void>
  deleteConfig: jest.fn(), // (deviceId, version?) => Promise<void>
  listConfigVersions: jest.fn(), // (deviceId) => Promise<string[]>
  getLatestConfig: jest.fn(), // (deviceId) => Promise<DeviceConfig | null>
};

// Mock for a device communication service (optional, if manager pushes configs)
const mockConfigDeviceCommunicator = {
  applyConfig: jest.fn(), // (deviceId, config) => Promise<boolean> (success/failure)
};

// Mock for an event emitter (optional, for config change notifications)
const mockConfigEventEmitter = {
  emit: jest.fn(),
};

// Placeholder for actual ConfigManager implementation
// import { ConfigManager } from '../../../../services/management/config-manager';

interface DeviceConfig {
  version: string; // e.g., 'v1', '2023-10-26T10:00:00Z', or a semantic version
  payload: Record<string, any>; // The actual configuration data
  metadata?: {
    appliedAt?: Date;
    source?: string; // 'user', 'system-default', 'group-policy'
  };
}

class ConfigManager {
  private storage: typeof mockConfigStorage;
  private communicator?: typeof mockConfigDeviceCommunicator;
  private emitter?: typeof mockConfigEventEmitter;

  constructor(
    storage: typeof mockConfigStorage,
    communicator?: typeof mockConfigDeviceCommunicator,
    emitter?: typeof mockConfigEventEmitter
  ) {
    this.storage = storage;
    this.communicator = communicator;
    this.emitter = emitter;
  }

  async getDeviceConfig(deviceId: string, version?: string): Promise<DeviceConfig | null> {
    if (!deviceId) throw new Error('Device ID is required.');
    if (version) {
      return this.storage.getConfig(deviceId, version);
    }
    return this.storage.getLatestConfig(deviceId);
  }

  async setDeviceConfig(deviceId: string, configPayload: Record<string, any>, newVersion?: string, source?: string): Promise<DeviceConfig> {
    if (!deviceId) throw new Error('Device ID is required.');
    if (!configPayload || Object.keys(configPayload).length === 0) {
      throw new Error('Configuration payload cannot be empty.');
    }

    const versionToSet = newVersion || new Date().toISOString(); // Default versioning by timestamp
    
    // Optional: Check if this version already exists to prevent overwrite without explicit intent
    // const existing = await this.storage.getConfig(deviceId, versionToSet);
    // if (existing) throw new Error(`Config version ${versionToSet} already exists for device ${deviceId}.`);

    const newConfig: DeviceConfig = {
      version: versionToSet,
      payload: configPayload,
      metadata: { source: source || 'manual-set' }
    };

    await this.storage.setConfig(deviceId, newConfig, versionToSet);
    this.emitter?.emit('configChanged', { deviceId, newConfig });
    return newConfig;
  }

  async updateDeviceConfig(deviceId: string, updates: Partial<Record<string, any>>, newVersion?: string, source?: string): Promise<DeviceConfig> {
    if (!deviceId) throw new Error('Device ID is required.');
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('No updates provided.');
    }

    const currentConfig = await this.storage.getLatestConfig(deviceId);
    if (!currentConfig) {
      // If no current config, treat as setting a new one with the updates as payload
      return this.setDeviceConfig(deviceId, updates, newVersion || new Date().toISOString(), source || 'manual-update-new');
    }

    const updatedPayload = { ...currentConfig.payload, ...updates };
    const versionToSet = newVersion || new Date().toISOString();

    const updatedConfig: DeviceConfig = {
      version: versionToSet,
      payload: updatedPayload,
      metadata: { ...currentConfig.metadata, source: source || 'manual-update' }
    };

    await this.storage.setConfig(deviceId, updatedConfig, versionToSet);
    this.emitter?.emit('configChanged', { deviceId, newConfig: updatedConfig, oldConfig: currentConfig });
    return updatedConfig;
  }
  
  async listConfigVersions(deviceId: string): Promise<string[]> {
    if (!deviceId) throw new Error('Device ID is required.');
    return this.storage.listConfigVersions(deviceId);
  }

  async applyConfigToDevice(deviceId: string, version?: string): Promise<boolean> {
    if (!this.communicator) throw new Error('Device communicator not configured.');
    if (!deviceId) throw new Error('Device ID is required.');

    const configToApply = await this.getDeviceConfig(deviceId, version);
    if (!configToApply) {
      throw new Error(`No configuration found for device ${deviceId}` + (version ? ` with version ${version}` : ' (latest)'));
    }

    const success = await this.communicator.applyConfig(deviceId, configToApply);
    if (success) {
      // Optionally update metadata after successful application
      const appliedConfig: DeviceConfig = {
          ...configToApply,
          metadata: { ...configToApply.metadata, appliedAt: new Date() }
      };
      await this.storage.setConfig(deviceId, appliedConfig, appliedConfig.version); // Re-set to update metadata
      this.emitter?.emit('configApplied', { deviceId, config: appliedConfig });
    }
    return success;
  }
}

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const deviceId = 'thermostat-789';

  beforeEach(() => {
    mockConfigStorage.getConfig.mockReset();
    mockConfigStorage.setConfig.mockReset();
    mockConfigStorage.deleteConfig.mockReset();
    mockConfigStorage.listConfigVersions.mockReset();
    mockConfigStorage.getLatestConfig.mockReset();
    if (mockConfigDeviceCommunicator) mockConfigDeviceCommunicator.applyConfig.mockReset();
    if (mockConfigEventEmitter) mockConfigEventEmitter.emit.mockReset();

    configManager = new ConfigManager(mockConfigStorage, mockConfigDeviceCommunicator, mockConfigEventEmitter);
  });

  describe('getDeviceConfig', () => {
    it('should get the latest config if no version is specified', async () => {
      const latestConfig: DeviceConfig = { version: 'v2', payload: { temp: 22 } };
      mockConfigStorage.getLatestConfig.mockResolvedValue(latestConfig);
      const result = await configManager.getDeviceConfig(deviceId);
      expect(result).toEqual(latestConfig);
      expect(mockConfigStorage.getLatestConfig).toHaveBeenCalledWith(deviceId);
      expect(mockConfigStorage.getConfig).not.toHaveBeenCalled();
    });

    it('should get a specific config version if specified', async () => {
      const specificConfig: DeviceConfig = { version: 'v1', payload: { temp: 20 } };
      mockConfigStorage.getConfig.mockResolvedValue(specificConfig);
      const result = await configManager.getDeviceConfig(deviceId, 'v1');
      expect(result).toEqual(specificConfig);
      expect(mockConfigStorage.getConfig).toHaveBeenCalledWith(deviceId, 'v1');
      expect(mockConfigStorage.getLatestConfig).not.toHaveBeenCalled();
    });

    it('should return null if config not found', async () => {
      mockConfigStorage.getLatestConfig.mockResolvedValue(null);
      const result = await configManager.getDeviceConfig(deviceId);
      expect(result).toBeNull();
    });
  });

  describe('setDeviceConfig', () => {
    const newPayload = { mode: 'auto', fanSpeed: 'low' };
    const version = 'config-v3';

    it('should set a new device configuration with a specific version', async () => {
      mockConfigStorage.setConfig.mockResolvedValue(undefined);
      const result = await configManager.setDeviceConfig(deviceId, newPayload, version, 'user-dashboard');
      
      const expectedConfig: DeviceConfig = {
        version,
        payload: newPayload,
        metadata: { source: 'user-dashboard' }
      };
      expect(mockConfigStorage.setConfig).toHaveBeenCalledWith(deviceId, expect.objectContaining(expectedConfig), version);
      expect(result).toEqual(expect.objectContaining(expectedConfig));
      expect(mockConfigEventEmitter.emit).toHaveBeenCalledWith('configChanged', { deviceId, newConfig: expect.objectContaining(expectedConfig) });
    });

    it('should use a timestamp as version if not provided', async () => {
        mockConfigStorage.setConfig.mockResolvedValue(undefined);
        const result = await configManager.setDeviceConfig(deviceId, newPayload);
        expect(result.version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO Timestamp
        expect(mockConfigStorage.setConfig).toHaveBeenCalledWith(deviceId, expect.any(Object), result.version);
    });

    it('should throw error if payload is empty', async () => {
        await expect(configManager.setDeviceConfig(deviceId, {})).rejects.toThrow('Configuration payload cannot be empty.');
    });
  });

  describe('updateDeviceConfig', () => {
    const initialPayload = { temp: 20, unit: 'C' };
    const initialVersion = 'v1.0';
    const initialConfig: DeviceConfig = { version: initialVersion, payload: initialPayload, metadata: { source: 'default' } };
    const updates = { temp: 22, fan: 'auto' };
    const newVersion = 'v1.1';

    it('should update an existing configuration', async () => {
        mockConfigStorage.getLatestConfig.mockResolvedValue(initialConfig);
        mockConfigStorage.setConfig.mockResolvedValue(undefined);

        const result = await configManager.updateDeviceConfig(deviceId, updates, newVersion, 'user-action');
        const expectedPayload = { ...initialPayload, ...updates };
        const expectedConfig: DeviceConfig = {
            version: newVersion,
            payload: expectedPayload,
            metadata: { source: 'user-action' }
        };

        expect(mockConfigStorage.setConfig).toHaveBeenCalledWith(deviceId, expect.objectContaining(expectedConfig), newVersion);
        expect(result).toEqual(expect.objectContaining(expectedConfig));
        expect(mockConfigEventEmitter.emit).toHaveBeenCalledWith('configChanged', { deviceId, newConfig: expect.objectContaining(expectedConfig), oldConfig: initialConfig });
    });

    it('should set a new config if no current config exists for update', async () => {
        mockConfigStorage.getLatestConfig.mockResolvedValue(null); // No existing config
        mockConfigStorage.setConfig.mockResolvedValue(undefined);

        const result = await configManager.updateDeviceConfig(deviceId, updates, newVersion, 'user-first-set');
        const expectedConfig: DeviceConfig = {
            version: newVersion,
            payload: updates, // Updates become the full payload
            metadata: { source: 'user-first-set' }
        };
        expect(mockConfigStorage.setConfig).toHaveBeenCalledWith(deviceId, expect.objectContaining(expectedConfig), newVersion);
        expect(result).toEqual(expect.objectContaining(expectedConfig));
    });
  });

  describe('listConfigVersions', () => {
    it('should list all available configuration versions for a device', async () => {
      const versions = ['v1', 'v2-timestamp', 'v3-alpha'];
      mockConfigStorage.listConfigVersions.mockResolvedValue(versions);
      const result = await configManager.listConfigVersions(deviceId);
      expect(result).toEqual(versions);
      expect(mockConfigStorage.listConfigVersions).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('applyConfigToDevice', () => {
    const config: DeviceConfig = { version: 'v2.1', payload: { brightness: 80 } };

    it('should fetch config and apply it to the device successfully', async () => {
      mockConfigStorage.getLatestConfig.mockResolvedValue(config); // Assuming latest if no version
      mockConfigDeviceCommunicator.applyConfig.mockResolvedValue(true);
      mockConfigStorage.setConfig.mockResolvedValue(undefined); // For updating metadata

      const success = await configManager.applyConfigToDevice(deviceId);
      expect(success).toBe(true);
      expect(mockConfigDeviceCommunicator.applyConfig).toHaveBeenCalledWith(deviceId, config);
      expect(mockConfigStorage.setConfig).toHaveBeenCalledWith(deviceId, expect.objectContaining({ metadata: expect.objectContaining({ appliedAt: expect.any(Date) }) }), config.version);
      expect(mockConfigEventEmitter.emit).toHaveBeenCalledWith('configApplied', { deviceId, config: expect.objectContaining({ metadata: expect.objectContaining({ appliedAt: expect.any(Date) }) }) });
    });

    it('should handle failure when applying config to device', async () => {
      mockConfigStorage.getLatestConfig.mockResolvedValue(config);
      mockConfigDeviceCommunicator.applyConfig.mockResolvedValue(false); // Device communication fails

      const success = await configManager.applyConfigToDevice(deviceId);
      expect(success).toBe(false);
      expect(mockConfigStorage.setConfig).not.toHaveBeenCalledWith(deviceId, expect.objectContaining({ metadata: expect.objectContaining({ appliedAt: expect.any(Date) }) }), config.version);
      expect(mockConfigEventEmitter.emit).not.toHaveBeenCalledWith('configApplied', expect.anything());
    });

    it('should throw error if config to apply is not found', async () => {
      mockConfigStorage.getLatestConfig.mockResolvedValue(null);
      await expect(configManager.applyConfigToDevice(deviceId))
        .rejects.toThrow(`No configuration found for device ${deviceId} (latest)`);
    });

    it('should throw error if communicator is not configured', async () => {
        const managerWithoutComm = new ConfigManager(mockConfigStorage); // No communicator
        await expect(managerWithoutComm.applyConfigToDevice(deviceId))
            .rejects.toThrow('Device communicator not configured.');
    });
  });
});