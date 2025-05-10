// src/mesh/utils/configuration/policy-config.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { IMeshConfigProvider } from './mesh-config'; // To get security policies section
import { SecurityPolicy } from '../../features/security/policy-enforcer';

export interface IPolicyConfigProvider {
  /**
   * Gets all security policies.
   * @returns A promise resolving to an array of SecurityPolicy objects, or an empty array if none are found.
   */
  getAllSecurityPolicies(): Promise<SecurityPolicy[]>;

  /**
   * Gets a specific security policy by its ID.
   * @param policyId - The ID of the policy.
   * @returns A promise resolving to the SecurityPolicy or null if not found.
   */
  getSecurityPolicyById(policyId: string): Promise<SecurityPolicy | null>;
  
  /**
   * Finds policies that might apply to a given service (e.g., as a source or destination principal/service).
   * This is a simplified search; real-world matching would be more complex.
   * @param serviceId - The service ID to find policies for.
   * @param role - Optional: 'source', 'destination', or 'any' to filter policies where the serviceId appears in that role.
   * @returns A promise resolving to an array of matching SecurityPolicy objects.
   */
  findPoliciesForService(serviceId: string, role?: 'source' | 'destination' | 'any'): Promise<SecurityPolicy[]>;
  
  /**
   * Reloads policies from the underlying MeshConfigProvider.
   */
  refreshPolicies(): Promise<void>;
}

/**
 * Provides specific access to security policy configurations,
 * potentially with validation or specialized query methods.
 * It uses IMeshConfigProvider as its source.
 */
export class PolicyConfigProvider implements IPolicyConfigProvider {
  private logger?: ILoggingService;
  private meshConfigProvider: IMeshConfigProvider;
  private lastLoadedPolicies?: SecurityPolicy[]; // Optional cache

  constructor(meshConfigProvider: IMeshConfigProvider, logger?: ILoggingService) {
    this.logger = logger;
    this.meshConfigProvider = meshConfigProvider;
    this.log(LogLevel.INFO, 'PolicyConfigProvider initialized.');
    // Initial load or lazy load
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[PolicyConfigProvider] ${message}`, context);
  }

  public async refreshPolicies(): Promise<void> {
    this.log(LogLevel.DEBUG, 'Refreshing security policies via MeshConfigProvider.');
    // Force refresh in the underlying provider if it supports it, or just re-fetch
    if (typeof (this.meshConfigProvider as any).refreshConfig === 'function') {
        await (this.meshConfigProvider as any).refreshConfig();
    }
    // Then update local cache
    const policies = await this.meshConfigProvider.getConfigSection<SecurityPolicy[]>('securityPolicies');
    this.lastLoadedPolicies = policies || [];
    this.log(LogLevel.INFO, `Security policies refreshed, loaded ${this.lastLoadedPolicies.length} policies.`);
  }

  private async ensurePoliciesLoaded(): Promise<SecurityPolicy[]> {
    if (!this.lastLoadedPolicies) {
      await this.refreshPolicies();
    }
    return this.lastLoadedPolicies || []; // Should be populated after refresh
  }

  public async getAllSecurityPolicies(): Promise<SecurityPolicy[]> {
    return this.ensurePoliciesLoaded();
  }

  public async getSecurityPolicyById(policyId: string): Promise<SecurityPolicy | null> {
    const policies = await this.ensurePoliciesLoaded();
    const foundPolicy = policies.find(p => p.id === policyId);
    if (!foundPolicy) {
        this.log(LogLevel.DEBUG, `Security policy with ID not found: ${policyId}`);
    }
    return foundPolicy || null;
  }
  
  public async findPoliciesForService(serviceId: string, role?: 'source' | 'destination' | 'any'): Promise<SecurityPolicy[]> {
    const policies = await this.ensurePoliciesLoaded();
    if (!serviceId) return policies; // Or empty array if serviceId is mandatory for filtering

    return policies.filter(p => {
      let matchesSource = false;
      if (p.source?.principals?.includes(serviceId)) {
        matchesSource = true;
      }
      // Add more source matching logic if needed (e.g., namespaces)

      let matchesDestination = false;
      if (p.destination?.services?.includes(serviceId)) {
        matchesDestination = true;
      }
      // Add more destination matching logic if needed (e.g., paths, ports specific to service)

      if (role === 'source') return matchesSource;
      if (role === 'destination') return matchesDestination;
      // Default or 'any' role
      return matchesSource || matchesDestination;
    });
  }
}