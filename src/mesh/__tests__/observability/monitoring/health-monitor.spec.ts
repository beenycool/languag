// src/mesh/__tests__/observability/monitoring/health-monitor.spec.ts
import { HealthMonitor, ServiceHealth, HealthStatus, HealthCheckConfig } from '../../../observability/monitoring/health-monitor';
// Corrected path to the mocks directory at src/mesh/__tests__/__mocks__
import { ServiceRegistry, mockServiceRegistryInstance } from '../../__mocks__/service-registry';
import { ServiceInstance } from '../../../core/control/service-registry'; // Import type from actual implementation
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

// Corrected path for jest.mock as well
jest.mock('../../../core/control/service-registry');

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockSR: typeof mockServiceRegistryInstance;
  const serviceIdA = 'serviceA';
  const instanceA1: ServiceInstance = { id: 'a1', host: 'localhost', port: 3001, status: 'UP' };
  const instanceA2: ServiceInstance = { id: 'a2', host: 'localhost', port: 9999, status: 'UP' }; // Port 9999 will fail in mock checkHealth
  const instanceA3: ServiceInstance = { id: 'a3', host: 'localhost', port: 3003, status: 'DOWN' };


  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    mockServiceRegistryInstance.reset();
    mockSR = mockServiceRegistryInstance;
    
    // ServiceRegistry constructor is mocked to return mockServiceRegistryInstance
    healthMonitor = new HealthMonitor(new ServiceRegistry() as any, mockLogger);
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await healthMonitor.shutdown();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with ServiceRegistry', () => {
      expect(healthMonitor['serviceRegistry']).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('[HealthMonitor] HealthMonitor initialized.');
    });
  });

  describe('checkHealth', () => {
    test('should return UNKNOWN if no instances are registered for the service', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([]);
      const health = await healthMonitor.checkHealth(serviceIdA) as ServiceHealth; // Cast for single object expectation
      expect(health.status).toBe('UNKNOWN');
      expect(health.details?.error).toBe('No instances registered');
      expect(mockLogger.warn).toHaveBeenCalledWith(`[HealthMonitor] No instances found for service: ${serviceIdA} to health check.`);
    });

    test('should check health of all instances for a service', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([instanceA1, instanceA2, instanceA3]); // A3 is DOWN, A2 will fail check
      const healthResults = await healthMonitor.checkHealth(serviceIdA) as ServiceHealth[];
      
      expect(healthResults).toHaveLength(3);
      const healthA1 = healthResults.find(h => h.instanceId === 'a1');
      const healthA2 = healthResults.find(h => h.instanceId === 'a2');
      const healthA3 = healthResults.find(h => h.instanceId === 'a3'); // instanceA3 is DOWN, so checkHealth might not even "check" it based on its own logic, or it might. Current impl checks all from registry.

      expect(healthA1?.status).toBe('HEALTHY');
      expect(healthA2?.status).toBe('UNHEALTHY');
      expect(healthA2?.details?.error).toContain('Simulated health check failure');
      // The current checkHealth implementation in HealthMonitor doesn't filter by instance.status before checking.
      // It relies on the simulated check logic (port 9999 fails). instanceA3 (port 3003) should pass the mock check.
      expect(healthA3?.status).toBe('HEALTHY'); 
    });

    test('should check health of a specific instance', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([instanceA1, instanceA2]);
      const healthA2 = await healthMonitor.checkHealth(serviceIdA, 'a2') as ServiceHealth;
      expect(healthA2?.status).toBe('UNHEALTHY');
      expect(healthA2?.instanceId).toBe('a2');
    });
    
    test('should return UNKNOWN if specific instance not found in registry list for that service', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([instanceA1]); // a2 is not returned by registry
      const health = await healthMonitor.checkHealth(serviceIdA, 'a2') as ServiceHealth;
      expect(health.status).toBe('UNKNOWN');
      expect(health.details?.error).toBe('Instance not found in registry');
    });
  });

  describe('getLastKnownHealth', () => {
    test('should return null if service/instance not monitored or no health data', async () => {
      expect(await healthMonitor.getLastKnownHealth(serviceIdA)).toBeNull();
    });

    test('should return last known health after a check', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([instanceA1]);
      await healthMonitor.checkHealth(serviceIdA, instanceA1.id); // This populates lastHealth if monitored
      
      // To test getLastKnownHealth, the service needs to be "monitored" so lastHealth is stored.
      // Let's start monitoring it.
      await healthMonitor.startMonitoring(serviceIdA, { type: 'HTTP_GET', intervalMs: 10000 });
      // The initial check in startMonitoring will populate lastHealth.
      jest.advanceTimersByTime(1); // Allow async operations in startMonitoring to complete

      const lastHealth = await healthMonitor.getLastKnownHealth(serviceIdA, instanceA1.id);
      expect(lastHealth).not.toBeNull();
      expect(lastHealth?.status).toBe('HEALTHY');
      expect(lastHealth?.instanceId).toBe(instanceA1.id);
    });
  });

  describe('Monitoring Lifecycle (start/stop)', () => {
    const checkConfig: HealthCheckConfig = { type: 'TCP_DIAL', port: 3001, intervalMs: 500, timeoutMs: 100 };

    test('startMonitoring should perform an initial health check and set up periodic checks', async () => {
      mockSR.getServiceEndpoints.mockResolvedValue([instanceA1]);
      const checkHealthSpy = jest.spyOn(healthMonitor, 'checkHealth');
      
      await healthMonitor.startMonitoring(serviceIdA, checkConfig);
      
      expect(checkHealthSpy).toHaveBeenCalledWith(serviceIdA); // Initial check
      expect(healthMonitor['monitoredServices'].has(serviceIdA)).toBe(true);
      expect(healthMonitor['monitoredServices'].get(serviceIdA)?.timer).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`[HealthMonitor] Starting health monitoring for service: ${serviceIdA}`, { config: checkConfig });

      // Fast-forward time to trigger periodic check
      jest.advanceTimersByTime(checkConfig.intervalMs!);
      expect(checkHealthSpy).toHaveBeenCalledTimes(2); // Initial + 1 periodic
      
      // Check if lastHealth was updated
      const monitoredInfo = healthMonitor['monitoredServices'].get(serviceIdA);
      expect(monitoredInfo?.lastHealth).toBeDefined();
      if (Array.isArray(monitoredInfo?.lastHealth)) {
        expect(monitoredInfo?.lastHealth[0].status).toBe('HEALTHY');
      }
    });

    test('startMonitoring should warn if service already monitored', async () => {
      await healthMonitor.startMonitoring(serviceIdA, checkConfig);
      (mockLogger.warn as jest.Mock).mockClear();
      await healthMonitor.startMonitoring(serviceIdA, checkConfig); // Attempt to start again
      expect(mockLogger.warn).toHaveBeenCalledWith(`[HealthMonitor] Service ${serviceIdA} is already being monitored. Call stopMonitoring first or updateMonitoring.`);
    });

    test('stopMonitoring should clear timer and remove service from monitoring', async () => {
      await healthMonitor.startMonitoring(serviceIdA, checkConfig);
      expect(healthMonitor['monitoredServices'].has(serviceIdA)).toBe(true);
      
      await healthMonitor.stopMonitoring(serviceIdA);
      expect(healthMonitor['monitoredServices'].has(serviceIdA)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(`[HealthMonitor] Stopped health monitoring for service: ${serviceIdA}`);
      
      // Ensure timer doesn't run again
      const checkHealthSpy = jest.spyOn(healthMonitor, 'checkHealth');
      jest.advanceTimersByTime(checkConfig.intervalMs! * 2);
      expect(checkHealthSpy).not.toHaveBeenCalledTimes(3); // Should not have run again after stop
    });

    test('stopMonitoring should warn if service not monitored', async () => {
      await healthMonitor.stopMonitoring('nonExistentService');
      expect(mockLogger.warn).toHaveBeenCalledWith('[HealthMonitor] Service nonExistentService is not currently being monitored or timer not found.');
    });
  });
  
  test('shutdown should stop all monitoring jobs', async () => {
      await healthMonitor.startMonitoring(serviceIdA, { type: 'HTTP_GET', intervalMs: 100 });
      await healthMonitor.startMonitoring('serviceB', { type: 'TCP_DIAL', intervalMs: 100 });
      expect(healthMonitor['monitoredServices'].size).toBe(2);
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      await healthMonitor.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2); // For each monitored service
      expect(healthMonitor['monitoredServices'].size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('[HealthMonitor] Shutting down HealthMonitor. Stopping all monitoring jobs.');
      clearIntervalSpy.mockRestore();
  });
});