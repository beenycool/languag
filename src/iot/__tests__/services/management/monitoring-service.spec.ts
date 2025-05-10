// Mock for a TelemetryCollector or similar data source
const mockTelemetryCollector = {
  getLatestTelemetry: jest.fn(), // (deviceId, metricName) => Promise<{ value: any; timestamp: Date } | null>
  queryTelemetry: jest.fn(), // (deviceId, metricName, timeRange) => Promise<Array<{ value: any; timestamp: Date }>>
};

// Mock for an AlertManager
const mockAlertManager = {
  triggerAlert: jest.fn(), // (alertData: { deviceId: string; ruleId: string; severity: string; message: string; metric?: string; value?: any }) => Promise<void>
  resolveAlert: jest.fn(), // (alertId: string) => Promise<void>
};

// Mock for a DeviceStatusProvider (could be DeviceLifecycleManager or a dedicated service)
const mockDeviceStatusProvider = {
  getDeviceState: jest.fn(), // (deviceId) => Promise<string | null> (e.g., 'ONLINE', 'OFFLINE')
  getLastSeen: jest.fn(), // (deviceId) => Promise<Date | null>
};

// Placeholder for actual MonitoringService implementation
// import { MonitoringService } from '../../../../services/management/monitoring-service';

interface MonitoringRule {
  id: string;
  deviceIdPattern?: string; // Optional: Apply to specific devices or all if undefined
  metricName: string;
  condition: 'GT' | 'LT' | 'EQ' | 'NEQ'; // Greater than, Less than, Equal, Not Equal
  threshold: number | string;
  severity: 'critical' | 'warning' | 'info';
  messageTemplate: string; // e.g., "Device {deviceId} temperature {value}°C exceeds threshold {threshold}°C"
  durationSeconds?: number; // Optional: condition must hold for this duration
}

interface DeviceHealth {
  deviceId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastSeen?: Date | null;
  currentState?: string | null;
  issues?: string[];
}

class MonitoringService {
  private rules: MonitoringRule[] = [];
  constructor(
    private telemetry: typeof mockTelemetryCollector,
    private alerts: typeof mockAlertManager,
    private statusProvider: typeof mockDeviceStatusProvider
  ) {}

  addRule(rule: MonitoringRule): void {
    if (!rule || !rule.id || !rule.metricName || !rule.condition || rule.threshold === undefined) {
        throw new Error('Invalid monitoring rule: id, metricName, condition, and threshold are required.');
    }
    const existing = this.rules.find(r => r.id === rule.id);
    if (existing) throw new Error(`Rule with id ${rule.id} already exists.`);
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  async checkDeviceHealth(deviceId: string): Promise<DeviceHealth> {
    if (!deviceId) throw new Error('Device ID is required.');
    const state = await this.statusProvider.getDeviceState(deviceId);
    const lastSeen = await this.statusProvider.getLastSeen(deviceId);
    const health: DeviceHealth = { deviceId, status: 'unknown', lastSeen, currentState: state, issues: [] };

    if (state === 'OFFLINE') {
      health.status = 'unhealthy';
      health.issues?.push('Device is offline.');
      // Consider lastSeen for staleness if offline
      if (lastSeen && (new Date().getTime() - lastSeen.getTime()) > (24 * 60 * 60 * 1000) /* 1 day */) {
        health.issues?.push('Device has been offline for an extended period.');
      }
    } else if (state === 'ERROR') {
      health.status = 'unhealthy';
      health.issues?.push('Device reported an error state.');
    } else if (state === 'ONLINE') {
      health.status = 'healthy'; // Assume healthy if online, specific metrics will refine this
    } else if (!state) {
        health.status = 'unknown';
        health.issues?.push('Device state is not available.');
    }
    // Further checks can be added here based on metrics or other factors
    return health;
  }

  async evaluateRulesForDevice(deviceId: string): Promise<void> {
    if (!deviceId) return;
    const applicableRules = this.rules.filter(r => !r.deviceIdPattern || deviceId.match(new RegExp(r.deviceIdPattern.replace('*', '.*'))));

    for (const rule of applicableRules) {
      const telemetry = await this.telemetry.getLatestTelemetry(deviceId, rule.metricName);
      if (telemetry === null || telemetry.value === undefined) continue; // No data for this metric

      let conditionMet = false;
      const { value } = telemetry;
      const { threshold, condition } = rule;

      if (typeof value === 'number' && typeof threshold === 'number') {
        if (condition === 'GT' && value > threshold) conditionMet = true;
        else if (condition === 'LT' && value < threshold) conditionMet = true;
        else if (condition === 'EQ' && value === threshold) conditionMet = true;
        else if (condition === 'NEQ' && value !== threshold) conditionMet = true;
      } else if (typeof value === 'string' && typeof threshold === 'string') {
        // Basic string comparison for EQ/NEQ
        if (condition === 'EQ' && value === threshold) conditionMet = true;
        else if (condition === 'NEQ' && value !== threshold) conditionMet = true;
      }
      // Note: Duration based rules are more complex and would require stateful evaluation, omitted for this example.

      if (conditionMet) {
        const message = rule.messageTemplate
          .replace('{deviceId}', deviceId)
          .replace('{metricName}', rule.metricName)
          .replace('{value}', String(value))
          .replace('{threshold}', String(threshold));
        await this.alerts.triggerAlert({
          deviceId,
          ruleId: rule.id,
          severity: rule.severity,
          message,
          metric: rule.metricName,
          value: value
        });
      }
    }
  }
}

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  const deviceId = 'temp-sensor-alpha';

