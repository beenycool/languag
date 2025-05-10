// src/mesh/__tests__/features/security/policy-enforcer.spec.ts
import { PolicyEnforcer, PolicyEvaluationContext, SecurityPolicy, PolicyDecision } from '../../../features/security/policy-enforcer';
// Corrected path to the mocks directory at src/mesh/__tests__/__mocks__
import { ConfigurationManager, mockConfigurationManagerInstance } from '../../__mocks__/configuration-manager';
import { MeshGlobalConfig } from '../../../core/control/configuration-manager'; // Import type from actual implementation
import { AuthContext } from '../../../features/security/auth-manager';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

// Corrected path for jest.mock as well
jest.mock('../../../core/control/configuration-manager');

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('PolicyEnforcer', () => {
  let policyEnforcer: PolicyEnforcer;
  let mockCM: typeof mockConfigurationManagerInstance;

  const user1AuthContext: AuthContext = { isAuthenticated: true, userId: 'user1', groups: ['groupA'] };
  const serviceAAuthContext: AuthContext = { isAuthenticated: true, userId: 'serviceA-principal', groups: ['internal-services'] };
  const unauthenticatedAuthContext: AuthContext = { isAuthenticated: false };

  const samplePolicies: SecurityPolicy[] = [
    { id: 'allow-serviceA-to-serviceB-port80', action: 'ALLOW', source: { principals: ['serviceA-principal'] }, destination: { services: ['serviceB'], ports: [80] } },
    { id: 'allow-user1-to-serviceB-path-data', action: 'ALLOW', source: { principals: ['user1'] }, destination: { services: ['serviceB'], paths: [{ pathPrefix: '/data' }] } },
    { id: 'deny-all-to-serviceC-admin', action: 'DENY', destination: { services: ['serviceC'], paths: [{ pathPrefix: '/admin' }] } },
    { id: 'allow-groupA-http-get-serviceD', action: 'ALLOW', source: { principals: ['user1'] /* Assuming user1 is in groupA, policy matches on principal for simplicity */ }, destination: { services: ['serviceD'], paths: [{ pathPrefix: '/public', methods: ['GET'] }] } },
    { id: 'default-deny-all-else', action: 'DENY' } // A catch-all deny, though PolicyEnforcer has implicit deny
  ];

  beforeEach(async () => {
    mockConfigurationManagerInstance.reset();
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });

    mockCM = mockConfigurationManagerInstance;
    // Simulate ConfigurationManager returning our sample policies
    mockCM.getGlobalConfig.mockResolvedValue({ securityPolicies: samplePolicies } as MeshGlobalConfig);

    policyEnforcer = new PolicyEnforcer(new ConfigurationManager() as any, mockLogger);
    await policyEnforcer.loadPolicies(); // Load policies during setup
    (mockLogger.info as jest.Mock).mockClear(); // Clear logs after initial load
    (mockLogger.debug as jest.Mock).mockClear();
  });

  describe('Policy Loading', () => {
    test('should load policies from ConfigurationManager on loadPolicies()', async () => {
      expect(mockCM.getGlobalConfig).toHaveBeenCalledTimes(1); // Called during new PolicyEnforcer -> loadPolicies
      expect(policyEnforcer['policies']).toEqual(samplePolicies);
      // Log for successful load was cleared, but we can re-trigger if needed for specific test
    });

    test('should handle empty or missing policies in configuration', async () => {
      mockCM.getGlobalConfig.mockResolvedValueOnce({ securityPolicies: [] } as MeshGlobalConfig);
      await policyEnforcer.loadPolicies();
      expect(policyEnforcer['policies']).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('[PolicyEnforcer] No security policies found or in unexpected format in configuration.');
      
      mockCM.getGlobalConfig.mockResolvedValueOnce({} as MeshGlobalConfig); // No securityPolicies key
      await policyEnforcer.loadPolicies();
      expect(policyEnforcer['policies']).toEqual([]);
    });
    
    test('should clear policies if loading fails', async () => {
      mockCM.getGlobalConfig.mockRejectedValueOnce(new Error("Config load failed"));
      await policyEnforcer.loadPolicies();
      expect(policyEnforcer['policies']).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('[PolicyEnforcer] Failed to load security policies', {error: "Config load failed"});
    });
  });

  describe('Policy Evaluation', () => {
    test('should default to deny if no policies are loaded', async () => {
      mockCM.getGlobalConfig.mockResolvedValueOnce({ securityPolicies: [] }); // No policies
      await policyEnforcer.loadPolicies();
      const context: PolicyEvaluationContext = { sourceService: 'serviceX', destinationService: 'serviceY' };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('No policies loaded');
    });

    test('should allow based on source principal, destination service, and port', async () => {
      const context: PolicyEvaluationContext = {
        authContext: serviceAAuthContext, // source principal is serviceA-principal
        sourceService: 'serviceA', // Can also be used if policy matches on service name
        destinationService: 'serviceB',
        destinationPort: 80,
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(true);
      expect(decision.matchedPolicyId).toBe('allow-serviceA-to-serviceB-port80');
    });

    test('should deny if source principal does not match an ALLOW policy', async () => {
      const context: PolicyEvaluationContext = {
        authContext: { isAuthenticated: true, userId: 'other-service' },
        destinationService: 'serviceB',
        destinationPort: 80,
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false); // Falls through to default deny
      expect(decision.reason).toContain('Default deny');
    });

    test('should allow based on user principal, destination service, and path prefix', async () => {
      const context: PolicyEvaluationContext = {
        authContext: user1AuthContext,
        destinationService: 'serviceB',
        path: '/data/items/123',
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(true);
      expect(decision.matchedPolicyId).toBe('allow-user1-to-serviceB-path-data');
    });

    test('should deny based on explicit DENY policy for a path', async () => {
      const context: PolicyEvaluationContext = {
        authContext: user1AuthContext, // Even if user1 is allowed elsewhere
        destinationService: 'serviceC',
        path: '/admin/users',
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.matchedPolicyId).toBe('deny-all-to-serviceC-admin');
    });
    
    test('should allow based on path prefix and method', async () => {
      const context: PolicyEvaluationContext = {
        authContext: user1AuthContext, // In groupA
        destinationService: 'serviceD',
        path: '/public/info',
        method: 'GET',
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(true);
      expect(decision.matchedPolicyId).toBe('allow-groupA-http-get-serviceD');
    });

    test('should deny if method does not match an ALLOW policy with method restrictions', async () => {
      const context: PolicyEvaluationContext = {
        authContext: user1AuthContext,
        destinationService: 'serviceD',
        path: '/public/info',
        method: 'POST', // Policy only allows GET
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false); // Falls to default deny
    });

    test('should default to deny if no specific policy matches', async () => {
      const context: PolicyEvaluationContext = {
        authContext: user1AuthContext,
        destinationService: 'serviceUnknown',
        path: '/some/path',
      };
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Default deny: No matching policy found.');
    });
    
    test('should handle unauthenticated context correctly (usually denied unless policy explicitly allows unauthenticated)', async () => {
      const context: PolicyEvaluationContext = {
        authContext: unauthenticatedAuthContext,
        destinationService: 'serviceB',
        path: '/data/items/123', // Path user1 can access
      };
      // The current sample policies require authenticated principals.
      const decision = await policyEnforcer.evaluate(context);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Default deny');
    });
  });
});