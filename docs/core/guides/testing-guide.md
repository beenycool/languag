# Testing Guide

## Test Organization
- Unit tests: `__tests__` adjacent to source files
- Integration tests: `src/__tests__/`
- Configuration: `jest.config.js` and `jest.setup.js`

## Mocking Strategies
1. **IPC Channels**:
```typescript
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }
}));
```

2. **Main Process Services**:
```typescript
jest.mock('../services/config-manager', () => ({
  get: jest.fn().mockResolvedValue('mock-value')
}));
```

## Running Tests
```bash
# Run all tests
yarn test

# Run specific test file
yarn test src/renderer/__tests__/settings.spec.ts

# Watch mode
yarn test:watch

# Coverage report
yarn test:coverage
```

## Test Structure Example
```typescript
describe('Settings IPC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get setting value', async () => {
    // Test implementation
  });
});