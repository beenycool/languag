# Platform API Documentation

## Core Interfaces
```typescript
// From src/platform/core/interfaces/platform-api.ts
interface PlatformAPI {
  // OS information
  getOS(): OSInfo;
  getPathSeparator(): string;
  
  // File system operations  
  normalizePath(path: string): string;
  resolvePath(...paths: string[]): string;
  
  // Process management
  spawnProcess(command: string, args: string[]): ProcessHandle;
}
```

## Implementation Guidelines
1. **Windows Implementation** (`src/platform/core/implementations/windows.ts`):
   - Uses Win32 API via Node-API bindings
   - Handles Windows-specific path conventions

2. **macOS Implementation** (`src/platform/core/implementations/macos.ts`):
   - Uses Cocoa bridges for native features
   - Implements macOS sandboxing requirements

3. **Linux Implementation** (`src/platform/core/implementations/linux.ts`):
   - Uses POSIX APIs
   - Supports common Linux distributions

## Best Practices
- Always use platform-agnostic paths in core logic
- Validate permissions before sensitive operations
- Test all implementations across supported OS versions