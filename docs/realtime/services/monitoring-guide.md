# Monitoring Service Guide

## Performance Monitoring
### Metric Collection
```typescript
import { monitor } from '@services/monitoring';

// Track custom metrics
monitor.gauge('active_connections', getConnectionCount);
monitor.counter('processed_events');
monitor.timer('processing_time');
```

### Built-in Metrics
| Metric | Type | Description |
|--------|------|-------------|
| cpu_usage | gauge | Current CPU utilization |
| memory | gauge | Heap memory usage |
| event_rate | counter | Events processed per second |
| latency | histogram | Processing latency distribution |

## Health Checking
### Service Health
```typescript
monitor.addHealthCheck('database', async () => {
  return db.ping() ? 'healthy' : 'unhealthy';
});
```

### Health Endpoint
```typescript
app.get('/health', (req, res) => {
  const status = monitor.getStatus();
  res.json(status);
});
```

## Metrics Collection
### Exporting Metrics
```typescript
// Prometheus exporter
monitor.addExporter('prometheus', {
  port: 9090,
  path: '/metrics'
});

// Console logger
monitor.addExporter('console', {
  interval: 60000 // Log every minute
});
```

### Custom Collectors
```typescript
monitor.addCollector('queue-depth', {
  interval: 5000,
  collect: () => getQueueStats()
});
```

## Alerting Setup
### Threshold Alerts
```typescript
monitor.addAlert('high-cpu', {
  condition: () => monitor.metrics.cpu_usage > 0.9,
  severity: 'critical',
  action: throttleProcessing
});
```

### Notification Channels
```typescript
monitor.addNotifier('slack', {
  webhook: process.env.SLACK_WEBHOOK,
  channels: ['#alerts']
});
```

### Alert Management
```typescript
// Silence alerts
monitor.silenceAlert('high-cpu', '1h');

// View active alerts
const activeAlerts = monitor.getActiveAlerts();