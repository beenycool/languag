// src/mesh/__tests__/features/security/auth-manager.spec.ts
import { AuthManager, AuthContext } from '../../../features/security/auth-manager';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    authManager = new AuthManager(mockLogger);
  });

  describe('Authentication', () => {
    test('should return not authenticated if no credentials provided', async () => {
      const context = await authManager.authenticate(undefined);
      expect(context.isAuthenticated).toBe(false);
      expect(context.error).toBe('No credentials provided');
      expect(mockLogger.info).toHaveBeenCalledWith('[AuthManager] No credentials provided for authentication.');
    });

    test('should return not authenticated for invalid token format (not Bearer)', async () => {
      const context = await authManager.authenticate('InvalidToken');
      expect(context.isAuthenticated).toBe(false);
      expect(context.error).toBe('Invalid token format');
      expect(mockLogger.warn).toHaveBeenCalledWith('[AuthManager] Invalid credentials format. Expected Bearer token.');
    });
    
    test('should return not authenticated for invalid token format (missing token part)', async () => {
      const context = await authManager.authenticate('Bearer ');
      expect(context.isAuthenticated).toBe(false);
      expect(context.error).toBe('Invalid token format');
    });

    test('should successfully authenticate a valid user token', async () => {
      const credentials = 'Bearer valid-token-user123';
      const context = await authManager.authenticate(credentials);
      expect(context.isAuthenticated).toBe(true);
      expect(context.userId).toBe('user123');
      expect(context.groups).toEqual(['users', 'editors']);
      expect(context.claims?.sub).toBe('user123');
      expect(context.token).toBe('valid-token-user123');
      expect(mockLogger.info).toHaveBeenCalledWith('[AuthManager] Token validated successfully for user123');
    });

    test('should successfully authenticate a valid service account token', async () => {
      const credentials = 'Bearer valid-token-service-account';
      const context = await authManager.authenticate(credentials);
      expect(context.isAuthenticated).toBe(true);
      expect(context.userId).toBe('service-account-abc');
      expect(context.groups).toEqual(['services']);
      expect(context.claims?.scope).toContain('read:data');
      expect(context.token).toBe('valid-token-service-account');
      expect(mockLogger.info).toHaveBeenCalledWith('[AuthManager] Token validated successfully for service-account-abc');
    });

    test('should return not authenticated for an expired token', async () => {
      const credentials = 'Bearer expired-token';
      const context = await authManager.authenticate(credentials);
      expect(context.isAuthenticated).toBe(false);
      expect(context.error).toBe('Token expired');
      expect(context.token).toBe('expired-token');
      expect(mockLogger.warn).toHaveBeenCalledWith('[AuthManager] Authentication failed: Token expired');
    });

    test('should return not authenticated for an otherwise invalid token', async () => {
      const credentials = 'Bearer unknown-invalid-token';
      const context = await authManager.authenticate(credentials);
      expect(context.isAuthenticated).toBe(false);
      expect(context.error).toBe('Invalid token');
      expect(context.token).toBe('unknown-invalid-token');
      expect(mockLogger.warn).toHaveBeenCalledWith('[AuthManager] Authentication failed: Invalid token');
    });

    // TODO: Add tests for policyKey usage if policies are implemented
    // test('should use specific policy for authentication if policyKey is provided', async () => { ... });
  });

  describe('Authorization', () => {
    const authenticatedUserContext: AuthContext = {
      isAuthenticated: true,
      userId: 'user123',
      groups: ['users', 'editors'],
      claims: { sub: 'user123', name: 'Test User' },
      token: 'valid-token-user123',
    };
    const authenticatedServiceContext: AuthContext = {
      isAuthenticated: true,
      userId: 'service-account-abc',
      groups: ['services'],
      claims: { sub: 'service-account-abc', scope: 'read:data write:data' },
      token: 'valid-token-service-account',
    };
     const unauthenticatedContext: AuthContext = { isAuthenticated: false, error: 'Not authenticated' };

    test('should not authorize if context is not authenticated', async () => {
      const authorized = await authManager.authorize(unauthenticatedContext, 'read:data');
      expect(authorized).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[AuthManager] Authorization check failed: User not authenticated.',
        { requiredPermission: 'read:data' }
      );
    });

    test('user with "users" group should be authorized for "read:data"', async () => {
      const authorized = await authManager.authorize(authenticatedUserContext, 'read:data');
      expect(authorized).toBe(true);
    });
    
    test('user with "editors" group should be authorized for "read:data" and "write:data"', async () => {
      expect(await authManager.authorize(authenticatedUserContext, 'read:data')).toBe(true);
      expect(await authManager.authorize(authenticatedUserContext, 'write:data')).toBe(true);
    });
    
    test('service account with "read:data" and "write:data" scope should be authorized', async () => {
      expect(await authManager.authorize(authenticatedServiceContext, 'read:data')).toBe(true);
      expect(await authManager.authorize(authenticatedServiceContext, 'write:data')).toBe(true);
    });

    test('user without "admins" group should not be authorized for "admin:access"', async () => {
      const authorized = await authManager.authorize(authenticatedUserContext, 'admin:access');
      expect(authorized).toBe(false);
    });
    
    test('service account without "admins" group should not be authorized for "admin:access"', async () => {
      const authorized = await authManager.authorize(authenticatedServiceContext, 'admin:access');
      expect(authorized).toBe(false);
    });

    test('should deny authorization for unknown permissions', async () => {
      const authorized = await authManager.authorize(authenticatedUserContext, 'unknown:permission');
      expect(authorized).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `[AuthManager] Authorization denied: Unknown permission 'unknown:permission' for user ${authenticatedUserContext.userId}.`
      );
    });
  });

  // TODO: Add tests for policy management (setPolicy, getPolicy) if implemented.
});