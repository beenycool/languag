type NodeStatus = 'healthy' | 'degraded' | 'offline';

interface NodeHealth {
  status: NodeStatus;
  load: number;
  lastPing: Date;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
}

export class EdgeHealthMonitor {
  private nodeStatus = new Map<string, NodeHealth>();

  updateStatus(nodeId: string, status: Partial<NodeHealth>): void {
    const current = this.nodeStatus.get(nodeId) || this.createDefaultStatus();
    this.nodeStatus.set(nodeId, { ...current, ...status });
  }

  getClusterHealth() {
    const nodes = Array.from(this.nodeStatus.values());
    const healthyNodes = nodes.filter(n => n.status === 'healthy');
    
    return {
      totalNodes: nodes.length,
      healthyNodes: healthyNodes.length,
      avgCpu: this.calculateAverage(nodes.map(n => n.resourceUsage.cpu)),
      avgMemory: this.calculateAverage(nodes.map(n => n.resourceUsage.memory)),
      lastUpdated: new Date()
    };
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }

  private createDefaultStatus(): NodeHealth {
    return {
      status: 'healthy',
      load: 0,
      lastPing: new Date(),
      resourceUsage: {
        cpu: 0,
        memory: 0
      }
    };
  }
}