// src/mesh/core/control/service-registry.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';

export interface ServiceRegistryOptions {
  logger?: ILoggingService;
}

export interface ServiceInstance {
  id: string; // Unique instance ID
  host: string;
  port: number;
  version?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  lastHeartbeat?: number;
  status?: 'UP' | 'DOWN' | 'STARTING' | 'UNKNOWN';
}

export interface ServiceDefinition {
  serviceId: string;
  instances: Map<string, ServiceInstance>; // Keyed by instanceId
  // other service-level config
}

type ServiceRegistryChangeListener = (
  eventType: 'REGISTER' | 'DEREGISTER' | 'UPDATE_METADATA' | 'HEARTBEAT_FAIL',
  serviceId: string,
  instance?: ServiceInstance | null,
  serviceDefinition?: ServiceDefinition | null
) => void;

export class ServiceRegistry {
  private services: Map<string, ServiceDefinition>; // Keyed by serviceId
  private logger?: ILoggingService;
  private listeners: Set<ServiceRegistryChangeListener>;

  constructor(options?: ServiceRegistryOptions) {
    this.services = new Map();
    this.logger = options?.logger;
    this.listeners = new Set();
    this.log(LogLevel.INFO, 'ServiceRegistry initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    if (this.logger) {
      this.logger.log(level, `[ServiceRegistry] ${message}`, context);
    }
  }

  public async registerService(serviceId: string, instanceInfo: Omit<ServiceInstance, 'id' | 'lastHeartbeat' | 'status'> & { instanceId: string }): Promise<void> {
    if (!this.services.has(serviceId)) {
      this.services.set(serviceId, { serviceId, instances: new Map() });
    }
    const serviceDef = this.services.get(serviceId)!;
    const instance: ServiceInstance = {
      ...instanceInfo,
      id: instanceInfo.instanceId,
      lastHeartbeat: Date.now(),
      status: 'UP',
    };
    serviceDef.instances.set(instance.id, instance);
    this.log(LogLevel.INFO, `Service instance registered: ${serviceId}/${instance.id}`, instance);
    this.notifyListeners('REGISTER', serviceId, instance, serviceDef);
  }

  public async deregisterService(serviceId: string, instanceId: string): Promise<void> {
    const serviceDef = this.services.get(serviceId);
    if (serviceDef && serviceDef.instances.has(instanceId)) {
      const instance = serviceDef.instances.get(instanceId)!;
      serviceDef.instances.delete(instanceId);
      if (serviceDef.instances.size === 0) {
        // Optionally remove the service definition if no instances are left
        // this.services.delete(serviceId);
      }
      this.log(LogLevel.INFO, `Service instance deregistered: ${serviceId}/${instanceId}`);
      this.notifyListeners('DEREGISTER', serviceId, instance, serviceDef);
    } else {
      this.log(LogLevel.WARN, `Attempted to deregister non-existent instance: ${serviceId}/${instanceId}`);
    }
  }

  public async getServiceEndpoints(serviceId: string): Promise<ServiceInstance[]> {
    const serviceDef = this.services.get(serviceId);
    if (serviceDef) {
      return Array.from(serviceDef.instances.values()).filter(inst => inst.status === 'UP');
    }
    return [];
  }

  public async getAllServices(): Promise<Record<string, ServiceDefinition>> {
    return Object.fromEntries(this.services);
  }
  
  public async updateServiceMetadata(serviceId: string, instanceId: string, metadata: Record<string, any>): Promise<void> {
    const serviceDef = this.services.get(serviceId);
    const instance = serviceDef?.instances.get(instanceId);
    if (instance) {
      instance.metadata = { ...instance.metadata, ...metadata };
      instance.lastHeartbeat = Date.now(); // Consider metadata update as a sign of life
      this.log(LogLevel.DEBUG, `Metadata updated for ${serviceId}/${instanceId}`, metadata);
      this.notifyListeners('UPDATE_METADATA', serviceId, instance, serviceDef);
    }
  }

  public subscribeToChanges(listener: ServiceRegistryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(
    eventType: 'REGISTER' | 'DEREGISTER' | 'UPDATE_METADATA' | 'HEARTBEAT_FAIL',
    serviceId: string,
    instance?: ServiceInstance | null,
    serviceDefinition?: ServiceDefinition | null
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(eventType, serviceId, instance, serviceDefinition);
      } catch (error) {
        this.log(LogLevel.ERROR, `Error in ServiceRegistry listener for event ${eventType} on ${serviceId}`, { error });
      }
    });
  }

  // Placeholder for heartbeat mechanism, health checks, etc.
}