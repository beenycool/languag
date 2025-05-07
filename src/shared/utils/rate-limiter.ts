interface CallRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly intervalMs: number;
  private calls: Map<string, CallRecord[]> = new Map();

  constructor(maxRequests: number, intervalMs: number) {
    if (maxRequests <= 0) {
      throw new Error('Max requests must be greater than 0.');
    }
    if (intervalMs <= 0) {
      throw new Error('Interval MS must be greater than 0.');
    }
    this.maxRequests = maxRequests;
    this.intervalMs = intervalMs;
  }

  public isAllowed(clientId: string): boolean {
    const now = Date.now();
    const clientCalls = this.calls.get(clientId) || [];

    // Filter out calls older than the interval
    const recentCalls = clientCalls.filter(
      (record) => now - record.timestamp < this.intervalMs
    );

    // Calculate total requests in the current window
    const currentRequestCount = recentCalls.reduce((sum, record) => sum + record.count, 0);

    if (currentRequestCount < this.maxRequests) {
      // Add current call
      recentCalls.push({ timestamp: now, count: 1 });
      this.calls.set(clientId, recentCalls);
      return true;
    }

    // If limit is reached, update the timestamp of the oldest call if it's within a second to allow smoothing
    // This is a simple way to prevent hard blocking if requests are bunched up.
    if (recentCalls.length > 0) {
        const oldestCall = recentCalls[0];
        if (now - oldestCall.timestamp < 1000) { // If oldest call in window is very recent
            // Effectively, we are just noting the attempt.
            // A more sophisticated limiter might have a queue or different backoff.
        }
    }
    this.calls.set(clientId, recentCalls); // Update with filtered/potentially modified list
    return false;
  }

  // Optional: Method to clear old records periodically if memory is a concern
  public cleanup(): void {
    const now = Date.now();
    for (const [clientId, records] of this.calls) {
      const validRecords = records.filter(
        (record) => now - record.timestamp < this.intervalMs * 2 // Keep a bit longer to be safe
      );
      if (validRecords.length > 0) {
        this.calls.set(clientId, validRecords);
      } else {
        this.calls.delete(clientId);
      }
    }
  }
}