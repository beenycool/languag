// src/mesh/utils/configuration/security-config.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { IMeshConfigProvider } from './mesh-config'; // To get global security settings
import { MeshGlobalConfig } from '../../core/control/configuration-manager';

// Define specific types for mesh-wide security settings
export interface MeshSecuritySettings {
  mTLSEnabled?: boolean; // Is mesh-wide mTLS enabled by default?
  defaultAuthPolicy?: string; // Name/ID of a default authentication policy
  permissiveMode?: boolean; // If true, might allow traffic even if policies are not perfectly matched (for onboarding)
  certificateAuthority?: {
    type: 'INTERNAL' | 'EXTERNAL_SPIFFE' | 'FILE_BASED';
    uri?: string; // e.g., SPIFFE endpoint, path to CA files
  };
  // Add other global security settings as needed
  allowedCipherSuites?: string[];
  egressPolicy?: 'ALLOW_ANY' | 'REGISTRY_ONLY'; // Controls outbound traffic not explicitly allowed by policies
}

export interface ISecurityConfigProvider {
  /**
   * Gets the mesh-wide security settings.
   */
  getMeshSecuritySettings(): Promise<MeshSecuritySettings | null>;

  /**
   * Checks if mTLS is globally enabled for the mesh.
   */
  isMTLSEnabled(): Promise<boolean>;
  
  /**
   * Gets the configuration for the mesh's Certificate Authority.
   */
  getCertificateAuthorityConfig(): Promise<MeshSecuritySettings['certificateAuthority'] | undefined>;

  /**
   * Reloads security settings from the underlying MeshConfigProvider.
   */
  refreshSecuritySettings(): Promise<void>;
}

/**
 * Provides specific access to mesh-wide security configurations.
 * It uses IMeshConfigProvider as its source, looking typically at global settings.
 */
export class SecurityConfigProvider implements ISecurityConfigProvider {
  private logger?: ILoggingService;
  private meshConfigProvider: IMeshConfigProvider;
  private lastLoadedSettings?: MeshSecuritySettings; // Optional cache

  constructor(meshConfigProvider: IMeshConfigProvider, logger?: ILoggingService) {
    this.logger = logger;
    this.meshConfigProvider = meshConfigProvider;
    this.log(LogLevel.INFO, 'SecurityConfigProvider initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[SecurityConfigProvider] ${message}`, context);
  }

  public async refreshSecuritySettings(): Promise<void> {
    this.log(LogLevel.DEBUG, 'Refreshing mesh security settings via MeshConfigProvider.');
    if (typeof (this.meshConfigProvider as any).refreshConfig === 'function') {
        await (this.meshConfigProvider as any).refreshConfig();
    }
    const globalSettings = await this.meshConfigProvider.getGlobalSettings();
    
    // Assume security settings are part of the global config, or under a specific key
    // For this placeholder, we'll extract known fields.
    if (globalSettings) {
      this.lastLoadedSettings = {
        mTLSEnabled: globalSettings.mTLSEnabled as boolean | undefined,
        defaultAuthPolicy: globalSettings.defaultAuthPolicy as string | undefined,
        permissiveMode: globalSettings.permissiveMode as boolean | undefined,
        certificateAuthority: globalSettings.certificateAuthority as MeshSecuritySettings['certificateAuthority'] | undefined,
        allowedCipherSuites: globalSettings.allowedCipherSuites as string[] | undefined,
        egressPolicy: globalSettings.egressPolicy as MeshSecuritySettings['egressPolicy'] | undefined,
      };
      this.log(LogLevel.INFO, 'Mesh security settings refreshed.', this.lastLoadedSettings);
    } else {
      this.log(LogLevel.WARN, 'No global settings found to extract security settings.');
      this.lastLoadedSettings = undefined;
    }
  }

  private async ensureSettingsLoaded(): Promise<MeshSecuritySettings | null> {
    if (this.lastLoadedSettings === undefined) { // Check for undefined to allow null to be cached
      await this.refreshSecuritySettings();
    }
    return this.lastLoadedSettings || null; // Return null if still not loaded (e.g. error during refresh)
  }

  public async getMeshSecuritySettings(): Promise<MeshSecuritySettings | null> {
    return this.ensureSettingsLoaded();
  }

  public async isMTLSEnabled(): Promise<boolean> {
    const settings = await this.ensureSettingsLoaded();
    // Default to false or a secure default if not explicitly set
    return settings?.mTLSEnabled ?? false; 
  }
  
  public async getCertificateAuthorityConfig(): Promise<MeshSecuritySettings['certificateAuthority'] | undefined> {
    const settings = await this.ensureSettingsLoaded();
    return settings?.certificateAuthority;
  }
}