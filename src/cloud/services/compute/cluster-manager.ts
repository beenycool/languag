export class ClusterManager {
  private clusters = new Map<string, string[]>();

  createCluster(name: string, instances: string[]) {
    this.clusters.set(name, instances);
    return { name, instances };
  }

  scaleCluster(name: string, delta: number) {
    const instances = this.clusters.get(name) || [];
    
    if (delta > 0) {
      // Add new instances
      const newInstances = Array(delta).fill('').map(() => crypto.randomUUID());
      instances.push(...newInstances);
    } else if (delta < 0) {
      // Remove instances (FIFO)
      instances.splice(0, Math.min(-delta, instances.length));
    }
    
    this.clusters.set(name, instances);
    return { name, instanceCount: instances.length };
  }

  getCluster(name: string) {
    return this.clusters.get(name) || [];
  }

  deleteCluster(name: string) {
    this.clusters.delete(name);
  }
}