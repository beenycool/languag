export class AssetManager {
  private assets = new Map<string, Asset>();

  registerAsset(asset: Asset): void {
    this.assets.set(asset.id, asset);
  }

  linkDevice(assetId: string, deviceId: string): void {
    const asset = this.assets.get(assetId);
    if (asset) {
      asset.linkedDevices.add(deviceId);
    }
  }

  getAssetStatus(assetId: string): AssetStatus {
    const asset = this.assets.get(assetId);
    return asset ? 'active' : 'unknown';
  }
}

type Asset = {
  id: string;
  name: string;
  location: string;
  linkedDevices: Set<string>;
};

type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'unknown';