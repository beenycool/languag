// Mock for a storage system
const mockAssetStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllItems: jest.fn(),
};

// Placeholder for actual AssetManager implementation
// Replace with actual import if AssetManager exists
// import { AssetManager } from '../../../../core/registry/asset-manager';

interface Asset {
  id: string;
  name: string;
  type: string;
  deviceId?: string; // Optional: asset might be linked to a device
  metadata?: Record<string, any>;
}

class AssetManager {
  private storage: typeof mockAssetStorage;
  constructor(storage: typeof mockAssetStorage) {
    this.storage = storage;
  }

  async createAsset(asset: Asset): Promise<Asset> {
    if (!asset || !asset.id || !asset.name || !asset.type) {
      throw new Error('Invalid asset data');
    }
    const existingAsset = await this.storage.getItem(asset.id);
    if (existingAsset) {
      throw new Error('Asset already exists');
    }
    await this.storage.setItem(asset.id, asset);
    return asset;
  }

  async getAsset(assetId: string): Promise<Asset | null> {
    if (!assetId) {
      throw new Error('Asset ID is required');
    }
    return this.storage.getItem(assetId);
  }

  async updateAsset(assetId: string, updates: Partial<Asset>): Promise<Asset> {
    if (!assetId) {
      throw new Error('Asset ID is required');
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }
    const asset = await this.storage.getItem(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    const updatedAsset = { ...asset, ...updates, id: assetId }; // Ensure ID is not changed
    await this.storage.setItem(assetId, updatedAsset);
    return updatedAsset;
  }

  async deleteAsset(assetId: string): Promise<Asset> {
    if (!assetId) {
      throw new Error('Asset ID is required');
    }
    const asset = await this.storage.getItem(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    await this.storage.removeItem(assetId);
    return asset;
  }

  async listAssets(): Promise<Asset[]> {
    const allItems = await this.storage.getAllItems();
    // Assuming getAllItems returns an array of assets or an object to convert
    return Array.isArray(allItems) ? allItems : Object.values(allItems || {});
  }

  async listAssetsByDevice(deviceId: string): Promise<Asset[]> {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    const allAssets = await this.listAssets();
    return allAssets.filter(asset => asset.deviceId === deviceId);
  }
}

describe('AssetManager', () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    mockAssetStorage.getItem.mockReset();
    mockAssetStorage.setItem.mockReset();
    mockAssetStorage.removeItem.mockReset();
    mockAssetStorage.getAllItems.mockReset();
    assetManager = new AssetManager(mockAssetStorage);
  });

