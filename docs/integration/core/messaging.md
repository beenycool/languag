# Messaging System

## Message Formats
All messages follow this base structure:
```typescript
interface BaseMessage {
  id: string;
  timestamp: number;
  version: '1.0';
  source: string;
  destination: string;
}
```

Specialized message types:
1. **Process Messages**:
   ```typescript
   interface ProcessMessage extends BaseMessage {
     type: 'process';
     payload: {
       operation: 'start' | 'stop' | 'status';
       pid?: number;
     };
   }
   ```

2. **Content Messages**:
   ```typescript
   interface ContentMessage extends BaseMessage {
     type: 'content';
     payload: {
       format: string;
       content: unknown;
       transformations: string[];
     };
   }
   ```

## Channel Management
Channels are created per:
- Process type (main/worker)
- Content format (markdown/html/etc)
- Security level (encrypted/plain)

Example channel creation:
```typescript
const channel = messageBus.createChannel({
  name: 'markdown-processing',
  type: 'content',
  security: 'encrypted'
});
```

## Security Considerations
1. **Message Validation**:
   - Schema validation
   - Size limits
   - Rate limiting

2. **Encryption**:
   - TLS for inter-process communication
   - End-to-end encryption for sensitive content

See implementation: [`src/main/integration/common/message-bus.ts`](../src/main/integration/common/message-bus.ts)