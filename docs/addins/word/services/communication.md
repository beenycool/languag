# Communication Architecture

## Word Host Communication
Implemented in [`host-bridge.ts`](src/addins/word/services/communication/host-bridge.ts):
```typescript
// Send command to Word
hostBridge.executeCommand('INSERT_TEXT', {text: "Hello"});
```

## Main App Communication
Handled by [`app-bridge.ts`](src/addins/word/services/communication/app-bridge.ts):
```typescript
// Request analysis from main app
appBridge.requestAnalysis(content);
```

## Security Considerations
1. Message validation ([`content-validator.ts`](src/main/integration/security/validation/content-validator.ts))
2. Encryption ([`channel-crypto.ts`](src/main/integration/security/encryption/channel-crypto.ts))
3. Rate limiting ([`rate-limiter.ts`](src/shared/utils/rate-limiter.ts))