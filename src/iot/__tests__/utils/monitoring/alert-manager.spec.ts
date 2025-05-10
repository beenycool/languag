// Mock for a NotificationService (e.g., email, SMS, webhook)
const mockNotificationService = {
  sendNotification: jest.fn(), // (recipient: string, subject: string, body: string, type: 'email' | 'sms' | 'webhook') => Promise<void>
};

// Mock for AlertStorage
const mockAlertStorage = {
  createAlert: jest.fn(), // (alertData: Alert) => Promise<Alert>
  getAlert: jest.fn(), // (alertId: string) => Promise<Alert | null>
  updateAlertStatus: jest.fn(), // (alertId: string, status: AlertStatus, resolutionNotes?: string) => Promise<Alert | null>
  queryAlerts: jest.fn(), // (filters: { deviceId?: string; status?: AlertStatus; severity?: AlertSeverity; timeRange?: { start: Date; end: Date } }) => Promise<Alert[]>
};

// Placeholder for actual AlertManager implementation
// import { AlertManager, Alert, AlertSeverity, AlertStatus } from '../../../../utils/monitoring/alert-manager';

type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type AlertStatus = 'new' | 'acknowledged' | 'inProgress' | 'resolved' | 'closed';

interface Alert {
  id: string;
  deviceId: string;
  ruleId?: string; // From MonitoringService rule
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metric?: string; // The metric that triggered the alert
  value?: any;   // The value of the metric
  timestamp: Date;
  lastUpdatedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  assignee?: string;
}

interface NotificationRule {
    id: string;
    alertSeverity?: AlertSeverity[]; // Trigger for these severities
    alertRuleId?: string; // Trigger for a specific monitoring rule ID
    deviceIdPattern?: string; // Trigger for specific devices
    recipient: string; // e.g., email address, phone number, webhook URL
    type: 'email' | 'sms' | 'webhook';
    messageTemplate?: string; // Optional: custom message format
}

class AlertManager {
  private notificationRules: NotificationRule[] = [];

  constructor(
    private storage: typeof mockAlertStorage,
    private notifier?: typeof mockNotificationService
  ) {}

