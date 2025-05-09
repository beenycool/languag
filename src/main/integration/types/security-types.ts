/**
 * @file Defines types related to security boundaries and permissions.
 */

export enum SecurityContext {
  MAIN_PROCESS = 'main_process',
  RENDERER_PROCESS = 'renderer_process',
  WORKER_PROCESS = 'worker_process',
  SANDBOXED_IFRAME = 'sandboxed_iframe',
}

export enum PermissionLevel {
  NONE = 0,
  READ = 1,
  WRITE = 2,
  EXECUTE = 4,
  ADMIN = READ | WRITE | EXECUTE,
}

export interface SecurityPrincipal {
  id: string;
  context: SecurityContext;
  origin?: string; // e.g., file://, https://
}

export interface AccessControlEntry {
  principal: SecurityPrincipal;
  resource: string; // e.g., file path, API endpoint
  permissions: PermissionLevel;
  allow: boolean; // true for allow, false for deny
}

export interface SecurityPolicy {
  version: string;
  defaultPermissions: PermissionLevel;
  rules: AccessControlEntry[];
}

export interface EncryptedData {
  iv: string; // Initialization Vector
  tag?: string; // Authentication Tag (for AEAD ciphers like AES-GCM)
  ciphertext: string; // Base64 encoded
  algorithm: string; // e.g., 'AES-GCM-256'
}