  beforeEach(() => {
    mockTelemetryCollector.getLatestTelemetry.mockReset();
    mockTelemetryCollector.queryTelemetry.mockReset();
    mockAlertManager.triggerAlert.mockReset();
    mockAlertManager.resolveAlert.mockReset();
    mockDeviceStatusProvider.getDeviceState.mockReset();
    mockDeviceStatusProvider.getLastSeen.mockReset();

    monitoringService = new MonitoringService(
      mockTelemetryCollector,
      mockAlertManager,
      mockDeviceStatusProvider
    );
    // Clear rules manually if not done in constructor or a dedicated method
    // @ts-expect-error accessing private member for test setup
    monitoringService.rules = [];
  });

  describe('addRule & removeRule', () => {
    const rule: MonitoringRule = { id: 'temp-high', metricName: 'temperature', condition: 'GT', threshold: 30, severity: 'critical', messageTemplate: 'Temp too high!' };
    it('should add a new monitoring rule', () => {
      monitoringService.addRule(rule);
      // @ts-expect-error
      expect(monitoringService.rules).toContainEqual(rule);
    });
    it('should throw error if rule ID already exists', () => {
        monitoringService.addRule(rule);
        expect(() => monitoringService.addRule(rule)).toThrow('Rule with id temp-high already exists.');
    });
    it('should throw error for invalid rule (missing threshold)', () => {
        const invalidRule = { id: 'inv', metricName: 'cpu', condition: 'GT', severity: 'warning' } as any;
        expect(() => monitoringService.addRule(invalidRule)).toThrow('Invalid monitoring rule');
    });
    it('should remove an existing rule', () => {
      monitoringService.addRule(rule);
      monitoringService.removeRule(rule.id);
      // @ts-expect-error
      expect(monitoringService.rules).not.toContainEqual(rule);
    });
  });

