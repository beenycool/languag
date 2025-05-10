// src/mesh/__tests__/__mocks__/configuration-manager.ts
export const mockConfigurationManagerInstance = {
  getGlobalConfig: jest.fn().mockResolvedValue({}),
  getServiceConfig: jest.fn().mockResolvedValue({}),
  updateGlobalConfig: jest.fn().mockResolvedValue(undefined),
  updateServiceConfig: jest.fn().mockResolvedValue(undefined),
  onConfigChange: jest.fn().mockReturnValue(() => {}), // Returns an unsubscribe function
  // Add any other methods from the actual ConfigurationManager that ControlPlane might use
  reset: () => {
    mockConfigurationManagerInstance.getGlobalConfig.mockClear();
    mockConfigurationManagerInstance.getServiceConfig.mockClear();
    mockConfigurationManagerInstance.updateGlobalConfig.mockClear();
    mockConfigurationManagerInstance.updateServiceConfig.mockClear();
    mockConfigurationManagerInstance.onConfigChange.mockClear();
  }
};

// This allows us to mock the constructor of ConfigurationManager
export const ConfigurationManager = jest.fn(() => mockConfigurationManagerInstance);