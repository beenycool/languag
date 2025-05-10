// src/mesh/__tests__/utils/routing/route-manager.spec.ts
import { RouteManager, RouteRule, HttpRouteMatch, HttpRouteAction, ResolvedRoute } from '../../../utils/routing/route-manager';
// Corrected path to the mocks directory at src/mesh/__tests__/__mocks__
import { ConfigurationManager, mockConfigurationManagerInstance } from '../../__mocks__/configuration-manager';
import { MeshGlobalConfig } from '../../../core/control/configuration-manager'; // Import type from actual implementation
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

// Corrected path for jest.mock as well
jest.mock('../../../core/control/configuration-manager');

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('RouteManager', () => {
  let routeManager: RouteManager;
  let mockCM: typeof mockConfigurationManagerInstance;

  const rule1Action: HttpRouteAction = { targetService: 'serviceA', targetPort: 8080 };
  const rule1Match: HttpRouteMatch = { pathPrefix: '/service-a' };
  const rule1: RouteRule = { id: 'rule-a', priority: 10, matches: [rule1Match], action: rule1Action };

  const rule2Action: HttpRouteAction = { targetService: 'serviceB', rewrite: { pathPrefix: '/v2/internal' } };
  const rule2Match: HttpRouteMatch = { pathExact: '/service-b/data', methods: ['POST'] };
  const rule2: RouteRule = { id: 'rule-b', priority: 5, matches: [rule2Match], action: rule2Action };
  
  const rule3Action: HttpRouteAction = { targetService: 'serviceC' };
  const rule3MatchHeader: HttpRouteMatch = { headers: [{ name: 'x-custom-header', exactValue: 'route-to-c' }]};
  const rule3: RouteRule = { id: 'rule-c-header', priority: 20, matches: [rule3MatchHeader], action: rule3Action };

  const rule4Action: HttpRouteAction = { targetService: 'serviceD' };
  const rule4MatchQuery: HttpRouteMatch = { queryParams: [{ name: 'version', exactValue: 'beta' }]};
  const rule4: RouteRule = { id: 'rule-d-query', priority: 15, matches: [rule4MatchQuery], action: rule4Action };

  const rule5Action: HttpRouteAction = { targetService: 'serviceE-regex' };
  const rule5MatchRegex: HttpRouteMatch = { pathRegex: '^/user/([a-zA-Z0-9]+)/profile$' }; // Captures user ID
  const rule5: RouteRule = { id: 'rule-e-regex', priority: 25, matches: [rule5MatchRegex], action: rule5Action };


  const sampleRoutingRules: RouteRule[] = [rule1, rule2, rule3, rule4, rule5];

  beforeEach(async () => {
    mockConfigurationManagerInstance.reset();
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    
    mockCM = mockConfigurationManagerInstance;
    mockCM.getGlobalConfig.mockResolvedValue({ routingRules: [...sampleRoutingRules] } as MeshGlobalConfig);

    routeManager = new RouteManager(new ConfigurationManager() as any, mockLogger);
    await routeManager.loadRoutingRules();
    (mockLogger.info as jest.Mock).mockClear(); // Clear logs after initial load
    (mockLogger.debug as jest.Mock).mockClear();
  });

  describe('Initialization and Rule Loading', () => {
    test('should load and sort routing rules by priority', () => {
      expect(mockCM.getGlobalConfig).toHaveBeenCalledTimes(1);
      const loadedRules = routeManager['routingRules'];
      expect(loadedRules).toHaveLength(sampleRoutingRules.length);
      expect(loadedRules[0].id).toBe(rule2.id); // Priority 5
      expect(loadedRules[1].id).toBe(rule1.id); // Priority 10
      expect(loadedRules[2].id).toBe(rule4.id); // Priority 15
      expect(loadedRules[3].id).toBe(rule3.id); // Priority 20
      expect(loadedRules[4].id).toBe(rule5.id); // Priority 25
    });

    test('should handle empty or missing routing rules in configuration', async () => {
      mockCM.getGlobalConfig.mockResolvedValueOnce({ routingRules: [] } as MeshGlobalConfig);
      await routeManager.loadRoutingRules();
      expect(routeManager['routingRules']).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('[RouteManager] No routing rules found or in unexpected format in configuration.');
      
      mockCM.getGlobalConfig.mockResolvedValueOnce({} as MeshGlobalConfig); // No routingRules key
      await routeManager.loadRoutingRules();
      expect(routeManager['routingRules']).toEqual([]);
    });
    
    test('should clear rules if loading fails', async () => {
      mockCM.getGlobalConfig.mockRejectedValueOnce(new Error("Config load failed for routes"));
      await routeManager.loadRoutingRules();
      expect(routeManager['routingRules']).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('[RouteManager] Failed to load routing rules', {error: "Config load failed for routes"});
    });
  });

  describe('findMatch', () => {
    test('should match by pathPrefix (rule1)', async () => {
      const context = { path: '/service-a/some/resource', method: 'GET' };
      const result = await routeManager.findMatch(context);
      expect(result).not.toBeNull();
      expect(result?.matchedRule.id).toBe(rule1.id);
      expect(result?.effectiveAction.targetService).toBe('serviceA');
    });

    test('should match by pathExact and method (rule2)', async () => {
      const context = { path: '/service-b/data', method: 'POST' };
      const result = await routeManager.findMatch(context);
      expect(result).not.toBeNull();
      expect(result?.matchedRule.id).toBe(rule2.id);
      expect(result?.effectiveAction.targetService).toBe('serviceB');
      expect(result?.effectiveAction.rewrite?.pathPrefix).toBe('/v2/internal');
    });

    test('should not match rule2 if method is different', async () => {
      const context = { path: '/service-b/data', method: 'GET' }; // Rule2 expects POST
      const result = await routeManager.findMatch(context);
      // It might match another rule or default to null if no other rule matches /service-b/data with GET
      // Assuming no other rule matches this specific path for GET, it should be null or a broader match.
      // Given current rules, it will be null.
      expect(result).toBeNull();
    });
    
    test('should match by header exactValue (rule3)', async () => {
      const context = { path: '/any/path', method: 'GET', headers: { 'x-custom-header': 'route-to-c' } };
      const result = await routeManager.findMatch(context);
      expect(result).not.toBeNull();
      expect(result?.matchedRule.id).toBe(rule3.id);
      expect(result?.effectiveAction.targetService).toBe('serviceC');
    });

    test('should not match rule3 if header value is different or header absent', async () => {
      let context: any = { path: '/any/path', method: 'GET', headers: { 'x-custom-header': 'wrong-value' } };
      expect(await routeManager.findMatch(context)).toBeNull();
      context = { path: '/any/path', method: 'GET', headers: { 'other-header': 'route-to-c' } as Record<string, string> };
      expect(await routeManager.findMatch(context)).toBeNull();
    });

    test('should match by queryParams exactValue (rule4)', async () => {
      const context = { path: '/product/search', method: 'GET', queryParams: { version: 'beta', q: 'test' } };
      const result = await routeManager.findMatch(context);
      expect(result).not.toBeNull();
      expect(result?.matchedRule.id).toBe(rule4.id);
      expect(result?.effectiveAction.targetService).toBe('serviceD');
    });
    
    test('should not match rule4 if query param value is different or absent', async () => {
      let context: any = { path: '/product/search', method: 'GET', queryParams: { version: 'stable' } };
      expect(await routeManager.findMatch(context)).toBeNull();
      context = { path: '/product/search', method: 'GET', queryParams: { otherparam: 'beta' } as Record<string, string> };
      expect(await routeManager.findMatch(context)).toBeNull();
    });

    test('should match by pathRegex (rule5)', async () => {
      const context = { path: '/user/user123/profile', method: 'GET' };
      const result = await routeManager.findMatch(context);
      expect(result).not.toBeNull();
      expect(result?.matchedRule.id).toBe(rule5.id);
      expect(result?.effectiveAction.targetService).toBe('serviceE-regex');
      // TODO: Test pathParams extraction if implemented: expect(result?.pathParams?.userId).toBe('user123');
    });

    test('should return null if no rules match', async () => {
      const context = { path: '/unmatched/path', method: 'PUT' };
      const result = await routeManager.findMatch(context);
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('[RouteManager] No matching route rule found for request.');
    });
    
    test('should respect rule priority (rule2 before rule1 if paths could overlap)', async () => {
      // Create a scenario where a more general rule (like rule1's prefix) could match,
      // but a more specific, higher-priority rule (like rule2) should take precedence.
      // This is already handled by the sorted list, but a specific test case can be illustrative.
      // For example, if rule1 was `/service` and rule2 was `/service/b/data` with higher priority.
      // The current rules don't have direct path overlap that tests priority well without method diff.
      
      // Let's test with the existing sorted order: rule2 (priority 5) vs rule1 (priority 10)
      // If a request matches rule2, it should be chosen even if it *could* also match rule1.
      // The current rule2 is very specific (exact path + method), so it won't overlap with rule1's prefix in a confusing way.
      // This test is more about confirming the loop processes in order.
      const contextForRule2 = { path: '/service-b/data', method: 'POST' };
      const result = await routeManager.findMatch(contextForRule2);
      expect(result?.matchedRule.id).toBe(rule2.id); // Rule2 is higher priority
    });

    test('should correctly handle header matching with case-insensitivity (conceptual)', async () => {
        // The current implementation uses toLowerCase() on request header names.
        // The HttpHeaderMatch.name should ideally be matched case-insensitively too.
        // Let's assume rule3's header name is 'x-custom-header'.
        const context = { path: '/any/path', method: 'GET', headers: { 'X-CUSTOM-HEADER': 'route-to-c' } }; // Uppercase request header
        const result = await routeManager.findMatch(context);
        expect(result).not.toBeNull();
        expect(result?.matchedRule.id).toBe(rule3.id);
    });

    test('should correctly handle header present/absent checks', async () => {
        const rulePresent: RouteRule = { id: 'header-present', priority: 1, matches: [{ headers: [{ name: 'x-must-be-present', present: true }] }], action: { targetService: 'presentService' }};
        const ruleAbsent: RouteRule = { id: 'header-absent', priority: 2, matches: [{ headers: [{ name: 'x-must-be-absent', present: false }] }], action: { targetService: 'absentService' }};
        mockCM.getGlobalConfig.mockResolvedValueOnce({ routingRules: [rulePresent, ruleAbsent] } as MeshGlobalConfig);
        await routeManager.loadRoutingRules();

        let context: any = { path: '/', method: 'GET', headers: { 'x-must-be-present': 'anyValue' } };
        expect((await routeManager.findMatch(context))?.matchedRule.id).toBe('header-present');
        
        context = { path: '/', method: 'GET', headers: { 'some-other-header': 'value' } as Record<string, string> }; // x-must-be-present is absent
        expect((await routeManager.findMatch(context))?.matchedRule.id).toBe('header-absent'); // x-must-be-absent is also absent

        context = { path: '/', method: 'GET', headers: { 'x-must-be-absent': 'anyValue' } as Record<string, string> }; // x-must-be-absent is present
        expect(await routeManager.findMatch(context)).toBeNull(); // Neither rule matches
    });
  });
});