// src/microservices/resilience/stability/rate-limiter.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @interface RateLimiterOptions
 * Configuration options for a rate limiter.
 */
export interface RateLimiterOptions {
  /** Max number of requests allowed in a given windowMs. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Optional logger instance. */
  logger?: ILoggingService;
  /** Optional name for logging/identification. */
  limiterName?: string;
  /**
   * Key to identify the client/source of requests.
   * If not provided, a global limit is applied.
   * Can be an IP address, user ID, API key, etc.
   */
  key?: string;
}

/**
 * @interface IRateLimiter
 * Defines the contract for a rate limiter.
 */
export interface IRateLimiter {
  /**
   * Attempts to consume a token or allow a request.
   * @param key - Optional key to apply the limit to a specific client/source.
   *              If the limiter was created with a key, this might be ignored or used for sub-segmentation.
   * @returns A Promise that resolves to true if the request is allowed, false if it's rate-limited.
   */
  tryConsume(key?: string): Promise<boolean>;

  /**
   * Gets the current status of the rate limiter for a given key.
   * @param key - Optional key.
   * @returns A promise resolving to an object with remaining requests and reset time.
   */
  getStatus(key?: string): Promise<{ remaining: number; resetTimeMs: number; total: number }>;
}

/**
 * @class InMemoryRateLimiter
 * A simple in-memory rate limiter using the sliding window log algorithm (approximated).
 * This is suitable for single-instance applications or for demonstration.
 * For distributed systems, a centralized store like Redis is typically used.
 */
export class InMemoryRateLimiter implements IRateLimiter {
  private options: Required<Omit<RateLimiterOptions, 'logger' | 'limiterName' | 'key'>> & Pick<RateLimiterOptions, 'logger' | 'limiterName' | 'key'>;
  // Store timestamps of requests for each key
  private requestTimestamps: Map<string, number[]>; // key -> array of timestamps

