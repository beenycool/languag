# IPC System Overview

## Available Channels

### Settings Management
- `settings:get` - Retrieve configuration value
- `settings:set` - Update configuration value
- `settings:reset` - Restore default value

### UI State Management
- `ui:window-state` - Get/set window position/size
- `ui:theme` - Get/set current theme

## Request/Response Formats

```typescript
// Request format
interface IpcRequest<T = unknown> {
  channel: string;
  payload?: T;
}

// Response format
interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Error Handling
All IPC handlers follow standardized error patterns:
1. Input validation errors (400)
2. Permission errors (403)
3. System errors (500)

## Security Boundaries
1. **Preload Whitelist**: Only exposed channels are available in renderer
2. **Input Sanitization**: All payloads validated (see `src/shared/utils/sanitization.ts`)
3. **Rate Limiting**: Sensitive endpoints protected (see `src/shared/utils/rate-limiter.ts`)