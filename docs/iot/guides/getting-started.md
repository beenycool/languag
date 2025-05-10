# IoT Device Management - Getting Started

## Initial Setup
```bash
# Install dependencies
npm install @iot/core @iot/services @iot/utils
```

## Basic Configuration
```typescript
// Initialize core services
import { DeviceRegistry, MessageBroker } from '@iot/core';

const registry = new DeviceRegistry({
  storage: 'postgres://user:pass@localhost/iot'
});

const broker = new MessageBroker({
  protocol: 'mqtt',
  host: 'mqtt.broker.com'
});
```

## First Device Registration
```typescript
// Register a new device
const newDevice = await registry.register({
  type: 'temperature-sensor-v2',
  location: 'building-5/floor-3',
  capabilities: ['telemetry', 'firmware-update']
});

console.log(`Device ID: ${newDevice.id}`);
```

## Common Patterns
```mermaid
sequenceDiagram
    Device->>Broker: Connect & Authenticate
    Broker->>Registry: Verify Credentials
    Registry-->>Broker: Auth Success
    Broker-->>Device: Connection ACK
    Device->>Broker: Publish Telemetry
    Broker->>Processor: Route Data
```

[Explore core API](src/iot/core/device-registry.ts)