// Mock for firmware image storage (e.g., S3, local filesystem)
const mockFirmwareStorage = {
  uploadFirmware: jest.fn(),
  getFirmwareUrl: jest.fn(), // Returns a URL or path to the firmware image
  deleteFirmwareImage: jest.fn(),
  listFirmwareImages: jest.fn(), // Lists stored firmware files/metadata
};

// Mock for a metadata store for firmware versions
const mockFirmwareMetadataStore = {
  addVersion: jest.fn(),
  getVersion: jest.fn(),
  getAllVersions: jest.fn(),
  deleteVersion: jest.fn(),
  updateVersionInfo: jest.fn(),
};

// Mock for DeviceLifecycleManager (or relevant parts)
const mockDeviceLifecycleManager = {
  getDeviceState: jest.fn(),
  startFirmwareUpdate: jest.fn(),
  finishFirmwareUpdate: jest.fn(),
};

// Mock for a device communication service (to send update commands)
const mockDeviceCommunicator = {
  triggerDeviceUpdate: jest.fn(), // (deviceId, firmwareUrl, version) => Promise<boolean> (success/failure)
  getDeviceCompatibility: jest.fn(), // (deviceId, firmwareVersionId) => Promise<boolean>
};

// Placeholder for actual FirmwareManager implementation
// import { FirmwareManager } from '../../../../core/lifecycle/firmware-manager';

interface FirmwareVersion {
  id: string; // e.g., 'fw-temp-sensor-v1.2.0'
  version: string; // e.g., '1.2.0'
  deviceType: string; // e.g., 'temp-sensor'
  fileName: string; // e.g., 'temp-sensor-v1.2.0.bin'
  size: number; // in bytes
  checksum: string; // e.g., md5 or sha256
  releaseDate: Date;
  description?: string;
  storagePath?: string; // Path/key in mockFirmwareStorage
}

class FirmwareManager {
  constructor(
    private fwStorage: typeof mockFirmwareStorage,
    private metaStore: typeof mockFirmwareMetadataStore,
    private lifecycleMgr: typeof mockDeviceLifecycleManager,
    private communicator: typeof mockDeviceCommunicator
  ) {}

  async uploadNewFirmware(
    firmwareFile: Buffer, // Simplified: in reality, this might be a stream or path
    metadata: Omit<FirmwareVersion, 'id' | 'storagePath' | 'size' | 'checksum' | 'releaseDate'> & { deviceType: string }
  ): Promise<FirmwareVersion> {
    if (!firmwareFile || firmwareFile.length === 0) throw new Error('Firmware file is empty or invalid');
    if (!metadata || !metadata.version || !metadata.deviceType || !metadata.fileName) {
      throw new Error('Invalid firmware metadata: version, deviceType, and fileName are required');
    }

    const id = `${metadata.deviceType}-fw-${metadata.version}`;
    const existing = await this.metaStore.getVersion(id);
    if (existing) throw new Error(`Firmware version ${id} already exists.`);

    // Simulate file upload and checksum/size calculation
    const checksum = `checksum-${Date.now()}`; // Simplified
    const size = firmwareFile.length;
    const storagePath = `firmware/${metadata.deviceType}/${metadata.fileName}`;
    await this.fwStorage.uploadFirmware(storagePath, firmwareFile);

    const newVersion: FirmwareVersion = {
      ...metadata,
      id,
      size,
      checksum,
      storagePath,
      releaseDate: new Date(),
    };
    await this.metaStore.addVersion(id, newVersion);
    return newVersion;
  }

  async getFirmwareVersion(firmwareId: string): Promise<FirmwareVersion | null> {
    if (!firmwareId) throw new Error('Firmware ID is required');
    return this.metaStore.getVersion(firmwareId);
  }

  async listFirmwareVersions(deviceType?: string): Promise<FirmwareVersion[]> {
    const allVersions: FirmwareVersion[] = await this.metaStore.getAllVersions();
    if (deviceType) {
      return allVersions.filter(fw => fw.deviceType === deviceType);
    }
    return allVersions;
  }

