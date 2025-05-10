// src/mesh/__tests__/observability/monitoring/alert-manager.spec.ts
import { AlertManager, Alert, NotificationChannel, AlertSeverity } from '../../../observability/monitoring/alert-manager';
import { PerformanceAlertConfig } from '../../../observability/monitoring/performance-monitor';
import { ServiceHealth, HealthStatus } from '../../../observability/monitoring/health-monitor';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

const mockConsoleChannel: jest.Mocked<NotificationChannel> = {
  id: 'console-test',
  type: 'CONSOLE',
  config: {},
  sendNotification: jest.fn().mockResolvedValue(undefined),
};

const mockSlackChannel: jest.Mocked<NotificationChannel> = {
  id: 'slack-test',
  type: 'SLACK',
  config: { webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX' },
  sendNotification: jest.fn().mockResolvedValue(undefined),
};

describe('AlertManager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    mockConsoleChannel.sendNotification.mockClear();
    mockSlackChannel.sendNotification.mockClear();
    
    alertManager = new AlertManager(mockLogger);
    // Add channels for testing
    alertManager.addNotificationChannel(mockConsoleChannel);
    alertManager.addNotificationChannel(mockSlackChannel);
    
    // Clear logs that might have occurred during addNotificationChannel
    (mockLogger.info as jest.Mock).mockClear();
    (mockLogger.warn as jest.Mock).mockClear();
    jest.useFakeTimers(); // For consistent timestamps
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization and Channel Management', () => {
    test('should initialize and log creation', () => {
      const newAm = new AlertManager(mockLogger); // Test constructor log without setup channels
      expect(newAm).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('[AlertManager] AlertManager initialized.');
    });

    test('addNotificationChannel should add a channel', () => {
      const newChannel: NotificationChannel = { id: 'email-test', type: 'EMAIL', config: {}, sendNotification: jest.fn() };
      alertManager.addNotificationChannel(newChannel);
      expect(alertManager['channels'].get('email-test')).toBe(newChannel);
      expect(mockLogger.info).toHaveBeenCalledWith('[AlertManager] Notification channel added/updated: email-test (Type: EMAIL)');
    });
    
    test('addNotificationChannel should overwrite existing channel with same ID', () => {
      const updatedConsoleChannel: NotificationChannel = { ...mockConsoleChannel, config: { newParam: true } };
      alertManager.addNotificationChannel(updatedConsoleChannel);
      expect(alertManager['channels'].get(mockConsoleChannel.id)?.config).toHaveProperty('newParam');
      expect(mockLogger.warn).toHaveBeenCalledWith(`[AlertManager] Notification channel with ID ${mockConsoleChannel.id} already exists. Overwriting.`);
    });

    test('removeNotificationChannel should remove an existing channel', () => {
      alertManager.removeNotificationChannel(mockConsoleChannel.id);
      expect(alertManager['channels'].has(mockConsoleChannel.id)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(`[AlertManager] Notification channel removed: ${mockConsoleChannel.id}`);
    });
    
    test('removeNotificationChannel should warn if channel does not exist', () => {
      alertManager.removeNotificationChannel('non-existent-channel');
      expect(mockLogger.warn).toHaveBeenCalledWith('[AlertManager] Attempted to remove non-existent notification channel: non-existent-channel');
    });
  });

  // Define perfAlertData in a scope accessible to multiple describe blocks
  const perfAlertData: PerformanceAlertConfig = {
    metricName: 'cpu_usage_percent', threshold: 80, comparison: 'ABOVE',
    durationSeconds: 300, severity: 'CRITICAL', labelsFilter: { service: 'api-gateway', instance: 'abc' }
  };

  describe('Alert Processing', () => {
    // perfAlertData is now accessible here
    const healthAlertData: ServiceHealth = {
      serviceId: 'user-db', instanceId: 'db-1', status: 'UNHEALTHY',
      lastChecked: Date.now(), details: { error: 'Connection refused' }
    };
    const genericAlertData: Omit<Alert, 'id' | 'timestamp' | 'status'> = {
        title: "Custom System Event",
        description: "A generic critical event occurred.",
        severity: "CRITICAL",
        labels: { component: "batch-processor" },
        sourceComponent: "CustomMonitor"
    };


    test('should process PerformanceAlertConfig, create FIRING alert, and notify channels', async () => {
      const now = Date.now();
      jest.setSystemTime(now);
      await alertManager.processAlert(perfAlertData, 'PerformanceMonitor');

      const signature = alertManager['generateAlertSignature'](perfAlertData, 'PerformanceMonitor');
      const activeAlert = alertManager['activeAlerts'].get(signature);

      expect(activeAlert).toBeDefined();
      expect(activeAlert?.status).toBe('FIRING');
      expect(activeAlert?.severity).toBe(perfAlertData.severity);
      expect(activeAlert?.title).toContain(perfAlertData.metricName);
      expect(activeAlert?.labels).toEqual({ service: 'api-gateway', instance: 'abc' }); // Stringified
      expect(activeAlert?.sourceComponent).toBe('PerformanceMonitor');
      
      expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(activeAlert);
      expect(mockSlackChannel.sendNotification).toHaveBeenCalledWith(activeAlert);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`[AlertManager] New alert FIRING: ${activeAlert?.title}`),
        expect.objectContaining({ alert: activeAlert })
      );
    });

    test('should process ServiceHealth (UNHEALTHY), create FIRING alert, and notify channels', async () => {
      await alertManager.processAlert(healthAlertData, 'HealthMonitor');
      const signature = alertManager['generateAlertSignature'](healthAlertData, 'HealthMonitor');
      const activeAlert = alertManager['activeAlerts'].get(signature);

      expect(activeAlert).toBeDefined();
      expect(activeAlert?.status).toBe('FIRING');
      expect(activeAlert?.severity).toBe('CRITICAL'); // Mapped from UNHEALTHY
      expect(activeAlert?.title).toContain(healthAlertData.serviceId);
      expect(activeAlert?.sourceComponent).toBe('HealthMonitor');
      
      expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(activeAlert);
    });
    
    test('should process generic alert data, create FIRING alert, and notify channels', async () => {
        await alertManager.processAlert(genericAlertData, genericAlertData.sourceComponent!);
        const signature = alertManager['generateAlertSignature'](genericAlertData, genericAlertData.sourceComponent!);
        const activeAlert = alertManager['activeAlerts'].get(signature);

        expect(activeAlert).toBeDefined();
        expect(activeAlert?.status).toBe('FIRING');
        expect(activeAlert?.severity).toBe(genericAlertData.severity);
        expect(activeAlert?.title).toBe(genericAlertData.title);
        expect(activeAlert?.labels).toEqual(genericAlertData.labels);
        expect(activeAlert?.sourceComponent).toBe(genericAlertData.sourceComponent);
        expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(activeAlert);
    });

    test('should de-duplicate active FIRING alerts by signature', async () => {
      await alertManager.processAlert(perfAlertData, 'PerformanceMonitor'); // First time
      (mockConsoleChannel.sendNotification as jest.Mock).mockClear();
      (mockLogger.info as jest.Mock).mockClear(); // Clear info logs too

      await alertManager.processAlert(perfAlertData, 'PerformanceMonitor'); // Second time with same data
      
      expect(mockConsoleChannel.sendNotification).not.toHaveBeenCalled(); // Should not notify again
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[AlertManager] Alert already active and firing, not re-notifying'),
        expect.anything()
      );
    });

    test('should process HEALTHY ServiceHealth as a potential resolution', async () => {
      // First, make an alert active
      await alertManager.processAlert(healthAlertData, 'HealthMonitor'); // UNHEALTHY
      const signature = alertManager['generateAlertSignature'](healthAlertData, 'HealthMonitor');
      expect(alertManager['activeAlerts'].get(signature)?.status).toBe('FIRING');
      (mockConsoleChannel.sendNotification as jest.Mock).mockClear();

      const healthyUpdate: ServiceHealth = { ...healthAlertData, status: 'HEALTHY', lastChecked: Date.now() + 1000 };
      await alertManager.processAlert(healthyUpdate, 'HealthMonitor');
      
      const resolvedAlert = alertManager['activeAlerts'].get(signature); // Should be removed or marked resolved
      expect(resolvedAlert).toBeUndefined(); // Current impl deletes on resolve
      
      // Check if sendNotification was called for the RESOLVED state
      expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RESOLVED', title: expect.stringContaining(healthAlertData.serviceId) })
      );
    });
    
    test('should log error for unknown alert data structure', async () => {
        const unknownAlertData = { someRandomField: "value" } as any;
        await alertManager.processAlert(unknownAlertData, "UnknownSource");
        expect(mockLogger.error).toHaveBeenCalledWith(
            "[AlertManager] Unknown alert data structure received.",
            { alertData: unknownAlertData }
        );
        expect(mockConsoleChannel.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Alert Resolution', () => {
    const signature = alertManager['generateAlertSignature'](perfAlertData, 'PerformanceMonitor');
    
    beforeEach(async () => {
      // Make an alert active
      await alertManager.processAlert(perfAlertData, 'PerformanceMonitor');
      (mockConsoleChannel.sendNotification as jest.Mock).mockClear(); // Clear notifications from initial firing
      (mockLogger.info as jest.Mock).mockClear();
    });

    test('resolveAlert should mark an active alert as RESOLVED and notify channels', async () => {
      expect(alertManager['activeAlerts'].get(signature)?.status).toBe('FIRING');
      
      await alertManager.resolveAlert(signature, 'Problem fixed by reboot.');
      
      const resolvedAlertState = alertManager['activeAlerts'].get(signature); // Should be removed by current impl
      expect(resolvedAlertState).toBeUndefined(); 
      
      expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'RESOLVED',
          description: expect.stringContaining('Problem fixed by reboot.'),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[AlertManager] Alert RESOLVED: ${perfAlertData.metricName}`),
        expect.anything()
      );
    });

    test('resolveAlert should work with ruleId if alert found', async () => {
        const ruleId = `${perfAlertData.metricName}-${perfAlertData.comparison}-${perfAlertData.threshold}`;
        await alertManager.resolveAlert(ruleId, "Resolved by rule ID");
        expect(alertManager['activeAlerts'].get(signature)).toBeUndefined();
        expect(mockConsoleChannel.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ status: 'RESOLVED' }));
    });
    
    test('resolveAlert should log if no active alert found for ID/signature', async () => {
      await alertManager.resolveAlert('non-existent-signature');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AlertManager] No active alert found to resolve for ID/Signature: non-existent-signature'
      );
      expect(mockConsoleChannel.sendNotification).not.toHaveBeenCalled();
    });
  });
});