import { Anomaly } from '../processors/anomaly-detector';
import { AnalysisOutput } from '../processors/metric-analyzer';

export interface Alert {
  id: string; // Unique identifier for the alert
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical'; // Consistent with Anomaly severity where applicable
  title: string;
  description: string;
  sourceMetric?: string; // The metric that triggered the alert
  currentValue?: number | string;
  thresholdValue?: number | string;
  details?: Record<string, any>; // Additional context
}

export interface AlertRule {
  name: string;
  condition: (analysisOutput: AnalysisOutput, anomalies?: Anomaly[]) => boolean; // Function to evaluate if alert should trigger
  severity: Alert['severity'];
  titleTemplate: string; // e.g., "High CPU Usage Detected on {metricName}"
  descriptionTemplate: string; // e.g., "{metricName} reached {currentValue}, exceeding threshold of {thresholdValue}"
  // Cooldown period in seconds to prevent alert spamming
  cooldownSeconds?: number; 
}

export class AlertGenerator {
  private rules: AlertRule[];
  private lastAlertTimestamps: Map<string, number> = new Map(); // Rule name to last alert timestamp (in ms)

  constructor(rules: AlertRule[] = []) {
    this.rules = rules;
  }

  addRule(rule: AlertRule): void {
    if (this.rules.find(r => r.name === rule.name)) {
      console.warn(`Alert rule with name '${rule.name}' already exists. Overwriting.`);
      this.rules = this.rules.filter(r => r.name !== rule.name);
    }
    this.rules.push(rule);
  }

  generateAlerts(analysisOutput: AnalysisOutput, detectedAnomalies?: Anomaly[]): Alert[] {
    const triggeredAlerts: Alert[] = [];
    const now = Date.now();

    // Generate alerts based on direct anomalies first
    if (detectedAnomalies) {
      detectedAnomalies.forEach(anomaly => {
        // Simple mapping from Anomaly to Alert
        // Check cooldown for anomaly-based alerts (e.g., by anomaly.metricName + anomaly.description)
        const alertKey = `anomaly-${anomaly.metricName}-${anomaly.description.substring(0,50)}`;
        const lastAlertTime = this.lastAlertTimestamps.get(alertKey);
        const cooldown = 300; // Default cooldown for anomaly-based alerts in seconds

        if (lastAlertTime && (now - lastAlertTime) < cooldown * 1000) {
          return; // Still in cooldown
        }

        triggeredAlerts.push({
          id: `anomaly-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: anomaly.timestamp,
          severity: this.mapAnomalySeverityToAlert(anomaly.severity),
          title: `Anomaly Detected: ${anomaly.metricName}`,
          description: anomaly.description,
          sourceMetric: anomaly.metricName,
          currentValue: anomaly.value,
          details: { expectedRange: anomaly.expectedRange, relatedTrend: anomaly.relatedTrend }
        });
        this.lastAlertTimestamps.set(alertKey, now);
      });
    }
    
    // Generate alerts based on rules
    this.rules.forEach(rule => {
      try {
        if (rule.condition(analysisOutput, detectedAnomalies)) {
          const lastAlertTime = this.lastAlertTimestamps.get(rule.name);
          if (rule.cooldownSeconds && lastAlertTime && (now - lastAlertTime) < rule.cooldownSeconds * 1000) {
            return; // Still in cooldown
          }

          // Basic template interpolation (can be made more sophisticated)
          // For simplicity, assumes templates might use properties from analysisOutput or a specific KPI/metric
          // This part needs careful implementation based on what data `condition` uses.
          let title = rule.titleTemplate;
          let description = rule.descriptionTemplate;
          // Example: if a KPI triggered it
          const criticalKpi = analysisOutput.keyPerformanceIndicators.find(kpi => kpi.status === 'critical');

          if (criticalKpi) {
            title = title.replace('{metricName}', criticalKpi.name).replace('{kpiName}', criticalKpi.name);
            description = description.replace('{metricName}', criticalKpi.name)
                                     .replace('{kpiName}', criticalKpi.name)
                                     .replace('{currentValue}', String(criticalKpi.value))
                                     .replace('{status}', criticalKpi.status);
          }
          // Add more sophisticated context extraction for templating as needed

          triggeredAlerts.push({
            id: `rule-${rule.name}-${Date.now()}`,
            timestamp: new Date(),
            severity: rule.severity,
            title,
            description,
            details: { ruleName: rule.name }
          });
          this.lastAlertTimestamps.set(rule.name, now);
        }
      } catch (error) {
        console.error(`Error evaluating alert rule '${rule.name}':`, error);
      }
    });

    return triggeredAlerts;
  }
  
  private mapAnomalySeverityToAlert(anomalySeverity: Anomaly['severity']): Alert['severity'] {
    switch(anomalySeverity) {
        case 'low': return 'info';
        case 'medium': return 'warning';
        case 'high': return 'error';
        case 'critical': return 'critical';
        default: return 'info';
    }
  }

  // Example: Method to define some default rules
  static getDefaultRules(): AlertRule[] {
    return [
      {
        name: 'HighOverallErrorRate',
        condition: (output) => {
          const errorRateKpi = output.keyPerformanceIndicators.find(kpi => kpi.name.toLowerCase().includes('error rate'));
          if (errorRateKpi && typeof errorRateKpi.value === 'string') {
            return parseFloat(errorRateKpi.value) > 10; // e.g. > 10%
          }
          return false;
        },
        severity: 'critical',
        titleTemplate: 'High Error Rate Detected',
        descriptionTemplate: 'Overall error rate at {currentValue}% exceeds critical threshold.',
        cooldownSeconds: 600
      },
      {
        name: 'CriticalKPI',
        condition: (output) => output.keyPerformanceIndicators.some(kpi => kpi.status === 'critical'),
        severity: 'critical',
        titleTemplate: 'Critical KPI: {kpiName}',
        descriptionTemplate: 'KPI {kpiName} is in a critical state with value {currentValue}.',
        cooldownSeconds: 300
      }
    ];
  }
}