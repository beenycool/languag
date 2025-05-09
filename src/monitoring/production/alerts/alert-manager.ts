// Manages alert handling and processing
// TODO: Implement alert handling, routing, and escalation logic

import { ThresholdManager, Threshold } from './threshold-manager';
import { NotificationManager, NotificationChannel } from './notification-manager';

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  triggeredBy: string; // e.g., metric name, system component
  value?: number | string; // The value that triggered the alert
  threshold?: Threshold;
  status: 'active' | 'acknowledged' | 'resolved';
  details?: Record<string, any>;
}

export class AlertManager {
  private activeAlerts: Map<string, Alert>;
  private alertHistory: Alert[]; // For auditing and review
  private thresholdManager: ThresholdManager;
  private notificationManager: NotificationManager;

  constructor(thresholdManager: ThresholdManager, notificationManager: NotificationManager) {
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.thresholdManager = thresholdManager;
    this.notificationManager = notificationManager;
    // Initialize alert manager
  }

  public processMetric(metricName: string, currentValue: number, details?: Record<string, any>): void {
    const thresholds = this.thresholdManager.getThresholdsForMetric(metricName);
    thresholds.forEach(threshold => {
      let alertSeverity: 'critical' | 'warning' | 'info' | undefined;
      let alertMessage: string | undefined;

      if (threshold.criticalUpper && currentValue >= threshold.criticalUpper) {
        alertSeverity = 'critical';
        alertMessage = `${metricName} (${currentValue}) exceeded critical upper threshold (${threshold.criticalUpper}).`;
      } else if (threshold.warningUpper && currentValue >= threshold.warningUpper) {
        alertSeverity = 'warning';
        alertMessage = `${metricName} (${currentValue}) exceeded warning upper threshold (${threshold.warningUpper}).`;
      } else if (threshold.criticalLower && currentValue <= threshold.criticalLower) {
        alertSeverity = 'critical';
        alertMessage = `${metricName} (${currentValue}) fell below critical lower threshold (${threshold.criticalLower}).`;
      } else if (threshold.warningLower && currentValue <= threshold.warningLower) {
        alertSeverity = 'warning';
        alertMessage = `${metricName} (${currentValue}) fell below warning lower threshold (${threshold.warningLower}).`;
      }

      if (alertSeverity && alertMessage) {
        const alertId = `${metricName}-${alertSeverity}-${new Date().getTime()}`;
        this.triggerAlert(alertId, metricName, alertSeverity, alertMessage, currentValue, threshold, details);
      } else {
        // Check if an existing alert for this metric and threshold needs to be resolved
        this.resolveAlertIfConditionMet(metricName, threshold, currentValue);
      }
    });
  }

  private triggerAlert(
    id: string,
    name: string,
    severity: 'critical' | 'warning' | 'info',
    message: string,
    value?: number | string,
    threshold?: Threshold,
    details?: Record<string, any>
  ): void {
    if (this.activeAlerts.has(id) && this.activeAlerts.get(id)?.status === 'active') {
      // Alert already active, maybe update timestamp or count
      console.log(`Alert ${id} is already active.`);
      return;
    }

    const newAlert: Alert = {
      id,
      name,
      severity,
      message,
      timestamp: new Date(),
      triggeredBy: name, // Could be more specific
      value,
      threshold,
      status: 'active',
      details,
    };

    this.activeAlerts.set(id, newAlert);
    this.alertHistory.push(newAlert);
    console.log(`ALERT TRIGGERED: ${newAlert.message}`);

    // Send notifications
    const channels: NotificationChannel[] = severity === 'critical' ? ['email', 'sms', 'slack'] : ['email', 'slack'];
    this.notificationManager.sendNotification(newAlert, channels);
  }

  private resolveAlertIfConditionMet(metricName: string, threshold: Threshold, currentValue: number): void {
    this.activeAlerts.forEach(alert => {
      if (alert.triggeredBy === metricName && alert.threshold?.id === threshold.id && alert.status === 'active') {
        // Check if the condition for this specific alert is no longer met
        let shouldResolve = false;
        if (alert.threshold?.criticalUpper && currentValue < alert.threshold.criticalUpper) {
          if (!alert.threshold.warningUpper || currentValue < alert.threshold.warningUpper) shouldResolve = true;
        } else if (alert.threshold?.warningUpper && currentValue < alert.threshold.warningUpper) {
          shouldResolve = true;
        } else if (alert.threshold?.criticalLower && currentValue > alert.threshold.criticalLower) {
           if (!alert.threshold.warningLower || currentValue > alert.threshold.warningLower) shouldResolve = true;
        } else if (alert.threshold?.warningLower && currentValue > alert.threshold.warningLower) {
          shouldResolve = true;
        }
        
        // A more robust check would ensure it's within a "safe" band, not just below the threshold it breached.
        // For simplicity, if it's no longer breaching the specific threshold level it triggered, we resolve.

        if (shouldResolve) {
          this.resolveAlert(alert.id, 'Condition no longer met.');
        }
      }
    });
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      alert.details = { ...alert.details, acknowledgedBy, acknowledgedAt: new Date() };
      console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}.`);
      // Optionally send an update notification
    } else {
      console.warn(`Alert ${alertId} not found or not active for acknowledgement.`);
    }
  }

  public resolveAlert(alertId: string, resolutionMessage: string, resolvedBy?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.details = { ...alert.details, resolutionMessage, resolvedAt: new Date(), resolvedBy };
      console.log(`Alert ${alertId} resolved: ${resolutionMessage}`);
      // Move from activeAlerts to history if not already there (though it's pushed on creation)
      // For simplicity, we just update status. Active alerts map could be filtered.
      // this.activeAlerts.delete(alertId); // Or keep it and filter by status

      // Send resolution notification
      this.notificationManager.sendNotification(alert, ['email', 'slack'], 'RESOLVED');

    } else {
      console.warn(`Alert ${alertId} not found for resolution.`);
    }
  }

  public getActiveAlerts(severity?: 'critical' | 'warning' | 'info'): Alert[] {
    const allActive = Array.from(this.activeAlerts.values()).filter(a => a.status === 'active' || a.status === 'acknowledged');
    if (severity) {
      return allActive.filter(alert => alert.severity === severity);
    }
    return allActive;
  }

  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }
}