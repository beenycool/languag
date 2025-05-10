type AlertRule = {
  metric: string;
  threshold: number;
  condition: 'above' | 'below';
  severity: 'critical' | 'warning';
};

export class AlertManager {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Set<string>();

  addRule(ruleId: string, rule: AlertRule): void {
    this.rules.set(ruleId, rule);
  }

  checkMetrics(deviceId: string, metrics: Map<string, number>): string[] {
    const alerts: string[] = [];
    
    for (const [ruleId, rule] of this.rules) {
      const value = metrics.get(rule.metric);
      if (value === undefined) continue;

      const alertKey = `${deviceId}:${ruleId}`;
      const shouldAlert = rule.condition === 'above' 
        ? value > rule.threshold
        : value < rule.threshold;

      if (shouldAlert) {
        const message = `${rule.severity.toUpperCase()} ALERT: ${rule.metric} ` +
          `${rule.condition} threshold (${rule.threshold}) - Current: ${value}`;
        
        alerts.push(message);
        this.activeAlerts.add(alertKey);
      } else {
        this.activeAlerts.delete(alertKey);
      }
    }
    
    return alerts;
  }

  getActiveAlerts(): string[] {
    return Array.from(this.activeAlerts);
  }
}