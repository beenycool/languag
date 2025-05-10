// Mock for a ProtocolHandler (e.g., MQTT, CoAP)
const mockProtocolHandler = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendMessage: jest.fn(), // (deviceId, topic, payload) => Promise<void>
  onMessage: jest.fn(), // (callback) => void, for receiving messages
  subscribeToTopic: jest.fn(), // (deviceId, topic) => Promise<void>
  isDeviceConnected: jest.fn(), // (deviceId) => boolean
};

// Mock for a MessageBroker (e.g., Kafka, RabbitMQ) for internal message routing
const mockMessageBroker = {
  publish: jest.fn(), // (topic, message) => Promise<void>
  subscribe: jest.fn(), // (topic, callback) => Promise<string> (subscriptionId)
  unsubscribe: jest.fn(), // (subscriptionId) => Promise<void>
};

// Placeholder for actual DeviceGateway implementation
// import { DeviceGateway } from '../../../../services/communication/device-gateway';

interface DeviceMessage {
  deviceId: string;
  topic: string;
  payload: Record<string, any> | Buffer | string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class DeviceGateway {
  private protocolHandlers: Map<string, typeof mockProtocolHandler>; // protocolType -> handler
  private messageBroker: typeof mockMessageBroker;
  private deviceConnections: Map<string, { protocol: string; handler: typeof mockProtocolHandler }>; // deviceId -> connection info

  constructor(messageBroker: typeof mockMessageBroker) {
    this.protocolHandlers = new Map();
    this.messageBroker = messageBroker;
    this.deviceConnections = new Map();
  }

  registerProtocolHandler(protocolType: string, handler: typeof mockProtocolHandler): void {
    if (this.protocolHandlers.has(protocolType)) {
      console.warn(`Protocol handler for ${protocolType} is being overridden.`);
    }
    this.protocolHandlers.set(protocolType, handler);
    // Setup handler to forward messages to the broker
    handler.onMessage(async (deviceId: string, topic: string, payload: any) => {
      const internalTopic = `devices/${deviceId}/${topic}`; // Example internal topic structure
      const message: DeviceMessage = { deviceId, topic, payload, timestamp: new Date() };
      await this.messageBroker.publish(internalTopic, message);
    });
  }

  async connectDevice(deviceId: string, protocolType: string, connectionParams?: any): Promise<void> {
    if (!deviceId || !protocolType) throw new Error('Device ID and protocol type are required.');
    const handler = this.protocolHandlers.get(protocolType);
    if (!handler) throw new Error(`No protocol handler registered for ${protocolType}.`);

    if (this.deviceConnections.has(deviceId)) {
        const existingConn = this.deviceConnections.get(deviceId);
        if (existingConn?.handler.isDeviceConnected(deviceId)) {
            console.log(`Device ${deviceId} already connected via ${existingConn.protocol}.`);
            return;
        }
    }

    await handler.connect(deviceId, connectionParams);
    this.deviceConnections.set(deviceId, { protocol: protocolType, handler });
    // Example: auto-subscribe to a default device topic
    await handler.subscribeToTopic(deviceId, `devices/${deviceId}/commands`);
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error('Device ID is required.');
    const connection = this.deviceConnections.get(deviceId);
    if (!connection) throw new Error(`Device ${deviceId} not found or not managed by gateway.`);
    
    await connection.handler.disconnect(deviceId);
    this.deviceConnections.delete(deviceId);
  }

  async sendMessageToDevice(deviceId: string, topic: string, payload: any): Promise<void> {
    if (!deviceId || !topic) throw new Error('Device ID and topic are required.');
    const connection = this.deviceConnections.get(deviceId);
    if (!connection || !connection.handler.isDeviceConnected(deviceId)) {
      throw new Error(`Device ${deviceId} is not connected or not found.`);
    }
    await connection.handler.sendMessage(deviceId, topic, payload);
  }

  // Messages from devices are handled by the protocolHandler's onMessage and published to the broker.
  // Services would subscribe to the messageBroker for these messages.
}


describe('DeviceGateway', () => {
  let deviceGateway: DeviceGateway;
  const mqttHandler = { ...mockProtocolHandler, type: 'mqtt' }; // Add type for clarity in tests
  const coapHandler = { ...mockProtocolHandler, type: 'coap' };
  const deviceId = 'sensor-001';

  beforeEach(() => {
    mockMessageBroker.publish.mockReset();
    mockMessageBroker.subscribe.mockReset();
    mockMessageBroker.unsubscribe.mockReset();

    mqttHandler.connect.mockReset();
    mqttHandler.disconnect.mockReset();
    mqttHandler.sendMessage.mockReset();
    mqttHandler.onMessage.mockReset();
    mqttHandler.subscribeToTopic.mockReset();
    mqttHandler.isDeviceConnected.mockReset();

    coapHandler.connect.mockReset();
    // ... reset other coapHandler mocks

    deviceGateway = new DeviceGateway(mockMessageBroker);
  });

  describe('registerProtocolHandler', () => {
    it('should register a new protocol handler', () => {
      deviceGateway.registerProtocolHandler('mqtt', mqttHandler);
      // Attempt to connect should now use this handler
      // This is indirectly tested via connectDevice
      expect(mqttHandler.onMessage).toHaveBeenCalled(); // Check if onMessage setup was called
    });
  });

  describe('connectDevice', () => {
    beforeEach(() => {
      deviceGateway.registerProtocolHandler('mqtt', mqttHandler);
    });

    it('should connect a device using the specified protocol handler', async () => {
      mqttHandler.isDeviceConnected.mockReturnValue(false);
      mqttHandler.connect.mockResolvedValue(undefined);
      mqttHandler.subscribeToTopic.mockResolvedValue(undefined);

      await deviceGateway.connectDevice(deviceId, 'mqtt');

      expect(mqttHandler.connect).toHaveBeenCalledWith(deviceId, undefined);
      expect(mqttHandler.subscribeToTopic).toHaveBeenCalledWith(deviceId, `devices/${deviceId}/commands`);
    });

    it('should not reconnect if device is already connected', async () => {
        mqttHandler.isDeviceConnected.mockReturnValue(true); // Device is already connected
        // Simulate it's already in deviceConnections by calling connect once
        await deviceGateway.connectDevice(deviceId, 'mqtt'); // First connect
        mqttHandler.connect.mockClear(); // Clear previous call

        await deviceGateway.connectDevice(deviceId, 'mqtt'); // Attempt to connect again
        expect(mqttHandler.connect).not.toHaveBeenCalled();
    });

    it('should throw error if protocol handler is not registered', async () => {
      await expect(deviceGateway.connectDevice(deviceId, 'unknown-protocol'))
        .rejects.toThrow('No protocol handler registered for unknown-protocol.');
    });
  });

  describe('disconnectDevice', () => {
    beforeEach(async () => {
      deviceGateway.registerProtocolHandler('mqtt', mqttHandler);
      mqttHandler.isDeviceConnected.mockReturnValue(true); // Assume connected for setup
      await deviceGateway.connectDevice(deviceId, 'mqtt'); // Connect the device first
      mqttHandler.disconnect.mockResolvedValue(undefined);
    });

    it('should disconnect an active device', async () => {
      await deviceGateway.disconnectDevice(deviceId);
      expect(mqttHandler.disconnect).toHaveBeenCalledWith(deviceId);
    });

    it('should throw error if device to disconnect is not found/managed', async () => {
      await expect(deviceGateway.disconnectDevice('unmanaged-device'))
        .rejects.toThrow('Device unmanaged-device not found or not managed by gateway.');
    });
  });

  describe('sendMessageToDevice', () => {
    const topic = 'config/update';
    const payload = { setting: 'value' };

    beforeEach(async () => {
      deviceGateway.registerProtocolHandler('mqtt', mqttHandler);
      mqttHandler.isDeviceConnected.mockReturnValue(true);
      await deviceGateway.connectDevice(deviceId, 'mqtt');
      mqttHandler.sendMessage.mockResolvedValue(undefined);
    });

    it('should send a message to a connected device', async () => {
      await deviceGateway.sendMessageToDevice(deviceId, topic, payload);
      expect(mqttHandler.sendMessage).toHaveBeenCalledWith(deviceId, topic, payload);
    });

    it('should throw error if device is not connected', async () => {
      mqttHandler.isDeviceConnected.mockReturnValue(false); // Simulate disconnected
      await expect(deviceGateway.sendMessageToDevice(deviceId, topic, payload))
        .rejects.toThrow(`Device ${deviceId} is not connected or not found.`);
    });
  });

  describe('Incoming message handling (via protocol handler)', () => {
    it('should publish incoming device messages to the message broker', async () => {
      // Setup: Register handler and capture its onMessage callback
      let onMessageHandlerCallback: Function = () => {};
      mqttHandler.onMessage.mockImplementation((cb) => {
        onMessageHandlerCallback = cb;
      });
      deviceGateway.registerProtocolHandler('mqtt', mqttHandler);

      // Simulate an incoming message via the captured callback
      const incomingTopic = 'telemetry/temp';
      const incomingPayload = { temperature: 25.5 };
      await onMessageHandlerCallback(deviceId, incomingTopic, incomingPayload);

      const expectedBrokerTopic = `devices/${deviceId}/${incomingTopic}`;
      expect(mockMessageBroker.publish).toHaveBeenCalledWith(
        expectedBrokerTopic,
        expect.objectContaining({
          deviceId,
          topic: incomingTopic,
          payload: incomingPayload,
          timestamp: expect.any(Date),
        })
      );
    });
  });
});