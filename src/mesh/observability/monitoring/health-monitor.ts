// src/mesh/observability/monitoring/health-monitor.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { ServiceRegistry, ServiceInstance } from '../../core/control/service-registry';

export type HealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN';

export interface ServiceHealth {
  serviceId: string;
  instanceId?: string; // If checking a specific instance
  status: HealthStatus;
  lastChecked: number; // epoch milliseconds
  details?: Record<string, any>; // e.g., error message, response time, specific check failures
}

export interface HealthCheckConfig {
  // Configuration for how a health check is performed
  type: 'HTTP_GET' | 'TCP_DIAL' | 'GRPC_HEALTH' | 'CUSTOM';
  targetPath?: string; // For HTTP_GET or GRPC_HEALTH service name
  port?: number; // Port to check on the instance
  timeoutMs?: number;
  intervalMs?: number; // How often to perform the check automatically
  retries?: number; // Number of retries on failure before marking unhealthy
}

export interface IHealthMonitor {
  /**
   * Checks the health of a specific service instance or all instances of a service.
   * @param serviceId - The ID of the service to check.
   * @param instanceId - Optional: The specific instance ID to check. If not provided, might check all or a summary.
   * @returns A Promise resolving to ServiceHealth or an array of ServiceHealth.
   */
  checkHealth(serviceId: string, instanceId?: string): Promise<ServiceHealth | ServiceHealth[] | null>;

  /**
   * Gets the last known health status for a service/instance.
   * @param serviceId - The ID of the service.
   * @param instanceId - Optional: The specific instance ID.
   * @returns The last known ServiceHealth or null if not monitored or found.
   */
  getLastKnownHealth(serviceId: string, instanceId?: string): Promise<ServiceHealth | null>;

  /**
   * Starts periodic health checking for a service based on its configuration.
   * @param serviceId - The ID of the service to monitor.
   * @param config - Health check configuration. If not provided, might fetch from a config manager.
   */
  startMonitoring(serviceId: string, config?: HealthCheckConfig): Promise<void>;

  /**
   * Stops periodic health checking for a service.
   * @param serviceId - The ID of the service to stop monitoring.
   */
  stopMonitoring(serviceId: string): Promise<void>;
}

/**
 * Monitors the health of services within the mesh.
 * It can perform active health checks (e.g., pinging an HTTP endpoint) or passively
 * observe health based on metrics/events (though active is more common for a "monitor").
 */
export class HealthMonitor implements IHealthMonitor {
  private logger?: ILoggingService;
  private serviceRegistry: ServiceRegistry;
  private monitoredServices: Map<string, { config: HealthCheckConfig, timer?: NodeJS.Timeout, lastHealth?: ServiceHealth | ServiceHealth[] }>;

