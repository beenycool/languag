// src/microservices/utils/monitoring/dependency-monitor.ts

import { HealthIndicator, HealthIndicatorResult, HealthStatus } from '../../services/management/health-service';
import { IMetricsService, MetricLabels } from '../../services/management/metrics-service';
import { ILoggingService, LogLevel } from '../../services/management/logging-service';

/**
 * @interface DependencyCheck
 * Represents a function that checks the health/status of a specific dependency.
 * @returns A Promise resolving to a HealthIndicatorResult.
 */
export type DependencyCheck = () => Promise<HealthIndicatorResult>;

/**
 * @interface MonitoredDependency
 * Configuration for a dependency to be monitored.
 */
export interface MonitoredDependency {
  name: string; // Unique name for the dependency (e.g., "Database", "PaymentGateway")
  check: DependencyCheck; // The function to perform the health check
  critical?: boolean; // If true, its failure might mark the main service as unhealthy/degraded. Default: true.
  checkIntervalMs?: number; // How often to proactively check this dependency (if proactive checking is used).
  // Additional metadata like type (db, http, queue), endpoint, etc. can be added.
  type?: string; // e.g., 'database', 'http-api', 'message-queue'
  endpoint?: string; // e.g., database connection string, API URL
}

/**
 * @interface IDependencyMonitor
 * Defines a contract for monitoring external dependencies.
 * It can also act as a HealthIndicator itself, reflecting the aggregate health of its critical dependencies.
 */
export interface IDependencyMonitor extends HealthIndicator {
  /**
   * Adds a dependency to monitor.
   * @param dependency - The dependency configuration.
   */
  addDependency(dependency: MonitoredDependency): void;

  /**
   * Removes a monitored dependency.
   * @param dependencyName - The name of the dependency to remove.
   */
  removeDependency(dependencyName: string): void;

  /**
   * Performs a health check on a specific dependency.
   * @param dependencyName - The name of the dependency.
   * @returns A Promise resolving to its HealthIndicatorResult, or undefined if not found.
   */
  checkDependency(dependencyName: string): Promise<HealthIndicatorResult | undefined>;

  /**
   * Gets the status of all monitored dependencies.
   * @returns A Promise resolving to a map of dependency name to its last known HealthIndicatorResult.
   */
  getAllDependencyStatuses(): Promise<Record<string, HealthIndicatorResult>>;

  /**
   * Starts proactive monitoring if checkIntervalMs is set for dependencies.
   * (Optional, can also be purely on-demand via checkHealth or checkDependency).
   */
  startProactiveMonitoring?(): void;

  /**
   * Stops proactive monitoring.
   */
  stopProactiveMonitoring?(): void;
}


/**
 * @class DependencyMonitor
 * Monitors the health and status of external dependencies.
 * It can provide metrics about dependency health and act as an aggregate HealthIndicator.
 */
export class DependencyMonitor implements IDependencyMonitor {
  private dependencies: Map<string, MonitoredDependency>;
  private lastKnownStatus: Map<string, HealthIndicatorResult>;
  private metricsService?: IMetricsService;
  private logger?: ILoggingService;
  private monitorName: string;
  private proactiveCheckTimers: Map<string, NodeJS.Timeout>;

  private dependencyStatusMetricName: string; // Gauge: 1 for UP, 0 for DOWN, 0.5 for DEGRADED/UNKNOWN

