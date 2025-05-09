# Windows Integration Optimization Guide

## Registry Optimization
```typescript
// From src/platform/optimizations/windows/integration/registry-cache.ts
import { RegistryCache } from 'src/platform/optimizations/windows';

const cache = new RegistryCache();
cache.prefetchKeys([
  'HKEY_CURRENT_USER\\Software\\MyApp',
  'HKEY_LOCAL_MACHINE\\Software\\MyApp'
]);
```

## Shell Extensions
1. **Context Menu Optimization**:
   - Register only necessary verbs
   - Use async handlers
   - Implement proper icon caching

2. **File Type Associations**:
   - Minimize registered file types
   - Use modern association methods
   - Implement proper MIME type handling

## COM Interfaces
| Interface | Optimization Technique |
|-----------|------------------------|
| IUnknown  | Aggregation |
| IDispatch | Type library caching |
| IStream   | Buffered operations |

## Windows-Specific Tips
- Use `CoInitializeEx` with COINIT_MULTITHREADED
- Prefer `SHGetKnownFolderPath` over legacy APIs
- Optimize DPI awareness handling
- Leverage Windows Runtime (WinRT) where applicable