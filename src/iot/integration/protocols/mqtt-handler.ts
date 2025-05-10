import { connect, MqttClient } from 'mqtt';
import { DeviceRegistry } from '../../core/registry/device-registry';

export class MQTTHandler {
  private client: MqttClient;
  private registry: DeviceRegistry;

  constructor(brokerUrl: string, registry: DeviceRegistry) {
    this.client = connect(brokerUrl);
    this.registry = registry;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.client.subscribe('devices/+/status');
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      const deviceId = topic.split('/')[1];
      const device = this.registry.get(deviceId);
      if (device) {
        device.lastSeen = new Date();
        this.registry.update(deviceId, device.config);
      }
    });

    this.client.on('error', (err: Error) => {
      console.error('MQTT connection error:', err);
    });
  }

  publish(deviceId: string, command: string, payload: object): void {
    this.client.publish(`devices/${deviceId}/commands/${command}`, JSON.stringify(payload));
  }

  disconnect(): void {
    this.client.end();
  }
}