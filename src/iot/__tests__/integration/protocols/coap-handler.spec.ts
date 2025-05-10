// Mock for a CoAP agent/library (e.g., coap package)
const mockCoapAgent = {
  request: jest.fn(), // (requestOptions) => CoapRequest (which is an EventEmitter)
  observe: jest.fn(), // (requestOptions, onUpdateCallback) => CoapRequest (for observe)
  // We'll simulate CoapRequest as an EventEmitter for 'response', 'error', 'update'
};

// Simulate a CoAP Request object (simplified EventEmitter)
class MockCoapRequest {
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};
  public pipeVal: any = null; // For piping data to the request
  public payload: any = null; // For response payload

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return this;
  }
  
  off(event: string, callback: (...args: any[]) => void) {
    if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }

  write(data: any) {
    this.pipeVal = data; // Simulate writing to the request stream
  }

  end(data?: any) {
    if (data) this.write(data);
    // In a real scenario, end() might trigger the request to be sent.
    // For mock, we might simulate a response after this.
  }

  // Method to simulate receiving a response for this request
  simulateResponse(response: { code: string; payload: Buffer | string; rsinfo?: any, headers?: any }) {
    this.payload = response.payload;
    this.emit('response', response);
  }
  
  // Method to simulate an error for this request
  simulateError(error: Error) {
    this.emit('error', error);
  }

  // Method to simulate an observe update
  simulateUpdate(response: { code: string; payload: Buffer | string; rsinfo?: any, headers?: any }) {
     this.payload = response.payload; // Update payload for subsequent reads if any
     this.emit('update', response); // Or 'data' or 'response' depending on observe implementation
  }

  close() { // For observe requests
    this.emit('close'); // Or similar event to signify observe termination
  }
}


// Placeholder for actual CoapHandler implementation
// import { CoapHandler } from '../../../../integration/protocols/coap-handler';

type CoapResponseCallback = (error: Error | null, response?: { code: string; payload: Buffer | string; rsinfo?: any, headers?: any }) => void;
type CoapObserveCallback = (update: { code: string; payload: Buffer | string; rsinfo?: any, headers?: any }) => void;


class CoapHandler {
  private agent: typeof mockCoapAgent;
  private deviceBaseUrl: string; // e.g., 'coap://[deviceId_or_ip]:port'
  private activeObservations: Map<string, MockCoapRequest>; // path -> request object

  constructor(agent: typeof mockCoapAgent, deviceBaseUrl: string) {
    this.agent = agent;
    this.deviceBaseUrl = deviceBaseUrl; // Should be specific to a device connection
    this.activeObservations = new Map();
  }

