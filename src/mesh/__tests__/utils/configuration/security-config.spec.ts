// src/mesh/__tests__/utils/configuration/security-config.spec.ts
import { SecurityConfigProvider, MeshSecuritySettings } from '../../../utils/configuration/security-config';
import { IMeshConfigProvider } from '../../../utils/configuration/mesh-config';
import { MeshGlobalConfig } from '../../../core/control/configuration-manager';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

// Mock IMeshConfigProvider
const mockMeshConfigProvider: jest.Mocked<IMeshConfigProvider> = {
  getAggregatedConfig: jest.fn(),
  getConfigSection: jest.fn(),
  getGlobalSettings: jest.fn(),
  getServiceEffectiveConfig: jest.fn(),
  refreshConfig: jest.fn().mockResolvedValue(undefined),
};

describe('SecurityConfigProvider', () => {
  let securityConfigProvider: SecurityConfigProvider;

  const mockGlobalMeshSettings: MeshGlobalConfig = {
    // These are from MeshGlobalConfig
    defaultTimeoutMs: 3000,
    defaultRetries: 1,
    // These are the specific fields SecurityConfigProvider looks for
    mTLSEnabled: true,
    defaultAuthPolicy: 'default-jwt',
    permissiveMode: false,
    certificateAuthority: { type: 'INTERNAL' },
    allowedCipherSuites: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256'],
    egressPolicy: 'REGISTRY_ONLY',
  };
  
  const expectedSecuritySettings: MeshSecuritySettings = {
    mTLSEnabled: true,
    defaultAuthPolicy: 'default-jwt',
    permissiveMode: false,
    certificateAuthority: { type: 'INTERNAL' },
    allowedCipherSuites: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256'],
    egressPolicy: 'REGISTRY_ONLY',
  };


  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    mockMeshConfigProvider.getGlobalSettings.mockClear();
    mockMeshConfigProvider.refreshConfig.mockClear();
    
    mockMeshConfigProvider.getGlobalSettings.mockResolvedValue(mockGlobalMeshSettings);

    securityConfigProvider = new SecurityConfigProvider(mockMeshConfigProvider, mockLogger);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with MeshConfigProvider', () => {
      expect(securityConfigProvider['meshConfigProvider']).toBe(mockMeshConfigProvider);
      expect(mockLogger.info).toHaveBeenCalledWith('[SecurityConfigProvider] SecurityConfigProvider initialized.');
    });
  });

  describe('refreshSecuritySettings and ensureSettingsLoaded', () => {
    test('refreshSecuritySettings should fetch global settings and extract security settings', async () => {
      await securityConfigProvider.refreshSecuritySettings();
      
      expect(mockMeshConfigProvider.getGlobalSettings).toHaveBeenCalledTimes(1);
      // If refreshConfig on meshConfigProvider is called, it would be 1 too.
      // Current impl calls it if it exists.
      if (typeof mockMeshConfigProvider.refreshConfig === 'function') {
        expect(mockMeshConfigProvider.refreshConfig).toHaveBeenCalledTimes(1);
      }
      
      const loadedSettings = securityConfigProvider['lastLoadedSettings'];
      expect(loadedSettings).toEqual(expectedSecuritySettings);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[SecurityConfigProvider] Mesh security settings refreshed.',
        expectedSecuritySettings
      );
    });

    test('ensureSettingsLoaded should call refreshSecuritySettings if not loaded', async () => {
      const refreshSpy = jest.spyOn(securityConfigProvider, 'refreshSecuritySettings');
      expect(securityConfigProvider['lastLoadedSettings']).toBeUndefined();
      await securityConfigProvider['ensureSettingsLoaded']();
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(securityConfigProvider['lastLoadedSettings']).toEqual(expectedSecuritySettings);
      refreshSpy.mockRestore();
    });

    test('ensureSettingsLoaded should not call refresh if already loaded', async () => {
      await securityConfigProvider.refreshSecuritySettings(); // Load once
      const refreshSpy = jest.spyOn(securityConfigProvider, 'refreshSecuritySettings');
      mockMeshConfigProvider.getGlobalSettings.mockClear();

      await securityConfigProvider['ensureSettingsLoaded'](); // Should use cache
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(mockMeshConfigProvider.getGlobalSettings).not.toHaveBeenCalled();
      refreshSpy.mockRestore();
    });
    
    test('refreshSecuritySettings should set lastLoadedSettings to undefined if getGlobalSettings returns null/undefined', async () => {
        mockMeshConfigProvider.getGlobalSettings.mockResolvedValueOnce(null as any); // Simulate no global settings
        await securityConfigProvider.refreshSecuritySettings();
        expect(securityConfigProvider['lastLoadedSettings']).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith('[SecurityConfigProvider] No global settings found to extract security settings.');
    });
  });

  describe('Security Settings Accessors', () => {
    beforeEach(async () => {
      // Ensure settings are loaded
      await securityConfigProvider.refreshSecuritySettings();
    });

    test('getMeshSecuritySettings should return the loaded security settings', async () => {
      const settings = await securityConfigProvider.getMeshSecuritySettings();
      expect(settings).toEqual(expectedSecuritySettings);
    });

    test('isMTLSEnabled should return the mTLSEnabled flag, defaulting to false', async () => {
      expect(await securityConfigProvider.isMTLSEnabled()).toBe(true);

      // Test default
      const specificGlobalSettings: MeshGlobalConfig = { ...mockGlobalMeshSettings, mTLSEnabled: undefined };
      mockMeshConfigProvider.getGlobalSettings.mockResolvedValueOnce(specificGlobalSettings);
      await securityConfigProvider.refreshSecuritySettings();
      expect(await securityConfigProvider.isMTLSEnabled()).toBe(false); // Default
      
      const falseGlobalSettings: MeshGlobalConfig = { ...mockGlobalMeshSettings, mTLSEnabled: false };
      mockMeshConfigProvider.getGlobalSettings.mockResolvedValueOnce(falseGlobalSettings);
      await securityConfigProvider.refreshSecuritySettings();
      expect(await securityConfigProvider.isMTLSEnabled()).toBe(false);
    });

    test('getCertificateAuthorityConfig should return the CA config', async () => {
      const caConfig = await securityConfigProvider.getCertificateAuthorityConfig();
      expect(caConfig).toEqual(expectedSecuritySettings.certificateAuthority);
    });
    
    test('accessors should return null/default if settings not loaded or field absent', async () => {
        // Simulate settings not being loaded properly (e.g., refresh failed and didn't throw in ensure)
        securityConfigProvider['lastLoadedSettings'] = undefined;
        mockMeshConfigProvider.getGlobalSettings.mockResolvedValueOnce(null as any); // Next refresh will yield no settings
        
        expect(await securityConfigProvider.getMeshSecuritySettings()).toBeNull();
        expect(await securityConfigProvider.isMTLSEnabled()).toBe(false); // Default
        expect(await securityConfigProvider.getCertificateAuthorityConfig()).toBeUndefined();
    });
  });
});