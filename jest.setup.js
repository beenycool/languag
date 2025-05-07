// jest.setup.js
// This file is run before each test file.
// You can use it for global setup, like mocking modules.

// Example:
// jest.mock('electron', () => ({
//   ipcRenderer: {
//     send: jest.fn(),
//     on: jest.fn(),
//     invoke: jest.fn(),
//   },
//   ipcMain: {
//     on: jest.fn(),
//     handle: jest.fn(),
//   },
//   app: {
//     getPath: jest.fn(type => {
//       if (type === 'userData') return './test-user-data';
//       return '.';
//     }),
//     isPackaged: false,
//   },
//   BrowserWindow: jest.fn(),
// }));

console.log('Jest global setup initialized.');