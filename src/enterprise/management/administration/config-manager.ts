/**
 * @file Enterprise Configuration Manager
 *
 * This file defines the configuration manager for enterprise applications and services.
 * It handles loading, accessing, and potentially updating configurations from various
 * sources (e.g., files, environment variables, configuration servers like Consul, Etcd).
 *
 * Focus areas:
 * - Reliability: Ensures consistent and correct configuration loading.
 * - Enterprise security: Manages sensitive configuration values securely (e.g., using Vault).
 * - Scalability: Can serve configurations to many services.
 * - Compliance: Audits access and changes to configurations.
 */

interface IConfigSource {
  type: 'file' | 'env' | 'consul' | 'etcd' | 'vault' | 'custom';
  priority: number; // Lower number means higher priority (overrides higher numbers)
  path?: string; // File path, Vault path, Consul/Etcd key prefix
  prefix?: string; // For environment variables (e.g., 'APP_')
  address?: string; // For remote config servers (e.g., 'http://consul:8500')
  token?: string; // For authenticated access to config servers
  // Custom loader for 'custom' type
  customLoader?: (source: IConfigSource) => Promise<Record<string, any>>;
}

interface IConfigManager {
  /**
   * Loads configurations from all registered sources.
   * This should be called during application startup.
   */
  loadConfigurations(): Promise<void>;

  /**
   * Adds a configuration source. Sources are processed by priority.
   * @param source The configuration source to add.
   */
  addSource(source: IConfigSource): void;

  /**
   * Retrieves a configuration value.
   * @param key The configuration key (e.g., 'database.host', 'featureFlags.newUI').
   * @param defaultValue Optional default value if the key is not found.
   * @returns The configuration value, or the default value, or undefined.
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined;

  /**
   * Retrieves all loaded configurations.
   * @returns A read-only representation of the entire configuration.
   */
  getAll(): Readonly<Record<string, any>>;

  /**
   * Subscribes to changes for a specific configuration key or prefix.
   * (Requires a dynamic configuration source that supports watching).
   * @param keyOrPrefix The key or prefix to watch.
   * @param callback The function to call when a change is detected.
   * @returns A subscription ID or object to allow unsubscribing.
   */
  watch(keyOrPrefix: string, callback: (newValue: any, oldValue?: any) => void): Promise<string>;

  /**
   * Unsubscribes from configuration changes.
   * @param subscriptionId The ID returned by watch().
   */
  unwatch(subscriptionId: string): Promise<void>;

  /**
   * Refreshes configurations from a specific source or all sources.
   * @param sourceId Optional ID of the source to refresh (if sources have IDs, or by type/path).
   */
  refresh(sourceId?: string): Promise<void>;
}

export class ConfigManager implements IConfigManager {
  private sources: IConfigSource[] = [];
  private combinedConfig: Record<string, any> = {};
  private watchers: Map<string, Array<{ id: string, callback: (newValue: any, oldValue?: any) => void }>> = new Map();
  private nextWatcherId = 1;

  constructor() {
    console.log('Enterprise Config Manager initialized.');
  }

  addSource(source: IConfigSource): void {
    this.sources.push(source);
    this.sources.sort((a, b) => a.priority - b.priority); // Sort by priority
    console.log(`Added config source: type='${source.type}', priority=${source.priority}, path/prefix='${source.path || source.prefix || 'N/A'}'`);
  }