  constructor(
    monitorName: string = 'ExternalDependencies',
    metricsService?: IMetricsService,
    logger?: ILoggingService
  ) {
    this.monitorName = monitorName;
    this.dependencies = new Map();
    this.lastKnownStatus = new Map();
    this.metricsService = metricsService;
    this.logger = logger;
    this.proactiveCheckTimers = new Map();

    const prefix = this.monitorName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    this.dependencyStatusMetricName = `${prefix}_dependency_status`;

    this.initializeMetrics();
    this.log(LogLevel.INFO, `DependencyMonitor "${this.monitorName}" initialized.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[DepMon:${this.monitorName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[DepMon:${this.monitorName}] ${message}`, context || '');
    }
  }

  private initializeMetrics(): void {
    if (!this.metricsService) {
      this.log(LogLevel.WARN, 'MetricsService not provided. Dependency metrics will not be recorded.');
      return;
    }
    if (!this.metricsService.getMetric(this.dependencyStatusMetricName)) {
      this.metricsService.createGauge(
        this.dependencyStatusMetricName,
        'Status of monitored dependencies (1=UP, 0.75=DEGRADED, 0.5=MAINTENANCE, 0.25=UNKNOWN, 0=DOWN).',
        ['dependency_name', 'dependency_type', 'dependency_endpoint']
      );
      this.log(LogLevel.DEBUG, `Metric registered: ${this.dependencyStatusMetricName}`);
    }
  }

  private updateDependencyMetric(dependencyName: string, result: HealthIndicatorResult): void {
    if (!this.metricsService) return;

    const depConfig = this.dependencies.get(dependencyName);
    const labels: MetricLabels = {
      dependency_name: dependencyName,
      ...(depConfig?.type && { dependency_type: depConfig.type }),
      ...(depConfig?.endpoint && { dependency_endpoint: depConfig.endpoint }),
    };

    let numericStatus: number;
    switch (result.status) {
      case HealthStatus.UP: numericStatus = 1; break;
      case HealthStatus.DEGRADED: numericStatus = 0.75; break;
      case HealthStatus.MAINTENANCE: numericStatus = 0.5; break;
      case HealthStatus.UNKNOWN: numericStatus = 0.25; break;
      case HealthStatus.DOWN: numericStatus = 0; break;
      default: numericStatus = 0.25; // Treat unhandled as UNKNOWN
    }
    const gauge = this.metricsService.getMetric(this.dependencyStatusMetricName) as import('../../services/management/metrics-service').IGauge | undefined;
    gauge?.set(numericStatus, labels);
  }

  public addDependency(dependency: MonitoredDependency): void {
    if (this.dependencies.has(dependency.name)) {
      this.log(LogLevel.WARN, `Dependency "${dependency.name}" is already being monitored. Overwriting.`);
      this.stopProactiveCheck(dependency.name); // Stop old timer if exists
    }
    this.dependencies.set(dependency.name, dependency);
    this.log(LogLevel.INFO, `Dependency added for monitoring: ${dependency.name}`, { type: dependency.type, critical: dependency.critical });
    // Perform an initial check and set status
    this.checkDependency(dependency.name).then(status => {
        if (status) this.lastKnownStatus.set(dependency.name, status);
    });
    if (dependency.checkIntervalMs && dependency.checkIntervalMs > 0) {
        this.startProactiveCheck(dependency.name, dependency.checkIntervalMs);
    }
  }

  public removeDependency(dependencyName: string): void {
    if (this.dependencies.has(dependencyName)) {
      this.dependencies.delete(dependencyName);
      this.lastKnownStatus.delete(dependencyName);
      this.stopProactiveCheck(dependencyName);
      this.log(LogLevel.INFO, `Dependency removed from monitoring: ${dependencyName}`);
      // Optionally clear metric for this dependency if metrics service supports it
    } else {
      this.log(LogLevel.WARN, `Dependency "${dependencyName}" not found for removal.`);
    }
  }

  public async checkDependency(dependencyName: string): Promise<HealthIndicatorResult | undefined> {
    const dependency = this.dependencies.get(dependencyName);
    if (!dependency) {
      this.log(LogLevel.WARN, `Dependency "${dependencyName}" not found for checking.`);
      return undefined;
    }
    this.log(LogLevel.DEBUG, `Performing health check for dependency: ${dependencyName}`);
    try {
      const result = await dependency.check();
      this.lastKnownStatus.set(dependencyName, result);
      this.updateDependencyMetric(dependencyName, result);
      this.log(LogLevel.INFO, `Health check for "${dependencyName}" completed. Status: ${result.status}`, { details: result.details });
      return result;
    } catch (error: any) {
      this.log(LogLevel.ERROR, `Error checking health for dependency "${dependencyName}":`, { error: error.message });
      const errorResult: HealthIndicatorResult = {
        status: HealthStatus.UNKNOWN, // Or DOWN, depending on policy for check errors
        details: { error: `Failed to execute health check: ${error.message}` },
        timestamp: Date.now(),
      };
      this.lastKnownStatus.set(dependencyName, errorResult);
      this.updateDependencyMetric(dependencyName, errorResult);
      return errorResult;
    }
  }

  public async getAllDependencyStatuses(): Promise<Record<string, HealthIndicatorResult>> {
    // Optionally, re-check all dependencies now, or return last known statuses.
    // For on-demand, re-checking is more accurate.
    const allStatuses: Record<string, HealthIndicatorResult> = {};
    for (const name of this.dependencies.keys()) {
      const status = await this.checkDependency(name); // Re-check on demand
      if (status) {
        allStatuses[name] = status;
      }
    }
    return allStatuses;
    // Or, to return last known:
    // return Object.fromEntries(this.lastKnownStatus);
  }

  // --- IHealthIndicator Implementation ---
  public getName(): string {
    return this.monitorName;
  }

  public async checkHealth(): Promise<HealthIndicatorResult> {
    this.log(LogLevel.DEBUG, 'Performing aggregate health check for all critical dependencies.');
    let overallStatus: HealthStatus = HealthStatus.UP;
    const componentDetails: Record<string, any> = {};
    let hasCritical = false;

    for (const [name, dep] of this.dependencies) {
      if (dep.critical === false) continue; // Skip non-critical for overall status calculation
      hasCritical = true;

      const result = await this.checkDependency(name); // Re-check on demand
      componentDetails[name] = result ? { status: result.status, details: result.details } : { status: HealthStatus.UNKNOWN, details: 'Not checked' };

      if (result) {
        if (result.status === HealthStatus.DOWN) {
          overallStatus = HealthStatus.DOWN; // DOWN takes precedence
        } else if (result.status === HealthStatus.DEGRADED && overallStatus !== HealthStatus.DOWN) {
          overallStatus = HealthStatus.DEGRADED;
        } else if (result.status === HealthStatus.UNKNOWN && overallStatus === HealthStatus.UP) {
          overallStatus = HealthStatus.UNKNOWN;
        } else if (result.status === HealthStatus.MAINTENANCE && overallStatus === HealthStatus.UP) {
            overallStatus = HealthStatus.MAINTENANCE; // Or DEGRADED
        }
      } else if (overallStatus === HealthStatus.UP) {
        overallStatus = HealthStatus.UNKNOWN; // If a critical dependency couldn't be checked
      }
    }
    if (!hasCritical && this.dependencies.size > 0) {
        this.log(LogLevel.INFO, "No critical dependencies registered, overall health UP by default (if non-critical exist).");
    } else if (!hasCritical && this.dependencies.size === 0) {
        this.log(LogLevel.INFO, "No dependencies registered, overall health UP by default.");
    }


    return {
      status: overallStatus,
      details: {
        message: `Aggregate health of critical dependencies.`,
        dependencies: componentDetails,
      },
      timestamp: Date.now(),
    };
  }

  // --- Proactive Monitoring ---
  private startProactiveCheck(dependencyName: string, intervalMs: number): void {
    this.stopProactiveCheck(dependencyName); // Ensure no duplicate timers

    const timer = setInterval(async () => {
      await this.checkDependency(dependencyName);
    }, intervalMs);
    this.proactiveCheckTimers.set(dependencyName, timer);
    this.log(LogLevel.INFO, `Proactive health check scheduled for "${dependencyName}" every ${intervalMs}ms.`);
  }

  private stopProactiveCheck(dependencyName: string): void {
    if (this.proactiveCheckTimers.has(dependencyName)) {
      clearInterval(this.proactiveCheckTimers.get(dependencyName)!);
      this.proactiveCheckTimers.delete(dependencyName);
      this.log(LogLevel.INFO, `Proactive health check stopped for "${dependencyName}".`);
    }
  }

  public startProactiveMonitoring(): void {
    this.log(LogLevel.INFO, 'Starting proactive monitoring for all configured dependencies.');
    this.dependencies.forEach(dep => {
      if (dep.checkIntervalMs && dep.checkIntervalMs > 0) {
        this.startProactiveCheck(dep.name, dep.checkIntervalMs);
      }
    });
  }

  public stopProactiveMonitoring(): void {
    this.log(LogLevel.INFO, 'Stopping all proactive monitoring.');
    this.proactiveCheckTimers.forEach((timer, name) => {
      clearInterval(timer);
      this.log(LogLevel.DEBUG, `Stopped proactive check for ${name}.`);
    });
    this.proactiveCheckTimers.clear();
  }

  /**
   * Cleans up resources, like stopping proactive timers.
   */
  public dispose(): void {
    this.stopProactiveMonitoring();
    this.log(LogLevel.INFO, `DependencyMonitor "${this.monitorName}" disposed.`);
  }
}


