export class DeviceRegistry {
  private devices = new Map<string, Device>();

  register(device: Device): void {
    this.devices.set(device.id, device);
  }

  update(id: string, config: DeviceConfig): void {
    const device = this.devices.get(id);
    if (device) Object.assign(device.config, config);
  }

  delete(id: string): void {
    this.devices.delete(id);
  }

  get(id: string): Device | undefined {
    return this.devices.get(id);
  }
}

type Device = {
  id: string;
  config: DeviceConfig;
  lastSeen: Date;
};

type DeviceConfig = {
  protocol: 'mqtt' | 'coap' | 'http';
  endpoint: string;
  pollingInterval: number;
};