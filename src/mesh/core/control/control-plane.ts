// src/mesh/core/control/control-plane.ts
import { ServiceRegistry } from './service-registry';
import { ConfigurationManager } from './configuration-manager';
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service'; // Assuming a logger might be used

export interface ControlPlaneOptions {
  logger?: ILoggingService;
}

export class ControlPlane {
  private serviceRegistry: ServiceRegistry;
  private configManager: ConfigurationManager;
  private logger?: ILoggingService;

  constructor(options?: ControlPlaneOptions) {
    this.logger = options?.logger;
    this.serviceRegistry = new ServiceRegistry({ logger: this.logger });
    this.configManager = new ConfigurationManager({ logger: this.logger });

    this.log(LogLevel.INFO, 'ControlPlane initialized.');
    this.setupEventHandlers();
  }

  private log(level: LogLevel, message: string, context?: any) {
    if (this.logger) {
      this.logger.log(level, `[ControlPlane] ${message}`, context);
    } else {
      // Fallback console logging if no logger is provided
      // console.log(`[ControlPlane] [${level.toUpperCase()}] ${message}`, context || '');
    }
  }

  private setupEventHandlers(): void {
    // Example: Listen to configuration changes and propagate them
    // this.configManager.onConfigChange('*', (serviceId, newConfig) => { // Assuming wildcard for all services or global
    //   this.log(LogLevel.INFO, `Configuration changed for ${serviceId || 'global'}, propagating...`, newConfig);
    //   this.propagateConfiguration(serviceId, newConfig);
    // });

    // Example: Listen to service registry changes
    // this.serviceRegistry.subscribeToChanges((eventType, serviceId, serviceInfo) => {
    //   this.log(LogLevel.INFO, `Service registry event: ${eventType} for ${serviceId}`, serviceInfo);
    //   this.handleRegistryUpdate(eventType, serviceId, serviceInfo);
    // });
    this.log(LogLevel.DEBUG, 'Event handlers setup.');
  }

  // Placeholder for actual methods that will be tested and implemented
  public async registerService(serviceId: string, serviceInfo: any): Promise<void> {
    this.log(LogLevel.INFO, `Registering service: ${serviceId}`, serviceInfo);
    await this.serviceRegistry.registerService(serviceId, serviceInfo);
  }

  public async deregisterService(serviceId: string): Promise<void> {
    this.log(LogLevel.INFO, `Deregistering service: ${serviceId}`);
    await this.serviceRegistry.deregisterService(serviceId);
  }

  public async getServiceEndpoints(serviceId: string): Promise<any[]> {
    this.log(LogLevel.DEBUG, `Fetching endpoints for service: ${serviceId}`);
    return this.serviceRegistry.getServiceEndpoints(serviceId);
  }

  public async updateGlobalConfiguration(config: any): Promise<void> {
    this.log(LogLevel.INFO, 'Updating global configuration', config);
    await this.configManager.updateGlobalConfig(config);
    // Potentially trigger propagation to all services/proxies
  }

  public async updateServiceConfiguration(serviceId: string, config: any): Promise<void> {
    this.log(LogLevel.INFO, `Updating configuration for service: ${serviceId}`, config);
    await this.configManager.updateServiceConfig(serviceId, config);
    // Potentially trigger propagation to specific service/proxies
  }

  // private propagateConfiguration(serviceId: string | null, config: any): void {
  //   // Logic to send updated configuration to relevant proxies/services
  //   this.log(LogLevel.DEBUG, `Propagating config for ${serviceId || 'global'}`, config);
  // }

  // private handleRegistryUpdate(eventType: string, serviceId: string, serviceInfo: any): void {
  //   // Logic to react to service registration/deregistration
  //   // e.g., update routing rules, notify proxies
  //   this.log(LogLevel.DEBUG, `Handling registry update: ${eventType} for ${serviceId}`, serviceInfo);
  // }

  public dispose(): void {
    this.log(LogLevel.INFO, 'Disposing ControlPlane resources.');
    // Unsubscribe from events, cleanup timers, etc.
    // if (this.serviceRegistry.dispose) this.serviceRegistry.dispose();
    // if (this.configManager.dispose) this.configManager.dispose();
  }
}