// src/microservices/services/management/health-service.ts

/**
 * @enum HealthStatus
 * Represents the health status of a component or the overall system.
 */
export enum HealthStatus {
  UP = 'UP', // The component is healthy and operational.
  DOWN = 'DOWN', // The component is not operational.
  DEGRADED = 'DEGRADED', // The component is operational but with issues (e.g., high latency, partial failure).
  UNKNOWN = 'UNKNOWN', // The health status cannot be determined.
  MAINTENANCE = 'MAINTENANCE', // The component is temporarily down for maintenance.
}

/**
 * @interface HealthIndicatorResult
 * Represents the result of a single health check for a component.
 */
export interface HealthIndicatorResult {
  status: HealthStatus;
  details?: Record<string, any>; // Additional details (e.g., error message, metrics)
  timestamp: number;
}

/**
 * @interface HealthIndicator
 * Defines the contract for a component that can report its health.
 */
export interface HealthIndicator {
  /**
   * Gets the name of the component being checked.
   * @returns The name of the health indicator (e.g., "database", "redisCache").
   */
  getName(): string;

  /**
   * Performs a health check.
   * @returns A promise that resolves to a HealthIndicatorResult.
   */
  checkHealth(): Promise<HealthIndicatorResult>;
}

/**
 * @interface AggregatedHealthStatus
 * Represents the overall health of the system, aggregating individual component statuses.
 */
export interface AggregatedHealthStatus {
  overallStatus: HealthStatus;
  timestamp: number;
  components: {
    name: string;
    status: HealthStatus;
    details?: Record<string, any>;
  }[];
}

/**
 * @interface IHealthService
 * Defines the contract for a service that monitors and reports system health.
 */
export interface IHealthService {
  /**
   * Registers a health indicator for a component.
   * @param indicator - The health indicator to register.
   */
  registerIndicator(indicator: HealthIndicator): void;

  /**
   * Unregisters a health indicator.
   * @param indicatorName - The name of the health indicator to unregister.
   */
  unregisterIndicator(indicatorName: string): void;

  /**
   * Performs health checks on all registered indicators and aggregates the results.
   * @returns A promise that resolves to an AggregatedHealthStatus.
   */
  getSystemHealth(): Promise<AggregatedHealthStatus>;

  /**
   * Gets the health of a specific component.
   * @param indicatorName - The name of the health indicator.
   * @returns A promise that resolves to a HealthIndicatorResult, or undefined if not found.
   */
  getComponentHealth(indicatorName: string): Promise<HealthIndicatorResult | undefined>;
}

/**
 * @class HealthService
 * Manages and reports the health of various system components.
 */
export class HealthService implements IHealthService {
  private indicators: Map<string, HealthIndicator>;

  constructor() {
    this.indicators = new Map();
    console.log('HealthService initialized.');
  }

  public registerIndicator(indicator: HealthIndicator): void {
    const name = indicator.getName();
    if (this.indicators.has(name)) {
      console.warn(`Health indicator "${name}" is already registered and will be overridden.`);
    }
    this.indicators.set(name, indicator);
    console.log(`Health indicator registered: ${name}`);
  }

  public unregisterIndicator(indicatorName: string): void {
    if (this.indicators.has(indicatorName)) {
      this.indicators.delete(indicatorName);
      console.log(`Health indicator unregistered: ${indicatorName}`);
    } else {
      console.warn(`Health indicator "${indicatorName}" not found for unregistration.`);
    }
  }

  public async getComponentHealth(indicatorName: string): Promise<HealthIndicatorResult | undefined> {
    const indicator = this.indicators.get(indicatorName);
    if (!indicator) {
      console.warn(`Health indicator "${indicatorName}" not found.`);
      return undefined;
    }
    try {
      return await indicator.checkHealth();
    } catch (error: any) {
      console.error(`Error checking health for component "${indicatorName}":`, error);
      return {
        status: HealthStatus.UNKNOWN,
        details: { error: `Failed to check health: ${error.message}` },
        timestamp: Date.now(),
      };
    }
  }

