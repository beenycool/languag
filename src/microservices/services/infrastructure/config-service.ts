// src/microservices/services/infrastructure/config-service.ts

/**
 * @interface IConfigSource
 * Defines a contract for a source of configuration data.
 * This could be a file, environment variables, a remote config server, etc.
 */
export interface IConfigSource {
  /**
   * Loads configuration data.
   * @returns A promise that resolves to a record of configuration key-value pairs.
   */
  load(): Promise<Record<string, any>>;

  /**
   * Optional: Watches for changes in the configuration source.
   * @param callback - A function to call with the updated configuration.
   * @returns A function to stop watching, or undefined if watching is not supported.
   */
  watch?(callback: (newConfig: Record<string, any>) => void): (() => void) | undefined;

  /**
   * Optional: Gets the name or identifier of the source.
   */
  getName?(): string;
}

/**
 * @interface IConfigService
 * Defines the contract for a centralized configuration service.
 */
export interface IConfigService {
  /**
   * Retrieves a configuration value by key.
   * Supports dot notation for nested properties (e.g., "database.host").
   * @param key - The configuration key.
   * @param defaultValue - An optional default value to return if the key is not found.
   * @returns The configuration value, or the defaultValue if not found, or undefined.
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined;

  /**
   * Checks if a configuration key exists.
   * @param key - The configuration key.
   * @returns True if the key exists, false otherwise.
   */
  has(key: string): boolean;

  /**
   * Loads or reloads configuration from all registered sources.
   * @returns A promise that resolves when configuration is loaded.
   */
  loadConfiguration(): Promise<void>;

  /**
   * Subscribes to changes for a specific configuration key.
   * @param key - The configuration key to watch.
   * @param callback - Function to call when the value of the key changes.
   *                   Receives the new value and the old value.
   * @returns An unsubscribe function.
   */
  onChange<T = any>(key: string, callback: (newValue: T | undefined, oldValue: T | undefined) => void): () => void;

  /**
   * Adds a configuration source. Sources are loaded in the order they are added,
   * with later sources potentially overriding values from earlier ones.
   * @param source - The configuration source to add.
   */
  addSource(source: IConfigSource): void;
}

/**
 * @class ConfigService
 * Provides a centralized way to manage application configuration from multiple sources.
 */
export class ConfigService implements IConfigService {
  private sources: IConfigSource[];
  private config: Record<string, any>;
  private watchers: Map<string, Set<(newValue: any, oldValue: any) => void>>;
  private sourceWatchStopper: (() => void)[];

  constructor() {
    this.sources = [];
    this.config = {};
    this.watchers = new Map();
    this.sourceWatchStopper = [];
    console.log('ConfigService initialized.');
  }

  public addSource(source: IConfigSource): void {
    this.sources.push(source);
    console.log(`Config source added: ${source.getName ? source.getName() : 'Unnamed Source'}`);
  }

  public async loadConfiguration(): Promise<void> {
    console.log('Loading configuration from all sources...');
    const newConfig: Record<string, any> = {};
    for (const source of this.sources) {
      try {
        const sourceConfig = await source.load();
        // Deep merge could be used here for more complex overrides
        Object.assign(newConfig, sourceConfig);
        console.log(`Configuration loaded from ${source.getName ? source.getName() : 'source'}.`);
      } catch (error) {
        console.error(`Error loading configuration from ${source.getName ? source.getName() : 'source'}:`, error);
      }
    }
    this.updateConfig(newConfig);
    this.setupSourceWatchers();
  }

  private updateConfig(newConfig: Record<string, any>): void {
    const oldConfig = { ...this.config };
    this.config = newConfig;

    // Notify watchers about changes
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
    allKeys.forEach(key => {
      const oldValue = this.getFromObject(oldConfig, key);
      const newValue = this.getFromObject(newConfig, key);

      // Basic check for actual change (could be improved with deep comparison for objects/arrays)
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        this.notifyWatchers(key, newValue, oldValue);

        // Notify watchers for parent keys if a nested property changes
        const parts = key.split('.');
        for (let i = parts.length - 1; i > 0; i--) {
          const parentKey = parts.slice(0, i).join('.');
          const oldParentValue = this.getFromObject(oldConfig, parentKey);
          const newParentValue = this.getFromObject(newConfig, parentKey);
          this.notifyWatchers(parentKey, newParentValue, oldParentValue);
        }
      }
    });
  }

  private setupSourceWatchers(): void {
    // Clear existing source watchers
    this.sourceWatchStopper.forEach(stop => stop());
    this.sourceWatchStopper = [];

    this.sources.forEach(source => {
      if (source.watch) {
        const stop = source.watch(async (updatedSourceConfig) => {
          console.log(`Configuration change detected in ${source.getName ? source.getName() : 'source'}. Reloading all configurations.`);
          // When one source changes, it's often safest to reload all to ensure correct override order.
          // A more optimized approach might selectively update, but can be complex.
          await this.loadConfiguration();
        });
        if (stop) {
          this.sourceWatchStopper.push(stop);
        }
      }
    });
  }


  public get<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = this.getFromObject(this.config, key);
    return value !== undefined ? value : defaultValue;
  }

  private getFromObject(obj: Record<string, any>, key: string): any {
    const keys = key.split('.');
    let current = obj;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    return current;
  }

  public has(key: string): boolean {
    return this.getFromObject(this.config, key) !== undefined;
  }

  public onChange<T = any>(
    key: string,
    callback: (newValue: T | undefined, oldValue: T | undefined) => void
  ): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    const watcherSet = this.watchers.get(key)!;
    watcherSet.add(callback);

    // Immediately call with current value
    // callback(this.get(key), undefined); // Or provide a more meaningful "old" value if available

    return () => {
      watcherSet.delete(callback);
      if (watcherSet.size === 0) {
        this.watchers.delete(key);
      }
    };
  }

  private notifyWatchers(key: string, newValue: any, oldValue: any): void {
    if (this.watchers.has(key)) {
      this.watchers.get(key)!.forEach(cb => {
        try {
          cb(newValue, oldValue);
        } catch (error) {
          console.error(`Error in config change callback for key "${key}":`, error);
        }
      });
    }
  }

  /**
   * Cleans up resources, like stopping watchers.
   */
  public dispose(): void {
    this.sourceWatchStopper.forEach(stop => stop());
    this.sourceWatchStopper = [];
    this.watchers.clear();
    console.log('ConfigService disposed.');
  }
}

