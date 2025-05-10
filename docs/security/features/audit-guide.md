# Audit Guide

## Audit Logging
```typescript
// From [audit-service.ts](src/security/features/audit/audit-service.ts)
interface AuditEvent {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  metadata: Record<string, unknown>;
}
```

## Compliance Checking
- Automated policy validation
- Regular compliance scans
- Evidence collection

## Activity Monitoring
- Real-time alerting
- Behavioral baselines
- Anomaly detection

## Audit Patterns
1. Immutable logs
2. Chain-of-custody tracking
3. Tamper-evident storage