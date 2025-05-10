// src/mesh/features/traffic/rate-limiter.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
// Assuming we might use or adapt concepts from an existing core rate limiter.
// If there's a specific core RateLimiter class to wrap or use:
// import { RateLimiter as CoreRateLimiter, RateLimiterOptions as CoreRateLimiterOptions } from '../../../microservices/resilience/stability/rate-limiter';

export interface MeshRateLimiterPolicy {
  permitsPerSecond: number;
  burstCapacity?: number; // Optional: for token bucket style
  // Could also include window size for sliding window, etc.
  windowMs?: number; 
}

export interface IMeshRateLimiter {
  /**
   * Attempts to acquire a permit.
   * @param key - A key to identify the entity being rate-limited (e.g., serviceId, userId, IP address).
   * @param tokens - Number of tokens/permits to acquire (default is 1).
   * @returns True if a permit was acquired, false otherwise.
   */
  tryAcquire(key: string, tokens?: number): Promise<boolean>;

  /**
   * Gets the current policy for a given key or the default policy.
   * @param key - The key for which to get the policy.
   */
  getPolicy(key: string): Promise<MeshRateLimiterPolicy | null>;
  
  /**
   * Updates or sets a rate limiting policy for a specific key or globally.
   * @param key - The key to apply the policy to (e.g. serviceId, or a global identifier).
   * @param policy - The rate limiting policy.
   */
  setPolicy(key: string, policy: MeshRateLimiterPolicy): Promise<void>;
}

/**
 * Manages rate limiting policies and applies them at the mesh level.
 * This could wrap one or more underlying rate limiter implementations (e.g., token bucket, sliding window).
 */
export class MeshRateLimiter implements IMeshRateLimiter {
  private policies: Map<string, MeshRateLimiterPolicy>; // Keyed by serviceId or policy name
  private defaultPolicy: MeshRateLimiterPolicy;
  private logger?: ILoggingService;
  // Store for actual rate limiting state (e.g., token counts, window request counts)
  private limiterState: Map<string, { tokens: number; lastRefill: number; requestsInWindow?: { timestamp: number }[] }>;


  constructor(defaultPolicy: MeshRateLimiterPolicy, logger?: ILoggingService) {
    this.defaultPolicy = defaultPolicy;
    this.policies = new Map();
    this.limiterState = new Map();
    this.logger = logger;
    this.log(LogLevel.INFO, 'MeshRateLimiter initialized.', { defaultPolicy });
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[MeshRateLimiter] ${message}`, context);
  }

  public async getPolicy(key: string): Promise<MeshRateLimiterPolicy | null> {
    return this.policies.get(key) || this.defaultPolicy;
  }

  public async setPolicy(key: string, policy: MeshRateLimiterPolicy): Promise<void> {
    this.log(LogLevel.INFO, `Setting rate limit policy for key: ${key}`, policy);
    this.policies.set(key, policy);
    // Reset or adjust limiter state for this key if necessary
    this.limiterState.delete(key); 
  }

  public async tryAcquire(key: string, tokensToAcquire: number = 1): Promise<boolean> {
    const policy = await this.getPolicy(key) || this.defaultPolicy;
    let state = this.limiterState.get(key);

    const now = Date.now();

    if (!state) {
      // Initialize state for this key (Token Bucket style)
      state = {
        tokens: policy.burstCapacity || policy.permitsPerSecond,
        lastRefill: now,
      };
      this.limiterState.set(key, state);
    }

    // Refill tokens based on permitsPerSecond (Token Bucket)
    const elapsedSeconds = (now - state.lastRefill) / 1000;
    const newTokens = elapsedSeconds * policy.permitsPerSecond;
    state.tokens = Math.min((state.tokens + newTokens), (policy.burstCapacity || policy.permitsPerSecond));
    state.lastRefill = now;

    if (state.tokens >= tokensToAcquire) {
      state.tokens -= tokensToAcquire;
      this.limiterState.set(key, state); // Update state
      this.log(LogLevel.DEBUG, `Permit acquired for key: ${key}`, { tokensRemaining: state.tokens, acquired: tokensToAcquire });
      return true;
    } else {
      this.log(LogLevel.WARN, `Rate limit exceeded for key: ${key}`, { tokensAvailable: state.tokens, requested: tokensToAcquire, policy });
      return false;
    }
  }
  
  // Placeholder for a sliding window implementation if needed
  // private async tryAcquireSlidingWindow(key: string, policy: MeshRateLimiterPolicy, tokensToAcquire: number): Promise<boolean> {
  //   const now = Date.now();
  //   let state = this.limiterState.get(key);
  //   if (!state || !state.requestsInWindow) {
  //     state = { tokens: 0, lastRefill: 0, requestsInWindow: [] }; // tokens/lastRefill not used for this strategy here
  //     this.limiterState.set(key, state);
  //   }
  //   const windowStart = now - (policy.windowMs || 1000); // Default 1s window
  //   state.requestsInWindow = state.requestsInWindow!.filter(req => req.timestamp > windowStart);
    
  //   if (state.requestsInWindow!.length < policy.permitsPerSecond) { // permitsPerSecond used as max requests in window
  //     for(let i=0; i < tokensToAcquire; i++) state.requestsInWindow!.push({ timestamp: now });
  //     this.limiterState.set(key, state);
  //     return true;
  //   }
  //   return false;
  // }
}