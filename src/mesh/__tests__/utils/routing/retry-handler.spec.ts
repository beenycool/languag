// src/mesh/__tests__/utils/routing/retry-handler.spec.ts
import { RetryHandler, RetryPolicy } from '../../../utils/routing/retry-handler';
// Corrected path to the mocks directory at src/mesh/__tests__/__mocks__
import { ConfigurationManager, mockConfigurationManagerInstance } from '../../__mocks__/configuration-manager';
import { MeshGlobalConfig } from '../../../core/control/configuration-manager'; // Import type from actual implementation
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

// Corrected path for jest.mock as well
jest.mock('../../../core/control/configuration-manager');
jest.useFakeTimers(); // Use fake timers for controlling setTimeout

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;
  let mockCM: typeof mockConfigurationManagerInstance;

  const policyFixed: RetryPolicy = { id: 'fixed-3-attempts', maxAttempts: 3, backoffStrategy: 'FIXED', initialIntervalMs: 100, retryOnHttpStatusCodes: [500, 503] };
  const policyExpo: RetryPolicy = { id: 'expo-2-attempts', maxAttempts: 2, backoffStrategy: 'EXPONENTIAL', initialIntervalMs: 50, multiplier: 2, maxIntervalMs: 500, retryOnHttpStatusCodes: [500] };
  const policyNoRetryCode: RetryPolicy = { id: 'no-retry-code', maxAttempts: 3, backoffStrategy: 'FIXED', initialIntervalMs: 10, retryOnHttpStatusCodes: [503] }; // Only retries on 503
  const policyGrpc: RetryPolicy = { id: 'grpc-unavailable', maxAttempts: 2, backoffStrategy: 'FIXED', initialIntervalMs: 10, retryOnGrpcStatusCodes: ['UNAVAILABLE'] };


  const sampleRetryPolicies: RetryPolicy[] = [policyFixed, policyExpo, policyNoRetryCode, policyGrpc];

  beforeEach(async () => {
    mockConfigurationManagerInstance.reset();
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    
    mockCM = mockConfigurationManagerInstance;
    mockCM.getGlobalConfig.mockResolvedValue({ retryPolicies: [...sampleRetryPolicies] } as MeshGlobalConfig);

    retryHandler = new RetryHandler(new ConfigurationManager() as any, mockLogger);
    await retryHandler.loadRetryPolicies(); // Load policies
    (mockLogger.info as jest.Mock).mockClear(); // Clear logs after initial load
    (mockLogger.debug as jest.Mock).mockClear();
  });
  
  afterEach(() => {
    jest.clearAllTimers(); // Clear any pending timers
  });

  describe('Initialization and Policy Loading', () => {
    test('should load retry policies from ConfigurationManager', () => {
      expect(mockCM.getGlobalConfig).toHaveBeenCalledTimes(1);
      expect(retryHandler['policies'].size).toBe(sampleRetryPolicies.length);
      expect(retryHandler['policies'].get(policyFixed.id)).toEqual(policyFixed);
    });
    
    test('should clear policies if loading fails', async () => {
      mockCM.getGlobalConfig.mockRejectedValueOnce(new Error("Config load failed for retries"));
      await retryHandler.loadRetryPolicies();
      expect(retryHandler['policies'].size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith('[RetryHandler] Failed to load retry policies', {error: "Config load failed for retries"});
    });
  });

  describe('executeWithRetries', () => {
    test('should execute operation once and succeed if no error', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await retryHandler.executeWithRetries(operation, policyFixed.id);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(operation).toHaveBeenCalledWith(1); // Attempt number
    });

    test('should execute once if policy not found, logging a warning', async () => {
      const operation = jest.fn().mockResolvedValue('success from no policy');
      const result = await retryHandler.executeWithRetries(operation, 'non-existent-policy');
      expect(result).toBe('success from no policy');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[RetryHandler] Retry policy "non-existent-policy" not found. Executing operation once without retry.',
        undefined
      );
    });

    test('should retry based on fixed policy for matching HTTP status code until success', async () => {
      const error500 = { message: 'Server Error', httpStatusCode: 500 };
      const operation = jest.fn()
        .mockRejectedValueOnce(error500) // Fails 1st time
        .mockRejectedValueOnce(error500) // Fails 2nd time
        .mockResolvedValue('success on 3rd attempt'); // Succeeds 3rd time
      
      const promise = retryHandler.executeWithRetries(operation, policyFixed.id);

      // Advance timers for delays
      jest.advanceTimersByTime(policyFixed.initialIntervalMs); // After 1st failure
      await Promise.resolve(); // Allow microtasks (like promise resolutions) to run
      jest.advanceTimersByTime(policyFixed.initialIntervalMs); // After 2nd failure
      await Promise.resolve();
      
      const result = await promise;
      expect(result).toBe('success on 3rd attempt');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Retrying after ${policyFixed.initialIntervalMs}ms (attempt 2/3)`), undefined
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Retrying after ${policyFixed.initialIntervalMs}ms (attempt 3/3)`), undefined
      );
    });

    test('should fail after max attempts for fixed policy if error persists', async () => {
      const error503 = { message: 'Service Unavailable', httpStatusCode: 503 };
      const operation = jest.fn().mockRejectedValue(error503); // Always fails

      const promise = retryHandler.executeWithRetries(operation, policyFixed.id);
      
      for(let i=0; i < policyFixed.maxAttempts -1; ++i) {
          jest.advanceTimersByTime(policyFixed.initialIntervalMs);
          await Promise.resolve();
      }
      
      await expect(promise).rejects.toEqual(error503);
      expect(operation).toHaveBeenCalledTimes(policyFixed.maxAttempts);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`All ${policyFixed.maxAttempts} attempts failed or error not retryable`),
        expect.objectContaining({ lastError: error503 })
      );
    });

    test('should retry with exponential backoff', async () => {
      const error500 = { message: 'Server Error', httpStatusCode: 500 };
      const operation = jest.fn()
        .mockRejectedValueOnce(error500) // Fails 1st
        .mockResolvedValue('success on 2nd attempt'); // Succeeds 2nd
      
      const promise = retryHandler.executeWithRetries(operation, policyExpo.id);

      // 1st attempt fails, delay is initialIntervalMs (50ms) + jitter
      // We can't precisely predict jitter, so advance by slightly more than base.
      jest.advanceTimersByTime(Math.ceil(policyExpo.initialIntervalMs * 1.3));
      await Promise.resolve();
      
      const result = await promise;
      expect(result).toBe('success on 2nd attempt');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Retrying after`), // Delay will include jitter
        undefined
      );
    });
    
    test('exponential backoff delay should not exceed maxIntervalMs', async () => {
        const policyLongExpo: RetryPolicy = { id: 'long-expo', maxAttempts: 5, backoffStrategy: 'EXPONENTIAL', initialIntervalMs: 10, multiplier: 10, maxIntervalMs: 100, retryOnHttpStatusCodes: [500] };
        await retryHandler['policies'].set(policyLongExpo.id, policyLongExpo); // Add to loaded policies

        const error500 = { message: 'Server Error', httpStatusCode: 500 };
        const operation = jest.fn()
            .mockRejectedValueOnce(error500) // attempt 1 fails, delay = 10ms
            .mockRejectedValueOnce(error500) // attempt 2 fails, delay = 10 * 10 = 100ms (capped by maxInterval)
            .mockRejectedValueOnce(error500) // attempt 3 fails, delay = 10 * 10^2 = 1000ms, capped to 100ms
            .mockResolvedValue('success');
        
        const promise = retryHandler.executeWithRetries(operation, policyLongExpo.id);

        // Delay after 1st failure (base 10ms)
        jest.advanceTimersByTime(20); // More than 10ms + jitter
        await Promise.resolve();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/Retrying after \d+ms \(attempt 2\/5\)/), undefined);
        
        // Delay after 2nd failure (base 100ms, capped at 100ms)
        jest.advanceTimersByTime(120); // More than 100ms + jitter
        await Promise.resolve();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/Retrying after \d+ms \(attempt 3\/5\)/), undefined);
        
        // Delay after 3rd failure (base 1000ms, capped at 100ms)
        jest.advanceTimersByTime(120);
        await Promise.resolve();
        
        await expect(promise).resolves.toBe('success');
        expect(operation).toHaveBeenCalledTimes(4);
    });


    test('should not retry if error HTTP status code does not match policy', async () => {
      const error400 = { message: 'Bad Request', httpStatusCode: 400 }; // Not in policyFixed.retryOnHttpStatusCodes
      const operation = jest.fn().mockRejectedValueOnce(error400);
      
      await expect(retryHandler.executeWithRetries(operation, policyFixed.id))
        .rejects.toEqual(error400);
      expect(operation).toHaveBeenCalledTimes(1); // No retry
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`All 1 attempts failed or error not retryable`), // Max attempts is 1 effectively
        expect.objectContaining({ lastError: error400 })
      );
    });
    
    test('should retry on matching gRPC status code', async () => {
        const grpcError = { message: 'Upstream unavailable', grpcStatusCode: 'UNAVAILABLE' };
        const operation = jest.fn()
            .mockRejectedValueOnce(grpcError)
            .mockResolvedValue('success on 2nd');
        
        const promise = retryHandler.executeWithRetries(operation, policyGrpc.id);
        jest.advanceTimersByTime(policyGrpc.initialIntervalMs + 5);
        await Promise.resolve();
        
        const result = await promise;
        expect(result).toBe('success on 2nd');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should not retry if error is not an object or has no relevant status codes', async () => {
        const stringError = "Just a string error";
        const operation = jest.fn().mockRejectedValueOnce(stringError);
        await expect(retryHandler.executeWithRetries(operation, policyFixed.id)).rejects.toBe(stringError);
        expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});