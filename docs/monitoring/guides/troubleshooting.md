# Troubleshooting Guide

## Common Issues
1. **Missing metrics**:
   - Verify collector registration
   - Check collection intervals
   - Review filter configurations

2. **High overhead**:
   - Reduce collection frequency
   - Disable unused collectors
   - Enable sampling

3. **Export failures**:
   - Check network connectivity
   - Verify exporter configurations
   - Review authentication

## Performance Tips
- Use batch exports for remote destinations
- Limit high-cardinality metrics
- Enable metric aggregation
- Use efficient serialization formats

## Debugging Guide
1. Enable debug logging:
```typescript
monitor.configure({ logLevel: 'debug' });
```

2. Check internal metrics:
```typescript
monitor.getInternalMetrics();
```

3. Use the diagnostic endpoint:
```bash
curl http://localhost:9090/diagnostics
```

## Best Practices
- Monitor the monitoring system
- Set up alerts for failures
- Regularly review configurations
- Document custom metrics

See [`src/monitoring/__tests__/integration/exporters/log-exporter.spec.ts`](src/monitoring/__tests__/integration/exporters/log-exporter.spec.ts:1) for debugging examples.