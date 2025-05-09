# IPC Architecture

## Channel Organization
The IPC system uses named channels for communication between main and renderer processes:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `state:sync` | Bidirectional | State synchronization |
| `analysis:request` | Renderer → Main | Analysis task requests |
| `analysis:response` | Main → Renderer | Analysis results |
| `config:update` | Bidirectional | Configuration changes |
| `error:report` | Main → Renderer | Error reporting |

```typescript
// From src/shared/types/ipc.ts
interface IpcMessage<T = any> {
  channel: string;
  payload: T;
  correlationId?: string;
  timestamp: number;
}
```

## Message Formats

### State Synchronization
```typescript
interface StateSyncMessage {
  type: 'full' | 'partial';
  state: Partial<AppState>;
  version: number;
}
```

### Analysis Requests
```typescript
interface AnalysisRequest {
  text: string;
  context: AnalysisContext;
  options?: AnalysisOptions;
}
```

## Security Considerations

1. **Input Validation**
   ```typescript
   function validateIpcMessage(message: unknown): message is IpcMessage {
     return (
       typeof message === 'object' && 
       message !== null &&
       'channel' in message &&
       'payload' in message
     );
   }
   ```

2. **Rate Limiting**
   ```typescript
   const ipcRateLimiter = new RateLimiter({
     windowMs: 1000,
     max: 50 // Max messages per second
   });
   ```

3. **Channel Whitelisting**
   ```typescript
   const ALLOWED_CHANNELS = new Set([
     'state:sync',
     'analysis:request',
     // ...other allowed channels
   ]);

   function isChannelAllowed(channel: string): boolean {
     return ALLOWED_CHANNELS.has(channel);
   }
   ```

## Error Handling

1. **Timeouts**
   ```typescript
   function withIpcTimeout<T>(
     promise: Promise<T>,
     timeoutMs = 5000
   ): Promise<T> {
     return Promise.race([
       promise,
       new Promise((_, reject) =>
         setTimeout(() => reject(new Error('IPC timeout')), timeoutMs)
       )
     ]);
   }
   ```

2. **Retry Logic**
   ```typescript
   async function reliableIpcSend(
     channel: string,
     payload: any,
     retries = 3
   ): Promise<any> {
     try {
       return await ipc.send(channel, payload);
     } catch (error) {
       if (retries > 0) {
         return reliableIpcSend(channel, payload, retries - 1);
       }
       throw error;
     }
   }
   ```

## Performance Optimization

1. **Message Compression**
   ```typescript
   function compressMessage(message: IpcMessage): Uint8Array {
     const json = JSON.stringify(message);
     return zlib.deflateSync(json);
   }
   ```

2. **Batching**
   ```typescript
   function batchMessages(messages: IpcMessage[]): IpcMessage {
     return {
       channel: 'batch',
       payload: messages,
       timestamp: Date.now()
     };
   }
   ```

3. **Debouncing**
   ```typescript
   const debouncedStateSync = debounce(
     (state) => ipc.send('state:sync', state),
     100
   );
   ```

## Related Documentation
- [State Sync Guide](./state-sync-guide.md)
- [Worker Architecture](../workers/worker-architecture.md)
- [Editor State](../editor/state-management.md)