  async loadConfigurations(): Promise<void> {
    console.log('Loading configurations from all sources...');
    const newCombinedConfig: Record<string, any> = {};

    for (const source of [...this.sources].reverse()) { // Iterate from highest priority (lowest number) by reversing sorted
      try {
        let configPart: Record<string, any> | null = null;
        console.log(`Loading from source type: ${source.type}, priority: ${source.priority}`);
        switch (source.type) {
          case 'file':
            // configPart = await this.loadFromFile(source.path!); // Requires fs module
            configPart = this.simulateLoadFromFile(source.path!);
            break;
          case 'env':
            // configPart = this.loadFromEnv(source.prefix);
            configPart = this.simulateLoadFromEnv(source.prefix);
            break;
          case 'consul':
          case 'etcd':
          case 'vault':
            // configPart = await this.loadFromRemote(source); // Requires HTTP client and specific logic
            configPart = this.simulateLoadFromRemote(source);
            break;
          case 'custom':
            if (source.customLoader) {
              configPart = await source.customLoader(source);
            } else {
              console.warn(`Custom source type specified for priority ${source.priority} but no customLoader provided.`);
            }
            break;
          default:
            console.warn(`Unsupported config source type: ${source.type}`);
        }

        if (configPart) {
          // Deep merge, newConfigPart overrides existing values in newCombinedConfig
          this.mergeDeep(newCombinedConfig, configPart);
        }
      } catch (error) {
        console.error(`Failed to load configuration from source type ${source.type} (priority ${source.priority}):`, error);
        // Decide if loading should halt or continue with other sources
      }
    }
    const oldConfig = this.combinedConfig;
    this.combinedConfig = newCombinedConfig;
    console.log('All configurations loaded.');
    // console.log('Final combined config:', JSON.stringify(this.combinedConfig, null, 2)); // For debugging

    // Notify watchers if config changed
    this.notifyWatchers(this.combinedConfig, oldConfig);
  }

  private notifyWatchers(newConfig: Record<string, any>, oldConfig: Record<string, any>){
    this.watchers.forEach((callbacks, keyOrPrefix) => {
        // This is a simplified notification. Real implementation would check specific key/prefix changes.
        const newValue = this.getNestedProperty(newConfig, keyOrPrefix);
        const oldValue = this.getNestedProperty(oldConfig, keyOrPrefix);

        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
            callbacks.forEach(watcher => {
                try {
                    watcher.callback(newValue, oldValue);
                } catch (err) {
                    console.error(`Error in config watcher for '${keyOrPrefix}':`, err);
                }
            });
        }
    });
  }


  get<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = this.getNestedProperty(this.combinedConfig, key);
    return value !== undefined ? value : defaultValue;
  }

  getAll(): Readonly<Record<string, any>> {
    return Object.freeze(JSON.parse(JSON.stringify(this.combinedConfig))); // Deep clone and freeze
  }

  async watch(keyOrPrefix: string, callback: (newValue: any, oldValue?: any) => void): Promise<string> {
    // Real watching requires integration with config server's watch capabilities or file system watchers.
    // This is a simplified polling or manual refresh based notification.
    const watcherId = `watcher-${this.nextWatcherId++}`;
    const existingWatchers = this.watchers.get(keyOrPrefix) || [];
    existingWatchers.push({ id: watcherId, callback });
    this.watchers.set(keyOrPrefix, existingWatchers);
    console.log(`Watcher added for key/prefix '${keyOrPrefix}' with ID ${watcherId}. (Simulated: relies on refresh)`);
    return watcherId;
  }

  async unwatch(subscriptionId: string): Promise<void> {
    this.watchers.forEach((callbacks, key) => {
      const index = callbacks.findIndex(w => w.id === subscriptionId);
      if (index > -1) {
        callbacks.splice(index, 1);
        if (callbacks.length === 0) {
          this.watchers.delete(key);
        }
        console.log(`Watcher ${subscriptionId} removed for key/prefix '${key}'.`);
      }
    });
  }

  async refresh(sourceId?: string): Promise<void> {
    // For simplicity, reloads all. A real implementation might target a specific source.
    console.log(`Configuration refresh triggered (sourceId: ${sourceId || 'all'}).`);
    await this.loadConfigurations();
  }

  // --- Helper methods for merging and accessing nested properties ---
  private getNestedProperty(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((o, k) => (o && typeof o === 'object' && o[k] !== undefined) ? o[k] : undefined, obj);
  }

  private mergeDeep(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            Object.assign(target, { [key]: {} });
          }
          this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    return target;
  }

  // --- Simulation methods for loading (replace with actual implementations) ---
  private simulateLoadFromFile(filePath: string): Record<string, any> {
    console.log(`Simulating load from file: ${filePath}`);
    if (filePath.includes('db')) return { database: { host: 'file-db-host', port: 5432, user: 'file_user' }, featureFlags: { newCheckout: true } };
    if (filePath.includes('app')) return { serviceName: 'OrderServiceFromFile', logLevel: 'DEBUG' };
    return {};
  }

  private simulateLoadFromEnv(prefix?: string): Record<string, any> {
    console.log(`Simulating load from env with prefix: ${prefix || '(none)'}`);
    const envVars: Record<string, any> = {
        [`${prefix || ''}DATABASE_HOST`]: 'env-db-host',
        [`${prefix || ''}DATABASE_PORT`]: '3306',
        [`${prefix || ''}API_KEY`]: 'env-api-key-secret',
        [`${prefix || ''}LOG_LEVEL`]: 'INFO',
        [`${prefix || ''}FEATURE_FLAGS_NEW_CHECKOUT`]: 'false', // Note: string 'false'
    };
    // Simple un-nesting for simulation based on '_' or '.'
    const result: Record<string, any> = {};
    for(const key in envVars) {
        if(!prefix || key.startsWith(prefix)){
            const unprefixedKey = prefix ? key.substring(prefix.length) : key;
            const parts = unprefixedKey.toLowerCase().split(/[_.]+/);
            let current = result;
            parts.forEach((part, index) => {
                if(index === parts.length -1) {
                    let value: any = envVars[key];
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (!isNaN(Number(value))) value = Number(value);
                    current[part] = value;
                } else {
                    current[part] = current[part] || {};
                    current = current[part];
                }
            });
        }
    }
    return result;
  }

  private simulateLoadFromRemote(source: IConfigSource): Record<string, any> {
    console.log(`Simulating load from remote ${source.type}: ${source.address || source.path}`);
    if (source.type === 'vault') return { secrets: { apiKey: 'vault-super-secret', dbPassword: 'vault-db-password' } };
    if (source.type === 'consul') return { serviceDiscovery: { userServiceUrl: 'http://user-service.consul' }, featureFlags: { newUI: true, newCheckout: false } };
    return {};
  }
}

