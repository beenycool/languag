# Microservices Communication Guide

## Message Handling

### Synchronous Communication
```typescript
// Example REST API call
interface ServiceRequest {
  endpoint: string;
  payload: unknown;
}

// From pipeline-manager.ts
class PipelineManager {
  async processRequest(request: ServiceRequest) {
    // Implementation
  }
}
```

### Asynchronous Communication
```typescript
// From event-coordinator.ts
interface EventMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}
```

## Event Distribution

Patterns:
1. Pub/Sub
2. Event streaming
3. Message queues

Implementation reference: [`src/realtime/core/pipeline/pipeline-manager.ts`](src/realtime/core/pipeline/pipeline-manager.ts)

## RPC Management

Options:
- gRPC
- REST
- WebSockets

Example:
```typescript
// From sync-service.ts
class SyncService {
  async remoteProcedureCall(method: string, params: unknown[]) {
    // Implementation
  }
}
```

## Protocol Selection Guide

| Protocol | Use Case | Performance | Complexity |
|----------|----------|-------------|------------|
| REST | Simple CRUD | Medium | Low |
| gRPC | Internal services | High | Medium |
| WebSockets | Real-time | High | High |
| AMQP | Event-driven | Medium | High |