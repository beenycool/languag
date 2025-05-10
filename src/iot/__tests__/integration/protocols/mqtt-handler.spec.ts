// Mock for an MQTT client library (e.g., mqtt.js)
const mockMqttClient = {
  connect: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  on: jest.fn(), // For events like 'connect', 'message', 'error', 'close'
  off: jest.fn(),
  end: jest.fn(), // To close the connection
  connected: false, // Property to simulate connection status
  removeAllListeners: jest.fn(), // Helper for cleanup
};

// Augment the mock client for testing purposes
// This allows tests to simulate server events like 'connect' or 'message'
let eventListeners: Record<string, ((...args: any[]) => void)[]> = {};

mockMqttClient.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
  return mockMqttClient; // Return 'this' for chaining if the actual library does
});

mockMqttClient.off.mockImplementation((event: string, callback: (...args: any[]) => void) => {
    if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    }
    return mockMqttClient;
});

mockMqttClient.removeAllListeners.mockImplementation((event?: string) => {
    if (event) {
        delete eventListeners[event];
    } else {
        eventListeners = {};
    }
    return mockMqttClient;
});

// Helper to simulate an event from the MQTT broker/client
function simulateMqttEvent(event: string, ...args: any[]) {
  if (eventListeners[event]) {
    eventListeners[event].forEach(callback => callback(...args));
  }
}

// Placeholder for actual MqttHandler implementation
// import { MqttHandler } from '../../../../integration/protocols/mqtt-handler';

type MqttMessageCallback = (deviceId: string, topic: string, payload: Buffer) => void;

class MqttHandler {
  private client: typeof mockMqttClient;
  private deviceId: string | null = null;
  private messageCallback: MqttMessageCallback | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(brokerUrl: string, options?: any) {
    // In a real scenario, mqtt.connect(brokerUrl, options) would be used.
    // Here, we just assign the mock. The actual connect call is simulated.
    this.client = mockMqttClient; 
    // The constructor might typically initiate connection or set up listeners.
    // For this mock, we'll do it in the connect method.
  }

  async connect(deviceId: string, connectionParams?: any): Promise<void> {
    if (this.client.connected && this.deviceId === deviceId) return;
    if (this.client.connected) await this.disconnect(); // Disconnect if connected as different device

    this.deviceId = deviceId;
    
    // Clear previous listeners before setting up new ones for this connection
    this.client.removeAllListeners();
    this.client.on('connect', () => {
      this.client.connected = true;
      console.log(`MQTT connected for ${this.deviceId}`);
      // Resolve connectionPromise if it exists
    });
    this.client.on('message', (topic: string, payload: Buffer) => {
      if (this.messageCallback && this.deviceId) {
        this.messageCallback(this.deviceId, topic, payload);
      }
    });
    this.client.on('error', (err: Error) => {
      console.error(`MQTT error for ${this.deviceId}:`, err);
      this.client.connected = false;
      // Reject connectionPromise if it exists and is pending
    });
    this.client.on('close', () => {
      this.client.connected = false;
      console.log(`MQTT connection closed for ${this.deviceId}`);
    });

    // Simulate the actual connection call to the MQTT client library
    // The mockMqttClient.connect is a jest.fn()
    this.client.connect(connectionParams); // Pass params if mqtt.js uses them here

    // Simulate the 'connect' event being emitted by the client after successful connection
    // In a real client, this would happen asynchronously.
    // For testing, we might need to control this more explicitly.
    // Let's assume the mockMqttClient.connect itself handles setting 'connected' and emitting 'connect'
    // or we simulate it in tests.
    
    // For simplicity in test, let's assume connect mock resolves when 'connect' event is simulated
    this.connectionPromise = new Promise((resolve, reject) => {
        const tempOnConnect = () => {
            this.client.off('connect', tempOnConnect);
            this.client.off('error', tempOnError);
            resolve();
        };
        const tempOnError = (err: Error) => {
            this.client.off('connect', tempOnConnect);
            this.client.off('error', tempOnError);
            reject(err);
        };
        this.client.on('connect', tempOnConnect);
        this.client.on('error', tempOnError);
    });
    
    // If mockMqttClient.connect is synchronous or immediately sets up for events:
    // We might need to call simulateMqttEvent('connect') in tests after this.
    // Or, if mockMqttClient.connect is async, await it.
    // For this mock, let's assume it's an async operation that resolves on 'connect' event.
    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.client.connected) return;
    this.client.end(true); // true for force close
    this.client.connected = false;
    this.deviceId = null;
    this.connectionPromise = null;
    // Simulate 'close' event
    simulateMqttEvent('close');
  }

  async sendMessage(deviceId: string, topic: string, payload: string | Buffer): Promise<void> {
    if (!this.client.connected || this.deviceId !== deviceId) {
      throw new Error('MQTT client not connected or wrong device context.');
    }
    this.client.publish(topic, payload, { qos: 1 }); // Example QoS
  }

  async subscribeToTopic(deviceId: string, topic: string): Promise<void> {
    if (!this.client.connected || this.deviceId !== deviceId) {
      throw new Error('MQTT client not connected or wrong device context.');
    }
    this.client.subscribe(topic, { qos: 1 }); // Example QoS
  }

  onMessage(callback: MqttMessageCallback): void {
    this.messageCallback = callback;
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.client.connected && this.deviceId === deviceId;
  }
}


