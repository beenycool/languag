import fs from 'fs-extra';
import path from 'path';
import { ConfigurationManager } from '../config-manager';
import { AppConfig, DEFAULT_CONFIG } from '../../../shared/types/config'; // Corrected import path for AppConfig

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Define mockConfigPath for ConfigurationManager instance in tests.
// This path will be passed to the ConfigurationManager constructor.
const testUserDataBasePath = path.join(__dirname, 'test-user-data-electron-mock');
const mockConfigPath = path.join(testUserDataBasePath, 'app-config.json');

// This is the path we expect fs.ensureDirSync to be called with. It's the dirname of mockConfigPath.
const mockExpectedUserDataPathForEnsureDir = testUserDataBasePath;


// Mock electron app path
jest.mock('electron', () => {
  // Define the path string directly inside the factory for electron's getPath mock
  const electronMockUserDataPath = path.join(__dirname, 'test-user-data-electron-mock');
  return {
    app: {
      getPath: jest.fn(type => {
        if (type === 'userData') return electronMockUserDataPath;
        return '.';
      }),
      isPackaged: false,
    },
  };
});

// Mock logger.ts - it exports a winston instance, not a class
// ConfigurationManager uses console.log/error internally, so we spy on those.
let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});


    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockImplementation(() => { throw new Error('File not found by readFileSync'); });
    mockedFs.ensureDirSync.mockImplementation(() => {});
    mockedFs.writeFileSync.mockImplementation(() => {});
    
    // For async file operations if used by configManager directly in tests
    mockedFs.pathExists.mockImplementation(async () => false);
    mockedFs.readFile.mockImplementation(async () => { throw new Error('File not found by readFile'); });
    mockedFs.ensureDir.mockImplementation(async () => undefined);
    mockedFs.writeFile.mockImplementation(async () => undefined);


    // Instantiate here, constructor calls loadSync
    configManager = new ConfigurationManager(mockConfigPath);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should initialize with default configuration if no config file exists and save it', () => {
    // Constructor already called loadSync which would use mockedFs.existsSync -> false
    // Then it should call saveSync
    expect(configManager.getFullConfig().logging.level).toEqual('info');
    expect(configManager.getFullConfig().llm.ollamaHost).toEqual('http://localhost:11434'); // Changed ollama.baseUrl to llm.ollamaHost
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(mockConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    expect(consoleLogSpy).toHaveBeenCalledWith(`Default configuration saved to ${mockConfigPath}`);
  });

  it('should load configuration from file if it exists', () => {
    const storedConfigData: AppConfig = {
      ...DEFAULT_CONFIG,
      logging: { ...DEFAULT_CONFIG.logging, level: 'debug' },
      llm: { ...DEFAULT_CONFIG.llm, ollamaHost: 'http://customhost:12345' }, // Changed ollama to llm, baseUrl to ollamaHost
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(storedConfigData));

    configManager = new ConfigurationManager(mockConfigPath);
    
    const currentConfig = configManager.getFullConfig();
    expect(currentConfig.logging.level).toEqual('debug');
    expect(currentConfig.llm.ollamaHost).toEqual('http://customhost:12345'); // Changed ollama.baseUrl to llm.ollamaHost
    expect(consoleLogSpy).toHaveBeenCalledWith(`Configuration loaded from ${mockConfigPath}`);
  });

  it('should use default values for missing fields when loading from file', () => {
    const partialConfig = {
      llm: { ollamaHost: 'http://partialhost:54321' }, // Changed ollama to llm, baseUrl to ollamaHost
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));
    
    configManager = new ConfigurationManager(mockConfigPath);
    const currentConfig = configManager.getFullConfig();

    expect(currentConfig.llm.ollamaHost).toEqual('http://partialhost:54321'); // Changed ollama.baseUrl to llm.ollamaHost
    expect(currentConfig.llm.model).toEqual(DEFAULT_CONFIG.llm.model); // Changed ollama.defaultModel to llm.model
    expect(currentConfig.logging.level).toEqual(DEFAULT_CONFIG.logging.level);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Configuration loaded from ${mockConfigPath}`);
  });


  it('should save configuration to file when using update', () => {
    const newConfigPartial: Partial<AppConfig> = {
      logging: { level: 'warn' },
    };
    configManager.update(newConfigPartial);

    expect(mockedFs.ensureDirSync).toHaveBeenCalledWith(mockExpectedUserDataPathForEnsureDir);
    // Check the last call to writeFileSync, as constructor might also call it.
    expect(mockedFs.writeFileSync).toHaveBeenLastCalledWith(mockConfigPath, expect.stringContaining('"level": "warn"'), 'utf-8');
    // More precise check for the object content:
    const lastWriteCallArgs = mockedFs.writeFileSync.mock.lastCall;
    expect(lastWriteCallArgs).not.toBeNull();
    if (lastWriteCallArgs) {
        expect(JSON.parse(lastWriteCallArgs[1] as string)).toEqual(expect.objectContaining({
            logging: expect.objectContaining({ level: 'warn' }),
            llm: DEFAULT_CONFIG.llm,
        }));
    }
    expect(consoleLogSpy).toHaveBeenCalledWith(`Configuration saved to ${mockConfigPath}`);
  });
  
  it('should save configuration to file when using set', () => {
    mockedFs.writeFileSync.mockClear();
    configManager.set('logging.level', 'error');
    
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1); // Ensure it's called once after clear
    const writtenArg = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(JSON.parse(writtenArg)).toEqual(expect.objectContaining({
        logging: expect.objectContaining({ level: 'error' })
    }));
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(mockConfigPath, expect.any(String), 'utf-8');
    expect(consoleLogSpy).toHaveBeenCalledWith(`Configuration saved to ${mockConfigPath}`);
  });


  it('should merge partial updates correctly with update()', () => {
    const initialLLMConfig = configManager.getFullConfig().llm;
    configManager.update({ llm: { ...initialLLMConfig, model: 'new-model' } });
    expect(configManager.getFullConfig().llm.model).toEqual('new-model');
    expect(configManager.getFullConfig().llm.ollamaHost).toEqual(DEFAULT_CONFIG.llm.ollamaHost);

    const initialLoggingConfig = configManager.getFullConfig().logging;
    configManager.update({ logging: { ...initialLoggingConfig, filePath: 'new/path.log' } });
    expect(configManager.getFullConfig().logging.filePath).toBe('new/path.log');
    expect(configManager.getFullConfig().logging.level).toEqual(DEFAULT_CONFIG.logging.level);
  });

  it('should handle errors during file reading (readFileSync throws) and use defaults', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('Corrupted JSON by readFileSync');
    });

    configManager = new ConfigurationManager(mockConfigPath); // Re-instantiate to trigger load
    expect(configManager.getFullConfig().logging.level).toEqual(DEFAULT_CONFIG.logging.level);
    expect(consoleErrorSpy).toHaveBeenCalledWith('ConfigLoadError: Failed to load configuration:', expect.any(Error));
  });

  it('should handle errors during file writing (writeFileSync throws)', () => {
    const writeError = new Error('Disk full');
    mockedFs.writeFileSync.mockImplementation(() => {
      throw writeError;
    });
    // The error is caught and logged by saveSync, not re-thrown by set/update
    configManager.set('logging.level', 'error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('ConfigPersistenceError: Failed to save configuration:', writeError);
    
    // Test update as well with a valid property
    const currentLoggingConfig = configManager.getFullConfig().logging;
    configManager.update({ logging: { ...currentLoggingConfig, level: 'error' } });
    expect(consoleErrorSpy).toHaveBeenCalledWith('ConfigPersistenceError: Failed to save configuration:', writeError);
  });

  it('should notify listeners on configuration change via update()', () => {
    const listener = jest.fn();
    const initialLLMConfigForNotify = configManager.getFullConfig().llm;
    configManager.onChange('llm.temperature', listener);
    configManager.update({ llm: { ...initialLLMConfigForNotify, temperature: 0.9 } });
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      path: 'llm.temperature',
      newValue: 0.9,
      oldValue: DEFAULT_CONFIG.llm.temperature,
    }));
  });

  it('should notify wildcard listeners on configuration change via set()', () => {
    const listener = jest.fn();
    configManager.onChange('*', listener); // Global listener
    configManager.set('logging.level', 'debug');
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      path: 'logging.level',
      newValue: 'debug',
      oldValue: 'info', // Reverted: Should be 'info' if DEFAULT_CONFIG is not mutated
    }));
  });
});