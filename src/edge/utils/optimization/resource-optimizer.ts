interface SystemMetrics {
  memory: {
    total: number;
    used: number;
    free: number;
  };
  cpu: {
    load: number;
  };
}

export class EdgeResourceOptimizer {
  private allocationStrategy: 'balanced' | 'memory' | 'cpu' = 'balanced';
  private readonly memoryThreshold = 0.8; // 80% memory usage
  private readonly cpuThreshold = 0.7; // 70% CPU load

  getAllocationStrategy(metrics: SystemMetrics): 'balanced' | 'memory' | 'cpu' {
    if (metrics.memory.used / metrics.memory.total > this.memoryThreshold) {
      this.allocationStrategy = 'memory';
    } else if (metrics.cpu.load > this.cpuThreshold) {
      this.allocationStrategy = 'cpu';
    } else {
      this.allocationStrategy = 'balanced';
    }
    return this.allocationStrategy;
  }

  /**
   * Adjusts resource allocation based on current strategy
   * @returns Suggested CPU/Memory allocation ratios
   */
  calculateResourceAllocation(metrics: SystemMetrics): { cpu: number; memory: number } {
    switch (this.allocationStrategy) {
      case 'memory':
        return { 
          cpu: 0.3, 
          memory: Math.min(0.9, 1 - (metrics.memory.used / metrics.memory.total))
        };
      case 'cpu':
        return {
          cpu: 1 - metrics.cpu.load,
          memory: 0.5
        };
      default: // balanced
        return {
          cpu: 0.7 - (metrics.cpu.load * 0.5),
          memory: 0.7 - (metrics.memory.used / metrics.memory.total * 0.5)
        };
    }
  }
}