  async deleteFirmwareVersion(firmwareId: string): Promise<FirmwareVersion> {
    if (!firmwareId) throw new Error('Firmware ID is required');
    const version = await this.metaStore.getVersion(firmwareId);
    if (!version) throw new Error(`Firmware version ${firmwareId} not found.`);
    if (version.storagePath) {
      await this.fwStorage.deleteFirmwareImage(version.storagePath);
    }
    await this.metaStore.deleteVersion(firmwareId);
    return version;
  }

  async initiateDeviceFirmwareUpdate(deviceId: string, firmwareId: string): Promise<void> {
    if (!deviceId || !firmwareId) throw new Error('Device ID and Firmware ID are required');

    const deviceState = await this.lifecycleMgr.getDeviceState(deviceId);
    if (deviceState !== DeviceState.ONLINE) {
      throw new Error(`Device ${deviceId} is not ONLINE. Current state: ${deviceState}`);
    }

    const firmwareVersion = await this.metaStore.getVersion(firmwareId);
    if (!firmwareVersion) throw new Error(`Firmware ${firmwareId} not found.`);
    if (!firmwareVersion.storagePath) throw new Error(`Firmware ${firmwareId} has no storage path.`);

    const isCompatible = await this.communicator.getDeviceCompatibility(deviceId, firmwareVersion.id);
    if (!isCompatible) {
        throw new Error(`Device ${deviceId} is not compatible with firmware ${firmwareId}`);
    }

    await this.lifecycleMgr.startFirmwareUpdate(deviceId);
    try {
      const firmwareUrl = await this.fwStorage.getFirmwareUrl(firmwareVersion.storagePath);
      const success = await this.communicator.triggerDeviceUpdate(deviceId, firmwareUrl, firmwareVersion.version);
      await this.lifecycleMgr.finishFirmwareUpdate(deviceId, success);
      if (!success) throw new Error(`Device ${deviceId} failed to apply firmware ${firmwareId}`);
    } catch (error) {
      await this.lifecycleMgr.finishFirmwareUpdate(deviceId, false); // Ensure state is updated on error
      // It's important to also log the error or handle it appropriately
      console.error(`Update failed for ${deviceId} with ${firmwareId}:`, error);
      throw error; // Re-throw to indicate failure
    }
  }
}