  public async getSystemHealth(): Promise<AggregatedHealthStatus> {
    const componentResults: { name: string; status: HealthStatus; details?: Record<string, any> }[] = [];
    let overallStatus: HealthStatus = HealthStatus.UP; // Assume UP unless a component is DOWN or DEGRADED

    if (this.indicators.size === 0) {
        console.log('No health indicators registered. System health considered UP by default.');
        return {
            overallStatus: HealthStatus.UP,
            timestamp: Date.now(),
            components: [],
        };
    }

    for (const [name, indicator] of this.indicators) {
      let result: HealthIndicatorResult;
      try {
        result = await indicator.checkHealth();
      } catch (error: any) {
        console.error(`Error during health check for "${name}":`, error);
        result = {
          status: HealthStatus.UNKNOWN,
          details: { error: `Health check failed: ${error.message}` },
          timestamp: Date.now(),
        };
      }
      componentResults.push({ name, status: result.status, details: result.details });

      // Determine overall status:
      // DOWN takes precedence, then DEGRADED, then UNKNOWN.
      if (result.status === HealthStatus.DOWN) {
        overallStatus = HealthStatus.DOWN;
      } else if (result.status === HealthStatus.DEGRADED && overallStatus !== HealthStatus.DOWN) {
        overallStatus = HealthStatus.DEGRADED;
      } else if (result.status === HealthStatus.UNKNOWN && overallStatus !== HealthStatus.DOWN && overallStatus !== HealthStatus.DEGRADED) {
        overallStatus = HealthStatus.UNKNOWN;
      } else if (result.status === HealthStatus.MAINTENANCE && overallStatus !== HealthStatus.DOWN && overallStatus !== HealthStatus.DEGRADED && overallStatus !== HealthStatus.UNKNOWN) {
        overallStatus = HealthStatus.MAINTENANCE; // Or could be DEGRADED depending on policy
      }
    }
    console.log(`System health check complete. Overall status: ${overallStatus}`);
    return {
      overallStatus,
      timestamp: Date.now(),
      components: componentResults,
    };
  }
}

// --- Example Health Indicators ---

/**
 * @class StaticHealthIndicator
 * A simple health indicator that always returns a predefined status.
 */
export class StaticHealthIndicator implements HealthIndicator {
  private name: string;
  private status: HealthStatus;
  private details?: Record<string, any>;

  constructor(name: string, status: HealthStatus, details?: Record<string, any>) {
    this.name = name;
    this.status = status;
    this.details = details;
  }

  public getName(): string {
    return this.name;
  }

  public async checkHealth(): Promise<HealthIndicatorResult> {
    return {
      status: this.status,
      details: this.details,
      timestamp: Date.now(),
    };
  }
}

/**
 * @class PingHealthIndicator
 * A conceptual indicator that would ping a URL.
 */
export class PingHealthIndicator implements HealthIndicator {
  private componentName: string;
  private targetUrl: string;
  // private httpClient: IHttpClient; // Would use an HTTP client

  constructor(name: string, url: string /*, httpClient: IHttpClient */) {
    this.componentName = name;
    this.targetUrl = url;
    // this.httpClient = httpClient;
  }

  public getName(): string {
    return this.componentName;
  }

  public async checkHealth(): Promise<HealthIndicatorResult> {
    try {
      // Simulate HTTP GET request
      // const response = await this.httpClient.request({ method: 'GET', url: this.targetUrl, timeout: 2000 });
      // if (response.status >= 200 && response.status < 300) {
      //   return { status: HealthStatus.UP, details: { url: this.targetUrl, responseTime: 'Xms' }, timestamp: Date.now() };
      // } else {
      //   return { status: HealthStatus.DOWN, details: { url: this.targetUrl, statusCode: response.status }, timestamp: Date.now() };
      // }
      console.log(`Simulating health check for ${this.componentName} by pinging ${this.targetUrl}`);
      // Mock implementation:
      if (this.targetUrl.includes('fail')) {
        throw new Error('Simulated ping failure');
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
      return {
        status: HealthStatus.UP,
        details: { url: this.targetUrl, message: 'Successfully pinged (simulated)' },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      return {
        status: HealthStatus.DOWN,
        details: { url: this.targetUrl, error: error.message },
        timestamp: Date.now(),
      };
    }
  }
}

// Example Usage
async function healthServiceExample() {
  const healthService = new HealthService();

  const dbIndicator = new StaticHealthIndicator('database', HealthStatus.UP, { version: 'PostgreSQL 15.2' });
  const cacheIndicator = new StaticHealthIndicator('redisCache', HealthStatus.DEGRADED, { message: 'High memory usage' });
  const externalApiIndicator = new PingHealthIndicator('externalPaymentAPI', 'https://api.payments.example.com/health');
  const failingApiIndicator = new PingHealthIndicator('failingService', 'http://localhost:9999/fail');


  healthService.registerIndicator(dbIndicator);
  healthService.registerIndicator(cacheIndicator);
  healthService.registerIndicator(externalApiIndicator);
  healthService.registerIndicator(failingApiIndicator);


  const systemHealth = await healthService.getSystemHealth();
  console.log('System Health:', JSON.stringify(systemHealth, null, 2));

  const dbHealth = await healthService.getComponentHealth('database');
  console.log('\nDatabase Health:', dbHealth);

  healthService.unregisterIndicator('redisCache');
  const systemHealthAfterUnregister = await healthService.getSystemHealth();
  console.log('\nSystem Health (after unregistering Redis):', JSON.stringify(systemHealthAfterUnregister, null, 2));
}

// To run the example:
// healthServiceExample().catch(console.error);