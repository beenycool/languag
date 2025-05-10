type AlertRule = {
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  duration: number; // Seconds the condition must persist
};

type Alert = {
  rule: AlertRule;
  triggeredAt: Date;
  resolvedAt?: Date;
  active: boolean;
};

export class AlertManager {
  private rules = new Map<string, AlertRule>();
  private alerts = new Map<string, Alert>();
  private metricHistory = new Map<string, number[]>();
  private readonly MAX_HISTORY = 100;

  addRule(name: string, rule: AlertRule) {
    this.rules.set(name, rule);
  }

  processMetric(metricName: string, value: number) {
    const history = this.metricHistory.get(metricName) || [];
    history.push(value);
    if (history.length > this.MAX_HISTORY) history.shift();
    this.metricHistory.set(metricName, history);

    this.checkRules(metricName);
  }

  private checkRules(metricName: string) {
    const history = this.metricHistory.get(metricName) || [];
    if (history.length < 10) return; // Require minimum data points
    
    const currentValue = history[history.length - 1];
    const avgValue = history.reduce((a, b) => a + b, 0) / history.length;

    for (const [ruleName, rule] of this.rules) {
      if (rule.metric !== metricName) continue;
      
      const isTriggered = this.checkCondition(currentValue, avgValue, rule);
      const alertKey = `${metricName}-${ruleName}`;
      
      if (isTriggered) {
        if (!this.alerts.has(alertKey)) {
          this.alerts.set(alertKey, {
            rule,
            triggeredAt: new Date(),
            active: true
          });
        }
      } else {
        if (this.alerts.has(alertKey)) {
          const alert = this.alerts.get(alertKey)!;
          if (alert.active) {
            alert.resolvedAt = new Date();
            alert.active = false;
          }
        }
      }
    }
  }

  private checkCondition(value: number, avg: number, rule: AlertRule) {
    const comparisonValue = rule.condition === 'eq' ? value : avg;
    
    switch(rule.condition) {
      case 'gt': return comparisonValue > rule.threshold;
      case 'lt': return comparisonValue < rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }

  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(a => a.active);
  }

  getHistoricalAlerts() {
    return Array.from(this.alerts.values());
  }
}