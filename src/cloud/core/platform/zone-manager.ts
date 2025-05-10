export class ZoneManager {
  private zones: Map<string, Set<string>> = new Map();

  addZone(region: string, zone: string) {
    if (!this.zones.has(region)) {
      this.zones.set(region, new Set());
    }
    this.zones.get(region)?.add(zone);
  }

  listZones(region: string) {
    return Array.from(this.zones.get(region) || []);
  }

  zoneAvailable(region: string, zone: string) {
    return this.zones.get(region)?.has(zone) || false;
  }
}