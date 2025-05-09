describe('ClipboardResourceManager', () => {
  // Mocks for system resources or services that need managing
  // e.g., mock database connections, file handles, external API clients
  let mockClipboardListener: { start: jest.Mock, stop: jest.Mock, isInitialized: boolean };
  let mockSomeOtherResource: { connect: jest.Mock, disconnect: jest.Mock, isConnected: boolean };

  beforeEach(() => {
    // Initialize or reset mocks for each test
    mockClipboardListener = { start: jest.fn(), stop: jest.fn(), isInitialized: false };
    mockSomeOtherResource = { connect: jest.fn(), disconnect: jest.fn(), isConnected: false };

    // Simulate resource acquisition success by default
    mockClipboardListener.start.mockImplementation(() => { mockClipboardListener.isInitialized = true; });
    mockSomeOtherResource.connect.mockImplementation(() => { mockSomeOtherResource.isConnected = true; });
    mockClipboardListener.stop.mockImplementation(() => { mockClipboardListener.isInitialized = false; });
    mockSomeOtherResource.disconnect.mockImplementation(() => { mockSomeOtherResource.isConnected = false; });

    // Inject these mock resources into the ResourceManager instance or its factory
  });

  describe('Resource Initialization', () => {
    it('should initialize all registered resources on initialize()', () => {
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.registerResource('otherResource', mockSomeOtherResource);
      // resourceManager.initialize();
      // expect(mockClipboardListener.start).toHaveBeenCalled();
      // expect(mockSomeOtherResource.connect).toHaveBeenCalled();
    });

    it('should not re-initialize resources that are already initialized', () => {
      // mockClipboardListener.isInitialized = true; // Simulate already initialized
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.initialize();
      // expect(mockClipboardListener.start).not.toHaveBeenCalled();
    });

    it('should handle errors during the initialization of a specific resource', () => {
      mockSomeOtherResource.connect.mockImplementation(() => { throw new Error('Connection failed'); });
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.registerResource('otherResource', mockSomeOtherResource);
      // expect(() => resourceManager.initialize()).toThrow(); // Or handle error internally
      // expect(mockClipboardListener.start).toHaveBeenCalled(); // Check if others still try or if it stops
      // Check state of resource manager (e.g., partially initialized, error state)
    });

    it('should report successful initialization', () => {
        // const result = resourceManager.initialize();
        // expect(result.success).toBe(true); // Or similar status reporting
    });
  });

  describe('Resource Disposal', () => {
    it('should dispose of all registered resources on dispose()', () => {
      // Simulate resources as initialized
      // mockClipboardListener.isInitialized = true;
      // mockSomeOtherResource.isConnected = true;
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.registerResource('otherResource', mockSomeOtherResource);
      // resourceManager.dispose();
      // expect(mockClipboardListener.stop).toHaveBeenCalled();
      // expect(mockSomeOtherResource.disconnect).toHaveBeenCalled();
    });

    it('should not attempt to dispose of resources that are not initialized/connected', () => {
      // mockClipboardListener.isInitialized = false; // Simulate not initialized
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.dispose();
      // expect(mockClipboardListener.stop).not.toHaveBeenCalled();
    });

    it('should handle errors during the disposal of a specific resource and attempt to dispose others', () => {
      mockSomeOtherResource.disconnect.mockImplementation(() => { throw new Error('Disconnection failed'); });
      // Simulate resources as initialized
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.registerResource('otherResource', mockSomeOtherResource);
      // resourceManager.initialize(); // Initialize them first
      // expect(() => resourceManager.dispose()).toThrow(); // Or handle error internally
      // expect(mockClipboardListener.stop).toHaveBeenCalled(); // Ensure others are still disposed
    });
  });

  describe('Resource Status', () => {
    it('should correctly report if all resources are healthy/initialized', () => {
      // resourceManager.registerResource('clipboardListener', mockClipboardListener);
      // resourceManager.initialize();
      // expect(resourceManager.areAllResourcesHealthy()).toBe(true);
      // mockClipboardListener.isInitialized = false; // Simulate one failing
      // expect(resourceManager.areAllResourcesHealthy()).toBe(false);
    });
  });

  describe('Dynamic Resource Management', () => {
    it('should allow adding a resource dynamically and initializing it', () => {
        // resourceManager.initialize(); // Initial set
        // resourceManager.addAndInitializeResource('newResource', mockNewResource);
        // expect(mockNewResource.start).toHaveBeenCalled();
    });
    it('should allow removing a resource dynamically and disposing it', () => {
        // resourceManager.addAndInitializeResource('removableResource', mockRemovableResource);
        // resourceManager.removeAndDisposeResource('removableResource');
        // expect(mockRemovableResource.stop).toHaveBeenCalled();
    });
  });
});