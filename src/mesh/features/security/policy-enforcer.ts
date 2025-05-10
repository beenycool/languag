// src/mesh/features/security/policy-enforcer.ts
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';
import { AuthContext } from './auth-manager'; // Assuming AuthContext is relevant for policy decisions
import { ConfigurationManager } from '../../core/control/configuration-manager'; // To fetch policies

export interface PolicyEvaluationContext {
  sourceService?: string; // Identity of the source service
  destinationService?: string; // Identity of the destination service
  destinationPort?: number;
  protocol?: 'HTTP' | 'TCP' | 'GRPC'; // Example protocols
  path?: string; // For HTTP/gRPC
  method?: string; // For HTTP
  authContext?: AuthContext; // Authentication context of the caller
  // Add other relevant context attributes
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string; // Reason for denial or specific policy that matched
  matchedPolicyId?: string;
}

export interface SecurityPolicy {
  id: string;
  description?: string;
  // Example policy structure:
  source?: {
    principals?: string[]; // e.g., service IDs, user IDs, group IDs
    namespaces?: string[];
  };
  destination?: {
    services?: string[]; // e.g., service IDs
    ports?: number[];
    paths?: { pathPrefix: string; methods?: string[] }[];
  };
  action: 'ALLOW' | 'DENY';
  // conditions?: any[]; // More complex conditions
}


export interface IPolicyEnforcer {
  /**
   * Evaluates if a given action/request is allowed based on configured security policies.
   * @param evalContext - The context of the request/action to be evaluated.
   * @returns A PolicyDecision indicating if the action is allowed and why.
   */
  evaluate(evalContext: PolicyEvaluationContext): Promise<PolicyDecision>;

  /**
   * Loads or reloads policies, potentially from a ConfigurationManager.
   */
  loadPolicies(): Promise<void>;
}

/**
 * Enforces security policies within the mesh (e.g., network policies, service-to-service access control).
 * It would typically fetch policies from a ConfigurationManager or a dedicated policy store.
 */
export class PolicyEnforcer implements IPolicyEnforcer {
  private logger?: ILoggingService;
  private configManager: ConfigurationManager; // Used to fetch policies
  private policies: SecurityPolicy[]; // In-memory cache of policies

  constructor(configManager: ConfigurationManager, logger?: ILoggingService) {
    this.logger = logger;
    this.configManager = configManager;
    this.policies = [];
    this.log(LogLevel.INFO, 'PolicyEnforcer initialized.');
    // Initial policy load can be triggered here or explicitly
    // this.loadPolicies().catch(err => this.log(LogLevel.ERROR, "Failed to load initial policies", { error: err.message }));
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[PolicyEnforcer] ${message}`, context);
  }

  public async loadPolicies(): Promise<void> {
    this.log(LogLevel.INFO, 'Loading security policies...');
    try {
      // Assume policies are stored under a specific key in ConfigurationManager,
      // e.g., as a global config or a special service config key.
      // This is a placeholder for how policies are actually fetched.
      const rawPolicies = await this.configManager.getGlobalConfig(); // Or a specific key like 'meshSecurityPolicies'
      
      if (rawPolicies && rawPolicies.securityPolicies && Array.isArray(rawPolicies.securityPolicies)) {
        this.policies = rawPolicies.securityPolicies as SecurityPolicy[];
        this.log(LogLevel.INFO, `Successfully loaded ${this.policies.length} security policies.`);
      } else {
        this.log(LogLevel.WARN, 'No security policies found or in unexpected format in configuration.');
        this.policies = [];
      }
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'Failed to load security policies', { error: error.message });
      // Decide if old policies should be kept or cleared on load failure
      this.policies = []; // Clearing policies on load failure for safety, could be configurable
    }
  }

  public async evaluate(evalContext: PolicyEvaluationContext): Promise<PolicyDecision> {
    this.log(LogLevel.DEBUG, 'Evaluating policies for context:', evalContext);

    if (this.policies.length === 0) {
      this.log(LogLevel.WARN, 'No policies loaded. Defaulting to deny (or allow, based on security posture). For now, deny.');
      // Default deny if no policies are loaded is generally safer.
      return { allowed: false, reason: 'No policies loaded, default deny.' };
    }

    // Policy evaluation logic:
    // Iterate through policies. First match determines outcome.
    // Order of policies can be significant.
    // This is a simplified example. Real policy engines can be complex (e.g., OPA).

    for (const policy of this.policies) {
      let match = true;

      // Source matching
      if (policy.source) {
        if (policy.source.principals && evalContext.authContext?.userId && !policy.source.principals.includes(evalContext.authContext.userId)) {
          if (evalContext.sourceService && !policy.source.principals.includes(evalContext.sourceService)) {
            match = false;
          } else if (!evalContext.sourceService) { // if no sourceService, principal must match userId
             match = false;
          }
        }
        // Add namespace matching if needed
      }

      // Destination matching
      if (match && policy.destination) {
        if (policy.destination.services && evalContext.destinationService && !policy.destination.services.includes(evalContext.destinationService)) {
          match = false;
        }
        if (match && policy.destination.ports && evalContext.destinationPort && !policy.destination.ports.includes(evalContext.destinationPort)) {
          match = false;
        }
        if (match && policy.destination.paths && evalContext.path) {
          const pathMatch = policy.destination.paths.some(p => {
            let currentPathMatch = evalContext.path!.startsWith(p.pathPrefix);
            if (currentPathMatch && p.methods && evalContext.method && !p.methods.map(m => m.toUpperCase()).includes(evalContext.method.toUpperCase())) {
              currentPathMatch = false;
            }
            return currentPathMatch;
          });
          if (!pathMatch) match = false;
        }
      }
      
      // If all conditions of the policy matched
      if (match) {
        this.log(LogLevel.INFO, `Policy matched: ${policy.id} (${policy.action}) for context.`, { policy });
        return {
          allowed: policy.action === 'ALLOW',
          reason: `Policy ID: ${policy.id} (${policy.description || ''})`,
          matchedPolicyId: policy.id,
        };
      }
    }

    // Default action if no policies match (e.g., default deny)
    this.log(LogLevel.INFO, 'No specific policy matched. Defaulting to deny.');
    return { allowed: false, reason: 'Default deny: No matching policy found.' };
  }
}