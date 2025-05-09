# Registry Operations Guide

## Key Registry Operations
1. **File Association** ([`src/integration/shell/registration/file-types.ts`](src/integration/shell/registration/file-types.ts))
   ```typescript
   registerFileType(extension: string, handlerPath: string) {
     // Creates HKEY_CLASSES_ROOT\.ext registry entry
   }
   ```

2. **Context Menu Registration** ([`src/integration/shell/registration/context-menu.ts`](src/integration/shell/registration/context-menu.ts))
   ```typescript
   addContextMenuItem(
     fileType: string,
     label: string,
     commandId: string
   ) {
     // Updates HKEY_CLASSES_ROOT\*\shell entries
   }
   ```

## Security Best Practices
- Validate all registry paths
- Use limited privilege operations
- Implement rollback for failed operations

## Troubleshooting
| Issue | Solution |
|-------|----------|
| Menu items missing | Verify registry permissions |
| Commands not executing | Check handler path in registry |
| File associations broken | Re-register file types |

## Example: Registering a New File Type
```typescript
import { registerFileType } from '../registration/file-types';

registerFileType('.languag', process.execPath);