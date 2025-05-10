export class LifecycleManager {
  private initTimes = new Map<string, number>();
  private warmInstances = new Set<string>();
  
  constructor(private maxKeepAlive = 300_000) {}

  trackInit(functionId: string) {
    const initStart = Date.now();
    this.initTimes.set(functionId, initStart);
    
    return {
      endInit: () => {
        const duration = Date.now() - initStart;
        this.warmInstances.add(functionId);
        setTimeout(() => this.warmInstances.delete(functionId), this.maxKeepAlive);
        return duration;
      },
      isColdStart: !this.warmInstances.has(functionId)
    };
  }

  maintainPool(functionId: string, minInstances = 1) {
    const current = this.warmInstances.size;
    if (current < minInstances) {
      Array(minInstances - current).fill(0).forEach(() => {
        this.warmInstances.add(`${functionId}-pool-${Date.now()}`);
      });
    }
  }
}