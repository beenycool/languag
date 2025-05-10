// src/mesh/utils/configuration/mesh-config.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { ConfigurationManager, MeshGlobalConfig, MeshServiceConfig } from '../../core/control/configuration-manager';
import { SecurityPolicy } from '../../features/security/policy-enforcer'; // Example: if mesh-config aggregates these
import { RouteRule } from '../routing/route-manager'; // Example
import { RetryPolicy } from '../routing/retry-handler'; // Example

// This utility might provide a typed and validated view over the raw configuration
// fetched by ConfigurationManager, or provide convenient accessors.

export interface AggregatedMeshConfig {
  globalSettings: MeshGlobalConfig;
  // Specific configurations for different aspects of the mesh
  routingRules?: RouteRule[];
  securityPolicies?: SecurityPolicy[];
  retryPolicies?: RetryPolicy[];
  // serviceDefaults?: Record<string, MeshServiceConfig>; // Default configs for service types
  // featureFlags?: Record<string, boolean>;
  // Add other structured configuration sections as needed
}

export interface IMeshConfigProvider {
  /**
   * Gets the fully aggregated and potentially validated mesh configuration.
   */
  getAggregatedConfig(): Promise<AggregatedMeshConfig>;

  /**
   * Gets a specific section of the mesh configuration, e.g., routing rules.
   * @param sectionKey - Key for the configuration section.
   */
  getConfigSection<T>(sectionKey: keyof Omit<AggregatedMeshConfig, 'globalSettings'>): Promise<T | undefined>;
  
  /**
   * Gets global mesh settings.
   */
  getGlobalSettings(): Promise<MeshGlobalConfig>;

  /**
   * Gets specific configuration for a service, potentially merged with defaults.
   * @param serviceId - The ID of the service.
   */
  getServiceEffectiveConfig(serviceId: string): Promise<MeshServiceConfig>;
  
  /**
   * Reloads configuration from the source (ConfigurationManager).
   */
  refreshConfig(): Promise<void>;
}

/**
 * Provides a structured and potentially validated access to mesh-wide configurations.
 * It uses ConfigurationManager as its source of truth.
 */
export class MeshConfigProvider implements IMeshConfigProvider {
  private logger?: ILoggingService;
  private configManager: ConfigurationManager;
  private lastLoadedConfig?: AggregatedMeshConfig; // Cache the loaded/processed config

  constructor(configManager: ConfigurationManager, logger?: ILoggingService) {
    this.logger = logger;
    this.configManager = configManager;
    this.log(LogLevel.INFO, 'MeshConfigProvider initialized.');
    // Initial load or lazy load on first access
    // this.refreshConfig().catch(err => this.log(LogLevel.ERROR, "Initial config load failed", { error: err.message }));
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[MeshConfigProvider] ${message}`, context);
  }

  public async refreshConfig(): Promise<void> {
    this.log(LogLevel.INFO, 'Refreshing mesh configuration...');
    try {
      const globalConfig = await this.configManager.getGlobalConfig();
      // Assuming other specific configs are also stored within globalConfig or fetched separately
      // For this placeholder, we'll assume they are part of globalConfig as structured properties.
      
      this.lastLoadedConfig = {
        globalSettings: globalConfig,
        routingRules: (globalConfig.routingRules as RouteRule[] || undefined),
        securityPolicies: (globalConfig.securityPolicies as SecurityPolicy[] || undefined),
        retryPolicies: (globalConfig.retryPolicies as RetryPolicy[] || undefined),
        // featureFlags: (globalConfig.featureFlags as Record<string,boolean> || undefined),
      };
      this.log(LogLevel.INFO, 'Mesh configuration refreshed successfully.');
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'Failed to refresh mesh configuration', { error: error.message });
      // Decide on error handling: throw, use stale cache, or clear cache
      this.lastLoadedConfig = undefined; // Example: clear cache on error
      throw error; // Re-throw so callers are aware
    }
  }

  private async ensureConfigLoaded(): Promise<AggregatedMeshConfig> {
    if (!this.lastLoadedConfig) {
      await this.refreshConfig();
    }
    if (!this.lastLoadedConfig) { // Should only happen if refreshConfig failed and didn't throw
        throw new Error("Mesh configuration is not available.");
    }
    return this.lastLoadedConfig;
  }

  public async getAggregatedConfig(): Promise<AggregatedMeshConfig> {
    return this.ensureConfigLoaded();
  }

  public async getConfigSection<T>(sectionKey: keyof Omit<AggregatedMeshConfig, 'globalSettings'>): Promise<T | undefined> {
    const config = await this.ensureConfigLoaded();
    return config[sectionKey] as T | undefined;
  }
  
  public async getGlobalSettings(): Promise<MeshGlobalConfig> {
    const config = await this.ensureConfigLoaded();
    return config.globalSettings;
  }

  public async getServiceEffectiveConfig(serviceId: string): Promise<MeshServiceConfig> {
    // This would fetch service-specific config and merge with global defaults
    // and potentially other applicable defaults.
    // Relies on ConfigurationManager's ability to provide this.
    this.log(LogLevel.DEBUG, `Getting effective config for service: ${serviceId}`);
    return this.configManager.getServiceConfig(serviceId); // ConfigurationManager already handles fallbacks
  }
}