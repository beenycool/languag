// src/mesh/features/traffic/load-balancer.ts
import { ServiceInstance } from '../../core/control/service-registry'; // Assuming ServiceInstance type is needed
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';

export type LoadBalancingStrategyType = 'ROUND_ROBIN' | 'RANDOM' | 'LEAST_CONNECTIONS' | 'WEIGHTED_ROUND_ROBIN';

export interface LoadBalancerOptions {
  logger?: ILoggingService;
  strategy?: LoadBalancingStrategyType;
}

export interface ILoadBalancer {
  /**
   * Selects an instance from a list of available instances based on the configured strategy.
   * @param instances - Array of available service instances.
   * @param clientContext - Optional context (e.g., client IP, session ID) for strategies like sticky sessions.
   * @returns The selected ServiceInstance or null if no suitable instance is found.
   */
  selectInstance(instances: ServiceInstance[], clientContext?: Record<string, any>): ServiceInstance | null;
  updateStrategy(strategy: LoadBalancingStrategyType, strategyOptions?: any): void;
  // Potentially methods to update weights for WEIGHTED_ROUND_ROBIN, or track connections for LEAST_CONNECTIONS
}

export class LoadBalancer implements ILoadBalancer {
  private logger?: ILoggingService;
  private strategy: LoadBalancingStrategyType;
  private roundRobinIndex: Map<string, number>; // Keyed by serviceId or a general key if LB is per service
  // Add other strategy-specific state here (e.g., weights, connection counts)

  constructor(options?: LoadBalancerOptions) {
    this.logger = options?.logger;
    this.strategy = options?.strategy || 'ROUND_ROBIN';
    this.roundRobinIndex = new Map();
    this.log(LogLevel.INFO, `LoadBalancer initialized with strategy: ${this.strategy}`);
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[LoadBalancer] ${message}`, context);
  }

  public updateStrategy(strategy: LoadBalancingStrategyType, strategyOptions?: any): void {
    this.log(LogLevel.INFO, `Updating load balancing strategy to: ${strategy}`, strategyOptions);
    this.strategy = strategy;
    this.roundRobinIndex.clear(); // Reset strategy-specific state
    // Handle strategyOptions if provided
  }

  public selectInstance(instances: ServiceInstance[], clientContext?: Record<string, any>): ServiceInstance | null {
    if (!instances || instances.length === 0) {
      this.log(LogLevel.WARN, 'No instances available for load balancing.');
      return null;
    }

    // Filter for healthy instances (assuming 'UP' status indicates healthy)
    const healthyInstances = instances.filter(inst => inst.status === 'UP');
    if (healthyInstances.length === 0) {
      this.log(LogLevel.WARN, 'No healthy (UP) instances available for load balancing.');
      return null; // Or perhaps return one from the original list if all are unhealthy but present
    }


    switch (this.strategy) {
      case 'RANDOM':
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];
      
      case 'ROUND_ROBIN':
        // Simple round robin for all calls, doesn't distinguish by service if this LB is global.
        // A more sophisticated LB might be per service.
        const key = clientContext?.serviceId || 'default_service'; // Use serviceId from context or a default
        let currentIndex = this.roundRobinIndex.get(key) || 0;
        const selected = healthyInstances[currentIndex % healthyInstances.length];
        this.roundRobinIndex.set(key, (currentIndex + 1) % healthyInstances.length);
        return selected;

      case 'LEAST_CONNECTIONS':
        // Requires tracking active connections to each instance.
        // This is a placeholder; actual implementation needs connection data.
        this.log(LogLevel.DEBUG, 'LEAST_CONNECTIONS strategy selected (placeholder). Returning random for now.');
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];
        
      case 'WEIGHTED_ROUND_ROBIN':
        // Requires instances to have weights.
        // This is a placeholder.
        this.log(LogLevel.DEBUG, 'WEIGHTED_ROUND_ROBIN strategy selected (placeholder). Returning random for now.');
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];

      default:
        this.log(LogLevel.WARN, `Unknown load balancing strategy: ${this.strategy}. Defaulting to RANDOM.`);
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];
    }
  }
}