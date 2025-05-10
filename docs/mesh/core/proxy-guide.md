# Service Mesh Proxy Implementation

## Sidecar Pattern
```yaml
# Example sidecar configuration from security policies
proxies:
  envoy:
    image: envoyproxy/envoy:v1.24
    configMap: envoy-config
    resources:
      limits:
        cpu: "1"
        memory: "512Mi"
    securityContext:
      policies: 
        - ref: $(MESH_SECURITY_POLICY)  # See [`src/security/management/configuration/security-config.ts`](../../src/security/management/configuration/security-config.ts)
```

## Traffic Management
```ts
// Example traffic splitting from implementation
const routingRules = {
  default: {
    version: 'v1',
    weight: 70
  },
  canary: {
    version: 'v2', 
    weight: 30,
    match: {
      header: 'X-Canary-Test'
    }
  }
};
```

## Proxy Configuration Patterns
| Pattern          | Use Case                          | Implementation Reference               |
|------------------|-----------------------------------|----------------------------------------|
| Circuit Breaker  | Prevent cascading failures        | `src/realtime/services/monitoring/health-monitor.ts` |
| Retry Policies   | Handle transient errors           | `src/shared/utils/rate-limiter.ts`     |
| Shadow Traffic   | Test new versions safely          | `src/scaling/distributed/workers/worker-scheduler.ts` |

[Next: Control Plane Configuration →](./control-guide.md)