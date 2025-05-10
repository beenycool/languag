// src/mesh/__tests__/features/traffic/rate-limiter.spec.ts
import { MeshRateLimiter, MeshRateLimiterPolicy } from '../../../features/traffic/rate-limiter';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

// Helper to advance time for token bucket tests
const advanceTime = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('MeshRateLimiter', () => {
  let rateLimiter: MeshRateLimiter;
  const defaultPolicy: MeshRateLimiterPolicy = { permitsPerSecond: 10, burstCapacity: 10 }; // 10 tokens, 10 burst
  const key1 = 'serviceA';
  const key2 = 'user123';

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    rateLimiter = new MeshRateLimiter(defaultPolicy, mockLogger);
    jest.useFakeTimers(); // Use Jest's fake timers
  });

  afterEach(() => {
    jest.useRealTimers(); // Restore real timers
  });

  describe('Policy Management', () => {
    test('should initialize with a default policy', () => {
      expect(rateLimiter['defaultPolicy']).toEqual(defaultPolicy);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MeshRateLimiter] MeshRateLimiter initialized.',
        { defaultPolicy }
      );
    });

    test('should return default policy if no specific policy for key', async () => {
      const policy = await rateLimiter.getPolicy('unknownKey');
      expect(policy).toEqual(defaultPolicy);
    });

    test('should set and get a specific policy for a key', async () => {
      const policyForServiceA: MeshRateLimiterPolicy = { permitsPerSecond: 5, burstCapacity: 5 };
      await rateLimiter.setPolicy(key1, policyForServiceA);
      const retrievedPolicy = await rateLimiter.getPolicy(key1);
      expect(retrievedPolicy).toEqual(policyForServiceA);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[MeshRateLimiter] Setting rate limit policy for key: ${key1}`,
        policyForServiceA
      );
    });

    test('setting a new policy should reset limiter state for that key', async () => {
      // Acquire some tokens to create state
      await rateLimiter.tryAcquire(key1, 1);
      expect(rateLimiter['limiterState'].has(key1)).toBe(true);
      const oldState = { ...rateLimiter['limiterState'].get(key1) };

      const newPolicy: MeshRateLimiterPolicy = { permitsPerSecond: 1, burstCapacity: 1 };
      await rateLimiter.setPolicy(key1, newPolicy);
      
      // State should be cleared, will be re-initialized on next tryAcquire
      expect(rateLimiter['limiterState'].has(key1)).toBe(false); 
    });
  });

  describe('tryAcquire (Token Bucket Logic)', () => {
    test('should acquire permit if tokens are available (initial burst)', async () => {
      const acquired = await rateLimiter.tryAcquire(key1, 1);
      expect(acquired).toBe(true);
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.burstCapacity! - 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[MeshRateLimiter] Permit acquired for key: ${key1}`,
        expect.objectContaining({ tokensRemaining: defaultPolicy.burstCapacity! - 1, acquired: 1 })
      );
    });

    test('should acquire multiple permits if burst capacity allows', async () => {
      const acquired = await rateLimiter.tryAcquire(key1, 5);
      expect(acquired).toBe(true);
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.burstCapacity! - 5);
    });

    test('should reject permit if not enough tokens in burst', async () => {
      const acquired = await rateLimiter.tryAcquire(key1, defaultPolicy.burstCapacity! + 1);
      expect(acquired).toBe(false);
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.burstCapacity); // Unchanged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `[MeshRateLimiter] Rate limit exceeded for key: ${key1}`,
        expect.anything()
      );
    });

    test('should reject permits once burst capacity is exhausted', async () => {
      // Exhaust burst
      for (let i = 0; i < defaultPolicy.burstCapacity!; i++) {
        await rateLimiter.tryAcquire(key1, 1);
      }
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(0);

      const acquired = await rateLimiter.tryAcquire(key1, 1);
      expect(acquired).toBe(false);
    });

    test('should refill tokens over time based on permitsPerSecond', async () => {
      // Exhaust burst
      for (let i = 0; i < defaultPolicy.burstCapacity!; i++) {
        await rateLimiter.tryAcquire(key1, 1);
      }
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(0);
      
      // Advance time by 1 second, should refill `permitsPerSecond` tokens
      jest.advanceTimersByTime(1000); // 1 second

      // tryAcquire will trigger refill logic
      const acquiredAfterRefill = await rateLimiter.tryAcquire(key1, 1);
      expect(acquiredAfterRefill).toBe(true);
      // Tokens should be permitsPerSecond - 1 (since one was just acquired)
      // The defaultPolicy has permitsPerSecond = 10
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.permitsPerSecond - 1);
    });

    test('refilled tokens should not exceed burstCapacity', async () => {
      await rateLimiter.tryAcquire(key1, 1); // Use 1 token, 9 left in burst
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.burstCapacity! - 1);

      // Advance time significantly to ensure full refill if not capped
      jest.advanceTimersByTime(5000); // 5 seconds

      // Trigger refill by trying to acquire. Even if it fails, refill happens.
      // Let's try to acquire 0 to just trigger refill without consuming. (Current impl requires tokensToAcquire >=1)
      // Or, acquire 1.
      await rateLimiter.tryAcquire(key1, 1); 
      
      // Tokens should be capped at burstCapacity - 1 (because we acquired one)
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(defaultPolicy.burstCapacity! - 1);
    });

    test('should handle different keys independently', async () => {
      // Acquire for key1
      await rateLimiter.tryAcquire(key1, defaultPolicy.burstCapacity!);
      expect(await rateLimiter.tryAcquire(key1, 1)).toBe(false); // key1 exhausted

      // key2 should still have full burst
      expect(await rateLimiter.tryAcquire(key2, 1)).toBe(true);
      expect(rateLimiter['limiterState'].get(key2)?.tokens).toBe(defaultPolicy.burstCapacity! - 1);
    });

    test('should use specific policy for a key if set', async () => {
      const specificPolicy: MeshRateLimiterPolicy = { permitsPerSecond: 1, burstCapacity: 1 };
      await rateLimiter.setPolicy(key1, specificPolicy);

      expect(await rateLimiter.tryAcquire(key1, 1)).toBe(true); // Uses 1 token from specific policy
      expect(rateLimiter['limiterState'].get(key1)?.tokens).toBe(0);
      expect(await rateLimiter.tryAcquire(key1, 1)).toBe(false); // Exhausted for specific policy

      // Advance time for specific policy (1 token per second)
      jest.advanceTimersByTime(1000);
      expect(await rateLimiter.tryAcquire(key1, 1)).toBe(true);
    });
  });

  // TODO: Add tests for sliding window if that strategy is implemented.
});