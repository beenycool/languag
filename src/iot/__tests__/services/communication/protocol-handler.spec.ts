// Mock for a generic underlying protocol client (e.g., an MQTT client, CoAP client library)
const mockProtocolClient = {
  connect: jest.fn(), // (connectionParams) => Promise<void>
  disconnect: jest.fn(), // () => Promise<void>
  publish: jest.fn(), // (topic, payload, options) => Promise<void>
  subscribe: jest.fn(), // (topic, options) => Promise<void>
  unsubscribe: jest.fn(), // (topic) => Promise<void>
  on: jest.fn(), // (event, callback) e.g., 'message', 'connect', 'error'
  off: jest.fn(), // (event, callback)
  isConnected: jest.fn(), // () => boolean
};

// Placeholder for actual ProtocolHandler implementation
// This could be an abstract class or a concrete implementation for a specific protocol
// For testing, we'll create a generic one that uses the mockProtocolClient.
// import { ProtocolHandler } from '../../../../services/communication/protocol-handler';

type MessageCallback = (deviceId: string, topic: string, payload: any) => void;

class GenericProtocolHandler {
  private client: typeof mockProtocolClient;
  private deviceId: string | null = null;
  private messageListeners: MessageCallback[] = [];
  private connectionParams: any;

  constructor(clientInstance: typeof mockProtocolClient) {
    this.client = clientInstance;
    this.client.on('message', (topic: string, payload: any) => {
      if (this.deviceId) {
        this.messageListeners.forEach(cb => cb(this.deviceId!, topic, payload));
      }
    });
    this.client.on('connect', () => {
        console.log(`Protocol client connected for ${this.deviceId}`);
    });
     this.client.on('error', (err: Error) => {
        console.error(`Protocol client error for ${this.deviceId}:`, err);
        // Potentially trigger a disconnect or error state management here
    });
  }

  async connect(deviceId: string, params?: any): Promise<void> {
    if (this.client.isConnected() && this.deviceId === deviceId) {
      console.log(`Already connected as ${deviceId}.`);
      return;
    }
    if (this.client.isConnected()) {
        await this.disconnect(); // Disconnect previous if any
    }
    this.deviceId = deviceId;
    this.connectionParams = params || {}; // Store params if needed for reconnect etc.
    // Pass device-specific or general params to the actual client connect
    await this.client.connect({ ...this.connectionParams, clientId: deviceId });
  }

  async disconnect(): Promise<void> {
    if (!this.client.isConnected()) {
      console.log(`Client for ${this.deviceId} already disconnected.`);
      this.deviceId = null;
      return;
    }
    await this.client.disconnect();
    this.deviceId = null;
  }

  async sendMessage(deviceId: string, topic: string, payload: any, options?: any): Promise<void> {
    if (!this.client.isConnected() || this.deviceId !== deviceId) {
      throw new Error(`Client not connected for device ${deviceId} or incorrect device context.`);
    }
    await this.client.publish(topic, payload, options || {});
  }

  async subscribeToTopic(deviceId: string, topic: string, options?: any): Promise<void> {
    if (!this.client.isConnected() || this.deviceId !== deviceId) {
      throw new Error(`Client not connected for device ${deviceId} or incorrect device context.`);
    }
    await this.client.subscribe(topic, options || {});
  }

  async unsubscribeFromTopic(deviceId: string, topic: string): Promise<void> {
    if (!this.client.isConnected() || this.deviceId !== deviceId) {
      throw new Error(`Client not connected for device ${deviceId} or incorrect device context.`);
    }
    await this.client.unsubscribe(topic);
  }

  onMessage(callback: MessageCallback): void {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback: MessageCallback): void {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.client.isConnected() && this.deviceId === deviceId;
  }
}

