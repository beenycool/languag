// src/mesh/__tests__/features/traffic/circuit-breaker.spec.ts
import { MeshCircuitBreaker, MeshCircuitBreakerOptions, CircuitBreakerState } from '../../../features/traffic/circuit-breaker';
import { CircuitBreaker as CoreCircuitBreaker, ICircuitBreaker as ICoreCircuitBreaker } from '../../../../microservices/resilience/circuit/circuit-breaker';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

jest.mock('../../../../microservices/resilience/circuit/circuit-breaker'); // Mock the core CircuitBreaker

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('MeshCircuitBreaker', () => {
  let meshCb: MeshCircuitBreaker;
  let mockCoreCb: jest.Mocked<ICoreCircuitBreaker>; // Use jest.Mocked for type safety with mocks
  const serviceId = 'test-service';
  const meshCbOptions: MeshCircuitBreakerOptions = {
    serviceId,
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 5000,
  };

  beforeEach(() => {
    // Reset mocks for CoreCircuitBreaker constructor and its instance methods
    (CoreCircuitBreaker as jest.Mock).mockClear();
    
    // Create a fresh mock instance for each test
    mockCoreCb = {
      execute: jest.fn(),
      getState: jest.fn().mockReturnValue(CircuitBreakerState.CLOSED),
      open: jest.fn(),
      close: jest.fn(),
      halfOpen: jest.fn(),
      dispose: jest.fn(), // Assuming ICoreCircuitBreaker might have dispose or the class does
    } as jest.Mocked<ICoreCircuitBreaker>;

    // If CoreCircuitBreaker constructor is called by MeshCircuitBreaker,
    // ensure the mock constructor returns our mockCoreCb.
    // The current MeshCircuitBreaker takes an ICoreCircuitBreaker in its constructor.
    // So we pass mockCoreCb directly.

    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    
    meshCb = new MeshCircuitBreaker(mockCoreCb, meshCbOptions, mockLogger);
  });

  test('should initialize and log creation', () => {
    expect(meshCb.getServiceId()).toBe(serviceId);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `[MeshCB:${serviceId}] MeshCircuitBreaker initialized for service: ${serviceId}`
    );
  });

  describe('Method Delegation to CoreCircuitBreaker', () => {
    test('execute should delegate to coreCircuitBreaker.execute', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      mockCoreCb.execute.mockResolvedValueOnce('success from core');
      
      const result = await meshCb.execute(operation);
      
      expect(mockCoreCb.execute).toHaveBeenCalledWith(operation);
      expect(result).toBe('success from core');
      expect(mockLogger.debug).toHaveBeenCalledWith(`[MeshCB:${serviceId}] Executing operation via mesh circuit breaker.`);
    });

    test('getState should delegate to coreCircuitBreaker.getState', () => {
      mockCoreCb.getState.mockReturnValueOnce(CircuitBreakerState.OPEN);
      expect(meshCb.getState()).toBe(CircuitBreakerState.OPEN);
      expect(mockCoreCb.getState).toHaveBeenCalledTimes(1);
    });

    test('open should delegate to coreCircuitBreaker.open', () => {
      meshCb.open();
      expect(mockCoreCb.open).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MeshCB:${serviceId}] Manually opening mesh circuit breaker.`);
    });

    test('close should delegate to coreCircuitBreaker.close', () => {
      meshCb.close();
      expect(mockCoreCb.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MeshCB:${serviceId}] Manually closing mesh circuit breaker.`);
    });

    test('halfOpen should delegate to coreCircuitBreaker.halfOpen', () => {
      meshCb.halfOpen();
      expect(mockCoreCb.halfOpen).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(`[MeshCB:${serviceId}] Manually setting mesh circuit breaker to half-open.`);
    });
    
    test('dispose should delegate to coreCircuitBreaker.dispose if it exists', () => {
      // Test case where core CB has dispose
      (mockCoreCb as any).dispose = jest.fn(); // Ensure dispose is a mock function
      meshCb.dispose();
      expect((mockCoreCb as any).dispose).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(`[MeshCB:${serviceId}] MeshCircuitBreaker disposed.`);

      // Test case where core CB might not have dispose (or it's optional on interface)
      const coreCbWithoutDispose = { ...mockCoreCb };
      delete (coreCbWithoutDispose as any).dispose;
      const meshCb2 = new MeshCircuitBreaker(coreCbWithoutDispose, meshCbOptions, mockLogger);
      expect(() => meshCb2.dispose()).not.toThrow(); // Should not throw if dispose is not there
    });
  });

  // Add more tests if MeshCircuitBreaker has its own logic beyond delegation,
  // e.g., reacting to state changes from the core CB, applying mesh-specific policies, etc.
});