describe('FirmwareManager', () => {
  let firmwareManager: FirmwareManager;
  const mockFirmwareFile = Buffer.from('this is mock firmware content');

  beforeEach(() => {
    mockFirmwareStorage.uploadFirmware.mockReset();
    mockFirmwareStorage.getFirmwareUrl.mockReset();
    mockFirmwareStorage.deleteFirmwareImage.mockReset();
    mockFirmwareStorage.listFirmwareImages.mockReset();
    mockFirmwareMetadataStore.addVersion.mockReset();
    mockFirmwareMetadataStore.getVersion.mockReset();
    mockFirmwareMetadataStore.getAllVersions.mockReset();
    mockFirmwareMetadataStore.deleteVersion.mockReset();
    mockDeviceLifecycleManager.getDeviceState.mockReset();
    mockDeviceLifecycleManager.startFirmwareUpdate.mockReset();
    mockDeviceLifecycleManager.finishFirmwareUpdate.mockReset();
    mockDeviceCommunicator.triggerDeviceUpdate.mockReset();
    mockDeviceCommunicator.getDeviceCompatibility.mockReset();

    firmwareManager = new FirmwareManager(
      mockFirmwareStorage,
      mockFirmwareMetadataStore,
      mockDeviceLifecycleManager,
      mockDeviceCommunicator
    );
  });

  describe('uploadNewFirmware', () => {
    const metadata = { version: '1.0.0', deviceType: 'sensor-v2', fileName: 'sensor-v2-fw-1.0.0.bin', description: 'Initial release' };
    const expectedId = `${metadata.deviceType}-fw-${metadata.version}`;

    it('should upload firmware and create metadata successfully', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(null); // Not existing
      mockFirmwareStorage.uploadFirmware.mockResolvedValue(undefined);
      mockFirmwareMetadataStore.addVersion.mockResolvedValue(undefined);

      const result = await firmwareManager.uploadNewFirmware(mockFirmwareFile, metadata);

      expect(mockFirmwareStorage.uploadFirmware).toHaveBeenCalledWith(expect.stringContaining(metadata.fileName), mockFirmwareFile);
      expect(mockFirmwareMetadataStore.addVersion).toHaveBeenCalledWith(expectedId, expect.objectContaining({
        ...metadata,
        id: expectedId,
        size: mockFirmwareFile.length,
        checksum: expect.any(String),
        storagePath: expect.stringContaining(metadata.fileName),
        releaseDate: expect.any(Date),
      }));
      expect(result.id).toBe(expectedId);
    });

    it('should throw error if firmware version already exists', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue({ id: expectedId } as FirmwareVersion); // Exists
      await expect(firmwareManager.uploadNewFirmware(mockFirmwareFile, metadata)).rejects.toThrow(`Firmware version ${expectedId} already exists.`);
    });

    it('should throw error for invalid metadata (missing version)', async () => {
        const invalidMeta = { deviceType: 'sensor-v2', fileName: 'file.bin' };
        // @ts-expect-error testing invalid input
        await expect(firmwareManager.uploadNewFirmware(mockFirmwareFile, invalidMeta)).rejects.toThrow('Invalid firmware metadata');
    });

    it('should throw error for empty firmware file', async () => {
        await expect(firmwareManager.uploadNewFirmware(Buffer.from(''), metadata)).rejects.toThrow('Firmware file is empty or invalid');
    });
  });

  describe('getFirmwareVersion', () => {
    it('should return firmware version details if found', async () => {
      const fwVersion: FirmwareVersion = { id: 'sensor-fw-1.0', version: '1.0', deviceType: 'sensor', fileName: 'f.bin', size: 100, checksum: 'cs', releaseDate: new Date() };
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(fwVersion);
      const result = await firmwareManager.getFirmwareVersion('sensor-fw-1.0');
      expect(result).toEqual(fwVersion);
      expect(mockFirmwareMetadataStore.getVersion).toHaveBeenCalledWith('sensor-fw-1.0');
    });

    it('should return null if firmware version not found', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(null);
      const result = await firmwareManager.getFirmwareVersion('non-existent-fw');
      expect(result).toBeNull();
    });
  });

  describe('listFirmwareVersions', () => {
    const versions: FirmwareVersion[] = [
      { id: 'typeA-fw-1', version: '1', deviceType: 'typeA', fileName: 'f1.bin', size: 1, checksum: 'c1', releaseDate: new Date() },
      { id: 'typeB-fw-1', version: '1', deviceType: 'typeB', fileName: 'f2.bin', size: 2, checksum: 'c2', releaseDate: new Date() },
      { id: 'typeA-fw-2', version: '2', deviceType: 'typeA', fileName: 'f3.bin', size: 3, checksum: 'c3', releaseDate: new Date() },
    ];
    it('should list all firmware versions', async () => {
      mockFirmwareMetadataStore.getAllVersions.mockResolvedValue(versions);
      const result = await firmwareManager.listFirmwareVersions();
      expect(result).toEqual(versions);
    });

    it('should list firmware versions filtered by deviceType', async () => {
      mockFirmwareMetadataStore.getAllVersions.mockResolvedValue(versions);
      const result = await firmwareManager.listFirmwareVersions('typeA');
      expect(result).toEqual([versions[0], versions[2]]);
    });
  });

  describe('deleteFirmwareVersion', () => {
    const fwVersion: FirmwareVersion = { id: 'fw-del-1.0', version: '1.0', deviceType: 'del-type', fileName: 'del.bin', size: 123, checksum: 'del-cs', releaseDate: new Date(), storagePath: 'firmware/del-type/del.bin' };
    it('should delete firmware image and metadata', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(fwVersion);
      mockFirmwareStorage.deleteFirmwareImage.mockResolvedValue(undefined);
      mockFirmwareMetadataStore.deleteVersion.mockResolvedValue(undefined);

      const result = await firmwareManager.deleteFirmwareVersion('fw-del-1.0');
      expect(mockFirmwareStorage.deleteFirmwareImage).toHaveBeenCalledWith(fwVersion.storagePath);
      expect(mockFirmwareMetadataStore.deleteVersion).toHaveBeenCalledWith('fw-del-1.0');
      expect(result).toEqual(fwVersion);
    });

    it('should throw error if firmware to delete is not found', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(null);
      await expect(firmwareManager.deleteFirmwareVersion('not-found-fw')).rejects.toThrow('Firmware version not-found-fw not found.');
    });
  });

  describe('initiateDeviceFirmwareUpdate', () => {
    const deviceId = 'dev-updater-1';
    const firmwareId = 'sensor-fw-v2.0';
    const firmwareVersion: FirmwareVersion = {
      id: firmwareId, version: '2.0', deviceType: 'sensor', fileName: 's-fw-2.0.bin',
      size: 2048, checksum: 'abc', releaseDate: new Date(), storagePath: 'fw/sensor/s-fw-2.0.bin'
    };
    const firmwareUrl = 'http://storage.example.com/fw/sensor/s-fw-2.0.bin';

    beforeEach(() => {
        mockDeviceLifecycleManager.getDeviceState.mockResolvedValue(DeviceState.ONLINE);
        mockFirmwareMetadataStore.getVersion.mockResolvedValue(firmwareVersion);
        mockFirmwareStorage.getFirmwareUrl.mockResolvedValue(firmwareUrl);
        mockDeviceCommunicator.getDeviceCompatibility.mockResolvedValue(true);
    });

    it('should successfully initiate and complete a firmware update', async () => {
      mockDeviceCommunicator.triggerDeviceUpdate.mockResolvedValue(true); // Device reports success

      await firmwareManager.initiateDeviceFirmwareUpdate(deviceId, firmwareId);

      expect(mockDeviceLifecycleManager.getDeviceState).toHaveBeenCalledWith(deviceId);
      expect(mockFirmwareMetadataStore.getVersion).toHaveBeenCalledWith(firmwareId);
      expect(mockDeviceCommunicator.getDeviceCompatibility).toHaveBeenCalledWith(deviceId, firmwareId);
      expect(mockDeviceLifecycleManager.startFirmwareUpdate).toHaveBeenCalledWith(deviceId);
      expect(mockFirmwareStorage.getFirmwareUrl).toHaveBeenCalledWith(firmwareVersion.storagePath);
      expect(mockDeviceCommunicator.triggerDeviceUpdate).toHaveBeenCalledWith(deviceId, firmwareUrl, firmwareVersion.version);
      expect(mockDeviceLifecycleManager.finishFirmwareUpdate).toHaveBeenCalledWith(deviceId, true);
    });

    it('should handle firmware update failure reported by device', async () => {
      mockDeviceCommunicator.triggerDeviceUpdate.mockResolvedValue(false); // Device reports failure

      await expect(firmwareManager.initiateDeviceFirmwareUpdate(deviceId, firmwareId))
        .rejects.toThrow(`Device ${deviceId} failed to apply firmware ${firmwareId}`);

      expect(mockDeviceLifecycleManager.finishFirmwareUpdate).toHaveBeenCalledWith(deviceId, false);
    });

    it('should throw error if device is not ONLINE', async () => {
      mockDeviceLifecycleManager.getDeviceState.mockResolvedValue(DeviceState.OFFLINE);
      await expect(firmwareManager.initiateDeviceFirmwareUpdate(deviceId, firmwareId))
        .rejects.toThrow(`Device ${deviceId} is not ONLINE. Current state: ${DeviceState.OFFLINE}`);
    });

    it('should throw error if firmware version not found', async () => {
      mockFirmwareMetadataStore.getVersion.mockResolvedValue(null);
      await expect(firmwareManager.initiateDeviceFirmwareUpdate(deviceId, 'unknown-fw'))
        .rejects.toThrow('Firmware unknown-fw not found.');
    });

    it('should throw error if device is not compatible', async () => {
        mockDeviceCommunicator.getDeviceCompatibility.mockResolvedValue(false);
        await expect(firmwareManager.initiateDeviceFirmwareUpdate(deviceId, firmwareId))
          .rejects.toThrow(`Device ${deviceId} is not compatible with firmware ${firmwareId}`);
    });

    it('should handle error during triggerDeviceUpdate and call finishFirmwareUpdate with false', async () => {
        const commError = new Error('Communication timed out');
        mockDeviceCommunicator.triggerDeviceUpdate.mockRejectedValue(commError);

        await expect(firmwareManager.initiateDeviceFirmwareUpdate(deviceId, firmwareId))
            .rejects.toThrow(commError); // or specific error related to update failure

        expect(mockDeviceLifecycleManager.finishFirmwareUpdate).toHaveBeenCalledWith(deviceId, false);
    });
  });
});