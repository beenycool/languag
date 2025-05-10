# Authentication Guide

## Flows
1. **Basic Auth**: Username/password
2. **Token-based**: JWT/OAuth
3. **Multi-factor**: 2FA/OTP

## Token Management
```typescript
// Example from [token-manager.ts](src/security/core/authentication/token-manager.ts)
interface TokenPayload {
  userId: string;
  roles: string[];
  exp: number;
}
```

## Session Handling Best Practices
- Short-lived sessions (15-30 mins)
- Secure cookie attributes (HttpOnly, Secure, SameSite)
- Session rotation on privilege changes