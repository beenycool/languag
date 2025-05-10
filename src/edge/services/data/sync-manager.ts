interface SyncData<T> {
  timestamp: number;
  version: string;
  payload: T;
}

export class EdgeSyncManager {
  private syncStrategies = new Map<string, ConflictResolutionStrategy>();

  async syncDelta<T>(local: SyncData<T>, remote: SyncData<T>): Promise<SyncData<T>> {
    const strategy = this.syncStrategies.get(local.version) || this.defaultStrategy;
    return strategy.resolve(local, remote);
  }

  private defaultStrategy: ConflictResolutionStrategy = {
    resolve: (local, remote) => 
      local.timestamp > remote.timestamp ? local : remote
  };

  registerStrategy(version: string, strategy: ConflictResolutionStrategy) {
    this.syncStrategies.set(version, strategy);
  }
}

interface ConflictResolutionStrategy {
  resolve<T>(local: SyncData<T>, remote: SyncData<T>): SyncData<T>;
}