  constructor(serviceRegistry: ServiceRegistry, logger?: ILoggingService) {
    this.logger = logger;
    this.serviceRegistry = serviceRegistry;
    this.monitoredServices = new Map();
    this.log(LogLevel.INFO, 'HealthMonitor initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[HealthMonitor] ${message}`, context);
  }

  public async checkHealth(serviceId: string, instanceId?: string): Promise<ServiceHealth | ServiceHealth[] | null> {
    this.log(LogLevel.DEBUG, `Performing health check for service: ${serviceId}`, { instanceId });
    const instances = await this.serviceRegistry.getServiceEndpoints(serviceId);

    if (!instances || instances.length === 0) {
      this.log(LogLevel.WARN, `No instances found for service: ${serviceId} to health check.`);
      return { serviceId, status: 'UNKNOWN', lastChecked: Date.now(), details: { error: 'No instances registered' } };
    }

    const monitoringConfig = this.monitoredServices.get(serviceId)?.config || 
                             { type: 'HTTP_GET', targetPath: '/health', timeoutMs: 1000, port: instances[0]?.port }; // Default basic config

    const results: ServiceHealth[] = [];

    for (const instance of instances) {
      if (instanceId && instance.id !== instanceId) continue;

      // Placeholder: Actual health check logic (HTTP GET, TCP dial, etc.)
      let currentStatus: HealthStatus = 'UNKNOWN';
      let details: Record<string, any> = {};
      try {
        // Simulate check based on config type
        this.log(LogLevel.TRACE, `Checking instance ${instance.id} via ${monitoringConfig.type}`);
        // For example: if (monitoringConfig.type === 'HTTP_GET') { /* make http call */ }
        // Mocking a successful check for now if port is not 9999
        if (instance.port !== 9999) { // Arbitrary failure condition for testing
          currentStatus = 'HEALTHY';
          details = { responseTime: Math.random() * 100 };
        } else {
          throw new Error('Simulated health check failure: Unresponsive');
        }
      } catch (error: any) {
        currentStatus = 'UNHEALTHY';
        details = { error: error.message };
        this.log(LogLevel.WARN, `Health check failed for ${serviceId}/${instance.id}`, details);
      }
      
      const healthResult: ServiceHealth = {
        serviceId,
        instanceId: instance.id,
        status: currentStatus,
        lastChecked: Date.now(),
        details,
      };
      results.push(healthResult);
      
      // Update last known health for this instance if it's being monitored
      if (this.monitoredServices.has(serviceId)) {
          const serviceMonitoring = this.monitoredServices.get(serviceId)!;
          if (Array.isArray(serviceMonitoring.lastHealth)) {
              const idx = serviceMonitoring.lastHealth.findIndex(h => h.instanceId === instance.id);
              if (idx !== -1) serviceMonitoring.lastHealth[idx] = healthResult;
              else serviceMonitoring.lastHealth.push(healthResult);
          } else { // If only one instance was monitored or it's the first check
              serviceMonitoring.lastHealth = [healthResult]; // Store as array now
          }
      }


      if (instanceId) return healthResult; // Return single result if instanceId was specified
    }
    
    if (results.length === 0 && instanceId) { // Specific instance was requested but not found in registry's list
        return { serviceId, instanceId, status: 'UNKNOWN', lastChecked: Date.now(), details: { error: 'Instance not found in registry' } };
    }

    return results.length > 0 ? results : null;
  }

  public async getLastKnownHealth(serviceId: string, instanceId?: string): Promise<ServiceHealth | null> {
    const monitoringInfo = this.monitoredServices.get(serviceId);
    if (!monitoringInfo || !monitoringInfo.lastHealth) return null;

    if (instanceId) {
        if (Array.isArray(monitoringInfo.lastHealth)) {
            return monitoringInfo.lastHealth.find(h => h.instanceId === instanceId) || null;
        } else if (monitoringInfo.lastHealth.instanceId === instanceId) { // Should not happen if lastHealth is array
            return monitoringInfo.lastHealth;
        }
        return null;
    } else {
        // If no instanceId, return overall service health (e.g., if all instances are healthy)
        // For simplicity, returning the first entry or a summary if available.
        // This part needs more sophisticated aggregation for "overall service health".
        // For now, if lastHealth is an array, it means we checked multiple. If it's single, it was for one.
        // This method is more useful for specific instance or if lastHealth was aggregated.
        if (Array.isArray(monitoringInfo.lastHealth)) return monitoringInfo.lastHealth[0] || null; // Placeholder
        return monitoringInfo.lastHealth; // This would be if only one instance was ever checked/stored
    }
  }

  public async startMonitoring(serviceId: string, config?: HealthCheckConfig): Promise<void> {
    if (this.monitoredServices.has(serviceId)) {
      this.log(LogLevel.WARN, `Service ${serviceId} is already being monitored. Call stopMonitoring first or updateMonitoring.`);
      // Optionally, update config here: this.monitoredServices.get(serviceId)!.config = effectiveConfig;
      return;
    }

    const effectiveConfig = config || { type: 'HTTP_GET', targetPath: '/health', intervalMs: 30000, timeoutMs: 2000 }; // Default config
    this.log(LogLevel.INFO, `Starting health monitoring for service: ${serviceId}`, { config: effectiveConfig });
    
    const job = async () => {
      this.log(LogLevel.TRACE, `Periodic health check running for ${serviceId}`);
      const healthStatus = await this.checkHealth(serviceId); // Checks all instances by default
      // Store or emit this healthStatus
      if (this.monitoredServices.has(serviceId)) { // Check again in case stopMonitoring was called
          this.monitoredServices.get(serviceId)!.lastHealth = healthStatus || undefined;
      }
    };

    await job(); // Perform initial check immediately
    const timer = setInterval(job, effectiveConfig.intervalMs || 30000);
    this.monitoredServices.set(serviceId, { config: effectiveConfig, timer });
  }

  public async stopMonitoring(serviceId: string): Promise<void> {
    const monitoringInfo = this.monitoredServices.get(serviceId);
    if (monitoringInfo && monitoringInfo.timer) {
      clearInterval(monitoringInfo.timer);
      this.monitoredServices.delete(serviceId);
      this.log(LogLevel.INFO, `Stopped health monitoring for service: ${serviceId}`);
    } else {
      this.log(LogLevel.WARN, `Service ${serviceId} is not currently being monitored or timer not found.`);
    }
  }
  
  public async shutdown(): Promise<void> {
    this.log(LogLevel.INFO, 'Shutting down HealthMonitor. Stopping all monitoring jobs.');
    this.monitoredServices.forEach((value, key) => {
      if (value.timer) clearInterval(value.timer);
    });
    this.monitoredServices.clear();
  }
}