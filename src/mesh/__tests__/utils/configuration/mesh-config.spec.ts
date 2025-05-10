// src/mesh/__tests__/utils/configuration/mesh-config.spec.ts
import { MeshConfigProvider, AggregatedMeshConfig } from '../../../utils/configuration/mesh-config';
// Corrected path to the mocks directory at src/mesh/__tests__/__mocks__
import { ConfigurationManager, mockConfigurationManagerInstance } from '../../__mocks__/configuration-manager';
import { MeshGlobalConfig, MeshServiceConfig } from '../../../core/control/configuration-manager'; // Import types from actual implementation
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';
import { RouteRule } from '../../../utils/routing/route-manager';
import { SecurityPolicy } from '../../../features/security/policy-enforcer';

// Corrected path for jest.mock as well
jest.mock('../../../core/control/configuration-manager');

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('MeshConfigProvider', () => {
  let meshConfigProvider: MeshConfigProvider;
  let mockCM: typeof mockConfigurationManagerInstance;

  const mockGlobalSettings: MeshGlobalConfig = { defaultTimeoutMs: 5000, defaultRetries: 2 };
  const mockRoutingRules: RouteRule[] = [{ id: 'route1', matches: [{ pathPrefix: '/api' }], action: { targetService: 's1' } }];
  const mockSecurityPolicies: SecurityPolicy[] = [{ id: 'policy1', action: 'ALLOW', source: { principals: ['*'] } }];
  
  const fullMockGlobalConfigFromCM: MeshGlobalConfig & Partial<Omit<AggregatedMeshConfig, 'globalSettings'>> = {
    ...mockGlobalSettings,
    routingRules: mockRoutingRules,
    securityPolicies: mockSecurityPolicies,
    // retryPolicies would be another example
  };


  beforeEach(() => {
    mockConfigurationManagerInstance.reset();
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    
    mockCM = mockConfigurationManagerInstance;
    // Simulate ConfigurationManager returning a global config that contains these structured sections
    mockCM.getGlobalConfig.mockResolvedValue(fullMockGlobalConfigFromCM);
    mockCM.getServiceConfig.mockImplementation(async (serviceId: string) => {
        if (serviceId === "testService") return { timeoutMs: 1000, retries: 1 };
        return { timeoutMs: mockGlobalSettings.defaultTimeoutMs, retries: mockGlobalSettings.defaultRetries }; // Default fallback
    });

    meshConfigProvider = new MeshConfigProvider(new ConfigurationManager() as any, mockLogger);
    // Initial load is not automatically called in current placeholder, so tests will call refreshConfig or ensureConfigLoaded
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with ConfigurationManager', () => {
      expect(meshConfigProvider['configManager']).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('[MeshConfigProvider] MeshConfigProvider initialized.');
    });
  });

  describe('refreshConfig and ensureConfigLoaded', () => {
    test('refreshConfig should load config from ConfigurationManager and store it', async () => {
      await meshConfigProvider.refreshConfig();
      expect(mockCM.getGlobalConfig).toHaveBeenCalledTimes(1);
      const loadedConfig = meshConfigProvider['lastLoadedConfig'];
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig?.globalSettings).toEqual(mockGlobalSettings); // Only global settings part
      expect(loadedConfig?.routingRules).toEqual(mockRoutingRules);
      expect(loadedConfig?.securityPolicies).toEqual(mockSecurityPolicies);
      expect(mockLogger.info).toHaveBeenCalledWith('[MeshConfigProvider] Mesh configuration refreshed successfully.');
    });

    test('ensureConfigLoaded should call refreshConfig if config not loaded', async () => {
      const refreshSpy = jest.spyOn(meshConfigProvider, 'refreshConfig');
      expect(meshConfigProvider['lastLoadedConfig']).toBeUndefined();
      await meshConfigProvider['ensureConfigLoaded']();
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(meshConfigProvider['lastLoadedConfig']).toBeDefined();
      refreshSpy.mockRestore();
    });

    test('ensureConfigLoaded should not call refreshConfig if config already loaded', async () => {
      await meshConfigProvider.refreshConfig(); // Load it once
      const refreshSpy = jest.spyOn(meshConfigProvider, 'refreshConfig');
      mockCM.getGlobalConfig.mockClear(); // Clear call count for getGlobalConfig

      await meshConfigProvider['ensureConfigLoaded'](); // Should use cached
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(mockCM.getGlobalConfig).not.toHaveBeenCalled(); // Underlying CM fetch not called again
      refreshSpy.mockRestore();
    });
    
    test('refreshConfig should clear cache and throw if ConfigurationManager fails', async () => {
        await meshConfigProvider.refreshConfig(); // Initial successful load
        expect(meshConfigProvider['lastLoadedConfig']).toBeDefined();

        mockCM.getGlobalConfig.mockRejectedValueOnce(new Error("CM Down"));
        await expect(meshConfigProvider.refreshConfig()).rejects.toThrow("CM Down");
        expect(meshConfigProvider['lastLoadedConfig']).toBeUndefined(); // Cache cleared
        expect(mockLogger.error).toHaveBeenCalledWith(
            '[MeshConfigProvider] Failed to refresh mesh configuration',
            { error: "CM Down" }
        );
    });
  });

  describe('Configuration Accessors', () => {
    beforeEach(async () => {
      // Ensure config is loaded before each test in this block
      await meshConfigProvider.refreshConfig();
    });

    test('getAggregatedConfig should return the full loaded configuration', async () => {
      const config = await meshConfigProvider.getAggregatedConfig();
      expect(config.globalSettings).toEqual(mockGlobalSettings);
      expect(config.routingRules).toEqual(mockRoutingRules);
      expect(config.securityPolicies).toEqual(mockSecurityPolicies);
    });

    test('getGlobalSettings should return only global settings part', async () => {
      const settings = await meshConfigProvider.getGlobalSettings();
      expect(settings).toEqual(mockGlobalSettings);
      expect(settings).not.toHaveProperty('routingRules'); // Check it's not the whole CM global config
    });

    test('getConfigSection should return a specific section like routingRules', async () => {
      const rules = await meshConfigProvider.getConfigSection<RouteRule[]>('routingRules');
      expect(rules).toEqual(mockRoutingRules);
    });
    
    test('getConfigSection should return undefined for non-existent section', async () => {
      // Assuming 'nonExistentSection' is not a key in AggregatedMeshConfig
      const section = await meshConfigProvider.getConfigSection<any>('featureFlags' as any); // Cast for test
      expect(section).toBeUndefined();
    });

    test('getServiceEffectiveConfig should delegate to ConfigurationManager', async () => {
      const serviceId = 'testService';
      const expectedServiceConfig: MeshServiceConfig = { timeoutMs: 1000, retries: 1 };
      mockCM.getServiceConfig.mockResolvedValueOnce(expectedServiceConfig); // Ensure this specific call returns this

      const serviceConfig = await meshConfigProvider.getServiceEffectiveConfig(serviceId);
      expect(mockCM.getServiceConfig).toHaveBeenCalledWith(serviceId);
      expect(serviceConfig).toEqual(expectedServiceConfig);
      expect(mockLogger.debug).toHaveBeenCalledWith(`[MeshConfigProvider] Getting effective config for service: ${serviceId}`);
    });
  });
});