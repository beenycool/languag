export interface ICloudProvider {
  init(config: object): Promise<void>;
  getRegions(): string[];
  setDefaultRegion(region: string): void;
}

export abstract class CloudProviderBase implements ICloudProvider {
  protected defaultRegion = 'us-east-1';
  protected regions: string[] = [];
  
  async init(config: object) {
    // Implementation specific to cloud provider
  }

  getRegions() {
    return this.regions;
  }

  setDefaultRegion(region: string) {
    this.defaultRegion = region;
  }
}