# Integration Guide

## Common Patterns
1. **Request-Response** ([`src/main/integration/common/message-bus.ts`](src/main/integration/common/message-bus.ts))
   ```typescript
   const response = await messageBus.request({
     type: 'GET_CONTEXT',
     payload: { filePath: 'document.txt' }
   });
   ```

2. **Event Subscription**
   ```typescript
   messageBus.subscribe('MENU_UPDATE', (event) => {
     updateMenu(event.payload);
   });
   ```

## Message Formats
```typescript
interface Message {
  id: string;
  type: string;
  timestamp: number;
  payload: unknown;
}
```

## Performance Tips
- Batch related operations
- Use binary format for large payloads
- Implement client-side caching