// src/mesh/__tests__/utils/configuration/policy-config.spec.ts
import { PolicyConfigProvider } from '../../../utils/configuration/policy-config';
import { IMeshConfigProvider } from '../../../utils/configuration/mesh-config';
import { SecurityPolicy } from '../../../features/security/policy-enforcer';
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
  refreshConfig: jest.fn().mockResolvedValue(undefined), // Ensure refreshConfig is a mock
};


describe('PolicyConfigProvider', () => {
  let policyConfigProvider: PolicyConfigProvider;

  const policy1: SecurityPolicy = { id: 'p1', action: 'ALLOW', source: { principals: ['serviceA'] }, destination: { services: ['serviceB'] } };
  const policy2: SecurityPolicy = { id: 'p2', action: 'DENY', destination: { services: ['serviceC'] } };
  const policy3: SecurityPolicy = { id: 'p3', action: 'ALLOW', source: { principals: ['userX'] }, destination: { services: ['serviceA'] } };
  const samplePolicies: SecurityPolicy[] = [policy1, policy2, policy3];

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    mockMeshConfigProvider.getConfigSection.mockClear();
    mockMeshConfigProvider.refreshConfig.mockClear(); // Clear this mock too
    
    // Setup default mock behavior for getConfigSection to return our sample policies
    mockMeshConfigProvider.getConfigSection.mockImplementation(async (sectionKey) => {
      if (sectionKey === 'securityPolicies') {
        return Promise.resolve(samplePolicies as any); // Cast as any if type is complex
      }
      return Promise.resolve(undefined);
    });

    policyConfigProvider = new PolicyConfigProvider(mockMeshConfigProvider, mockLogger);
  });

  describe('Initialization', () => {
    test('should initialize with MeshConfigProvider', () => {
      expect(policyConfigProvider['meshConfigProvider']).toBe(mockMeshConfigProvider);
      expect(mockLogger.info).toHaveBeenCalledWith('[PolicyConfigProvider] PolicyConfigProvider initialized.');
    });
  });

  describe('refreshPolicies and ensurePoliciesLoaded', () => {
    test('refreshPolicies should call refreshConfig on meshConfigProvider and load policies', async () => {
      await policyConfigProvider.refreshPolicies();
      expect(mockMeshConfigProvider.refreshConfig).toHaveBeenCalledTimes(1);
      expect(mockMeshConfigProvider.getConfigSection).toHaveBeenCalledWith('securityPolicies');
      expect(policyConfigProvider['lastLoadedPolicies']).toEqual(samplePolicies);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[PolicyConfigProvider] Security policies refreshed, loaded ${samplePolicies.length} policies.`
      );
    });

    test('ensurePoliciesLoaded should call refreshPolicies if not loaded', async () => {
      const refreshSpy = jest.spyOn(policyConfigProvider, 'refreshPolicies');
      expect(policyConfigProvider['lastLoadedPolicies']).toBeUndefined();
      await policyConfigProvider['ensurePoliciesLoaded']();
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(policyConfigProvider['lastLoadedPolicies']).toEqual(samplePolicies);
      refreshSpy.mockRestore();
    });

    test('ensurePoliciesLoaded should not call refreshPolicies if already loaded', async () => {
      await policyConfigProvider.refreshPolicies(); // Load once
      const refreshSpy = jest.spyOn(policyConfigProvider, 'refreshPolicies');
      mockMeshConfigProvider.getConfigSection.mockClear();

      await policyConfigProvider['ensurePoliciesLoaded'](); // Should use cache
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(mockMeshConfigProvider.getConfigSection).not.toHaveBeenCalled();
      refreshSpy.mockRestore();
    });
    
    test('refreshPolicies should handle empty policies from provider', async () => {
        mockMeshConfigProvider.getConfigSection.mockResolvedValueOnce(undefined); // Simulate no policies
        await policyConfigProvider.refreshPolicies();
        expect(policyConfigProvider['lastLoadedPolicies']).toEqual([]);
        expect(mockLogger.info).toHaveBeenCalledWith(
            `[PolicyConfigProvider] Security policies refreshed, loaded 0 policies.`
        );
    });
  });

  describe('Policy Accessors', () => {
    beforeEach(async () => {
      // Ensure policies are loaded for these tests
      await policyConfigProvider.refreshPolicies();
    });

    test('getAllSecurityPolicies should return all loaded policies', async () => {
      const policies = await policyConfigProvider.getAllSecurityPolicies();
      expect(policies).toEqual(samplePolicies);
    });

    test('getSecurityPolicyById should return the correct policy or null', async () => {
      let policy = await policyConfigProvider.getSecurityPolicyById('p1');
      expect(policy).toEqual(policy1);
      policy = await policyConfigProvider.getSecurityPolicyById('non-existent-id');
      expect(policy).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('[PolicyConfigProvider] Security policy with ID not found: non-existent-id');
    });

    test('findPoliciesForService should find policies where service is a source principal', async () => {
      const policiesForA = await policyConfigProvider.findPoliciesForService('serviceA', 'source');
      expect(policiesForA).toHaveLength(1);
      expect(policiesForA).toContain(policy1);
    });

    test('findPoliciesForService should find policies where service is a destination service', async () => {
      const policiesForB = await policyConfigProvider.findPoliciesForService('serviceB', 'destination');
      expect(policiesForB).toHaveLength(1);
      expect(policiesForB).toContain(policy1);
    });
    
    test('findPoliciesForService should find policies where service is in any role (source or destination)', async () => {
      const policiesForA_any = await policyConfigProvider.findPoliciesForService('serviceA', 'any');
      expect(policiesForA_any).toHaveLength(2); // policy1 (source), policy3 (destination)
      expect(policiesForA_any).toContain(policy1);
      expect(policiesForA_any).toContain(policy3);

      const policiesForUserX_any = await policyConfigProvider.findPoliciesForService('userX'); // Default is 'any'
      expect(policiesForUserX_any).toHaveLength(1);
      expect(policiesForUserX_any).toContain(policy3);
    });

    test('findPoliciesForService should return empty array if no matching policies', async () => {
      const policies = await policyConfigProvider.findPoliciesForService('serviceUnknown');
      expect(policies).toEqual([]);
    });
    
    test('findPoliciesForService should return all policies if serviceId is empty/null (as per current impl)', async () => {
        const policies = await policyConfigProvider.findPoliciesForService('');
        expect(policies).toEqual(samplePolicies);
    });
  });
});