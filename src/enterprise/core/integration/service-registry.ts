/**
 * @file Service Registry
 *
 * This file defines the service registry for enterprise integrations.
 * It allows services to register themselves and enables discovery of services
 * by other components, such as the API gateway.
 *
 * Focus areas:
 * - Scalability: Supports a large number of services and instances.
 * - Reliability: Ensures high availability of service information.
 * - Performance monitoring: Tracks the health and performance of registered services.
 */

interface IServiceDefinition {
  id: string;
  name: string;
  version: string;
  address: string; // e.g., IP:port or a resolvable hostname
  protocol: string; // e.g., 'http', 'grpc', 'amqp'
  metadata?: Record<string, any>; // Additional service-specific information
  healthCheckUrl?: string;
  status?: 'UP' | 'DOWN' | 'STARTING' | 'STOPPING';
}

interface IServiceRegistry {
  /**
   * Registers a new service instance.
   * @param service The definition of the service to register.
   */
  registerService(service: IServiceDefinition): Promise<void>;

  /**
   * Deregisters a service instance.
   * @param serviceId The ID of the service to deregister.
   */
  deregisterService(serviceId: string): Promise<void>;

  /**
   * Discovers service instances based on name or other criteria.
   * @param serviceName The name of the service to discover.
   * @returns A promise that resolves with a list of matching service instances.
   */
  discoverServices(serviceName: string): Promise<IServiceDefinition[]>;

  /**
   * Retrieves a specific service instance by its ID.
   * @param serviceId The ID of the service.
   * @returns A promise that resolves with the service definition or null if not found.
   */
  getServiceById(serviceId: string): Promise<IServiceDefinition | null>;

  /**
   * Updates the status of a service instance (e.g., for health checks).
   * @param serviceId The ID of the service.
   * @param status The new status of the service.
   */
  updateServiceStatus(serviceId: string, status: IServiceDefinition['status']): Promise<void>;
}

export class ServiceRegistry implements IServiceRegistry {
  private services: Map<string, IServiceDefinition> = new Map();

  constructor() {
    // TODO: Initialize connection to a persistent store if needed (e.g., etcd, Consul, ZooKeeper)
    console.log('Service Registry initialized.');
  }

  public async registerService(service: IServiceDefinition): Promise<void> {
    if (this.services.has(service.id)) {
      console.warn(`Service with ID ${service.id} already registered. Updating.`);
    }
    this.services.set(service.id, { ...service, status: 'UP' }); // Default to UP on registration
    console.log(`Service ${service.name} (ID: ${service.id}) registered at ${service.address}.`);
    // TODO: Persist registration if using an external store.
  }

  public async deregisterService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (service) {
      this.services.delete(serviceId);
      console.log(`Service ${service.name} (ID: ${serviceId}) deregistered.`);
      // TODO: Remove from persistent store.
    } else {
      console.warn(`Service with ID ${serviceId} not found for deregistration.`);
    }
  }

  public async discoverServices(serviceName: string): Promise<IServiceDefinition[]> {
    const foundServices: IServiceDefinition[] = [];
    this.services.forEach(service => {
      if (service.name === serviceName && service.status === 'UP') {
        foundServices.push(service);
      }
    });
    console.log(`Discovered ${foundServices.length} instances for service ${serviceName}.`);
    return foundServices;
  }

  public async getServiceById(serviceId: string): Promise<IServiceDefinition | null> {
    const service = this.services.get(serviceId);
    return service || null;
  }

  public async updateServiceStatus(serviceId: string, status: IServiceDefinition['status']): Promise<void> {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = status;
      this.services.set(serviceId, service);
      console.log(`Status of service ${service.name} (ID: ${serviceId}) updated to ${status}.`);
      // TODO: Persist status update.
    } else {
      console.warn(`Service with ID ${serviceId} not found for status update.`);
    }
  }
}

// Example usage (conceptual)
// const registry = new ServiceRegistry();
// const myService: IServiceDefinition = {
//   id: 'user-service-v1-instance1',
//   name: 'user-service',
//   version: '1.0.0',
//   address: '10.0.0.1:3000',
//   protocol: 'http',
//   healthCheckUrl: '/health'
// };
// registry.registerService(myService);
// registry.discoverServices('user-service').then(services => {
//   console.log('Found services:', services);
// });