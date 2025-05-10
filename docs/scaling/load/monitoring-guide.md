# Load Monitoring Guide

## Key Metrics
Track these core metrics from `src/scaling/load/monitoring/`:
- Request rate (`LoadMonitor.trackRequestRate()`)
- Error rate (`ThresholdMonitor.trackErrors()`)
- Latency distribution (`CapacityMonitor.trackLatency()`)

## Capacity Tracking
Example alert configuration:
```typescript
// From src/scaling/load/monitoring/capacity-monitor.ts
const monitor = new CapacityMonitor({
  thresholds: {
    cpu: 85,
    memory: 75,
    network: 90
  },
  alertHandlers: [new SlackAlerter(), new PagerDutyAlerter()]
});
```

## Threshold Management
Recommended thresholds:
| Metric          | Warning | Critical |
|-----------------|---------|----------|
| CPU Usage       | 70%     | 85%      |
| Memory Usage    | 65%     | 80%      |
| Network I/O     | 60%     | 75%      |

## Alerting Setup
1. Configure receivers in `alert-manager.yaml`:
```yaml
receivers:
  - name: 'team-x-pager'
    pagerduty_configs:
      - service_key: $(PD_KEY)
  - name: 'team-x-slack'
    slack_configs:
      - channel: '#alerts'
```
2. Set up routing rules
3. Test with synthetic alerts