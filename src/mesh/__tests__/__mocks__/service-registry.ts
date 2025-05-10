// src/mesh/__tests__/__mocks__/service-registry.ts
export const mockServiceRegistryInstance = {
  registerService: jest.fn(),
  deregisterService: jest.fn(),
  getServiceEndpoints: jest.fn().mockResolvedValue([]),
  getAllServices: jest.fn().mockResolvedValue({}),
  updateServiceMetadata: jest.fn(),
  subscribeToChanges: jest.fn().mockReturnValue(() => {}), // Returns an unsubscribe function
  // Add any other methods from the actual ServiceRegistry that ControlPlane might use
  reset: () => {
    mockServiceRegistryInstance.registerService.mockClear();
    mockServiceRegistryInstance.deregisterService.mockClear();
    mockServiceRegistryInstance.getServiceEndpoints.mockClear();
    mockServiceRegistryInstance.getAllServices.mockClear();
    mockServiceRegistryInstance.updateServiceMetadata.mockClear();
    mockServiceRegistryInstance.subscribeToChanges.mockClear();
  }
};

// This allows us to mock the constructor of ServiceRegistry
export const ServiceRegistry = jest.fn(() => mockServiceRegistryInstance);