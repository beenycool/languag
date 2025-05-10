// src/microservices/core/framework/discovery-service.ts

import { IServiceRegistry } from './service-registry';

/**
 * @interface IDiscoveryService
 * Defines the contract for a service discovery mechanism.
 */
export interface IDiscoveryService {
  /**
   * Discovers available instances for a given service.
   * @param serviceName - The name of the service to discover.
   * @returns A promise that resolves to an array of service instance URLs.
   * Returns an empty array if the service is not found or has no instances.
   */
  discoverService(serviceName: string): Promise<string[]>;

  /**
   * Watches for changes in a service's instances.
   * @param serviceName - The name of the service to watch.
   * @param callback - A function to call with the updated list of instances.
   *                   The callback receives an array of service URLs.
   * @returns A function to stop watching the service.
   */
  watchService(serviceName: string, callback: (instances: string[]) => void): () => void;
}

/**
 * @class DiscoveryService
 * Implements service discovery logic using a service registry.
 */
export class DiscoveryService implements IDiscoveryService {
  private registry: IServiceRegistry;
  private watchers: Map<string, Set<(instances: string[]) => void>>;
  private pollInterval: number;
  private pollTimer?: NodeJS.Timeout;


  /**
   * Creates an instance of DiscoveryService.
   * @param registry - An instance of IServiceRegistry to use for looking up services.
   * @param pollInterval - Interval in milliseconds to poll for service changes (for watchService). Defaults to 5000ms.
   */
  constructor(registry: IServiceRegistry, pollInterval: number = 5000) {
    this.registry = registry;
    this.watchers = new Map();
    this.pollInterval = pollInterval;
    this.startPolling();
    console.log('DiscoveryService initialized.');
  }

  /**
   * Discovers available instances for a given service.
   * @param serviceName - The name of the service to discover.
   * @returns A promise that resolves to an array of service instance URLs.
   */
  public async discoverService(serviceName: string): Promise<string[]> {
    try {
      const instances = await this.registry.getServiceInstances(serviceName);
      console.log(`Discovered ${instances.length} instances for service: ${serviceName}`);
      return instances;
    } catch (error) {
      console.error(`Error discovering service ${serviceName}:`, error);
      return [];
    }
  }

  /**
   * Watches for changes in a service's instances.
   * @param serviceName - The name of the service to watch.
   * @param callback - A function to call with the updated list of instances.
   * @returns A function to stop watching the service.
   */
  public watchService(serviceName: string, callback: (instances: string[]) => void): () => void {
    if (!this.watchers.has(serviceName)) {
      this.watchers.set(serviceName, new Set());
    }
    this.watchers.get(serviceName)!.add(callback);
    console.log(`Watcher added for service: ${serviceName}`);

    // Immediately provide current instances
    this.discoverService(serviceName).then(callback).catch(err => console.error(`Initial discovery failed for watcher on ${serviceName}:`, err));

    return () => {
      if (this.watchers.has(serviceName)) {
        this.watchers.get(serviceName)!.delete(callback);
        if (this.watchers.get(serviceName)!.size === 0) {
          this.watchers.delete(serviceName);
          console.log(`All watchers removed for service: ${serviceName}`);
        }
      }
    };
  }

  /**
   * Starts polling the registry for service changes to notify watchers.
   */
  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    this.pollTimer = setInterval(async () => {
      if (this.watchers.size === 0) {
        return; // No active watchers
      }
      // console.log('Polling for service updates...');
      for (const [serviceName, callbacks] of this.watchers) {
        if (callbacks.size > 0) {
          try {
            const currentInstances = await this.registry.getServiceInstances(serviceName);
            // A more sophisticated check would compare old vs new instances
            // For simplicity, we notify on every poll if there are watchers.
            // To avoid unnecessary notifications, one might store previous state and compare.
            callbacks.forEach(cb => cb(currentInstances));
          } catch (error) {
            console.error(`Error polling service ${serviceName} for watchers:`, error);
            // Optionally notify watchers of the error or an empty list
            callbacks.forEach(cb => cb([]));
          }
        }
      }
    }, this.pollInterval);
    console.log(`Polling started with interval: ${this.pollInterval}ms`);
  }

  /**
   * Stops the polling mechanism.
   * Call this when the discovery service is no longer needed to prevent resource leaks.
   */
  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      console.log('Polling stopped.');
    }
  }
}