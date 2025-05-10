// src/mesh/observability/monitoring/alert-manager.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { PerformanceAlertConfig } from './performance-monitor'; // Assuming alerts come from Perf Monitor
import { ServiceHealth } from './health-monitor'; // Assuming health alerts

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'ERROR'; // ERROR might be from HealthMonitor status

export interface Alert {
  id: string; // Unique ID for this alert instance
  ruleId?: string; // ID of the rule that triggered it (e.g., from PerformanceAlertConfig)
  serviceId?: string; // Service affected
  instanceId?: string; // Instance affected
  timestamp: number; // epoch ms
  severity: AlertSeverity;
  title: string; // Short description
  description: string; // Detailed message
  status: 'FIRING' | 'RESOLVED'; // Alertmanager-like status
  labels?: Record<string, string>; // Additional labels for routing/filtering
  sourceComponent?: string; // e.g., 'PerformanceMonitor', 'HealthMonitor'
}

export interface NotificationChannel {
  id: string;
  type: 'EMAIL' | 'SLACK' | 'PAGERDUTY' | 'WEBHOOK' | 'CONSOLE'; // Example channels
  config: Record<string, any>; // Channel-specific config (e.g., email address, webhook URL)
  /**
   * Sends a notification.
   * @param alert - The alert to send.
   */
  sendNotification(alert: Alert): Promise<void>;
}

export interface IAlertManager {
  /**
   * Processes an incoming alert, potentially de-duplicates, groups, and then dispatches it.
   * @param alertData - Data describing the alert (could be a PerformanceAlertConfig, ServiceHealth, or a generic structure).
   * @param source - Identifier of the component raising the alert.
   */
  processAlert(alertData: PerformanceAlertConfig | ServiceHealth | Omit<Alert, 'id' | 'timestamp' | 'status'>, source: string): Promise<void>;

  /**
   * Manually triggers a resolved notification for an alert.
   * @param alertIdOrRuleId - The ID of the original alert or the rule ID that is now resolved.
   * @param resolutionDetails - Optional details about the resolution.
   */
  resolveAlert(alertIdOrRuleId: string, resolutionDetails?: string): Promise<void>;
  
  // addNotificationChannel(channel: NotificationChannel): void;
  // removeNotificationChannel(channelId: string): void;
}

/**
 * Manages alerts from various mesh components and dispatches notifications.
 * It can handle de-duplication, grouping, and routing of alerts.
 */
export class AlertManager implements IAlertManager {
  private logger?: ILoggingService;
  private channels: Map<string, NotificationChannel>; // Keyed by channel ID
  private activeAlerts: Map<string, Alert>; // Keyed by a unique alert signature or ruleId+labels

