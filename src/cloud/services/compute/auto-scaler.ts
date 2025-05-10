type ScalingPolicy = {
  metric: 'cpu' | 'memory' | 'network';
  threshold: number;
  direction: 'up' | 'down';
  cooldown: number; // in seconds
};

type InstanceMetrics = {
  timestamp: Date;
  cpu: number;
  memory: number;
  network: number;
};

export class AutoScaler {
  private metricsHistory = new Map<string, InstanceMetrics[]>();
  private scalingPolicies = new Map<string, ScalingPolicy[]>();
  private lastScaling = new Map<string, Date>();

  addMetrics(instanceId: string, metrics: Omit<InstanceMetrics, 'timestamp'>) {
    const entry = { ...metrics, timestamp: new Date() };
    const history = this.metricsHistory.get(instanceId) || [];
    history.push(entry);
    this.metricsHistory.set(instanceId, history);
  }

  setPolicy(groupId: string, policy: ScalingPolicy) {
    const policies = this.scalingPolicies.get(groupId) || [];
    policies.push(policy);
    this.scalingPolicies.set(groupId, policies);
  }

  checkScale(groupId: string, currentInstances: string[]) {
    const policies = this.scalingPolicies.get(groupId) || [];
    const lastScale = this.lastScaling.get(groupId);
    if (lastScale && Date.now() - lastScale.getTime() < 60000) return null;

    const metrics = currentInstances
      .map(id => this.metricsHistory.get(id)?.slice(-5) || [])
      .flat();

    if (metrics.length === 0) return null;

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMem = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
    const avgNet = metrics.reduce((sum, m) => sum + m.network, 0) / metrics.length;

    for (const policy of policies) {
      const value = {
        cpu: avgCpu,
        memory: avgMem,
        network: avgNet
      }[policy.metric];

      if (value >= policy.threshold && policy.direction === 'up') {
        this.lastScaling.set(groupId, new Date());
        return { action: 'scaleOut', amount: 1 };
      }

      if (value <= policy.threshold && policy.direction === 'down') {
        this.lastScaling.set(groupId, new Date());
        return { action: 'scaleIn', amount: 1 };
      }
    }

    return null;
  }
}