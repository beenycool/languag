# Compatibility Services

## Path Handling
```typescript
// From src/platform/services/compatibility/path-resolver.ts
interface PathAPI {
  normalize(path: string): string;
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  isAbsolute(path: string): boolean;
}
```

## Environment Management
Key features from `src/platform/services/compatibility/env-manager.ts`:
- Cross-platform environment variables
- Path resolution for executables
- System configuration detection

## Permission System
```typescript
// From src/platform/services/compatibility/permission-manager.ts
interface PermissionAPI {
  request(permission: PermissionType): Promise<boolean>;
  query(permission: PermissionType): PermissionStatus;
}
```

## Cross-Platform Tips
1. Always use path.join() instead of string concatenation
2. Check permissions before file operations
3. Use environment variables for platform-specific configurations
4. Test on all target platforms during development