  constructor(logger?: ILoggingService) {
    this.logger = logger;
    this.channels = new Map();
    this.activeAlerts = new Map();
    this.log(LogLevel.INFO, 'AlertManager initialized.');
    // Load notification channels from config
    this.loadChannels(); 
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[AlertManager] ${message}`, context);
  }

  private loadChannels(): void {
    // Placeholder: Load channels from config or add them programmatically
    // Example:
    // const consoleChannel: NotificationChannel = {
    //   id: 'console-default', type: 'CONSOLE', config: {},
    //   sendNotification: async (alert) => {
    //     this.log(LogLevel.INFO, `CONSOLE ALERT [${alert.severity}] ${alert.title}: ${alert.description}`, { alert });
    //   }
    // };
    // this.addNotificationChannel(consoleChannel);
    this.log(LogLevel.DEBUG, 'Notification channels loaded (placeholder).');
  }
  
  public addNotificationChannel(channel: NotificationChannel): void {
    if (this.channels.has(channel.id)) {
        this.log(LogLevel.WARN, `Notification channel with ID ${channel.id} already exists. Overwriting.`);
    }
    this.channels.set(channel.id, channel);
    this.log(LogLevel.INFO, `Notification channel added/updated: ${channel.id} (Type: ${channel.type})`);
  }

  public removeNotificationChannel(channelId: string): void {
    if (this.channels.delete(channelId)) {
        this.log(LogLevel.INFO, `Notification channel removed: ${channelId}`);
    } else {
        this.log(LogLevel.WARN, `Attempted to remove non-existent notification channel: ${channelId}`);
    }
  }

  // Generates a unique signature for an alert to help with de-duplication/tracking
  private generateAlertSignature(alertData: PerformanceAlertConfig | ServiceHealth | Omit<Alert, 'id' | 'timestamp' | 'status'>, source: string): string {
    if ('metricName' in alertData && 'threshold' in alertData) { // PerformanceAlertConfig
        return `${source}-${alertData.metricName}-${JSON.stringify(alertData.labelsFilter || {})}`;
    } else if ('status' in alertData && 'serviceId' in alertData && typeof alertData.status === 'string') { // ServiceHealth
        return `${source}-health-${alertData.serviceId}-${alertData.instanceId || 'service'}`;
    } else if ('title' in alertData && 'severity' in alertData) { // Generic Alert structure
        return `${source}-${alertData.severity}-${alertData.title}-${JSON.stringify(alertData.labels || {})}`;
    }
    return `${source}-unknown-${Date.now()}`; // Fallback
  }

  public async processAlert(alertData: PerformanceAlertConfig | ServiceHealth | Omit<Alert, 'id' | 'timestamp' | 'status'>, source: string): Promise<void> {
    const signature = this.generateAlertSignature(alertData, source);
    this.log(LogLevel.DEBUG, `Processing incoming alert from ${source} with signature ${signature}`, { alertData });

    if (this.activeAlerts.has(signature) && this.activeAlerts.get(signature)!.status === 'FIRING') {
      this.log(LogLevel.INFO, `Alert already active and firing, not re-notifying (de-duplication). Signature: ${signature}`);
      // Could implement re-notification logic after a certain period if needed.
      return;
    }

    let newAlert: Alert;
    const now = Date.now();

    if ('metricName' in alertData && 'threshold' in alertData) { // PerformanceAlertConfig
      const alertLabels: Record<string, string> | undefined = alertData.labelsFilter
        ? Object.fromEntries(
            Object.entries(alertData.labelsFilter).map(([key, value]) => [key, String(value)])
          )
        : undefined;

      newAlert = {
        id: `perf-${now}-${Math.random().toString(16).slice(2)}`,
        ruleId: `${alertData.metricName}-${alertData.comparison}-${alertData.threshold}`,
        serviceId: alertLabels?.service || undefined, // Example: extract from converted labels
        timestamp: now,
        severity: alertData.severity,
        title: `Performance Alert: ${alertData.metricName} ${alertData.comparison} ${alertData.threshold}`,
        description: `Metric ${alertData.metricName} (labels: ${JSON.stringify(alertLabels || {})}) breached threshold. Severity: ${alertData.severity}.`,
        status: 'FIRING',
        labels: alertLabels,
        sourceComponent: source,
      };
    } else if ('status' in alertData && 'serviceId' in alertData && typeof alertData.status === 'string') { // ServiceHealth
      if (alertData.status === 'HEALTHY' || alertData.status === 'UNKNOWN') { // Potentially a resolution or non-alerting state
        this.log(LogLevel.INFO, `Received non-alerting health status for ${alertData.serviceId}, attempting to resolve if active.`);
        await this.resolveAlert(signature, `Health status changed to ${alertData.status}`);
        return;
      }
      newAlert = {
        id: `health-${now}-${Math.random().toString(16).slice(2)}`,
        ruleId: `health-${alertData.serviceId}-${alertData.instanceId || 'service'}`,
        serviceId: alertData.serviceId,
        instanceId: alertData.instanceId,
        timestamp: now,
        severity: alertData.status === 'UNHEALTHY' ? 'CRITICAL' : 'WARNING', // Map health status to severity
        title: `Health Alert: ${alertData.serviceId} ${alertData.instanceId || ''} is ${alertData.status}`,
        description: `Service ${alertData.serviceId} (instance: ${alertData.instanceId || 'N/A'}) reported status ${alertData.status}. Details: ${JSON.stringify(alertData.details || {})}`,
        status: 'FIRING',
        labels: { serviceId: alertData.serviceId, ...(alertData.instanceId && { instanceId: alertData.instanceId }) },
        sourceComponent: source,
      };
    } else if ('title' in alertData && 'severity' in alertData) { // Generic Alert structure
        newAlert = {
            id: `generic-${now}-${Math.random().toString(16).slice(2)}`,
            timestamp: now,
            status: 'FIRING',
            sourceComponent: source,
            ...alertData, // Spread the rest of Omit<Alert, 'id' | 'timestamp' | 'status'>
        } as Alert; // Cast needed as ...alertData is partial
    }
     else {
      this.log(LogLevel.ERROR, 'Unknown alert data structure received.', { alertData });
      return;
    }

    this.activeAlerts.set(signature, newAlert);
    this.log(LogLevel.WARN, `New alert FIRING: ${newAlert.title}`, { alert: newAlert });

    for (const channel of this.channels.values()) {
      try {
        await channel.sendNotification(newAlert);
        this.log(LogLevel.DEBUG, `Alert notification sent via channel: ${channel.id}`);
      } catch (error: any) {
        this.log(LogLevel.ERROR, `Failed to send notification via channel: ${channel.id}`, { error: error.message, alertId: newAlert.id });
      }
    }
  }

  public async resolveAlert(alertIdOrSignature: string, resolutionDetails: string = "Issue resolved."): Promise<void> {
    let alertToResolve: Alert | undefined;
    let signatureToResolve: string | undefined;

    if (this.activeAlerts.has(alertIdOrSignature)) { // It's a signature
        signatureToResolve = alertIdOrSignature;
        alertToResolve = this.activeAlerts.get(signatureToResolve);
    } else { // Try to find by alert.id (less common for resolution trigger) or ruleId
        for(const [sig, alert] of this.activeAlerts.entries()){
            if(alert.id === alertIdOrSignature || alert.ruleId === alertIdOrSignature) {
                alertToResolve = alert;
                signatureToResolve = sig;
                break;
            }
        }
    }

    if (alertToResolve && alertToResolve.status === 'FIRING') {
      alertToResolve.status = 'RESOLVED';
      alertToResolve.description = `${alertToResolve.description}\nRESOLVED: ${resolutionDetails}`;
      // this.activeAlerts.delete(signatureToResolve); // Or keep it as RESOLVED for some time

      this.log(LogLevel.INFO, `Alert RESOLVED: ${alertToResolve.title}`, { alert: alertToResolve });

      for (const channel of this.channels.values()) {
        try {
          // Notification channels might have specific logic for resolved alerts
          await channel.sendNotification(alertToResolve); 
          this.log(LogLevel.DEBUG, `Resolved notification sent via channel: ${channel.id}`);
        } catch (error: any) {
          this.log(LogLevel.ERROR, `Failed to send resolved notification via channel: ${channel.id}`, { error: error.message, alertId: alertToResolve.id });
        }
      }
      // Clean up after a delay or based on policy
      this.activeAlerts.delete(signatureToResolve!);


    } else {
      this.log(LogLevel.INFO, `No active alert found to resolve for ID/Signature: ${alertIdOrSignature}`);
    }
  }
}