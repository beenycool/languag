module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // For main process tests
  // Or use 'jest-electron/environment' for renderer process tests,
  // or configure multiple projects for both.
  // For now, we'll focus on main process.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  // If using jest-electron for main process:
  // runner: 'jest-electron/runner',
  // testEnvironment: 'jest-electron/environment-main',
  //
  // For now, we'll stick to 'node' for main process unit/integration tests
  // and can add a separate config or project for renderer/e2e later.
  setupFilesAfterEnv: ['./jest.setup.js'], // Optional: for global test setup
};