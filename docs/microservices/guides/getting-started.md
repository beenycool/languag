# Getting Started with Microservices

## Initial Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables:
```env
SERVICE_REGISTRY_URL=http://localhost:8500
LOG_LEVEL=info
```

## Basic Usage

Starting a service:
```typescript
// From service-manager.ts
import { ServiceManager } from './core/service-manager';

const service = new ServiceManager({
  name: 'user-service',
  port: 3000,
  dependencies: ['auth-service']
});

service.start();
```

## Common Patterns

1. Service-to-service communication:
```typescript
// From sync-service.ts
const response = await serviceCoordinator.callService('payment-service', 'processPayment', payload);
```

2. Event publishing:
```typescript
// From event-coordinator.ts
eventBus.publish('order_created', {
  orderId: 123,
  amount: 99.99
});
```

## Examples

Basic service template:
```typescript
import { ServiceBase } from '@core/services';

class ExampleService extends ServiceBase {
  async initialize() {
    this.registerEndpoint('GET', '/status', this.handleStatus);
  }
  
  private handleStatus = () => ({ status: 'ok' });
}