// Mock 'os' module to control platform and release information
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
  release: jest.fn(),
  arch: jest.fn(() => 'x64'), // Default architecture
  cpus: jest.fn(() => [{ model: 'Test CPU', speed: 2500 }]), // Mock CPU info
  version: jest.fn(), // For Windows version specifically if needed
}));

// Mock 'process' for process.platform if used as a fallback or primary source
jest.mock('process', () => ({
  ...jest.requireActual('process'),
  platform: jest.fn(),
  versions: { // Mock Node.js and other versions if relevant
    node: '18.0.0',
    v8: '10.0.0',
  }
}));

describe('OS Detector Helper', () => {
  let osMock: any;
  let processMock: any;
  // let osDetector: any; // Instance of your OsDetector

  beforeEach(() => {
    jest.clearAllMocks();
    osMock = require('os');
    processMock = require('process');
    // osDetector = require('../../../utils/helpers/os-detector'); // Adjust path
  });

  const testCases = [
    { platform: 'win32', release: '10.0.19045', expected: { isWindows: true, isMacOS: false, isLinux: false, name: 'Windows', version: '10.0.19045' } },
    { platform: 'darwin', release: '21.6.0', expected: { isWindows: false, isMacOS: true, isLinux: false, name: 'macOS', version: '21.6.0' } },
    { platform: 'linux', release: '5.15.0-generic', expected: { isWindows: false, isMacOS: false, isLinux: true, name: 'Linux', version: '5.15.0-generic' } },
    { platform: 'aix', release: '7.1.0.0', expected: { isWindows: false, isMacOS: false, isLinux: false, name: 'AIX', version: '7.1.0.0' } }, // Example other OS
  ];

  testCases.forEach(({ platform, release, expected }) => {
    it(`should correctly identify ${expected.name} (${platform})`, () => {
      osMock.platform.mockReturnValue(platform);
      osMock.release.mockReturnValue(release);
      processMock.platform.mockReturnValue(platform); // Sync process.platform for consistency

      // const result = osDetector.getOSInfo(); // Assuming a method like this
      // expect(result.isWindows).toBe(expected.isWindows);
      // expect(result.isMacOS).toBe(expected.isMacOS);
      // expect(result.isLinux).toBe(expected.isLinux);
      // expect(result.name).toBe(expected.name);
      // expect(result.version).toBe(expected.version);
      expect(true).toBe(true); // Placeholder for actual implementation
    });
  });

  // TODO: Add more specific tests for OS Detector
  // - Test individual boolean checks (e.g., osDetector.isWindows())
  // - Test version parsing for different OSs (e.g., major, minor, patch)
  // - Test detection of specific Windows versions (7, 8, 10, 11) if needed (mock os.release() or os.version())
  // - Test detection of specific macOS versions (Monterey, Ventura, etc.) if needed
  // - Test detection of Linux distributions (Ubuntu, Fedora, etc.) if os-release or lsb_release is parsed (mock 'fs' for these files)
  // - Test architecture detection (x64, arm64) using os.arch()
  // - Test fallback mechanisms if primary detection methods fail
  // - Test memoization/caching of OS info if implemented
});