describe('MqttHandler Integration Tests', () => {
  let mqttHandler: MqttHandler;
  const brokerUrl = 'mqtt://localhost:1883'; // Dummy URL for constructor
  const deviceId = 'mqtt-device-001';

  beforeEach(() => {
    // Reset the mock client state and listeners for each test
    mockMqttClient.connect.mockReset();
    mockMqttClient.publish.mockReset();
    mockMqttClient.subscribe.mockReset();
    mockMqttClient.unsubscribe.mockReset();
    mockMqttClient.on.mockClear(); // Clear call history but keep implementations for event simulation
    mockMqttClient.off.mockClear();
    mockMqttClient.end.mockReset();
    mockMqttClient.removeAllListeners.mockImplementation((event?: string) => { // Restore simple removeAllListeners
        if (event) delete eventListeners[event]; else eventListeners = {};
        return mockMqttClient;
    });
    mockMqttClient.connected = false;
    eventListeners = {}; // Clear externally managed listeners

    // Re-apply the mock implementation for 'on' as it's cleared by mockClear
    mockMqttClient.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(callback);
        return mockMqttClient;
    });


    mqttHandler = new MqttHandler(brokerUrl);
  });

  afterEach(async () => {
    if (mqttHandler.isDeviceConnected(deviceId)) {
      await mqttHandler.disconnect();
    }
     mockMqttClient.removeAllListeners(); // Ensure all listeners are cleared
  });

  it('should connect to MQTT broker and set deviceId', async () => {
    mockMqttClient.connect.mockImplementation(() => {
      // Simulate async connection and 'connect' event
      setTimeout(() => simulateMqttEvent('connect'), 0);
    });
    
    await mqttHandler.connect(deviceId);
    
    expect(mockMqttClient.connect).toHaveBeenCalled();
    // @ts-expect-error private member access for test
    expect(mqttHandler.deviceId).toBe(deviceId);
    expect(mqttHandler.isDeviceConnected(deviceId)).toBe(true);
  });

  it('should disconnect from MQTT broker', async () => {
    // First connect
    mockMqttClient.connect.mockImplementation(() => setTimeout(() => simulateMqttEvent('connect'), 0));
    await mqttHandler.connect(deviceId);
    expect(mqttHandler.isDeviceConnected(deviceId)).toBe(true);

    // Then disconnect
    mockMqttClient.end.mockImplementation(() => {
        mockMqttClient.connected = false; // Simulate client updating its state
        simulateMqttEvent('close');
    });
    await mqttHandler.disconnect();
    expect(mockMqttClient.end).toHaveBeenCalledWith(true);
    expect(mqttHandler.isDeviceConnected(deviceId)).toBe(false);
    // @ts-expect-error
    expect(mqttHandler.deviceId).toBeNull();
  });

  it('should publish a message to a topic', async () => {
    mockMqttClient.connect.mockImplementation(() => setTimeout(() => simulateMqttEvent('connect'), 0));
    await mqttHandler.connect(deviceId);

    const topic = `devices/${deviceId}/data`;
    const payload = JSON.stringify({ temperature: 25 });
    mockMqttClient.publish.mockImplementation((_t, _p, _o, callback) => {
        if (callback) callback(null); // Simulate success for mqtt.js style callback
        return mockMqttClient;
    });
    
    await mqttHandler.sendMessage(deviceId, topic, payload);
    expect(mockMqttClient.publish).toHaveBeenCalledWith(topic, payload, { qos: 1 });
  });

  it('should subscribe to a topic', async () => {
    mockMqttClient.connect.mockImplementation(() => setTimeout(() => simulateMqttEvent('connect'), 0));
    await mqttHandler.connect(deviceId);

    const topic = `devices/${deviceId}/commands`;
     mockMqttClient.subscribe.mockImplementation((_t, _o, callback) => {
        if (callback) callback(null, [{ topic: _t, qos: 1 }]); // Simulate success
        return mockMqttClient;
    });

    await mqttHandler.subscribeToTopic(deviceId, topic);
    expect(mockMqttClient.subscribe).toHaveBeenCalledWith(topic, { qos: 1 });
  });

  it('should receive a message after subscribing', async () => {
    mockMqttClient.connect.mockImplementation(() => setTimeout(() => simulateMqttEvent('connect'), 0));
    await mqttHandler.connect(deviceId);

    const topic = `devices/${deviceId}/updates`;
    const incomingPayload = Buffer.from(JSON.stringify({ firmware: 'v2.0' }));
    const messageCb = jest.fn();
    mqttHandler.onMessage(messageCb);

    // Simulate subscription success
    mockMqttClient.subscribe.mockImplementation((_t, _o, callback) => {
        if (callback) callback(null, [{ topic: _t, qos: 1 }]);
        return mockMqttClient;
    });
    await mqttHandler.subscribeToTopic(deviceId, topic);

    // Simulate broker sending a message
    simulateMqttEvent('message', topic, incomingPayload);

    expect(messageCb).toHaveBeenCalledWith(deviceId, topic, incomingPayload);
  });

  it('should handle connection error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const connectError = new Error('Connection Refused');
    mockMqttClient.connect.mockImplementation(() => {
        setTimeout(() => simulateMqttEvent('error', connectError), 0);
    });

    await expect(mqttHandler.connect(deviceId)).rejects.toThrow(connectError.message);
    expect(mqttHandler.isDeviceConnected(deviceId)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(`MQTT error for ${deviceId}:`, connectError);
    consoleErrorSpy.mockRestore();
  });
});