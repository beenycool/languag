# Extending the Monitoring System

## Creating New Metrics
1. Implement the Metric interface:
```typescript
interface Metric {
  name: string;
  type: 'gauge'|'counter'|'histogram';
  collect(): Promise<MetricValue>;
}
```
2. Register with `monitor.registerMetric()`

## Custom Collectors
To create a collector:
1. Extend BaseCollector
2. Implement collection logic
3. Register in `src/monitoring/collectors/registry.ts`

Example:
```typescript
class CustomCollector extends BaseCollector {
  async collect() {
    return { value: getCustomMetric() };
  }
}
```

## Plugin Development
Plugin structure:
```
plugins/
  my-plugin/
    index.ts      # Main plugin file
    package.json  # Plugin metadata
    README.md     # Documentation
```

## Testing Guide
Key test scenarios:
1. Metric collection accuracy
2. Export format correctness
3. Performance under load
4. Error handling robustness

See [`src/monitoring/__tests__/integration/exporters/*.spec.ts`](src/monitoring/__tests__/integration/exporters/) for examples.