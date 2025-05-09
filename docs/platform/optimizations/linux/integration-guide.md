# Linux Integration Optimization Guide

## D-Bus Optimization
```c
// From src/platform/optimizations/linux/integration/dbus-cache.ts
import { DBusCache } from 'src/platform/optimizations/linux';

const cache = new DBusCache();
cache.prefetchServices([
  'org.freedesktop.DBus',
  'org.freedesktop.Notifications'
]);
```

## X11 Performance
1. **Rendering**:
   - Use MIT-SHM for shared memory
   - Implement proper damage tracking
   - Optimize XRender usage

2. **Input Handling**:
   - Batch input events
   - Use XI2 for modern input
   - Implement proper focus handling

## File Watching
| Method | Use Case | Optimization |
|--------|----------|--------------|
| inotify | Real-time | Watch descriptor reuse |
| fanotify | Security | Minimize events |
| poll    | Legacy   | Batch updates |

## Linux-Specific Tips
- Optimize systemd service files
- Use cgroups for resource control
- Implement proper udev handling
- Leverage seccomp for sandboxing