  private buildUrl(path: string): string {
    return `${this.deviceBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    payload?: Buffer | string | Record<string, any>,
    options?: Record<string, any> // e.g., { observe: false, query: 'k=v' }
  ): Promise<{ code: string; payload: Buffer | string; headers?: any }> {
    return new Promise((resolve, reject) => {
      const reqOpts = {
        hostname: new URL(this.deviceBaseUrl).hostname,
        port: parseInt(new URL(this.deviceBaseUrl).port || '5683'),
        pathname: path,
        method: method,
        ...options
      };
      
      const req = this.agent.request(reqOpts) as unknown as MockCoapRequest;

      req.on('response', (res: any) => {
        resolve({ code: res.code, payload: res.payload, headers: res.headers });
      });
      req.on('error', (err: Error) => {
        reject(err);
      });

      if (payload) {
        const data = (typeof payload === 'object' && !Buffer.isBuffer(payload)) ? JSON.stringify(payload) : payload;
        req.write(data);
      }
      req.end();
    });
  }

  async observe(
    path: string,
    onUpdate: CoapObserveCallback,
    options?: Record<string, any>
  ): Promise<string> { // Returns an observation ID (path for simplicity)
    if (this.activeObservations.has(path)) {
        throw new Error(`Already observing path: ${path}`);
    }
    const reqOpts = {
        hostname: new URL(this.deviceBaseUrl).hostname,
        port: parseInt(new URL(this.deviceBaseUrl).port || '5683'),
        pathname: path,
        method: 'GET',
        observe: true,
        ...options
    };

    const req = this.agent.request(reqOpts) as unknown as MockCoapRequest;
    
    req.on('response', (res: any) => { // Initial response for observe
        onUpdate(res);
    });
    req.on('update', (res: any) => { // Subsequent updates
        onUpdate(res);
    });
    req.on('error', (err: Error) => {
        console.error(`Error observing ${path}:`, err);
        this.stopObserve(path); // Clean up on error
        // Optionally, propagate error to a global handler or specific callback
    });
    req.on('close', () => { // When observation is properly closed
        console.log(`Observation closed for ${path}`);
        this.activeObservations.delete(path);
    });

    this.activeObservations.set(path, req);
    req.end(); // Start the observation request
    return path; // Use path as a simple observation ID
  }

  stopObserve(observationId: string): void { // observationId is the path
    const req = this.activeObservations.get(observationId);
    if (req) {
      req.close(); // This should trigger the 'close' event on the mock if implemented
      this.activeObservations.delete(observationId);
    } else {
        console.warn(`No active observation found for ID: ${observationId} to stop.`);
    }
  }
}


describe('CoapHandler Integration Tests', () => {
  let coapHandler: CoapHandler;
  const deviceIp = '192.168.1.100'; // Example device IP
  const deviceBaseUrl = `coap://${deviceIp}:5683`;

  beforeEach(() => {
    mockCoapAgent.request.mockReset();
    mockCoapAgent.observe.mockReset(); // Though we use request for observe in this mock
    
    // Each call to agent.request should return a new MockCoapRequest instance
    mockCoapAgent.request.mockImplementation(() => new MockCoapRequest());

    coapHandler = new CoapHandler(mockCoapAgent, deviceBaseUrl);
  });

  it('should send a GET request and receive a response', async () => {
    const path = '/sensors/temperature';
    const mockResponsePayload = Buffer.from(JSON.stringify({ value: 22.5 }));
    const mockRes = { code: '2.05', payload: mockResponsePayload, headers: {'Content-Format': 'application/json'} };

    mockCoapAgent.request.mockImplementation((_opts: any) => {
      const req = new MockCoapRequest();
      setTimeout(() => req.simulateResponse(mockRes), 0); // Simulate async response
      return req;
    });

    const response = await coapHandler.request('GET', path);

    expect(mockCoapAgent.request).toHaveBeenCalledWith(expect.objectContaining({
      hostname: deviceIp,
      pathname: path,
      method: 'GET'
    }));
    expect(response.code).toBe('2.05');
    expect(response.payload).toEqual(mockResponsePayload);
    expect(response.headers).toEqual({'Content-Format': 'application/json'});
  });

  it('should send a POST request with payload and receive a response', async () => {
    const path = '/actuators/light';
    const payload = { state: 'on' };
    const mockResponsePayload = Buffer.from('Accepted');
    const mockRes = { code: '2.04', payload: mockResponsePayload }; // Changed

     mockCoapAgent.request.mockImplementation((_opts: any) => {
      const req = new MockCoapRequest();
      // Check if write was called with correct data
      // For simplicity, we assume it's correct and simulate response
      setTimeout(() => req.simulateResponse(mockRes), 0);
      return req;
    });

    const response = await coapHandler.request('POST', path, payload);
    
    const requestInstance = mockCoapAgent.request.mock.results[0].value as MockCoapRequest;
    expect(requestInstance.pipeVal).toEqual(JSON.stringify(payload)); // Check what was written

    expect(response.code).toBe('2.04');
    expect(response.payload).toEqual(mockResponsePayload);
  });

  it('should handle request error', async () => {
    const path = '/test/error';
    const errorMessage = 'Request timed out';
    
    mockCoapAgent.request.mockImplementation((_opts: any) => {
      const req = new MockCoapRequest();
      setTimeout(() => req.simulateError(new Error(errorMessage)), 0);
      return req;
    });

    await expect(coapHandler.request('GET', path)).rejects.toThrow(errorMessage);
  });

  describe('Observe functionality', () => {
    const observePath = '/sensors/humidity';
    const initialPayload = Buffer.from(JSON.stringify({ value: 60 }));
    const updatePayload1 = Buffer.from(JSON.stringify({ value: 62 }));
    const updatePayload2 = Buffer.from(JSON.stringify({ value: 59 }));

    it('should establish an observation and receive initial and subsequent updates', async () => {
      const onUpdateCallback = jest.fn();
      let currentMockRequest: MockCoapRequest | null = null;

      mockCoapAgent.request.mockImplementation((opts: any) => {
        if (opts.observe) {
          const req = new MockCoapRequest();
          currentMockRequest = req;
          // Simulate initial response
          setTimeout(() => req.simulateResponse({ code: '2.05', payload: initialPayload }), 0);
          return req;
        }
        return new MockCoapRequest(); // Should not happen for observe
      });
      
      const observationId = await coapHandler.observe(observePath, onUpdateCallback);
      expect(observationId).toBe(observePath);
      expect(mockCoapAgent.request).toHaveBeenCalledWith(expect.objectContaining({
        pathname: observePath, observe: true
      }));

      // Wait for initial response to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(onUpdateCallback).toHaveBeenCalledWith(expect.objectContaining({ payload: initialPayload }));

      // Simulate updates
      expect(currentMockRequest).toBeDefined();
      if (currentMockRequest) {
        (currentMockRequest as MockCoapRequest).simulateUpdate({ code: '2.05', payload: updatePayload1 });
        expect(onUpdateCallback).toHaveBeenCalledWith(expect.objectContaining({ payload: updatePayload1 }));
        
        (currentMockRequest as MockCoapRequest).simulateUpdate({ code: '2.05', payload: updatePayload2 });
        expect(onUpdateCallback).toHaveBeenCalledWith(expect.objectContaining({ payload: updatePayload2 }));
      } else {
        throw new Error("currentMockRequest was not set during observation test");
      }
      
      expect(onUpdateCallback).toHaveBeenCalledTimes(3); // Initial + 2 updates
    });

    it('should stop an active observation', async () => {
        let currentMockRequest: MockCoapRequest | null = null;
        mockCoapAgent.request.mockImplementation((opts: any) => {
            if (opts.observe) {
                const req = new MockCoapRequest();
                currentMockRequest = req;
                jest.spyOn(req, 'close'); // Spy on the close method of this specific instance
                setTimeout(() => req.simulateResponse({ code: '2.05', payload: initialPayload }), 0);
                return req;
            }
            return new MockCoapRequest();
        });

        await coapHandler.observe(observePath, jest.fn());
        await new Promise(resolve => setTimeout(resolve, 10)); // ensure observation is set up

        expect(currentMockRequest).not.toBeNull();
        if (currentMockRequest) {
            coapHandler.stopObserve(observePath);
            expect((currentMockRequest as MockCoapRequest).close).toHaveBeenCalled();
            // @ts-expect-error private member
            expect(coapHandler.activeObservations.has(observePath)).toBe(false);
        } else {
            throw new Error("currentMockRequest was not set during stopObserve test");
        }
    });

    it('should handle error during observation and clean up', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const observeError = new Error("Observation failed");
        let currentMockRequest: MockCoapRequest | null = null;

        mockCoapAgent.request.mockImplementation((opts: any) => {
            if (opts.observe) {
                const req = new MockCoapRequest();
                currentMockRequest = req;
                setTimeout(() => req.simulateError(observeError), 5); // Simulate error after setup
                return req;
            }
            return new MockCoapRequest();
        });

        await coapHandler.observe(observePath, jest.fn());
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait for error to be processed

        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error observing ${observePath}:`, observeError);
        // @ts-expect-error private member
        expect(coapHandler.activeObservations.has(observePath)).toBe(false);
        consoleErrorSpy.mockRestore();
    });
  });
});