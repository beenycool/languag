// src/mesh/core/control/configuration-manager.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';

export interface ConfigurationManagerOptions {
  logger?: ILoggingService;
  // Potentially a config store (e.g., etcd, Consul, DB adapter)
  // configStore?: IConfigStore; 
}

export interface MeshGlobalConfig {
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  // other global settings
  [key: string]: any; 
}

export interface MeshServiceConfig {
  timeoutMs?: number;
  retries?: number;
  loadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'RANDOM';
  // other service-specific settings
  [key: string]: any;
}

type ConfigChangeListener = (
  configType: 'GLOBAL' | 'SERVICE',
  serviceId: string | null, // null for global config
  newConfig: MeshGlobalConfig | MeshServiceConfig
) => void;


export class ConfigurationManager {
  private globalConfig: MeshGlobalConfig;
  private serviceConfigs: Map<string, MeshServiceConfig>; // Keyed by serviceId
  private logger?: ILoggingService;
  private listeners: Set<ConfigChangeListener>;

  constructor(options?: ConfigurationManagerOptions) {
    this.logger = options?.logger;
    this.globalConfig = { defaultTimeoutMs: 2000, defaultRetries: 1 }; // Default global config
    this.serviceConfigs = new Map();
    this.listeners = new Set();
    this.log(LogLevel.INFO, 'ConfigurationManager initialized.');
    // In a real scenario, this might load initial config from a persistent store
  }

  private log(level: LogLevel, message: string, context?: any) {
    if (this.logger) {
      this.logger.log(level, `[ConfigManager] ${message}`, context);
    }
  }

  public async getGlobalConfig(): Promise<MeshGlobalConfig> {
    // In a real system, might fetch from a distributed config store
    return { ...this.globalConfig };
  }

  public async updateGlobalConfig(newConfig: Partial<MeshGlobalConfig>): Promise<void> {
    this.globalConfig = { ...this.globalConfig, ...newConfig };
    this.log(LogLevel.INFO, 'Global configuration updated.', this.globalConfig);
    this.notifyListeners('GLOBAL', null, this.globalConfig);
    // Persist to store if applicable
  }

  public async getServiceConfig(serviceId: string): Promise<MeshServiceConfig> {
    // Fallback to global defaults if service-specific config doesn't exist or lacks properties
    const serviceSpecific = this.serviceConfigs.get(serviceId) || {};
    const defaults = {
      timeoutMs: this.globalConfig.defaultTimeoutMs,
      retries: this.globalConfig.defaultRetries,
    };
    return { ...defaults, ...serviceSpecific };
  }

  public async updateServiceConfig(serviceId: string, newConfig: Partial<MeshServiceConfig>): Promise<void> {
    const currentConfig = this.serviceConfigs.get(serviceId) || {};
    const updatedConfig = { ...currentConfig, ...newConfig };
    this.serviceConfigs.set(serviceId, updatedConfig);
    this.log(LogLevel.INFO, `Configuration updated for service: ${serviceId}`, updatedConfig);
    this.notifyListeners('SERVICE', serviceId, updatedConfig);
    // Persist to store if applicable
  }
  
  public onConfigChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(
    configType: 'GLOBAL' | 'SERVICE',
    serviceId: string | null,
    newConfig: MeshGlobalConfig | MeshServiceConfig
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(configType, serviceId, newConfig);
      } catch (error) {
        this.log(LogLevel.ERROR, `Error in ConfigManager listener for ${configType} config (service: ${serviceId || 'N/A'})`, { error });
      }
    });
  }
  
  // public async loadInitialConfig(): Promise<void> {
  //   // Load from a persistent store or default files
  // }

  // public dispose(): void {
  //   this.log(LogLevel.INFO, 'Disposing ConfigurationManager resources.');
  //   this.listeners.clear();
  // }
}