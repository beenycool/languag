type Instance = {
  id: string;
  type: string;
  zone: string;
  status: 'running' | 'stopped' | 'pending';
};

export class InstanceManager {
  private instances = new Map<string, Instance>();

  create(type: string, zone: string) {
    const id = crypto.randomUUID();
    const instance: Instance = { id, type, zone, status: 'pending' };
    this.instances.set(id, instance);
    return instance;
  }

  start(id: string) {
    const instance = this.instances.get(id);
    if (instance) instance.status = 'running';
    return instance;
  }

  stop(id: string) {
    const instance = this.instances.get(id);
    if (instance) instance.status = 'stopped';
    return instance;
  }

  listByZone(zone: string) {
    return Array.from(this.instances.values())
      .filter(i => i.zone === zone);
  }
}