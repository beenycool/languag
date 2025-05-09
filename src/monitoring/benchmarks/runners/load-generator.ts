import { TimingMetrics } from '../../core/metrics/timing-metrics';

export interface LoadTestConfig {
  name: string;
  targetFunction: (iteration: number, ...args: any[]) => Promise<void> | void;
  argsProvider?: (iteration: number) => any[]; // Provides arguments for each call
  concurrencyLevel: number; // Number of concurrent executions
  totalRequests: number; // Total number of requests to make
  rampUpPeriodMs?: number; // Optional: time to ramp up to full concurrency
  durationLimitMs?: number; // Optional: stop test after this duration
}

export interface LoadTestRequestResult {
  iteration: number;
  startTime: number; // timestamp or high-res time
  endTime: number;
  durationMs: number;
  success: boolean;
  error?: any;
}

export interface LoadTestSummary {
  configName: string;
  totalRequestsSent: number;
  successfulRequests: number;
  failedRequests: number;
  totalDurationMs: number; // Overall duration of the test execution
  requestsPerSecond: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p90LatencyMs?: number; // 90th percentile
  p95LatencyMs?: number; // 95th percentile
  p99LatencyMs?: number; // 99th percentile
  errors: { message: string, count: number }[];
  individualResults?: LoadTestRequestResult[]; // Optional: include all results
}

export class LoadGenerator {
  private timingMetrics: TimingMetrics;

  constructor(timingMetrics?: TimingMetrics) {
    this.timingMetrics = timingMetrics || new TimingMetrics();
  }

  async run(config: LoadTestConfig, includeIndividualResults: boolean = false): Promise<LoadTestSummary> {
    if (config.concurrencyLevel <= 0 || config.totalRequests <= 0) {
      throw new Error('Concurrency level and total requests must be positive.');
    }

    const results: LoadTestRequestResult[] = [];
    let activeWorkers = 0;
    let requestsSent = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const errorsMap: Map<string, number> = new Map();
    const latencies: number[] = [];

    const testStartTime = performance.now();

    const executeRequest = async (iteration: number): Promise<void> => {
      activeWorkers++;
      const requestStartTime = performance.now();
      let success = false;
      let errorDetail: any = undefined;
      try {
        const args = config.argsProvider ? config.argsProvider(iteration) : [];
        await config.targetFunction(iteration, ...args);
        success = true;
        successfulRequests++;
      } catch (e: any) {
        errorDetail = e;
        failedRequests++;
        const errorMessage = e.message || String(e);
        errorsMap.set(errorMessage, (errorsMap.get(errorMessage) || 0) + 1);
      } finally {
        const requestEndTime = performance.now();
        const durationMs = requestEndTime - requestStartTime;
        latencies.push(durationMs);
        if (includeIndividualResults || results.length < 10000) { // Limit stored individual results
             results.push({ iteration, startTime: requestStartTime, endTime: requestEndTime, durationMs, success, error: errorDetail });
        }
        activeWorkers--;
      }
    };

    const rampUpDelay = config.rampUpPeriodMs && config.concurrencyLevel > 1 ? config.rampUpPeriodMs / config.concurrencyLevel : 0;

    // Using a simple promise-based concurrency limiter
    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < config.totalRequests; i++) {
      if (config.durationLimitMs && (performance.now() - testStartTime) > config.durationLimitMs) {
        console.log(`Load test ${config.name} reached duration limit.`);
        break;
      }

      while (activeWorkers >= config.concurrencyLevel) {
        await Promise.race(workerPromises.filter(p => p)); // Wait for any worker to finish
      }
      
      requestsSent++;
      const promise = executeRequest(i);
      workerPromises.push(promise);
      promise.finally(() => {
        const index = workerPromises.indexOf(promise);
        if (index > -1) workerPromises.splice(index, 1);
      });


      if (rampUpDelay > 0 && i < config.concurrencyLevel) {
        await new Promise(resolve => setTimeout(resolve, rampUpDelay));
      }
    }

    await Promise.all(workerPromises); // Wait for all outstanding requests

    const testEndTime = performance.now();
    const totalDurationMs = testEndTime - testStartTime;

    latencies.sort((a, b) => a - b);
    const minLatencyMs = latencies.length > 0 ? latencies[0] : 0;
    const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    const averageLatencyMs = latencies.length > 0 ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length : 0;
    
    const getPercentile = (p: number) => {
        if (latencies.length === 0) return 0;
        const index = Math.floor(latencies.length * (p / 100));
        return latencies[Math.min(index, latencies.length - 1)];
    }

    return {
      configName: config.name,
      totalRequestsSent: requestsSent,
      successfulRequests,
      failedRequests,
      totalDurationMs,
      requestsPerSecond: totalDurationMs > 0 ? (requestsSent / (totalDurationMs / 1000)) : 0,
      averageLatencyMs,
      minLatencyMs,
      maxLatencyMs,
      p90LatencyMs: getPercentile(90),
      p95LatencyMs: getPercentile(95),
      p99LatencyMs: getPercentile(99),
      errors: Array.from(errorsMap.entries()).map(([message, count]) => ({ message, count })),
      individualResults: includeIndividualResults ? results : undefined,
    };
  }
}