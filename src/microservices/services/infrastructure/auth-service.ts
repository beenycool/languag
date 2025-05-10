// src/microservices/services/infrastructure/auth-service.ts

import { IConfigService } from './config-service'; // For secret keys, token expiry, etc.

/**
 * @interface IUser
 * Represents a user identity.
 */
export interface IUser {
  id: string;
  username: string;
  roles: string[];
  permissions?: string[]; // More granular permissions
  [key: string]: any; // Additional user attributes
}

/**
 * @interface IAuthTokenPayload
 * Payload typically encoded within an authentication token.
 */
export interface IAuthTokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions?: string[];
  iat?: number; // Issued at (timestamp)
  exp?: number; // Expiration time (timestamp)
  iss?: string; // Issuer
  aud?: string; // Audience
  [key: string]: any; // Other claims
}

/**
 * @interface IAuthService
 * Defines the contract for an authentication and authorization service.
 */
export interface IAuthService {
  /**
   * Authenticates a user based on credentials.
   * @param credentials - User credentials (e.g., username/password, API key).
   * @returns A promise that resolves to a user object if authentication is successful.
   * @throws Error if authentication fails.
   */
  authenticate(credentials: Record<string, any>): Promise<IUser>;

  /**
   * Generates an authentication token for a user.
   * @param user - The user object for whom to generate the token.
   * @param expiresIn - Optional token expiration time (e.g., "1h", "7d").
   * @returns A promise that resolves to an authentication token string.
   */
  generateToken(user: IUser, expiresIn?: string): Promise<string>;

  /**
   * Validates an authentication token.
   * @param token - The authentication token string.
   * @returns A promise that resolves to the decoded token payload if the token is valid.
   * @throws Error if the token is invalid, expired, or malformed.
   */
  validateToken(token: string): Promise<IAuthTokenPayload>;

  /**
   * Checks if a user (identified by token payload) has a specific role.
   * @param tokenPayload - The decoded token payload.
   * @param role - The role to check for.
   * @returns A promise that resolves to true if the user has the role, false otherwise.
   */
  hasRole(tokenPayload: IAuthTokenPayload, role: string): Promise<boolean>;

  /**
   * Checks if a user (identified by token payload) has a specific permission.
   * @param tokenPayload - The decoded token payload.
   * @param permission - The permission to check for.
   * @returns A promise that resolves to true if the user has the permission, false otherwise.
   */
  hasPermission?(tokenPayload: IAuthTokenPayload, permission: string): Promise<boolean>;

  /**
   * Refreshes an authentication token.
   * @param refreshToken - A refresh token.
   * @returns A promise that resolves to a new access token.
   * @throws Error if the refresh token is invalid or expired.
   */
  refreshToken?(refreshToken: string): Promise<string>;
}

/**
 * @class MockAuthService
 * A simplified mock implementation of an AuthService.
 * Uses a hardcoded user and a very simple token mechanism.
 * **NOT FOR PRODUCTION USE.** Replace with a robust solution like OAuth2 (Keycloak, Auth0), JWT with proper signing, etc.
 */
export class MockAuthService implements IAuthService {
  private users: Map<string, IUser>; // username -> IUser
  private secretKey: string;
  private tokenExpiry: string; // e.g., "1h"

  constructor(configService?: IConfigService) {
    this.users = new Map();
    // In a real app, load users from a database or identity provider.
    this.users.set('admin', { id: 'user-1', username: 'admin', roles: ['administrator', 'editor'] });
    this.users.set('editor', { id: 'user-2', username: 'editor', roles: ['editor'] });
    this.users.set('viewer', { id: 'user-3', username: 'viewer', roles: ['viewer'], permissions: ['read_data'] });

    this.secretKey = configService?.get<string>('auth.jwtSecret', 'default-super-secret-key-for-mock') ?? 'default-super-secret-key-for-mock';
    this.tokenExpiry = configService?.get<string>('auth.tokenExpiry', '1h') ?? '1h';

    if (this.secretKey === 'default-super-secret-key-for-mock') {
        console.warn('MockAuthService is using a default secret key. Configure "auth.jwtSecret" for better security in dev/test.');
    }
    console.log('MockAuthService initialized.');
  }

  public async authenticate(credentials: Record<string, any>): Promise<IUser> {
    const { username, password } = credentials;
    if (!username || !password) {
      throw new Error('Username and password are required.');
    }

    const user = this.users.get(username as string);
    // Mock password check - in reality, use bcrypt.compare or similar
    if (user && password === `${username}Password123`) {
      console.log(`User authenticated: ${username}`);
      return { ...user }; // Return a copy
    }
    console.warn(`Authentication failed for user: ${username}`);
    throw new Error('Invalid username or password.');
  }

