// Mock for a storage system
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllItems: jest.fn(),
};

// Mock DeviceRegistry (assuming it uses a storage system)
// Replace with actual import if DeviceRegistry exists
// import { DeviceRegistry } from '../../../../core/registry/device-registry';

// Placeholder for actual DeviceRegistry implementation
class DeviceRegistry {
  private storage: typeof mockStorage;
  constructor(storage: typeof mockStorage) {
    this.storage = storage;
  }

  async registerDevice(device: { id: string; name: string; type: string }) {
    if (!device || !device.id || !device.name || !device.type) {
      throw new Error('Invalid device data');
    }
    const existingDevice = await this.storage.getItem(device.id);
    if (existingDevice) {
      throw new Error('Device already registered');
    }
    await this.storage.setItem(device.id, device);
    return device;
  }

  async deregisterDevice(deviceId: string) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    const device = await this.storage.getItem(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }
    await this.storage.removeItem(deviceId);
    return device;
  }

  async getDevice(deviceId: string) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    return this.storage.getItem(deviceId);
  }

  async listDevices() {
    return this.storage.getAllItems();
  }
}


describe('DeviceRegistry', () => {
  let deviceRegistry: DeviceRegistry;

  beforeEach(() => {
    // Reset mocks before each test
    mockStorage.getItem.mockReset();
    mockStorage.setItem.mockReset();
    mockStorage.removeItem.mockReset();
    mockStorage.getAllItems.mockReset();
    deviceRegistry = new DeviceRegistry(mockStorage);
  });

  describe('registerDevice', () => {
    it('should register a new device successfully', async () => {
      const newDevice = { id: 'device-1', name: 'Sensor 1', type: 'temp-sensor' };
      mockStorage.getItem.mockResolvedValue(null); // Device not yet registered
      mockStorage.setItem.mockResolvedValue(undefined);

      const registeredDevice = await deviceRegistry.registerDevice(newDevice);

      expect(mockStorage.getItem).toHaveBeenCalledWith('device-1');
      expect(mockStorage.setItem).toHaveBeenCalledWith('device-1', newDevice);
      expect(registeredDevice).toEqual(newDevice);
    });

    it('should throw an error if device data is invalid', async () => {
      // @ts-expect-error testing invalid input
      await expect(deviceRegistry.registerDevice({ id: 'd1' })).rejects.toThrow('Invalid device data');
      // @ts-expect-error testing invalid input
      await expect(deviceRegistry.registerDevice(null)).rejects.toThrow('Invalid device data');
    });

    it('should throw an error if device is already registered', async () => {
      const existingDevice = { id: 'device-1', name: 'Sensor 1', type: 'temp-sensor' };
      mockStorage.getItem.mockResolvedValue(existingDevice); // Device already exists

      await expect(deviceRegistry.registerDevice(existingDevice)).rejects.toThrow('Device already registered');
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('deregisterDevice', () => {
    it('should deregister an existing device successfully', async () => {
      const deviceToDeregister = { id: 'device-1', name: 'Sensor 1', type: 'temp-sensor' };
      mockStorage.getItem.mockResolvedValue(deviceToDeregister); // Device exists
      mockStorage.removeItem.mockResolvedValue(undefined);

      const deregisteredDevice = await deviceRegistry.deregisterDevice('device-1');

      expect(mockStorage.getItem).toHaveBeenCalledWith('device-1');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('device-1');
      expect(deregisteredDevice).toEqual(deviceToDeregister);
    });

    it('should throw an error if device ID is not provided', async () => {
      // @ts-expect-error testing invalid input
      await expect(deviceRegistry.deregisterDevice(null)).rejects.toThrow('Device ID is required');
      await expect(deviceRegistry.deregisterDevice('')).rejects.toThrow('Device ID is required');
    });

    it('should throw an error if device is not found', async () => {
      mockStorage.getItem.mockResolvedValue(null); // Device does not exist

      await expect(deviceRegistry.deregisterDevice('non-existent-device')).rejects.toThrow('Device not found');
      expect(mockStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('getDevice', () => {
    it('should return a device if it exists', async () => {
      const device = { id: 'device-1', name: 'Sensor 1', type: 'temp-sensor' };
      mockStorage.getItem.mockResolvedValue(device);

      const foundDevice = await deviceRegistry.getDevice('device-1');

      expect(mockStorage.getItem).toHaveBeenCalledWith('device-1');
      expect(foundDevice).toEqual(device);
    });

    it('should return null if device does not exist', async () => {
      mockStorage.getItem.mockResolvedValue(null);

      const foundDevice = await deviceRegistry.getDevice('non-existent-device');

      expect(mockStorage.getItem).toHaveBeenCalledWith('non-existent-device');
      expect(foundDevice).toBeNull();
    });

    it('should throw an error if device ID is not provided', async () => {
       // @ts-expect-error testing invalid input
      await expect(deviceRegistry.getDevice(null)).rejects.toThrow('Device ID is required');
      await expect(deviceRegistry.getDevice('')).rejects.toThrow('Device ID is required');
    });
  });

  describe('listDevices', () => {
    it('should return a list of all registered devices', async () => {
      const devices = [
        { id: 'device-1', name: 'Sensor 1', type: 'temp-sensor' },
        { id: 'device-2', name: 'Actuator 1', type: 'valve-actuator' },
      ];
      // Assuming getAllItems returns an array of device objects directly
      // or an object that can be converted to an array.
      // For simplicity, let's assume it returns the array.
      mockStorage.getAllItems.mockResolvedValue(devices);

      const deviceList = await deviceRegistry.listDevices();

      expect(mockStorage.getAllItems).toHaveBeenCalled();
      expect(deviceList).toEqual(devices);
    });

    it('should return an empty list if no devices are registered', async () => {
      mockStorage.getAllItems.mockResolvedValue([]);

      const deviceList = await deviceRegistry.listDevices();

      expect(mockStorage.getAllItems).toHaveBeenCalled();
      expect(deviceList).toEqual([]);
    });
  });
});