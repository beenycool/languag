// Manages alert thresholds for metrics
// TODO: Implement persistent storage for thresholds (e.g., config file, database)

export interface Threshold {
  id: string; // Unique identifier for the threshold rule
  metricName: string; // The metric this threshold applies to (e.g., "cpuUsage", "memoryUsage.percentage")
  warningUpper?: number;
  criticalUpper?: number;
  warningLower?: number;
  criticalLower?: number;
  durationSeconds?: number; // Optional: alert only if condition persists for this duration
  description?: string;
  isEnabled: boolean;
}

export class ThresholdManager {
  private thresholds: Map<string, Threshold[]>; // Keyed by metricName

  constructor() {
    this.thresholds = new Map();
    this.loadDefaultThresholds(); // Load some example thresholds
  }

  private loadDefaultThresholds(): void {
    // Example thresholds - in a real system, these would come from config
    this.addThreshold({
      id: 'cpu_critical_high',
      metricName: 'cpuUsage',
      criticalUpper: 90,
      warningUpper: 75,
      description: 'CPU usage is high.',
      isEnabled: true,
    });
    this.addThreshold({
      id: 'memory_critical_high',
      metricName: 'memoryUsage.percentage',
      criticalUpper: 95,
      warningUpper: 85,
      description: 'Memory usage is critically high.',
      isEnabled: true,
    });
    this.addThreshold({
      id: 'load_avg_warning',
      metricName: 'loadAverage.1min', // Assuming loadAverage is an array [1min, 5min, 15min]
                                      // and we can target specific indices or have metrics like 'loadAverage.1min'
      warningUpper: 5, // Example: warn if 1-min load average > 5
      description: '1-minute load average is elevated.',
      isEnabled: true,
    });
     this.addThreshold({
      id: 'active_connections_warning',
      metricName: 'active_connections',
      warningUpper: 1000,
      criticalUpper: 1500,
      description: 'Number of active connections is high.',
      isEnabled: true,
    });
  }

  public addThreshold(threshold: Omit<Threshold, 'id'> & { id?: string }): Threshold {
    const newThreshold: Threshold = {
      ...threshold,
      id: threshold.id || `${threshold.metricName}-${Date.now()}`, // Auto-generate ID if not provided
    };

    const existingThresholds = this.thresholds.get(newThreshold.metricName) || [];
    // Prevent duplicate IDs for the same metric
    if (existingThresholds.some(t => t.id === newThreshold.id)) {
      console.warn(`Threshold with ID ${newThreshold.id} for metric ${newThreshold.metricName} already exists. Updating.`);
      this.updateThreshold(newThreshold.id, newThreshold);
      return newThreshold;
    }

    existingThresholds.push(newThreshold);
    this.thresholds.set(newThreshold.metricName, existingThresholds);
    console.log(`Threshold added/updated: ${newThreshold.id} for metric ${newThreshold.metricName}`);
    return newThreshold;
  }

  public updateThreshold(thresholdId: string, updates: Partial<Threshold>): Threshold | undefined {
    for (const [metricName, metricThresholds] of this.thresholds) {
      const index = metricThresholds.findIndex(t => t.id === thresholdId);
      if (index !== -1) {
        const updatedThreshold = { ...metricThresholds[index], ...updates };
        metricThresholds[index] = updatedThreshold;
        this.thresholds.set(metricName, metricThresholds);
        console.log(`Threshold ${thresholdId} updated.`);
        return updatedThreshold;
      }
    }
    console.warn(`Threshold with ID ${thresholdId} not found for update.`);
    return undefined;
  }

  public removeThreshold(thresholdId: string): boolean {
    for (const [metricName, metricThresholds] of this.thresholds) {
      const initialLength = metricThresholds.length;
      const filteredThresholds = metricThresholds.filter(t => t.id !== thresholdId);
      if (filteredThresholds.length < initialLength) {
        this.thresholds.set(metricName, filteredThresholds);
        console.log(`Threshold ${thresholdId} removed.`);
        return true;
      }
    }
    console.warn(`Threshold with ID ${thresholdId} not found for removal.`);
    return false;
  }

  public getThresholdsForMetric(metricName: string): Threshold[] {
    return (this.thresholds.get(metricName) || []).filter(t => t.isEnabled);
  }

  public getAllThresholds(): Threshold[] {
    let all: Threshold[] = [];
    this.thresholds.forEach(metricThresholds => {
      all = all.concat(metricThresholds);
    });
    return all;
  }

  public getThresholdById(thresholdId: string): Threshold | undefined {
    for (const metricThresholds of this.thresholds.values()) {
      const found = metricThresholds.find(t => t.id === thresholdId);
      if (found) return found;
    }
    return undefined;
  }
}