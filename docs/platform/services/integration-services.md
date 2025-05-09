# Platform Integration Services

## Clipboard Handling
```typescript
// From src/platform/services/integration/clipboard-service.ts
interface ClipboardAPI {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  readImage(): Promise<Buffer>;
  writeImage(image: Buffer): Promise<void>;
}
```

## Shell Integration
Key features from `src/platform/services/integration/shell-service.ts`:
- Open files with default applications
- Open URLs in system browser
- Show items in file manager

## Startup Management
```typescript
// From src/platform/services/integration/startup-service.ts
interface StartupAPI {
  enable(options: StartupOptions): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<boolean>;
}
```

## Security Guidelines
- Validate all shell commands
- Sanitize clipboard content
- Request user confirmation for startup changes
- Use platform-specific secure storage for credentials