describe('GenericProtocolHandler', () => {
  let protocolHandler: GenericProtocolHandler;
  const deviceId = 'device-mqtt-123';
  const connectionParams = { host: 'mqtt.example.com', port: 1883 };

  beforeEach(() => {
    // Reset all methods of the mock client
    Object.values(mockProtocolClient).forEach(mockFn => mockFn.mockReset());
    protocolHandler = new GenericProtocolHandler(mockProtocolClient);
  });

  describe('connect', () => {
    it('should connect the client with given deviceId and params', async () => {
      mockProtocolClient.isConnected.mockReturnValue(false);
      mockProtocolClient.connect.mockResolvedValue(undefined);
      await protocolHandler.connect(deviceId, connectionParams);
      expect(mockProtocolClient.connect).toHaveBeenCalledWith({ ...connectionParams, clientId: deviceId });
    });

    it('should not reconnect if already connected with the same deviceId', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      // Simulate already connected state by calling connect once
      await protocolHandler.connect(deviceId, connectionParams);
      mockProtocolClient.connect.mockClear(); // Clear the first call

      await protocolHandler.connect(deviceId, connectionParams); // Attempt to connect again
      expect(mockProtocolClient.connect).not.toHaveBeenCalled();
    });

    it('should disconnect previous connection if connecting with a new deviceId', async () => {
        mockProtocolClient.isConnected.mockReturnValue(true); // Initially connected as 'old-device'
        await protocolHandler.connect('old-device', connectionParams); // Setup initial state

        mockProtocolClient.disconnect.mockResolvedValue(undefined);
        mockProtocolClient.connect.mockResolvedValue(undefined); // For the new connection

        await protocolHandler.connect(deviceId, connectionParams); // Connect with new deviceId

        expect(mockProtocolClient.disconnect).toHaveBeenCalled();
        expect(mockProtocolClient.connect).toHaveBeenCalledWith({ ...connectionParams, clientId: deviceId });
    });
  });

  describe('disconnect', () => {
    it('should disconnect the client if connected', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      await protocolHandler.connect(deviceId, connectionParams); // Ensure deviceId is set
      mockProtocolClient.disconnect.mockResolvedValue(undefined);
      await protocolHandler.disconnect();
      expect(mockProtocolClient.disconnect).toHaveBeenCalled();
    });

    it('should not attempt to disconnect if already disconnected', async () => {
      mockProtocolClient.isConnected.mockReturnValue(false);
      await protocolHandler.disconnect();
      expect(mockProtocolClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    const topic = 'sensors/temp';
    const payload = { value: 22.5 };

    it('should publish a message if connected and deviceId matches', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      await protocolHandler.connect(deviceId, connectionParams); // Set up connected state
      mockProtocolClient.publish.mockResolvedValue(undefined);

      await protocolHandler.sendMessage(deviceId, topic, payload);
      expect(mockProtocolClient.publish).toHaveBeenCalledWith(topic, payload, {});
    });

    it('should throw error if not connected', async () => {
      mockProtocolClient.isConnected.mockReturnValue(false);
      await expect(protocolHandler.sendMessage(deviceId, topic, payload))
        .rejects.toThrow(`Client not connected for device ${deviceId} or incorrect device context.`);
    });

    it('should throw error if deviceId does not match current context', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      await protocolHandler.connect(deviceId, connectionParams); // Connected as 'device-mqtt-123'
      await expect(protocolHandler.sendMessage('other-device', topic, payload))
        .rejects.toThrow(`Client not connected for device other-device or incorrect device context.`);
    });
  });

  describe('subscribeToTopic & unsubscribeFromTopic', () => {
    const topic = 'commands/light';
    beforeEach(async () => {
        mockProtocolClient.isConnected.mockReturnValue(true);
        await protocolHandler.connect(deviceId, connectionParams);
        mockProtocolClient.subscribe.mockResolvedValue(undefined);
        mockProtocolClient.unsubscribe.mockResolvedValue(undefined);
    });

    it('should subscribe to a topic', async () => {
      await protocolHandler.subscribeToTopic(deviceId, topic);
      expect(mockProtocolClient.subscribe).toHaveBeenCalledWith(topic, {});
    });

    it('should unsubscribe from a topic', async () => {
      await protocolHandler.unsubscribeFromTopic(deviceId, topic);
      expect(mockProtocolClient.unsubscribe).toHaveBeenCalledWith(topic);
    });

    it('subscribe should throw if not connected for the device', async () => {
        await protocolHandler.disconnect(); // Ensure disconnected state
        mockProtocolClient.isConnected.mockReturnValue(false);
        await expect(protocolHandler.subscribeToTopic(deviceId, topic))
            .rejects.toThrow(`Client not connected for device ${deviceId} or incorrect device context.`);
    });
  });

  describe('onMessage & removeMessageListener', () => {
    it('should register and call message listeners when client emits message', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      protocolHandler.onMessage(listener1);
      protocolHandler.onMessage(listener2);

      // Simulate client emitting a message
      // First, connect to set the deviceId context
      mockProtocolClient.isConnected.mockReturnValue(true);
      protocolHandler.connect(deviceId, connectionParams);

      // Find the 'message' event callback registered with the client
      const messageEventCallback = mockProtocolClient.on.mock.calls.find(call => call[0] === 'message')?.[1];
      expect(messageEventCallback).toBeDefined();

      const topic = 'data/stream';
      const payload = { data: 'sample' };
      if (messageEventCallback) {
        messageEventCallback(topic, payload); // Simulate client emitting message
      }

      expect(listener1).toHaveBeenCalledWith(deviceId, topic, payload);
      expect(listener2).toHaveBeenCalledWith(deviceId, topic, payload);

      protocolHandler.removeMessageListener(listener1);
      listener1.mockClear(); // Clear previous calls to listener1

      if (messageEventCallback) {
        messageEventCallback(topic, { data: 'another sample' }); // Emit another message
      }
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(deviceId, topic, { data: 'another sample' });
    });
  });

   describe('isDeviceConnected', () => {
    it('should return true if client is connected and deviceId matches', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      await protocolHandler.connect(deviceId, connectionParams);
      expect(protocolHandler.isDeviceConnected(deviceId)).toBe(true);
    });

    it('should return false if client is not connected', async () => {
      mockProtocolClient.isConnected.mockReturnValue(false);
      // No connect call, so this.deviceId is null
      expect(protocolHandler.isDeviceConnected(deviceId)).toBe(false);
    });

    it('should return false if client is connected but for a different deviceId', async () => {
      mockProtocolClient.isConnected.mockReturnValue(true);
      await protocolHandler.connect('other-device', connectionParams);
      expect(protocolHandler.isDeviceConnected(deviceId)).toBe(false);
    });
  });
});