  private generateAlertId(): string {
    return `alert-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  async triggerAlert(alertData: Omit<Alert, 'id' | 'status' | 'timestamp' | 'lastUpdatedAt'>): Promise<Alert> {
    if (!alertData.deviceId || !alertData.severity || !alertData.message) {
      throw new Error('Device ID, severity, and message are required to trigger an alert.');
    }
    const newAlert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      status: 'new',
      timestamp: new Date(),
      lastUpdatedAt: new Date(),
    };
    const createdAlert = await this.storage.createAlert(newAlert);
    await this.processNotifications(createdAlert);
    return createdAlert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert | null> {
    if (!alertId || !userId) throw new Error('Alert ID and User ID are required.');
    // In a real system, you'd check if the alert exists and is in 'new' status
    return this.storage.updateAlertStatus(alertId, 'acknowledged');
    // Could also log who acknowledged it.
  }

  async resolveAlert(alertId: string, resolutionNotes: string, userId: string): Promise<Alert | null> {
    if (!alertId || !resolutionNotes || !userId) throw new Error('Alert ID, resolution notes, and User ID are required.');
    return this.storage.updateAlertStatus(alertId, 'resolved', resolutionNotes);
  }
  
  async closeAlert(alertId: string, userId: string): Promise<Alert | null> {
    if (!alertId || !userId) throw new Error('Alert ID and User ID are required.');
    // Typically, an alert is resolved first, then closed.
    // Or, closing might imply resolution if not already resolved.
    const alert = await this.storage.getAlert(alertId);
    if (alert && alert.status !== 'resolved') {
        await this.storage.updateAlertStatus(alertId, 'resolved', alert.resolutionNotes || "Closed without explicit resolution.");
    }
    return this.storage.updateAlertStatus(alertId, 'closed');
  }


  async getAlertDetails(alertId: string): Promise<Alert | null> {
    if (!alertId) throw new Error('Alert ID is required.');
    return this.storage.getAlert(alertId);
  }

  async queryAlerts(filters: { deviceId?: string; status?: AlertStatus; severity?: AlertSeverity; timeRange?: { start: Date; end: Date } }): Promise<Alert[]> {
    return this.storage.queryAlerts(filters);
  }

  addNotificationRule(rule: NotificationRule): void {
    if (!rule || !rule.id || !rule.recipient || !rule.type) {
        throw new Error("Invalid notification rule: id, recipient, and type are required.");
    }
    this.notificationRules.push(rule);
  }

  private async processNotifications(alert: Alert): Promise<void> {
    if (!this.notifier) return;

    for (const rule of this.notificationRules) {
      let shouldNotify = true;
      if (rule.alertSeverity && !rule.alertSeverity.includes(alert.severity)) shouldNotify = false;
      if (rule.alertRuleId && rule.alertRuleId !== alert.ruleId) shouldNotify = false;
      if (rule.deviceIdPattern && !alert.deviceId.match(new RegExp(rule.deviceIdPattern))) shouldNotify = false;

      if (shouldNotify) {
        const subject = `Alert [${alert.severity.toUpperCase()}] for ${alert.deviceId}: ${alert.ruleId || 'General'}`;
        const body = rule.messageTemplate
            ? rule.messageTemplate.replace('{deviceId}', alert.deviceId).replace('{message}', alert.message).replace('{severity}', alert.severity).replace('{value}', String(alert.value))
            : `Alert: ${alert.message}\nDevice: ${alert.deviceId}\nSeverity: ${alert.severity}\nMetric: ${alert.metric}\nValue: ${alert.value}\nTimestamp: ${alert.timestamp.toISOString()}`;
        
        try {
            await this.notifier.sendNotification(rule.recipient, subject, body, rule.type);
        } catch (error) {
            console.error(`Failed to send notification for alert ${alert.id} to ${rule.recipient} via ${rule.type}:`, error);
        }
      }
    }
  }
}

// Need crypto for generateAlertId if not importing from Node.js 'crypto' directly in class
import * as crypto from 'crypto';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  const deviceId = 'alert-device-pro';

  beforeEach(() => {
    mockNotificationService.sendNotification.mockReset();
    mockAlertStorage.createAlert.mockReset();
    mockAlertStorage.getAlert.mockReset();
    mockAlertStorage.updateAlertStatus.mockReset();
    mockAlertStorage.queryAlerts.mockReset();
    
    jest.spyOn(console, 'error').mockImplementation(() => {});

    alertManager = new AlertManager(mockAlertStorage, mockNotificationService);
    // @ts-expect-error private member access for test
    alertManager.notificationRules = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('triggerAlert', () => {
    const alertData = { deviceId, severity: 'critical' as AlertSeverity, message: 'CPU temperature critical!', ruleId: 'cpu-temp-high', metric: 'cpuTemp', value: 95 };
    
    it('should create an alert in storage and process notifications', async () => {
      const createdAlertId = `alert-${Date.now()}-test`;
      const expectedAlert: Alert = { ...alertData, id: createdAlertId, status: 'new', timestamp: expect.any(Date), lastUpdatedAt: expect.any(Date) };
      mockAlertStorage.createAlert.mockImplementation(async (alert) => ({...alert, id: createdAlertId })); // Simulate ID generation and return

      const result = await alertManager.triggerAlert(alertData);
      
      expect(result.id).toBe(createdAlertId);
      expect(result.status).toBe('new');
      expect(mockAlertStorage.createAlert).toHaveBeenCalledWith(expect.objectContaining(alertData));
      // Notification processing is tested separately or by checking sendNotification calls
    });
  });

  describe('Alert Lifecycle: acknowledge, resolve, close', () => {
    const alertId = 'alert123';
    const userId = 'user-admin';

    it('should acknowledge an alert', async () => {
      mockAlertStorage.updateAlertStatus.mockResolvedValue({ id: alertId, status: 'acknowledged' } as Alert);
      await alertManager.acknowledgeAlert(alertId, userId);
      expect(mockAlertStorage.updateAlertStatus).toHaveBeenCalledWith(alertId, 'acknowledged');
    });

    it('should resolve an alert with notes', async () => {
      const notes = "Issue fixed by rebooting device.";
      mockAlertStorage.updateAlertStatus.mockResolvedValue({ id: alertId, status: 'resolved', resolutionNotes: notes } as Alert);
      await alertManager.resolveAlert(alertId, notes, userId);
      expect(mockAlertStorage.updateAlertStatus).toHaveBeenCalledWith(alertId, 'resolved', notes);
    });

    it('should close an alert (implicitly resolving if not already)', async () => {
        mockAlertStorage.getAlert.mockResolvedValue({ id: alertId, status: 'acknowledged' } as Alert); // Not yet resolved
        mockAlertStorage.updateAlertStatus.mockResolvedValue({ id: alertId, status: 'closed' } as Alert);

        await alertManager.closeAlert(alertId, userId);
        expect(mockAlertStorage.updateAlertStatus).toHaveBeenCalledWith(alertId, 'resolved', expect.any(String)); // First resolve
        expect(mockAlertStorage.updateAlertStatus).toHaveBeenLastCalledWith(alertId, 'closed'); // Then close
    });
  });

  describe('getAlertDetails & queryAlerts', () => {
    it('should retrieve alert details', async () => {
      const alertId = 'get-alert-detail';
      const mockAlert = { id: alertId, deviceId, message: 'Test' } as Alert;
      mockAlertStorage.getAlert.mockResolvedValue(mockAlert);
      const result = await alertManager.getAlertDetails(alertId);
      expect(result).toEqual(mockAlert);
    });

    it('should query alerts based on filters', async () => {
      const filters = { deviceId, status: 'new' as AlertStatus };
      const mockAlerts = [{ id: 'q1', deviceId, status: 'new' }] as Alert[];
      mockAlertStorage.queryAlerts.mockResolvedValue(mockAlerts);
      const results = await alertManager.queryAlerts(filters);
      expect(results).toEqual(mockAlerts);
      expect(mockAlertStorage.queryAlerts).toHaveBeenCalledWith(filters);
    });
  });

  describe('Notification Processing', () => {
    const alert: Alert = {
        id: 'notify-alert-1', deviceId: 'dev-notify-A', ruleId: 'rule-X',
        severity: 'critical', status: 'new', message: 'System overload!',
        metric: 'loadAvg', value: 5.5, timestamp: new Date(), lastUpdatedAt: new Date()
    };
    const rule: NotificationRule = {
        id: 'email-criticals', recipient: 'ops@example.com', type: 'email',
        alertSeverity: ['critical'], deviceIdPattern: 'dev-notify-.*'
    };

    it('should send notification if alert matches a rule', async () => {
        alertManager.addNotificationRule(rule);
        mockNotificationService.sendNotification.mockResolvedValue(undefined);
        // @ts-expect-error private method
        await alertManager.processNotifications(alert);
        expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
            rule.recipient,
            expect.stringContaining(`Alert [CRITICAL] for ${alert.deviceId}`),
            expect.stringContaining(alert.message),
            rule.type
        );
    });

    it('should not send notification if alert does not match rule severity', async () => {
        const lowSeverityAlert = { ...alert, severity: 'info' as AlertSeverity };
        alertManager.addNotificationRule(rule); // rule is for critical only
        // @ts-expect-error
        await alertManager.processNotifications(lowSeverityAlert);
        expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
    
    it('should not send notification if notifier is not configured', async () => {
        const managerWithoutNotifier = new AlertManager(mockAlertStorage); // No notifier
        managerWithoutNotifier.addNotificationRule(rule);
        // @ts-expect-error
        await managerWithoutNotifier.processNotifications(alert);
        expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });
});