# macOS Integration Optimization Guide

## Sandbox Optimization
```swift
// From src/platform/optimizations/macos/integration/sandbox-optimization.ts
import { SandboxTuner } from 'src/platform/optimizations/macos';

const tuner = new SandboxTuner();
tuner.optimizeEntitlements({
  network: 'limited',
  fileAccess: 'user-selected'
});
```

## Services Integration
1. **XPC Services**:
   - Use lightweight connections
   - Implement proper error handling
   - Optimize message serialization

2. **Launch Agents**:
   - Minimize startup items
   - Use demand-loaded services
   - Implement proper keep-alive strategies

## IPC Performance
| Method | Use Case | Optimization |
|--------|----------|--------------|
| Mach Ports | High perf | Message batching |
| Distributed Notifications | System-wide | Filtering |
| Pasteboard | Data sharing | Change counting |

## macOS-Specific Tips
- Use `NSUserDefaults` efficiently
- Optimize Spotlight importer plugins
- Implement proper AppKit threading
- Leverage system preference observers