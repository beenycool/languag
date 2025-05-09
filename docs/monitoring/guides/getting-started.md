# Getting Started with Monitoring

## Setup Instructions
1. Install dependencies:
```bash
npm install @monitoring/core @monitoring/exporters
```

2. Import in your application:
```typescript
import { Monitor } from '@monitoring/core';
```

3. Basic configuration:
```typescript
const monitor = new Monitor({
  collectors: ['cpu', 'memory'],
  exporters: ['console']
});
```

## Basic Usage
Start monitoring:
```typescript
monitor.start();
```

Access metrics:
```typescript
const metrics = monitor.getMetrics();
```

## Common Patterns
1. **Custom metrics**:
```typescript
monitor.registerMetric('custom', {
  type: 'counter',
  description: 'Custom events'
});
```

2. **Tagging metrics**:
```typescript
monitor.counter('requests', { route: '/api' }).inc();
```

## Examples
See [`src/monitoring/__tests__/integration/*.spec.ts`](src/monitoring/__tests__/integration/) for usage examples.