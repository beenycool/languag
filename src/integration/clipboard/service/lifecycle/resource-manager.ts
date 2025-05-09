import { EventEmitter } from 'events';

interface Resource {
  name: string;
  type: string;
  handle: any;
  lastUsed: number;
}

export class ResourceManager extends EventEmitter {
  private resources: Map<string, Resource> = new Map();
  private maxResources: number = 10;

  constructor() {
    super();
  }

  register(name: string, type: string, handle: any): void {
    if (this.resources.size >= this.maxResources) {
      this.cleanupOldResources();
    }

    this.resources.set(name, {
      name,
      type,
      handle,
      lastUsed: Date.now()
    });

    this.emit('resource-registered', name);
  }

  get(name: string): any {
    const resource = this.resources.get(name);
    if (resource) {
      resource.lastUsed = Date.now();
      return resource.handle;
    }
    return null;
  }

  release(name: string): void {
    if (this.resources.has(name)) {
      this.emit('resource-released', name);
      this.resources.delete(name);
    }
  }

  setMaxResources(max: number): void {
    this.maxResources = max;
    this.cleanupOldResources();
  }

  private cleanupOldResources(): void {
    const resources = Array.from(this.resources.values())
      .sort((a, b) => a.lastUsed - b.lastUsed);

    while (this.resources.size > this.maxResources && resources.length > 0) {
      const oldest = resources.shift();
      if (oldest) {
        this.release(oldest.name);
      }
    }
  }
}