// --- Example Implementations of IConfigSource ---

/**
 * @class EnvironmentConfigSource
 * Loads configuration from environment variables.
 * Optionally prefixes keys (e.g., APP_DATABASE_HOST becomes database.host).
 */
export class EnvironmentConfigSource implements IConfigSource {
  private prefix: string;
  private keyMapping: (key: string) => string; // Transforms env var key to config key

  constructor(prefix: string = '', keyMapping?: (key: string) => string) {
    this.prefix = prefix;
    this.keyMapping = keyMapping || ((key) => key.toLowerCase().replace(/_/g, '.'));
  }

  public getName(): string {
    return `EnvironmentVariables(prefix='${this.prefix || 'NONE'}')`;
  }

  public async load(): Promise<Record<string, any>> {
    const config: Record<string, any> = {};
    for (const envKey in process.env) {
      if (envKey.startsWith(this.prefix)) {
        const unprefixedKey = envKey.substring(this.prefix.length);
        const configKey = this.keyMapping(unprefixedKey);
        this.setValueByDottedPath(config, configKey, process.env[envKey]);
      }
    }
    return config;
  }

  private setValueByDottedPath(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        current[key] = value;
      } else {
        current[key] = current[key] || {};
        if (typeof current[key] !== 'object') {
            // Overwriting a non-object value with an object to nest further.
            // This might happen if a flat key like 'db' was set, and now 'db.host' is being set.
            console.warn(`Config key conflict: "${keys.slice(0, index + 1).join('.')}" was not an object, but is being treated as one.`);
            current[key] = {};
        }
        current = current[key];
      }
    });
  }

  // Watching environment variables is complex and OS-dependent, typically not done directly.
  // Changes usually require a process restart or a signal to reload.
  public watch?(callback: (newConfig: Record<string, any>) => void): (() => void) | undefined {
    console.warn('EnvironmentConfigSource does not support live watching of environment variables.');
    return undefined;
  }
}

/**
 * @class ObjectConfigSource
 * Loads configuration directly from a JavaScript object.
 */
export class ObjectConfigSource implements IConfigSource {
  private configObject: Record<string, any>;
  private name: string;

  constructor(configObject: Record<string, any>, name: string = 'StaticObject') {
    this.configObject = configObject;
    this.name = name;
  }

  public getName(): string {
    return this.name;
  }

  public async load(): Promise<Record<string, any>> {
    // Return a copy to prevent external modification of the source object
    return JSON.parse(JSON.stringify(this.configObject));
  }

  // Watching a static object is not applicable unless the object itself is made reactive.
  public watch?(callback: (newConfig: Record<string, any>) => void): (() => void) | undefined {
    return undefined;
  }
}

// Example: FileConfigSource (requires 'fs' and 'path', and a parser like 'js-yaml' or 'dotenv')
// For brevity, this is a conceptual placeholder.
// import * as fs from 'fs/promises';
// import * as path from 'path';
// export class JsonFileConfigSource implements IConfigSource {
//   private filePath: string;
//   constructor(filePath: string) { this.filePath = path.resolve(filePath); }
//   public getName(): string { return `JsonFile(${this.filePath})`; }
//   public async load(): Promise<Record<string, any>> {
//     try {
//       const content = await fs.readFile(this.filePath, 'utf-8');
//       return JSON.parse(content);
//     } catch (error: any) {
//       if (error.code === 'ENOENT') return {}; // File not found, return empty config
//       throw error; // Other errors
//     }
//   }
//   public watch(callback: (newConfig: Record<string, any>) => void): (() => void) | undefined {
//     // fs.watch can be used here
//     console.warn(`File watching for ${this.filePath} not fully implemented in this example.`);
//     return () => {};
//   }
// }