# Input Validation System

## Size Limits and Constraints

1. **Text Length** - Maximum 10,000 characters per analysis
2. **File Size** - 1MB limit for document uploads
3. **Batch Processing** - 10 documents maximum per batch

```typescript
// Example validation check
import { validateInput } from '../../src/shared/utils/sanitization';
const isValid = validateInput(text, { maxLength: 10000 });
```

## Sanitization Patterns

1. **HTML/XML** - Strips all markup tags
2. **Code Injection** - Removes executable patterns
3. **Special Characters** - Escapes potentially dangerous chars

## Error Handling

1. **Validation Errors** - Returns structured error objects:
   ```json
   {
     "error": "INPUT_TOO_LONG",
     "maxAllowed": 10000,
     "received": 12000
   }
   ```
2. **Recovery** - Automatically truncates oversized input
3. **Logging** - All validation failures are logged securely