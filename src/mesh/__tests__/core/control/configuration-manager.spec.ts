// src/mesh/__tests__/core/control/configuration-manager.spec.ts
import { ConfigurationManager, MeshGlobalConfig, MeshServiceConfig } from '../../../core/control/configuration-manager';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLoggerInstance: ILoggingService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined),
  setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO),
  getChildLogger: jest.fn().mockReturnThis(),
};

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const initialGlobalConfig: MeshGlobalConfig = { defaultTimeoutMs: 2000, defaultRetries: 1 };

  beforeEach(() => {
    // Clear mock logger calls
    Object.values(mockLoggerInstance).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
    configManager = new ConfigurationManager({ logger: mockLoggerInstance });
  });

  describe('Global Configuration', () => {
    test('should return the initial global configuration', async () => {
      const globalConfig = await configManager.getGlobalConfig();
      expect(globalConfig).toEqual(initialGlobalConfig);
    });

    test('should update and return the new global configuration', async () => {
      const updates: Partial<MeshGlobalConfig> = { defaultTimeoutMs: 5000, customGlobalSetting: 'hello' };
      await configManager.updateGlobalConfig(updates);
      const globalConfig = await configManager.getGlobalConfig();
      expect(globalConfig.defaultTimeoutMs).toBe(5000);
      expect(globalConfig.defaultRetries).toBe(initialGlobalConfig.defaultRetries); // Unchanged
      expect(globalConfig.customGlobalSetting).toBe('hello');
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ConfigManager] Global configuration updated.',
        expect.objectContaining(updates)
      );
    });
  });

  describe('Service-Specific Configuration', () => {
    const serviceId = 'order-service';
    const serviceSpecificUpdates: Partial<MeshServiceConfig> = { timeoutMs: 1000, loadBalancer: 'ROUND_ROBIN' };

    test('should return global defaults if no service-specific config exists', async () => {
      const serviceConfig = await configManager.getServiceConfig(serviceId);
      expect(serviceConfig.timeoutMs).toBe(initialGlobalConfig.defaultTimeoutMs);
      expect(serviceConfig.retries).toBe(initialGlobalConfig.defaultRetries);
      expect(serviceConfig.loadBalancer).toBeUndefined();
    });

    test('should update and return service-specific configuration', async () => {
      await configManager.updateServiceConfig(serviceId, serviceSpecificUpdates);
      const serviceConfig = await configManager.getServiceConfig(serviceId);
      expect(serviceConfig.timeoutMs).toBe(1000);
      expect(serviceConfig.loadBalancer).toBe('ROUND_ROBIN');
      expect(serviceConfig.retries).toBe(initialGlobalConfig.defaultRetries); // Falls back for unspecified
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        `[ConfigManager] Configuration updated for service: ${serviceId}`,
        expect.objectContaining(serviceSpecificUpdates)
      );
    });

    test('should merge service-specific config with global defaults', async () => {
      // Update global to see fallback changes
      await configManager.updateGlobalConfig({ defaultRetries: 5, defaultTimeoutMs: 3000 });
      // Update service-specific, but only timeout
      await configManager.updateServiceConfig(serviceId, { timeoutMs: 500 });
      
      const serviceConfig = await configManager.getServiceConfig(serviceId);
      expect(serviceConfig.timeoutMs).toBe(500); // Service-specific override
      expect(serviceConfig.retries).toBe(5);     // Fallback to new global default
    });

    test('should handle multiple service configurations independently', async () => {
      const serviceBId = 'inventory-service';
      const serviceBConfig: Partial<MeshServiceConfig> = { retries: 0, customSetting: 'inventoryValue' };

      await configManager.updateServiceConfig(serviceId, serviceSpecificUpdates);
      await configManager.updateServiceConfig(serviceBId, serviceBConfig);

      const serviceAConf = await configManager.getServiceConfig(serviceId);
      const serviceBConf = await configManager.getServiceConfig(serviceBId);

      expect(serviceAConf.timeoutMs).toBe(serviceSpecificUpdates.timeoutMs);
      expect(serviceBConf.retries).toBe(0);
      expect(serviceBConf.customSetting).toBe('inventoryValue');
      // Check fallback for service B timeout
      expect(serviceBConf.timeoutMs).toBe(initialGlobalConfig.defaultTimeoutMs);
    });
  });

  describe('Subscription to Changes', () => {
    test('should notify listeners on global config change', (done) => {
      const newGlobalConfig: Partial<MeshGlobalConfig> = { defaultTimeoutMs: 7000 };
      const listener = jest.fn((configType, sId, newConf) => {
        try {
          expect(configType).toBe('GLOBAL');
          expect(sId).toBeNull();
          expect(newConf).toEqual(expect.objectContaining(newGlobalConfig));
          done();
        } catch (error) {
          done(error);
        }
      });
      configManager.onConfigChange(listener);
      configManager.updateGlobalConfig(newGlobalConfig);
    });

    test('should notify listeners on service-specific config change', (done) => {
      const serviceId = 'payment-service';
      const newServiceConfig: Partial<MeshServiceConfig> = { timeoutMs: 800 };
      const listener = jest.fn((configType, sId, newConf) => {
        try {
          expect(configType).toBe('SERVICE');
          expect(sId).toBe(serviceId);
          expect(newConf).toEqual(expect.objectContaining(newServiceConfig));
          done();
        } catch (error) {
          done(error);
        }
      });
      configManager.onConfigChange(listener);
      configManager.updateServiceConfig(serviceId, newServiceConfig);
    });

    test('unsubscribe should remove listener', async () => {
      const listener = jest.fn();
      const unsubscribe = configManager.onConfigChange(listener);
      unsubscribe();

      await configManager.updateGlobalConfig({ defaultRetries: 10 });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});