/**
 * @file Manages security policies and validation.
 */
import {
  SecurityPrincipal,
  SecurityPolicy,
  PermissionLevel,
  AccessControlEntry,
  SecurityContext,
} from '../types/security-types';
import { Message } from '../types/message-types';
// import { logger } from '../../services/logger';
// import { ConfigManager } from '../../services/config-manager'; // Assuming ConfigManager for loading policies

const DEFAULT_POLICY: SecurityPolicy = {
  version: '1.0.0',
  defaultPermissions: PermissionLevel.NONE,
  rules: [
    // Example: Allow main process to do anything with its own resources
    {
      principal: { id: 'main', context: SecurityContext.MAIN_PROCESS, origin: 'self' },
      resource: 'file://self/*', // Special keyword for self-owned resources
      permissions: PermissionLevel.ADMIN,
      allow: true,
    },
    // Example: Allow renderer to read/write to a specific app data path
    {
      principal: { id: '*', context: SecurityContext.RENDERER_PROCESS }, // Applies to any renderer
      resource: 'appdata://*', // Placeholder for app-specific data directory
      permissions: PermissionLevel.READ | PermissionLevel.WRITE,
      allow: true,
    },
    // Example: Deny worker processes from accessing file system by default
    {
      principal: { id: '*', context: SecurityContext.WORKER_PROCESS },
      resource: 'file://*',
      permissions: PermissionLevel.ADMIN, // Deny all file access
      allow: false,
    },
  ],
};

export class SecurityManager {
  private currentPolicy: SecurityPolicy;

  constructor(/*configManager?: ConfigManager*/) {
    // In a real app, load policy from configManager or a secure store
    // this.currentPolicy = configManager?.get('security.policy') || DEFAULT_POLICY;
    this.currentPolicy = DEFAULT_POLICY;
    // logger.info('SecurityManager initialized with policy version:', this.currentPolicy.version);
    console.info('SecurityManager initialized with policy version:', this.currentPolicy.version);
  }

  /**
   * Checks if a given principal has the required permissions for a resource.
   * @param principal The security principal requesting access.
   * @param resource The resource being accessed (e.g., file path, API endpoint, message topic).
   * @param requiredPermissions The minimum permissions needed.
   * @returns True if access is allowed, false otherwise.
   */
  canAccess(principal: SecurityPrincipal, resource: string, requiredPermissions: PermissionLevel): boolean {
    let allowedPermissions = this.currentPolicy.defaultPermissions;
    let specificRuleFound = false;

    for (const rule of this.currentPolicy.rules) {
      if (this.matchesPrincipal(principal, rule.principal) && this.matchesResource(resource, rule.resource)) {
        specificRuleFound = true;
        if (rule.allow) {
          allowedPermissions |= rule.permissions;
        } else {
          // Deny rules override allow rules if permissions overlap
          // This logic might need refinement based on exact policy requirements (e.g., explicit deny takes precedence)
          allowedPermissions &= ~rule.permissions;
        }
      }
    }

    const hasRequired = (allowedPermissions & requiredPermissions) === requiredPermissions;

    if (!hasRequired) {
      // logger.warn(`Access denied for principal ${principal.id} (${principal.context}) to resource ${resource}. Required: ${requiredPermissions}, Allowed: ${allowedPermissions}`);
      console.warn(`Access denied for principal ${principal.id} (${principal.context}) to resource ${resource}. Required: ${requiredPermissions}, Allowed: ${allowedPermissions}`);
    } else {
      // logger.debug(`Access granted for principal ${principal.id} (${principal.context}) to resource ${resource}. Required: ${requiredPermissions}, Allowed: ${allowedPermissions}`);
      console.debug(`Access granted for principal ${principal.id} (${principal.context}) to resource ${resource}. Required: ${requiredPermissions}, Allowed: ${allowedPermissions}`);
    }
    return hasRequired;
  }

  /**
   * Validates if a message can be sent from a source to a target based on security policy.
   * This is a simplified check; real-world scenarios might involve checking message content or specific IPC channels.
   * @param message The message being sent.
   * @param senderPrincipal The security principal of the sender.
   * @param receiverContext The security context of the intended receiver.
   * @returns True if communication is allowed.
   */
  canCommunicate(message: Message<unknown>, senderPrincipal: SecurityPrincipal, receiverContext: SecurityContext): boolean {
    // Example: Define a resource string for IPC communication
    const ipcResource = `ipc://${senderPrincipal.context}-to-${receiverContext}/${message.header.type}`;
    // Require EXECUTE permission to send messages between contexts
    const can = this.canAccess(senderPrincipal, ipcResource, PermissionLevel.EXECUTE);
    if(!can) {
        // logger.warn(`Communication blocked for ${senderPrincipal.id} to ${receiverContext} for message type ${message.header.type}`);
        console.warn(`Communication blocked for ${senderPrincipal.id} to ${receiverContext} for message type ${message.header.type}`);
    }
    return can;
  }


  private matchesPrincipal(requestPrincipal: SecurityPrincipal, rulePrincipal: Partial<SecurityPrincipal>): boolean {
    if (rulePrincipal.id && rulePrincipal.id !== '*' && requestPrincipal.id !== rulePrincipal.id) {
      return false;
    }
    if (rulePrincipal.context && requestPrincipal.context !== rulePrincipal.context) {
      return false;
    }
    if (rulePrincipal.origin && rulePrincipal.origin !== '*' && requestPrincipal.origin !== rulePrincipal.origin) {
      return false;
    }
    return true;
  }

  private matchesResource(requestResource: string, ruleResourcePattern: string): boolean {
    if (ruleResourcePattern === '*' || ruleResourcePattern === requestResource) {
      return true;
    }
    // Simple wildcard matching (ends with *)
    if (ruleResourcePattern.endsWith('*')) {
      const prefix = ruleResourcePattern.slice(0, -1);
      return requestResource.startsWith(prefix);
    }
    // More complex pattern matching (e.g., regex) could be implemented here
    return false;
  }

  /**
   * Loads or reloads the security policy.
   * @param newPolicy The new security policy to apply.
   */
  loadPolicy(newPolicy: SecurityPolicy): void {
    // Add validation for the new policy structure here
    this.currentPolicy = newPolicy;
    // logger.info('Security policy updated. New version:', newPolicy.version);
    console.info('Security policy updated. New version:', newPolicy.version);
  }

  /**
   * Gets the currently active security policy.
   * @returns The current SecurityPolicy object.
   */
  getCurrentPolicy(): SecurityPolicy {
    return JSON.parse(JSON.stringify(this.currentPolicy)); // Return a deep copy
  }
}