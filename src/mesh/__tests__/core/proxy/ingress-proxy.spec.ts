// src/mesh/__tests__/core/proxy/ingress-proxy.spec.ts
import { IngressProxy, IngressRequest, IngressResponse } from '../../../core/proxy/ingress-proxy';
import { ServiceRegistry, mockServiceRegistryInstance } from '../../__mocks__/service-registry'; // ServiceInstance will be imported from actual
import { ConfigurationManager, mockConfigurationManagerInstance } from '../../__mocks__/configuration-manager'; // MeshServiceConfig will be imported from actual
import { ServiceInstance } from '../../../core/control/service-registry'; // Import type from actual implementation
import { MeshServiceConfig } from '../../../core/control/configuration-manager'; // Import type from actual implementation
import { CircuitBreaker, CircuitBreakerState } from '../../../../microservices/resilience/circuit/circuit-breaker';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

jest.mock('../../../core/control/service-registry');
jest.mock('../../../core/control/configuration-manager');
// We might need to mock CircuitBreaker if its instantiation or methods are complex
// For now, IngressProxy creates them internally. We can spy on their methods.

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('IngressProxy', () => {
  let ingressProxy: IngressProxy;
  let mockSR: typeof mockServiceRegistryInstance;
  let mockCM: typeof mockConfigurationManagerInstance;

  const serviceAId = 'service-a';
  const serviceBId = 'service-b';

  const serviceAInstance1: ServiceInstance = { id: 'sa1', host: 'localhost', port: 3001, status: 'UP', version: 'v1' };
  const serviceBInstance1: ServiceInstance = { id: 'sb1', host: 'localhost', port: 3002, status: 'UP', version: 'v1' };
  
  const serviceAConfig: MeshServiceConfig = { timeoutMs: 1000 };
  const serviceBConfig: MeshServiceConfig = { timeoutMs: 1500, retries: 1 };


  beforeEach(() => {
    mockServiceRegistryInstance.reset();
    mockConfigurationManagerInstance.reset();
    (mockLogger.info as jest.Mock).mockClear();
    (mockLogger.debug as jest.Mock).mockClear();
    (mockLogger.warn as jest.Mock).mockClear();
    (mockLogger.error as jest.Mock).mockClear();

    // Mock return values for dependencies
    mockSR = mockServiceRegistryInstance;
    mockCM = mockConfigurationManagerInstance;

    mockSR.getServiceEndpoints.mockImplementation(async (sId) => {
      if (sId === serviceAId) return [serviceAInstance1];
      if (sId === serviceBId) return [serviceBInstance1];
      return [];
    });
    mockCM.getServiceConfig.mockImplementation(async (sId) => {
      if (sId === serviceAId) return serviceAConfig;
      if (sId === serviceBId) return serviceBConfig;
      return {}; // Default empty config
    });

    ingressProxy = new IngressProxy({
      logger: mockLogger,
      // The mocked constructors return our predefined mock instances.
      // We cast to 'any' then to the actual type to satisfy TypeScript in this test context,
      // acknowledging that our mock instance provides the necessary methods for IngressProxy.
      serviceRegistry: new ServiceRegistry() as any, // Effectively mockServiceRegistryInstance
      configManager: new ConfigurationManager() as any, // Effectively mockConfigurationManagerInstance
    });
  });

  afterEach(() => {
    ingressProxy.dispose();
    jest.clearAllMocks();
  });

  describe('Request Handling and Routing', () => {
    test('should route to service-a and return its mocked response', async () => {
      const request: IngressRequest = { host: 'api.example.com', path: '/service-a/data', method: 'GET', headers: {} };
      const response = await ingressProxy.handleRequest(request);

      expect(mockLogger.debug).toHaveBeenCalledWith('[IngressProxy] Handling incoming request', { host: request.host, path: request.path });
      expect(mockSR.getServiceEndpoints).toHaveBeenCalledWith(serviceAId);
      expect(mockCM.getServiceConfig).toHaveBeenCalledWith(serviceAId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[IngressProxy] Forwarding request to ${serviceAId}/${serviceAInstance1.id}`),
        // expect.anything() // Or more specific if needed
      );
      expect(response.statusCode).toBe(200);
      expect(response.body?.message).toContain(`Response from ${serviceAId}/${serviceAInstance1.id}`);
      expect(response.headers['X-Target-Service']).toBe(serviceAId);
    });

    test('should route to service-b and return its mocked response', async () => {
      const request: IngressRequest = { host: 'api.example.com', path: '/service-b/items', method: 'POST', headers: {}, body: { name: 'test' } };
      const response = await ingressProxy.handleRequest(request);

      expect(mockSR.getServiceEndpoints).toHaveBeenCalledWith(serviceBId);
      expect(mockCM.getServiceConfig).toHaveBeenCalledWith(serviceBId);
      expect(response.statusCode).toBe(200);
      expect(response.body?.message).toContain(`Response from ${serviceBId}/${serviceBInstance1.id}`);
      expect(response.headers['X-Target-Service']).toBe(serviceBId);
    });

    test('should return 404 if no route matches', async () => {
      const request: IngressRequest = { host: 'api.example.com', path: '/unknown-service/action', method: 'GET', headers: {} };
      const response = await ingressProxy.handleRequest(request);

      expect(response.statusCode).toBe(404);
      expect(response.body?.error).toBe('Not Found');
      expect(mockLogger.warn).toHaveBeenCalledWith('[IngressProxy] No route matched for request', { path: request.path });
    });

    test('should return 503 if no healthy instances found for a matched route', async () => {
      mockSR.getServiceEndpoints.mockResolvedValueOnce([]); // No instances for service-a
      const request: IngressRequest = { host: 'api.example.com', path: '/service-a/critical', method: 'GET', headers: {} };
      const response = await ingressProxy.handleRequest(request);

      expect(response.statusCode).toBe(503);
      expect(response.body?.error).toBe('Service Unavailable');
      expect(mockLogger.error).toHaveBeenCalledWith(`[IngressProxy] No healthy instances found for service: ${serviceAId}`);
    });
  });

  describe('Circuit Breaker Integration', () => {
    const failingServiceId = 'service-a'; // Use service-a for this
    const failingInstance = { ...serviceAInstance1, port: 9999 }; // Port 9999 simulates failure in current IngressProxy impl

    beforeEach(() => {
        // Ensure service-a endpoints return the failing instance for these tests
        mockSR.getServiceEndpoints.mockImplementation(async (sId) => {
            if (sId === failingServiceId) return [failingInstance];
            return [];
        });
    });

    test('should open circuit for a service after repeated failures', async () => {
      const request: IngressRequest = { host: 'api.example.com', path: `/${failingServiceId}/fail`, method: 'GET', headers: {} };
      
      // Default CB failureThreshold is 5. Let's simulate 5 failures.
      for (let i = 0; i < 5; i++) {
        const response = await ingressProxy.handleRequest(request);
        expect(response.statusCode).toBe(502); // Bad Gateway due to simulated backend failure
        expect(response.body?.details).toBe('Simulated backend failure');
      }

      // Circuit should now be OPEN for service-a
      const cb = ingressProxy['circuitBreakers'].get(failingServiceId); // Access private for test
      expect(cb).toBeDefined();
      expect(cb?.getState()).toBe(CircuitBreakerState.OPEN);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`[IngressProxy] Circuit open for ${failingServiceId}`), expect.anything());


      // Subsequent request should be rejected immediately by open circuit
      const responseAfterOpen = await ingressProxy.handleRequest(request);
      expect(responseAfterOpen.statusCode).toBe(503);
      expect(responseAfterOpen.body?.error).toContain('Circuit Open');
    });

    test('should transition to HALF_OPEN and close circuit on success', async () => {
        const request: IngressRequest = { host: 'api.example.com', path: `/${failingServiceId}/transient`, method: 'GET', headers: {} };
        const cbOptions = { failureThreshold: 1, successThreshold: 1, timeout: 50 }; // Quick timeout
        
        // Modify the CB for service-a for this specific test
        const cb = ingressProxy['getCircuitBreaker'](failingServiceId); // Ensure CB is created
        cb['options'] = {...cb['options'], ...cbOptions}; // Override options for test

        // 1. Fail once to open circuit
        await ingressProxy.handleRequest(request); // Will fail due to port 9999
        expect(cb.getState()).toBe(CircuitBreakerState.OPEN);

        // 2. Wait for timeout to go to HALF_OPEN
        await new Promise(resolve => setTimeout(resolve, cbOptions.timeout + 20));
        expect(cb.getState()).toBe(CircuitBreakerState.HALF_OPEN);
        
        // 3. Successful call in HALF_OPEN
        // Temporarily make the instance "succeed" by changing its port for the mock operation
        const successfulInstance = { ...failingInstance, port: 3001 };
        mockSR.getServiceEndpoints.mockResolvedValueOnce([successfulInstance]); // Next call gets this

        const successResponse = await ingressProxy.handleRequest(request);
        expect(successResponse.statusCode).toBe(200);
        expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // TODO:
  // - Test load balancing strategies if more complex than random.
  // - Test routing rules from ConfigurationManager if IngressProxy uses them.
  // - Test request/response transformation.
  // - Test authentication/authorization if IngressProxy handles it.
});