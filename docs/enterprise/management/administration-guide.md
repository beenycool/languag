# Enterprise Integration Administration Guide

## System Configuration
```properties
# Core configuration parameters
integration.gateway.port=8080
integration.gateway.threads=200
integration.gateway.timeout=30000

# Security configuration
security.oauth2.client.id=integration-client
security.oauth2.client.secret=${CLIENT_SECRET}
security.oauth2.scope=read,write
```

## Deployment Procedures
1. **Blue-Green Deployment**:
   ```bash
   # Example deployment script
   kubectl apply -f integration-blue.yaml
   kubectl rollout status deployment/integration-blue
   kubectl patch svc/integration -p '{"spec":{"selector":{"version":"blue"}}}'
   ```

2. **Canary Release**:
   ```yaml
   # Istio VirtualService for canary
   apiVersion: networking.istio.io/v1alpha3
   kind: VirtualService
   spec:
     hosts: [integration.company.com]
     http:
     - route:
       - destination:
           host: integration
           subset: v1
         weight: 90
       - destination:
           host: integration
           subset: v2
         weight: 10
   ```

## Audit Logging
```json
{
  "timestamp": "2025-05-09T19:02:40Z",
  "principal": "admin@company.com",
  "operation": "UPDATE_CONFIG",
  "resource": "security-policies",
  "status": "SUCCESS",
  "details": {
    "oldValue": "TLS_1.1",
    "newValue": "TLS_1.3"
  }
}
```

## Common Management Tasks
| Task | Command | Frequency |
|------|---------|-----------|
| Certificate Rotation | `security rotate-certs` | Quarterly |
| User Provisioning | `admin create-user` | As needed |
| Configuration Refresh | `config reload` | Weekly |
| Service Restart | `systemctl restart integration` | Emergency |