  describe('createAsset', () => {
    it('should create a new asset successfully', async () => {
      const newAsset: Asset = { id: 'asset-1', name: 'Factory Pump', type: 'machinery' };
      mockAssetStorage.getItem.mockResolvedValue(null);
      mockAssetStorage.setItem.mockResolvedValue(undefined);

      const createdAsset = await assetManager.createAsset(newAsset);

      expect(mockAssetStorage.getItem).toHaveBeenCalledWith('asset-1');
      expect(mockAssetStorage.setItem).toHaveBeenCalledWith('asset-1', newAsset);
      expect(createdAsset).toEqual(newAsset);
    });

    it('should throw an error if asset data is invalid', async () => {
      // @ts-expect-error testing invalid input
      await expect(assetManager.createAsset({ id: 'a1' })).rejects.toThrow('Invalid asset data');
      // @ts-expect-error testing invalid input
      await expect(assetManager.createAsset(null)).rejects.toThrow('Invalid asset data');
    });

    it('should throw an error if asset already exists', async () => {
      const existingAsset: Asset = { id: 'asset-1', name: 'Factory Pump', type: 'machinery' };
      mockAssetStorage.getItem.mockResolvedValue(existingAsset);

      await expect(assetManager.createAsset(existingAsset)).rejects.toThrow('Asset already exists');
      expect(mockAssetStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getAsset', () => {
    it('should return an asset if it exists', async () => {
      const asset: Asset = { id: 'asset-1', name: 'Factory Pump', type: 'machinery' };
      mockAssetStorage.getItem.mockResolvedValue(asset);

      const foundAsset = await assetManager.getAsset('asset-1');

      expect(mockAssetStorage.getItem).toHaveBeenCalledWith('asset-1');
      expect(foundAsset).toEqual(asset);
    });

    it('should return null if asset does not exist', async () => {
      mockAssetStorage.getItem.mockResolvedValue(null);
      const foundAsset = await assetManager.getAsset('non-existent-asset');
      expect(mockAssetStorage.getItem).toHaveBeenCalledWith('non-existent-asset');
      expect(foundAsset).toBeNull();
    });

    it('should throw an error if asset ID is not provided', async () => {
      // @ts-expect-error testing invalid input
      await expect(assetManager.getAsset(null)).rejects.toThrow('Asset ID is required');
      await expect(assetManager.getAsset('')).rejects.toThrow('Asset ID is required');
    });
  });

  describe('updateAsset', () => {
    it('should update an existing asset successfully', async () => {
      const existingAsset: Asset = { id: 'asset-1', name: 'Old Pump Name', type: 'machinery' };
      const updates: Partial<Asset> = { name: 'New Pump Name', metadata: { location: 'Factory A' } };
      const expectedAsset: Asset = { ...existingAsset, ...updates };

      mockAssetStorage.getItem.mockResolvedValue(existingAsset);
      mockAssetStorage.setItem.mockResolvedValue(undefined);

      const updatedAsset = await assetManager.updateAsset('asset-1', updates);

      expect(mockAssetStorage.getItem).toHaveBeenCalledWith('asset-1');
      expect(mockAssetStorage.setItem).toHaveBeenCalledWith('asset-1', expectedAsset);
      expect(updatedAsset).toEqual(expectedAsset);
    });

    it('should throw an error if asset ID is not provided for update', async () => {
      // @ts-expect-error testing invalid input
      await expect(assetManager.updateAsset(null, { name: 'test' })).rejects.toThrow('Asset ID is required');
    });

    it('should throw an error if no updates are provided', async () => {
      await expect(assetManager.updateAsset('asset-1', {})).rejects.toThrow('No updates provided');
    });

    it('should throw an error if asset to update is not found', async () => {
      mockAssetStorage.getItem.mockResolvedValue(null);
      await expect(assetManager.updateAsset('non-existent-asset', { name: 'test' })).rejects.toThrow('Asset not found');
    });
  });

  describe('deleteAsset', () => {
    it('should delete an existing asset successfully', async () => {
      const assetToDelete: Asset = { id: 'asset-1', name: 'Pump to Delete', type: 'machinery' };
      mockAssetStorage.getItem.mockResolvedValue(assetToDelete);
      mockAssetStorage.removeItem.mockResolvedValue(undefined);

      const deletedAsset = await assetManager.deleteAsset('asset-1');

      expect(mockAssetStorage.getItem).toHaveBeenCalledWith('asset-1');
      expect(mockAssetStorage.removeItem).toHaveBeenCalledWith('asset-1');
      expect(deletedAsset).toEqual(assetToDelete);
    });

    it('should throw an error if asset ID is not provided for deletion', async () => {
      // @ts-expect-error testing invalid input
      await expect(assetManager.deleteAsset(null)).rejects.toThrow('Asset ID is required');
    });

    it('should throw an error if asset to delete is not found', async () => {
      mockAssetStorage.getItem.mockResolvedValue(null);
      await expect(assetManager.deleteAsset('non-existent-asset')).rejects.toThrow('Asset not found');
    });
  });

  describe('listAssets', () => {
    it('should return a list of all assets', async () => {
      const assets: Asset[] = [
        { id: 'asset-1', name: 'Pump 1', type: 'machinery' },
        { id: 'asset-2', name: 'Sensor A', type: 'sensor' },
      ];
      mockAssetStorage.getAllItems.mockResolvedValue(assets);

      const assetList = await assetManager.listAssets();

      expect(mockAssetStorage.getAllItems).toHaveBeenCalled();
      expect(assetList).toEqual(assets);
    });

    it('should return an empty list if no assets exist', async () => {
      mockAssetStorage.getAllItems.mockResolvedValue([]);
      const assetList = await assetManager.listAssets();
      expect(assetList).toEqual([]);
    });
  });

  describe('listAssetsByDevice', () => {
    const allAssets: Asset[] = [
        { id: 'asset-1', name: 'Pump 1', type: 'machinery', deviceId: 'device-A' },
        { id: 'asset-2', name: 'Sensor X', type: 'sensor', deviceId: 'device-B' },
        { id: 'asset-3', name: 'Valve Alpha', type: 'actuator', deviceId: 'device-A' },
        { id: 'asset-4', name: 'Motor Beta', type: 'machinery' }, // No deviceId
      ];
    it('should return assets linked to a specific device ID', async () => {
      mockAssetStorage.getAllItems.mockResolvedValue(allAssets);
      const deviceAAssets = await assetManager.listAssetsByDevice('device-A');
      expect(deviceAAssets).toEqual([
        { id: 'asset-1', name: 'Pump 1', type: 'machinery', deviceId: 'device-A' },
        { id: 'asset-3', name: 'Valve Alpha', type: 'actuator', deviceId: 'device-A' },
      ]);
      expect(mockAssetStorage.getAllItems).toHaveBeenCalled();
    });

    it('should return an empty list if no assets are linked to the device ID', async () => {
       mockAssetStorage.getAllItems.mockResolvedValue(allAssets);
      const deviceCAssets = await assetManager.listAssetsByDevice('device-C');
      expect(deviceCAssets).toEqual([]);
    });

     it('should throw an error if device ID is not provided', async () => {
      // @ts-expect-error testing invalid input
      await expect(assetManager.listAssetsByDevice(null)).rejects.toThrow('Device ID is required');
      await expect(assetManager.listAssetsByDevice('')).rejects.toThrow('Device ID is required');
    });
  });
});