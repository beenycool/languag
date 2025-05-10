// src/microservices/core/framework/service-registry.ts

/**
 * @interface IServiceRegistry
 * Defines the contract for a service registry.
 */
export interface IServiceRegistry {
  /**
   * Registers a service instance.
   * @param serviceName - The name of the service.
   * @param serviceUrl - The URL or endpoint of the service.
   * @param metadata - Optional metadata about the service.
   */
  registerService(serviceName: string, serviceUrl: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Deregisters a service instance.
   * @param serviceName - The name of the service.
   * @param serviceUrl - The URL or endpoint of the service.
   */
  deregisterService(serviceName: string, serviceUrl: string): Promise<void>;

  /**
   * Retrieves a list of available instances for a given service.
   * @param serviceName - The name of the service.
   * @returns A promise that resolves to an array of service URLs.
   */
  getServiceInstances(serviceName: string): Promise<string[]>;

  /**
   * Lists all registered services.
   * @returns A promise that resolves to an array of service names.
   */
  listServices(): Promise<string[]>;
}

/**
 * @class ServiceRegistry
 * Provides a basic implementation for service registration and discovery.
 * This class is designed to be extended or used with a persistent store in a real-world scenario.
 */
export class ServiceRegistry implements IServiceRegistry {
  private services: Map<string, Set<string>>;
  private serviceMetadata: Map<string, Record<string, any>>;

  constructor() {
    this.services = new Map<string, Set<string>>();
    this.serviceMetadata = new Map<string, Record<string, any>>();
    console.log('ServiceRegistry initialized.');
  }

  /**
   * Registers a service instance.
   * @param serviceName - The name of the service.
   * @param serviceUrl - The URL or endpoint of the service.
   * @param metadata - Optional metadata about the service.
   */
  public async registerService(serviceName: string, serviceUrl: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, new Set<string>());
    }
    this.services.get(serviceName)!.add(serviceUrl);
    if (metadata) {
      this.serviceMetadata.set(`${serviceName}:${serviceUrl}`, metadata);
    }
    console.log(`Service registered: ${serviceName} at ${serviceUrl}`);
  }

  /**
   * Deregisters a service instance.
   * @param serviceName - The name of the service.
   * @param serviceUrl - The URL or endpoint of the service.
   */
  public async deregisterService(serviceName: string, serviceUrl: string): Promise<void> {
    if (this.services.has(serviceName)) {
      this.services.get(serviceName)!.delete(serviceUrl);
      this.serviceMetadata.delete(`${serviceName}:${serviceUrl}`);
      if (this.services.get(serviceName)!.size === 0) {
        this.services.delete(serviceName);
      }
      console.log(`Service deregistered: ${serviceName} at ${serviceUrl}`);
    } else {
      console.warn(`Service not found for deregistration: ${serviceName}`);
    }
  }

  /**
   * Retrieves a list of available instances for a given service.
   * @param serviceName - The name of the service.
   * @returns A promise that resolves to an array of service URLs.
   */
  public async getServiceInstances(serviceName: string): Promise<string[]> {
    if (this.services.has(serviceName)) {
      const instances = Array.from(this.services.get(serviceName)!);
      console.log(`Found ${instances.length} instances for service: ${serviceName}`);
      return instances;
    }
    console.log(`No instances found for service: ${serviceName}`);
    return [];
  }

  /**
   * Lists all registered services.
   * @returns A promise that resolves to an array of service names.
   */
  public async listServices(): Promise<string[]> {
    const serviceNames = Array.from(this.services.keys());
    console.log(`Available services: ${serviceNames.join(', ')}`);
    return serviceNames;
  }

  /**
   * Retrieves metadata for a specific service instance.
   * @param serviceName - The name of the service.
   * @param serviceUrl - The URL of the service instance.
   * @returns A promise that resolves to the service metadata or undefined if not found.
   */
  public async getServiceMetadata(serviceName: string, serviceUrl: string): Promise<Record<string, any> | undefined> {
    return this.serviceMetadata.get(`${serviceName}:${serviceUrl}`);
  }
}