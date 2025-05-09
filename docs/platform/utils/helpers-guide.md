# Platform Helpers Guide

## OS Detection
```typescript
// From src/platform/utils/helpers/os-detector.ts
function getOS(): {
  platform: 'windows'|'macos'|'linux';
  version: string;
  arch: 'x64'|'arm64';
}
```

## Feature Detection
Key features from `src/platform/utils/helpers/feature-detector.ts`:
- Check for specific OS capabilities
- Detect available system resources
- Verify hardware acceleration support

## Compatibility Checking
```typescript
// From src/platform/utils/helpers/compatibility-checker.ts
interface CompatibilityAPI {
  checkSystemRequirements(): SystemCheckResult;
  getMissingFeatures(): string[];
}
```

## Troubleshooting
1. **Path issues**: Use `path.resolve()` for absolute paths
2. **Permission errors**: Request permissions before operations
3. **Feature detection**: Fallback to alternative implementations
4. **Version conflicts**: Check minimum OS requirements