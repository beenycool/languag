# Workspace Format Handlers

## Workspace Format Structure
Key components:
- Project configuration
- File references
- Dependency mapping

```json
// Example workspace format
{
  "version": "1.0",
  "files": [
    {
      "path": "src/main.ts",
      "type": "typescript"
    }
  ]
}
```

## Settings Handling
- Environment-specific settings
- Workspace preferences
- Extension configurations

## Migration Guides
1. **Version 1.0 to 1.1**:
- Added file hashes
- Changed path resolution
- Updated metadata structure

2. **Backward Compatibility**:
- Fallback loading
- Automatic conversion
- Validation warnings

## Implementation Details
- Uses [`settings.ts`](src/formats/handlers/settings.ts)
- Integrates with [`config-manager.ts`](src/main/services/config-manager.ts)
- Validates with [`content-validator.ts`](src/main/integration/security/validation/content-validator.ts)