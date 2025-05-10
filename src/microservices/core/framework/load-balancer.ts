// src/microservices/core/framework/load-balancer.ts

import { IDiscoveryService } from './discovery-service';

/**
 * @enum LoadBalancingStrategy
 * Defines available load balancing strategies.
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  RANDOM = 'RANDOM',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS', // Placeholder, actual implementation needs connection tracking
}

/**
 * @interface ILoadBalancer
 * Defines the contract for a load balancer.
 */
export interface ILoadBalancer {
  /**
   * Gets the next available service instance URL based on the configured strategy.
   * @param serviceName - The name of the service.
   * @returns A promise that resolves to a service instance URL, or undefined if no instances are available.
   * @throws Error if the service is not found or no instances are available.
   */
  getNextInstance(serviceName: string): Promise<string>;
}

/**
 * @class LoadBalancer
 * Implements load balancing logic for distributing requests among service instances.
 */
export class LoadBalancer implements ILoadBalancer {
  private discoveryService: IDiscoveryService;
  private strategy: LoadBalancingStrategy;
  private roundRobinCounters: Map<string, number>;
  // For LEAST_CONNECTIONS, a more complex tracking mechanism would be needed, e.g.:
  // private connectionCounts: Map<string, Map<string, number>>; // serviceName -> instanceUrl -> count

  /**
   * Creates an instance of LoadBalancer.
   * @param discoveryService - An instance of IDiscoveryService to fetch service instances.
   * @param strategy - The load balancing strategy to use. Defaults to ROUND_ROBIN.
   */
  constructor(discoveryService: IDiscoveryService, strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN) {
    this.discoveryService = discoveryService;
    this.strategy = strategy;
    this.roundRobinCounters = new Map<string, number>();
    // this.connectionCounts = new Map();
    console.log(`LoadBalancer initialized with strategy: ${this.strategy}`);
  }

  /**
   * Gets the next available service instance URL based on the configured strategy.
   * @param serviceName - The name of the service.
   * @returns A promise that resolves to a service instance URL.
   * @throws Error if the service is not found or no instances are available.
   */
  public async getNextInstance(serviceName: string): Promise<string> {
    const instances = await this.discoveryService.discoverService(serviceName);

    if (!instances || instances.length === 0) {
      console.error(`No instances found for service: ${serviceName}`);
      throw new Error(`No instances available for service: ${serviceName}`);
    }

    if (instances.length === 1) {
      return instances[0]; // Only one instance, no balancing needed
    }

    switch (this.strategy) {
      case LoadBalancingStrategy.RANDOM:
        return this.getRandomInstance(instances);
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        // This is a simplified placeholder. Real implementation requires tracking active connections.
        console.warn('LEAST_CONNECTIONS strategy is not fully implemented and will behave like ROUND_ROBIN.');
        return this.getRoundRobinInstance(serviceName, instances);
      case LoadBalancingStrategy.ROUND_ROBIN:
      default:
        return this.getRoundRobinInstance(serviceName, instances);
    }
  }

  /**
   * Selects an instance using the Round Robin strategy.
   * @param serviceName - The name of the service.
   * @param instances - Array of available service instance URLs.
   * @returns A service instance URL.
   */
  private getRoundRobinInstance(serviceName: string, instances: string[]): string {
    if (!this.roundRobinCounters.has(serviceName)) {
      this.roundRobinCounters.set(serviceName, 0);
    }

    let currentIndex = this.roundRobinCounters.get(serviceName)!;
    const selectedInstance = instances[currentIndex];
    currentIndex = (currentIndex + 1) % instances.length;
    this.roundRobinCounters.set(serviceName, currentIndex);

    console.log(`RoundRobin selected: ${selectedInstance} for service: ${serviceName}`);
    return selectedInstance;
  }

  /**
   * Selects an instance randomly.
   * @param instances - Array of available service instance URLs.
   * @returns A service instance URL.
   */
  private getRandomInstance(instances: string[]): string {
    const randomIndex = Math.floor(Math.random() * instances.length);
    const selectedInstance = instances[randomIndex];
    console.log(`Random selected: ${selectedInstance}`);
    return selectedInstance;
  }

  // Example method signatures for LEAST_CONNECTIONS (if fully implemented)
  // public recordConnection(serviceName: string, instanceUrl: string): void {
  //   // Increment connection count for the instance
  // }
  // public releaseConnection(serviceName: string, instanceUrl: string): void {
  //   // Decrement connection count
  // }
  // private getLeastConnectionsInstance(serviceName: string, instances: string[]): string {
  //   // Logic to find instance with fewest connections
  //   return instances[0]; // Placeholder
  // }

  /**
   * Allows changing the load balancing strategy at runtime.
   * @param newStrategy - The new strategy to apply.
   */
  public setStrategy(newStrategy: LoadBalancingStrategy): void {
    console.log(`Load balancing strategy changed from ${this.strategy} to ${newStrategy}`);
    this.strategy = newStrategy;
    // Reset counters or state if necessary when strategy changes
    this.roundRobinCounters.clear();
    // if (this.connectionCounts) this.connectionCounts.clear();
  }
}