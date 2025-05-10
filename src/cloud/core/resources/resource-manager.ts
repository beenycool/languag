type CloudResource = {
  id: string;
  type: string;
  region: string;
  metadata: Record<string, unknown>;
};

export class ResourceManager {
  private resources = new Map<string, CloudResource>();

  create(resource: Omit<CloudResource, 'id'>) {
    const id = crypto.randomUUID();
    const newResource = { ...resource, id };
    this.resources.set(id, newResource);
    return newResource;
  }

  get(id: string) {
    return this.resources.get(id);
  }

  list() {
    return Array.from(this.resources.values());
  }

  delete(id: string) {
    return this.resources.delete(id);
  }
}