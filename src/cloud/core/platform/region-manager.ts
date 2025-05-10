export class RegionManager {
  private regions: Map<string, boolean> = new Map();

  addRegion(region: string) {
    this.regions.set(region, true);
  }

  listRegions() {
    return Array.from(this.regions.keys());
  }

  regionAvailable(region: string) {
    return this.regions.get(region) || false;
  }
}