  /**
   * Generates a very simple "token" (base64 encoded JSON).
   * **NOT SECURE.** Real JWTs involve cryptographic signing.
   */
  public async generateToken(user: IUser, expiresIn?: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiryDuration = expiresIn || this.tokenExpiry;
    let exp = now + (60 * 60); // Default 1 hour

    // Simple duration parser (e.g., "1h", "30m", "7d")
    const durationMatch = expiryDuration.match(/^(\d+)([hmds])$/);
    if (durationMatch) {
        const value = parseInt(durationMatch[1], 10);
        const unit = durationMatch[2];
        if (unit === 'h') exp = now + value * 3600;
        else if (unit === 'm') exp = now + value * 60;
        else if (unit === 'd') exp = now + value * 3600 * 24;
        else if (unit === 's') exp = now + value;
    }


    const payload: IAuthTokenPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      iat: now,
      exp: exp,
      iss: 'MockAuthService',
    };
    // Simple Base64 encoding, NOT a real JWT.
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    console.log(`Token generated for user: ${user.username}`);
    return token;
  }

  /**
   * Validates the simple "token".
   * **NOT SECURE.**
   */
  public async validateToken(token: string): Promise<IAuthTokenPayload> {
    try {
      const decodedJson = Buffer.from(token, 'base64').toString('utf-8');
      const payload = JSON.parse(decodedJson) as IAuthTokenPayload;

      if (!payload.exp || !payload.userId || !payload.username) {
        throw new Error('Invalid token structure.');
      }

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired.');
      }
      // In a real JWT, you would verify the signature here using this.secretKey
      // e.g., jwt.verify(token, this.secretKey);

      console.log(`Token validated for user: ${payload.username}`);
      return payload;
    } catch (error: any) {
      console.warn(`Token validation failed: ${error.message}`);
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  public async hasRole(tokenPayload: IAuthTokenPayload, role: string): Promise<boolean> {
    return tokenPayload.roles.includes(role);
  }

  public async hasPermission(tokenPayload: IAuthTokenPayload, permission: string): Promise<boolean> {
    if (!tokenPayload.permissions) {
      return false;
    }
    return tokenPayload.permissions.includes(permission);
  }

  // refreshToken is not implemented in this mock version for simplicity.
  public async refreshToken?(refreshToken: string): Promise<string> {
    console.warn('refreshToken is not implemented in MockAuthService.');
    throw new Error('Refresh token functionality is not available.');
  }
}

// Example Usage (conceptual)
async function authExample(configService?: IConfigService) {
  const authService = new MockAuthService(configService);

  try {
    // 1. Authenticate
    const user = await authService.authenticate({ username: 'admin', password: 'adminPassword123' });
    console.log('Authenticated User:', user);

    // 2. Generate Token
    const token = await authService.generateToken(user);
    console.log('Generated Token:', token);

    // 3. Validate Token
    const payload = await authService.validateToken(token);
    console.log('Validated Token Payload:', payload);

    // 4. Check Role
    const isAdmin = await authService.hasRole(payload, 'administrator');
    console.log('Is Administrator?', isAdmin); // true
    const isViewer = await authService.hasRole(payload, 'viewer');
    console.log('Is Viewer?', isViewer); // false

    // 5. Check Permission (for a user who has permissions)
    const viewerUser = await authService.authenticate({ username: 'viewer', password: 'viewerPassword123' });
    const viewerToken = await authService.generateToken(viewerUser);
    const viewerPayload = await authService.validateToken(viewerToken);
    const canReadData = await authService.hasPermission(viewerPayload, 'read_data');
    console.log('Viewer can read_data?', canReadData); // true
    const canWriteData = await authService.hasPermission(viewerPayload, 'write_data');
    console.log('Viewer can write_data?', canWriteData); // false


    // Example of failed authentication
    // await authService.authenticate({ username: 'admin', password: 'wrongpassword' });
  } catch (error: any) {
    console.error('Auth Example Error:', error.message);
  }

  try {
    // Example of expired token (manually create an expired one for test)
    const expiredPayload: IAuthTokenPayload = {
        userId: 'user-1', username: 'admin', roles: ['admin'],
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago
    };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
    console.log('Attempting to validate expired token:', expiredToken);
    await authService.validateToken(expiredToken);
  } catch (error: any) {
    console.error('Auth Example Error (Expired Token):', error.message);
  }
}

// To run the example:
// authExample().catch(console.error);