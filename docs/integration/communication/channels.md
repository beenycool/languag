# Communication Channels Architecture

## Core Protocols
1. **IPC Protocol** ([`src/main/integration/types/message-types.ts`](src/main/integration/types/message-types.ts))
   - Used for local process communication
   - JSON message format

2. **Network Protocol** ([`src/main/integration/common/message-bus.ts`](src/main/integration/common/message-bus.ts))
   - WebSocket-based
   - Binary message format

## Security Measures
- Message encryption
- Endpoint authentication
- Rate limiting ([`src/shared/utils/rate-limiter.ts`](src/shared/utils/rate-limiter.ts))

## Error Handling
```typescript
interface ErrorResponse {
  code: number;
  message: string;
  retryable: boolean;
}

function handleError(error: Error): ErrorResponse {
  // Convert errors to standardized responses
}