  constructor(options: Partial<RateLimiterOptions> & { maxRequests: number; windowMs: number }) {
    this.options = {
        maxRequests: options.maxRequests,
        windowMs: options.windowMs,
        logger: options.logger,
        limiterName: options.limiterName || 'UnnamedLimiter',
        key: options.key, // The default key for this instance if provided at construction
    };
    this.requestTimestamps = new Map();
    this.log(LogLevel.INFO, `InMemoryRateLimiter "${this.options.limiterName}" initialized. Max ${this.options.maxRequests} req / ${this.options.windowMs}ms.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.options.logger) {
      this.options.logger.log(level, `[RateLimiter:${this.options.limiterName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[RateLimiter:${this.options.limiterName}] ${message}`, context || '');
    }
  }

  private getKey(key?: string): string {
    return key || this.options.key || '___GLOBAL___'; // Use provided key, then instance key, then global
  }

  public async tryConsume(key?: string): Promise<boolean> {
    const effectiveKey = this.getKey(key);
    const now = Date.now();

    // Get or initialize timestamps for the key
    if (!this.requestTimestamps.has(effectiveKey)) {
      this.requestTimestamps.set(effectiveKey, []);
    }
    const timestamps = this.requestTimestamps.get(effectiveKey)!;

    // Remove timestamps older than the window
    const windowStartTime = now - this.options.windowMs;
    while (timestamps.length > 0 && timestamps[0] <= windowStartTime) {
      timestamps.shift();
    }

    // Check if the limit is exceeded
    if (timestamps.length >= this.options.maxRequests) {
      this.log(LogLevel.WARN, `Rate limit exceeded for key "${effectiveKey}".`, {
        count: timestamps.length,
        max: this.options.maxRequests,
        nextAvailableInMs: timestamps.length > 0 ? Math.max(0, (timestamps[0] + this.options.windowMs) - now) : 0
      });
      return false; // Rate limit exceeded
    }

    // Add current request timestamp and allow
    timestamps.push(now);
    this.log(LogLevel.DEBUG, `Request allowed for key "${effectiveKey}". Count: ${timestamps.length}/${this.options.maxRequests}`);
    return true;
  }

  public async getStatus(key?: string): Promise<{ remaining: number; resetTimeMs: number; total: number }> {
    const effectiveKey = this.getKey(key);
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(effectiveKey) || [];

    // Recalculate current count in window (as tryConsume does)
    const windowStartTime = now - this.options.windowMs;
    const currentCountInWindow = timestamps.filter(ts => ts > windowStartTime).length;

    const remaining = Math.max(0, this.options.maxRequests - currentCountInWindow);
    let resetTimeMs = 0; // Time when the limit fully resets

    if (currentCountInWindow >= this.options.maxRequests && timestamps.length > 0) {
        // Find the oldest timestamp that's still part of the current full window
        // The window will clear for this request when this oldest timestamp expires from the window
        const relevantTimestamps = timestamps.filter(ts => ts > windowStartTime);
        if (relevantTimestamps.length >= this.options.maxRequests) {
             // The reset time is when the (Nth - maxRequests + 1) oldest request in the current window expires
            const resetTimestampForOldestContributingRequest = relevantTimestamps[relevantTimestamps.length - this.options.maxRequests] + this.options.windowMs;
            resetTimeMs = Math.max(0, resetTimestampForOldestContributingRequest - now);
        }
    }


    return {
      remaining,
      resetTimeMs, // This is the time until the oldest request in the current full window expires
      total: this.options.maxRequests,
    };
  }

  /**
   * Clears all rate limiting data. Use with caution.
   */
  public clearAll(): void {
    this.requestTimestamps.clear();
    this.log(LogLevel.WARN, 'All rate limiting data has been cleared.');
  }

  /**
   * Clears rate limiting data for a specific key.
   * @param key - The key to clear.
   */
  public clearKey(key: string): void {
    const effectiveKey = this.getKey(key);
    if (this.requestTimestamps.has(effectiveKey)) {
      this.requestTimestamps.delete(effectiveKey);
      this.log(LogLevel.INFO, `Rate limiting data cleared for key "${effectiveKey}".`);
    }
  }
}


// Example Usage:
async function exampleRateLimiterUsage() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const globalLimiter = new InMemoryRateLimiter({
    maxRequests: 5, // 5 requests
    windowMs: 10 * 1000, // per 10 seconds
    limiterName: 'GlobalAPI',
    // logger
  });

  const userLimiter = new InMemoryRateLimiter({
    maxRequests: 2,
    windowMs: 5 * 1000, // 2 requests per 5 seconds per user
    limiterName: 'UserSpecific',
    // logger
  });

  console.log('\n--- Testing Global Limiter ---');
  for (let i = 0; i < 7; i++) {
    const allowed = await globalLimiter.tryConsume();
    const status = await globalLimiter.getStatus();
    console.log(`Global Request ${i + 1}: Allowed = ${allowed}, Remaining = ${status.remaining}, Resets in ~${Math.ceil(status.resetTimeMs/1000)}s`);
    if (!allowed) {
        console.log(`Waiting for global rate limit to pass slightly... (current reset in ${status.resetTimeMs}ms)`);
        await new Promise(resolve => setTimeout(resolve, status.resetTimeMs > 0 ? status.resetTimeMs + 500 : 1000));
    } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between allowed requests
    }
  }

  console.log('\n--- Testing User Specific Limiter ---');
  const user1Key = 'user123';
  const user2Key = 'user456';

  for (let i = 0; i < 3; i++) {
    let allowed = await userLimiter.tryConsume(user1Key);
    let status = await userLimiter.getStatus(user1Key);
    console.log(`User1 Request ${i + 1}: Allowed = ${allowed}, Remaining = ${status.remaining}, Resets in ~${Math.ceil(status.resetTimeMs/1000)}s`);

    allowed = await userLimiter.tryConsume(user2Key);
    status = await userLimiter.getStatus(user2Key);
    console.log(`User2 Request ${i + 1}: Allowed = ${allowed}, Remaining = ${status.remaining}, Resets in ~${Math.ceil(status.resetTimeMs/1000)}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\nWaiting for user1's limit to reset...");
  let user1Status = await userLimiter.getStatus(user1Key);
  if (user1Status.resetTimeMs > 0) {
    await new Promise(resolve => setTimeout(resolve, user1Status.resetTimeMs + 500));
  }

  const allowedUser1AfterWait = await userLimiter.tryConsume(user1Key);
  user1Status = await userLimiter.getStatus(user1Key);
  console.log(`User1 Request after wait: Allowed = ${allowedUser1AfterWait}, Remaining = ${user1Status.remaining}`);

  globalLimiter.clearAll();
  userLimiter.clearKey(user1Key);
}

// To run the example:
// exampleRateLimiterUsage().catch(e => console.error("Example usage main error:", e));