// Example Usage (Conceptual)
// async function runConfigManagerExample() {
//   const configManager = new ConfigManager();

//   configManager.addSource({ type: 'file', priority: 3, path: './config/default-app-settings.json' });
//   configManager.addSource({ type: 'file', priority: 2, path: './config/database.json' });
//   configManager.addSource({ type: 'env', priority: 1, prefix: 'MYAPP_' });
//   configManager.addSource({
//     type: 'consul',
//     priority: 0,
//     address: 'http://localhost:8500',
//     path: 'config/my-app/',
//     // token: 'consul-acl-token'
//   });

//   await configManager.loadConfigurations();

//   console.log("\n--- Retrieved Config Values ---");
//   console.log('Service Name:', configManager.get('serviceName', 'DefaultService'));
//   console.log('Database Host:', configManager.get('database.host'));
//   console.log('Database Port (number):', configManager.get<number>('database.port'));
//   console.log('Log Level:', configManager.get('logLevel'));
//   console.log('API Key from env:', configManager.get('apiKey'));
//   console.log('Feature: New UI (from Consul):', configManager.get('featureFlags.newUI'));
//   console.log('Feature: New Checkout (overridden by file, then env):', configManager.get('featureFlags.newCheckout'));
//   console.log('Missing Key:', configManager.get('nonExistent.key', 'fallbackValue'));

//   // console.log("\n--- All Configs ---");
//   // console.log(JSON.stringify(configManager.getAll(), null, 2));

//   // Simulate a change and refresh
//   // In a real scenario, a remote source (Consul) might change.
//   // Here, we'd manually alter a simulated source or trigger a webhook if supported.
//   console.log("\n--- Simulating refresh (no actual remote changes in this mock) ---");
//   // To see changes, you'd need to modify what simulateLoadFromRemote returns for 'consul'
//   // or how simulateLoadFromFile/Env works before calling refresh.
//   await configManager.refresh();
//   console.log('After Refresh - Feature: New UI:', configManager.get('featureFlags.newUI'));
// }

// runConfigManagerExample();