  describe('checkDeviceHealth', () => {
    it('should report healthy for an ONLINE device', async () => {
      mockDeviceStatusProvider.getDeviceState.mockResolvedValue('ONLINE');
      mockDeviceStatusProvider.getLastSeen.mockResolvedValue(new Date());
      const health = await monitoringService.checkDeviceHealth(deviceId);
      expect(health.status).toBe('healthy');
      expect(health.currentState).toBe('ONLINE');
    });

    it('should report unhealthy for an OFFLINE device', async () => {
      mockDeviceStatusProvider.getDeviceState.mockResolvedValue('OFFLINE');
      mockDeviceStatusProvider.getLastSeen.mockResolvedValue(new Date(Date.now() - 2 * 60 * 60 * 1000)); // 2 hours ago
      const health = await monitoringService.checkDeviceHealth(deviceId);
      expect(health.status).toBe('unhealthy');
      expect(health.issues).toContain('Device is offline.');
    });

    it('should report unhealthy for an OFFLINE device for extended period', async () => {
        mockDeviceStatusProvider.getDeviceState.mockResolvedValue('OFFLINE');
        mockDeviceStatusProvider.getLastSeen.mockResolvedValue(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)); // 2 days ago
        const health = await monitoringService.checkDeviceHealth(deviceId);
        expect(health.status).toBe('unhealthy');
        expect(health.issues).toContain('Device has been offline for an extended period.');
    });

    it('should report unhealthy for an ERROR state device', async () => {
      mockDeviceStatusProvider.getDeviceState.mockResolvedValue('ERROR');
      const health = await monitoringService.checkDeviceHealth(deviceId);
      expect(health.status).toBe('unhealthy');
      expect(health.issues).toContain('Device reported an error state.');
    });

     it('should report unknown if device state is not available', async () => {
      mockDeviceStatusProvider.getDeviceState.mockResolvedValue(null);
      const health = await monitoringService.checkDeviceHealth(deviceId);
      expect(health.status).toBe('unknown');
      expect(health.issues).toContain('Device state is not available.');
    });
  });

  describe('evaluateRulesForDevice', () => {
    const highTempRule: MonitoringRule = {
      id: 'temp-gt-30', deviceIdPattern: deviceId, metricName: 'temperature',
      condition: 'GT', threshold: 30, severity: 'critical',
      messageTemplate: 'Device {deviceId} temperature {value}°C exceeds threshold {threshold}°C'
    };
    const lowBatteryRule: MonitoringRule = {
      id: 'batt-lt-10', metricName: 'batteryLevel',
      condition: 'LT', threshold: 10, severity: 'warning',
      messageTemplate: 'Device {deviceId} battery {value}% is below threshold {threshold}%'
    };
     const statusRule: MonitoringRule = {
      id: 'status-offline', metricName: 'deviceStatus',
      condition: 'EQ', threshold: 'OFFLINE_REPORTED', severity: 'critical',
      messageTemplate: 'Device {deviceId} reported status {value}'
    };


    it('should trigger an alert if a numeric rule condition is met (GT)', async () => {
      monitoringService.addRule(highTempRule);
      mockTelemetryCollector.getLatestTelemetry.mockResolvedValue({ value: 35, timestamp: new Date() });
      await monitoringService.evaluateRulesForDevice(deviceId);
      expect(mockAlertManager.triggerAlert).toHaveBeenCalledWith({
        deviceId, ruleId: highTempRule.id, severity: 'critical',
        message: `Device ${deviceId} temperature 35°C exceeds threshold 30°C`,
        metric: 'temperature', value: 35
      });
    });

    it('should trigger an alert if a numeric rule condition is met (LT)', async () => {
      monitoringService.addRule(lowBatteryRule);
      mockTelemetryCollector.getLatestTelemetry.mockResolvedValue({ value: 5, timestamp: new Date() }); // For batteryLevel
      await monitoringService.evaluateRulesForDevice(deviceId); // Assuming deviceId matches or no pattern
      expect(mockAlertManager.triggerAlert).toHaveBeenCalledWith(expect.objectContaining({
        ruleId: lowBatteryRule.id, severity: 'warning', value: 5
      }));
    });

    it('should trigger an alert if a string rule condition is met (EQ)', async () => {
        monitoringService.addRule(statusRule);
        mockTelemetryCollector.getLatestTelemetry.mockResolvedValue({ value: 'OFFLINE_REPORTED', timestamp: new Date() });
        await monitoringService.evaluateRulesForDevice(deviceId);
        expect(mockAlertManager.triggerAlert).toHaveBeenCalledWith(expect.objectContaining({
            ruleId: statusRule.id, value: 'OFFLINE_REPORTED'
        }));
    });

    it('should not trigger an alert if rule condition is not met', async () => {
      monitoringService.addRule(highTempRule);
      mockTelemetryCollector.getLatestTelemetry.mockResolvedValue({ value: 25, timestamp: new Date() });
      await monitoringService.evaluateRulesForDevice(deviceId);
      expect(mockAlertManager.triggerAlert).not.toHaveBeenCalled();
    });

    it('should not trigger an alert if telemetry data is unavailable', async () => {
      monitoringService.addRule(highTempRule);
      mockTelemetryCollector.getLatestTelemetry.mockResolvedValue(null);
      await monitoringService.evaluateRulesForDevice(deviceId);
      expect(mockAlertManager.triggerAlert).not.toHaveBeenCalled();
    });

    it('should only evaluate rules matching deviceIdPattern if provided', async () => {
        const specificRule: MonitoringRule = { ...highTempRule, id: 'specific-dev-rule', deviceIdPattern: 'specific-device-.*' };
        monitoringService.addRule(specificRule);
        monitoringService.addRule(lowBatteryRule); // General rule

        mockTelemetryCollector.getLatestTelemetry
            .mockResolvedValueOnce({ value: 35, timestamp: new Date() }) // For specificRule on 'specific-device-001'
            .mockResolvedValueOnce({ value: 5, timestamp: new Date() });  // For lowBatteryRule on 'specific-device-001'

        await monitoringService.evaluateRulesForDevice('specific-device-001');
        expect(mockAlertManager.triggerAlert).toHaveBeenCalledTimes(2); // Both rules match

        mockAlertManager.triggerAlert.mockClear();
        mockTelemetryCollector.getLatestTelemetry.mockResolvedValueOnce({ value: 5, timestamp: new Date() }); // For lowBatteryRule on 'other-device'
        await monitoringService.evaluateRulesForDevice('other-device');
        expect(mockAlertManager.triggerAlert).toHaveBeenCalledTimes(1); // Only general rule matches
        expect(mockAlertManager.triggerAlert).toHaveBeenCalledWith(expect.objectContaining({ ruleId: lowBatteryRule.id }));
    });
  });
});