// Example Usage:
async function exampleDependencyMonitor() {
  // const metrics = new MetricsService();
  // await metrics.addReporter(new ConsoleMetricsReporter());
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const depMonitor = new DependencyMonitor(
    'MyServiceDependencies',
    // metrics,
    // logger
  );

  // Mock Database Dependency
  let dbUp = true;
  depMonitor.addDependency({
    name: 'PrimaryDatabase',
    type: 'PostgreSQL',
    endpoint: 'db.example.com:5432',
    critical: true,
    checkIntervalMs: 5000, // Check every 5s
    check: async () => {
      console.log('[DepCheck] Checking PrimaryDatabase...');
      await new Promise(r => setTimeout(r, 100)); // Simulate check delay
      if (!dbUp) return { status: HealthStatus.DOWN, details: { reason: 'Cannot connect' }, timestamp: Date.now() };
      return { status: HealthStatus.UP, details: { version: '15.3', connections: 50 }, timestamp: Date.now() };
    },
  });

  // Mock External API Dependency
  depMonitor.addDependency({
    name: 'PaymentGatewayAPI',
    type: 'http-api',
    endpoint: 'https://api.payment.com/v1',
    critical: true,
    checkIntervalMs: 10000,
    check: async () => {
      console.log('[DepCheck] Checking PaymentGatewayAPI...');
      await new Promise(r => setTimeout(r, 200));
      // Simulate occasional degradation
      if (Math.random() < 0.2) {
        return { status: HealthStatus.DEGRADED, details: { message: 'High latency detected', avgLatency: '350ms' }, timestamp: Date.now() };
      }
      return { status: HealthStatus.UP, details: { message: 'API operational' }, timestamp: Date.now() };
    },
  });

  depMonitor.addDependency({
    name: 'LoggingQueue',
    type: 'message-queue',
    critical: false, // Non-critical
    check: async () => ({ status: HealthStatus.UP, details: { queueSize: 10 }, timestamp: Date.now() }),
  });


  depMonitor.startProactiveMonitoring();

  console.log('\n--- Initial Health (as DependencyMonitor HealthIndicator) ---');
  let overallHealth = await depMonitor.checkHealth();
  console.log(`Overall Dependency Health: ${overallHealth.status}`, overallHealth.details);

  console.log('\n--- Waiting for a few proactive checks (12s) ---');
  await new Promise(r => setTimeout(r, 12000));

  console.log('\n--- Simulating Database Down ---');
  dbUp = false;
  await new Promise(r => setTimeout(r, 6000)); // Wait for next proactive check of DB

  overallHealth = await depMonitor.checkHealth();
  console.log(`Overall Dependency Health (DB Down): ${overallHealth.status}`, overallHealth.details);

  const statuses = await depMonitor.getAllDependencyStatuses();
  console.log('\nAll current dependency statuses (on-demand check):', JSON.stringify(statuses, null, 2));


  depMonitor.stopProactiveMonitoring();
  depMonitor.dispose();
  // if (metrics) await metrics.shutdown();
}

// To run the example:
// exampleDependencyMonitor().catch(e => console.error("Example usage main error:", e));