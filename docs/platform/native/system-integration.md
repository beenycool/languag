# Native System Integration

## File System Operations
```typescript
// From src/platform/native/system/file-system.ts
interface FileSystemAPI {
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

## Process Management
Key features from `src/platform/native/system/process-manager.ts`:
- Process spawning with resource limits
- Process tree monitoring
- Cross-platform process signaling

## Memory Management
```typescript
// From src/platform/native/system/memory-manager.ts
interface MemoryAPI {
  getMemoryUsage(): ProcessMemoryInfo;
  setMemoryLimit(limit: number): void;
}
```

## Platform Differences
| Feature       | Windows          | macOS            | Linux            |
|--------------|-----------------|-----------------|-----------------|
| Path Separator | `\`             | `/`              | `/`              |
| Process Tree  | Requires WMI    | BSD process tree | procfs           |
| Memory Limits | Job Objects     | XPC              | cgroups          |