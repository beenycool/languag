# Enterprise Integration Guide

## Gateway Configuration
```yaml
# Example gateway configuration
gateway:
  port: 8080
  maxConnections: 1000
  timeout: 30s
  cors:
    allowedOrigins: ["*.company.com"]
    allowedMethods: ["GET", "POST", "PUT"]
```

## Service Registration
1. **Service Discovery**:
   - Automatic registration via health checks
   - Manual registration through admin API
   - Service metadata includes:
     - Endpoints
     - Protocols supported
     - SLA requirements

2. **Registration Example**:
```json
POST /api/services
{
  "name": "order-service",
  "version": "1.2.0",
  "endpoints": [
    {
      "path": "/orders",
      "method": "POST",
      "protocol": "REST"
    }
  ]
}
```

## Protocol Handling
| Protocol | Adapter | Default Port | Security |
|----------|---------|--------------|----------|
| HTTP/1.1 | REST    | 80/443       | TLS      |
| HTTP/2   | gRPC    | 50051        | TLS      |
| AMQP 1.0 | AMQP    | 5672         | SASL     |
| MQTT 3.1 | MQTT    | 1883         | TLS      |

## Best Practices
1. **Circuit Breaking**: Implement fail-fast patterns
2. **Retry Policies**: Exponential backoff for transient failures
3. **Payload Validation**: Schema validation for all messages
4. **Rate Limiting**: Protect backend services
5. **Observability**: Metrics, logs and traces for all integrations