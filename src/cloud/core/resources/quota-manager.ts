type QuotaLimits = {
  instances: number;
  storageGB: number;
  networks: number;
};

export class QuotaManager {
  private quotas = new Map<string, QuotaLimits>();
  private usage = new Map<string, QuotaLimits>();

  setQuota(accountId: string, limits: QuotaLimits) {
    this.quotas.set(accountId, limits);
  }

  checkUsage(accountId: string, requested: Partial<QuotaLimits>) {
    const quota = this.quotas.get(accountId);
    const current = this.usage.get(accountId) || this.emptyUsage();
    
    if (!quota) throw new Error('No quota defined');
    
    return Object.entries(requested).every(([key, value]) => 
      (current[key as keyof QuotaLimits] + value) <= quota[key as keyof QuotaLimits]
    );
  }

  recordUsage(accountId: string, delta: Partial<QuotaLimits>) {
    const current = this.usage.get(accountId) || this.emptyUsage();
    this.usage.set(accountId, {
      instances: current.instances + (delta.instances || 0),
      storageGB: current.storageGB + (delta.storageGB || 0),
      networks: current.networks + (delta.networks || 0)
    });
  }

  getQuota(accountId: string) {
    return this.quotas.get(accountId);
  }

  getUsage(accountId: string) {
    return this.usage.get(accountId) || this.emptyUsage();
  }

  private emptyUsage(): QuotaLimits {
    return { instances: 0, storageGB: 0, networks: 0 };
  }
}