# Device Registry Guide

## Registration Process
```typescript
// Device provisioning example
async function registerDevice(deviceInfo: DeviceSpec) {
  const device = {
    id: generateDeviceId(),
    ...deviceInfo,
    createdAt: new Date(),
    status: 'inactive'
  };
  
  await registry.create(device);
  return deviceCredentials(device.id);
}
```

## Asset Management
```yaml
# Device configuration template
deviceProfile:
  type: temperature-sensor-v2
  capabilities:
    - measurement
    - firmware-update
  constraints:
    maxUpdateInterval: 300s
    allowedProtocols: [mqtt, coap]
```

## Group Operations
```typescript
interface DeviceGroup {
  id: string;
  name: string;
  selector: {
    tags: string[];
    firmwareVersion?: string;
  };
  devices: string[];
}

// Query group members
const groupDevices = await registry.query({
  tags: ['building-5'],
  firmware: { min: '2.1.0' }
});
```

[Implementation reference](src/iot/core/device-registry.ts)