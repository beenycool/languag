import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG, ConfigUpdate, ValidationResult, ChangeCallback, ConfigChange } from '../../shared/types/config';

// Helper for deep object access
const getProperty = <T>(obj: any, path: string, defaultValue?: T): T | undefined => {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object' || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }
  return current as T;
};

const setProperty = (obj: any, path: string, value: any): void => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
};

export class ConfigurationManager {
  private config: AppConfig;
  private readonly configPath: string;
  private changeListeners: Map<string, ChangeCallback[]> = new Map();

  constructor(configFilePath?: string) {
    this.configPath = configFilePath || path.join(app.getPath('userData'), 'app-config.json');
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
    this.loadSync(); // Load synchronously on instantiation for simplicity here
  }

  private loadSync(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(fileContent);
        // Deep merge with a deep clone of defaults to ensure all keys are present
        this.config = this.mergeDeep(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), loadedConfig);
        console.log(`Configuration loaded from ${this.configPath}`);
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
        this.saveSync(); // Save defaults if no config file exists
        console.log(`Default configuration saved to ${this.configPath}`);
      }
    } catch (error) {
      console.error('ConfigLoadError: Failed to load configuration:', error);
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Fallback to deep clone of defaults
    }
  }

  private saveSync(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error('ConfigPersistenceError: Failed to save configuration:', error);
    }
  }

  async load(): Promise<void> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const fileContent = await fs.readFile(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(fileContent);
        this.config = this.mergeDeep(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), loadedConfig);
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
        await this.save();
      }
    } catch (error) {
      console.error('ConfigLoadError: Failed to load configuration asynchronously:', error);
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
    }
  }

  async save(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('ConfigPersistenceError: Failed to save configuration asynchronously:', error);
    }
  }

  async reset(): Promise<void> {
    const oldConfig = JSON.parse(JSON.stringify(this.config)); // Deep clone for old state
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone for new state
    await this.save();
    // Notify listeners about all changes during reset
    this.notifyChangesForObject(this.config, oldConfig, "");
  }

  get<T>(key: string, defaultValue?: T): T {
    const value = getProperty(this.config, key, defaultValue);
    // Ensure that if defaultValue is provided and value is undefined, defaultValue is returned.
    // Also, handle cases where T might be boolean and value is undefined.
    return value === undefined && defaultValue !== undefined ? defaultValue : (value as T);
  }

  getFullConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Return a deep clone
  }

  update(configUpdate: Partial<AppConfig>): void {
    const oldConfigSnapshot = JSON.parse(JSON.stringify(this.config));
    this.config = this.mergeDeep(this.config, configUpdate);
    this.saveSync();
    this.notifyChangesForObject(this.config, oldConfigSnapshot, "");
  }

  set<T>(key: string, value: T): void {
    const oldValue = getProperty(this.config, key);
    setProperty(this.config, key, value);
    this.notifyChange(key, oldValue, value);
    // Consider auto-saving or debounced saving here
    this.saveSync(); // For simplicity, save immediately
  }

  has(key: string): boolean {
    return getProperty(this.config, key) !== undefined;
  }

  delete(key: string): void {
    const oldValue = getProperty(this.config, key);
    // This is a simplified delete; for true nested delete, a more complex helper is needed
    const keys = key.split('.');
    let current = this.config as any;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        return; // Path doesn't exist
      }
      current = current[keys[i]];
    }
    if (current && keys[keys.length -1] in current) {
      delete current[keys[keys.length - 1]];
      this.notifyChange(key, oldValue, undefined);
      this.saveSync();
    }
  }

  // Basic validation (can be expanded based on spec)
  validate(): ValidationResult[] {
    // Implement actual validation rules as per specs/core/configuration.md
    const results: ValidationResult[] = [];
    if (this.config.llm.contextSize < 512 || this.config.llm.contextSize > 8192) {
      results.push({ path: "llm.contextSize", isValid: false, message: "Must be between 512 and 8192" });
    }
    if (this.config.engine.maxConcurrentTasks <= 0 || this.config.engine.maxConcurrentTasks > 10) {
        results.push({ path: "engine.maxConcurrentTasks", isValid: false, message: "Must be between 1 and 10" });
    }
    // Add more validation rules here
    return results;
  }

  validateSection(sectionKey: string): ValidationResult[] {
    const sectionConfig = getProperty(this.config, sectionKey);
    if (sectionConfig === undefined) {
        return [{ path: sectionKey, isValid: false, message: "Section not found" }];
    }
    // This is a placeholder. Implement specific validation logic for each section.
    // For now, just re-validating the whole config and filtering.
    return this.validate().filter(res => res.path.startsWith(sectionKey));
  }


  onChange(key: string, callback: ChangeCallback): () => void {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, []);
    }
    this.changeListeners.get(key)!.push(callback);

    // Return an unsubscribe function
    return () => {
      const listeners = this.changeListeners.get(key);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
          if (listeners.length === 0) {
            this.changeListeners.delete(key);
          }
        }
      }
    };
  }

  private notifyChange(path: string, oldValue: any, newValue: any): void {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;

    const change: ConfigChange = {
      path,
      oldValue,
      newValue,
      timestamp: Date.now(),
    };

    // Notify specific listeners
    const specificListeners = this.changeListeners.get(path);
    if (specificListeners) {
      specificListeners.forEach(cb => cb(change));
    }

    // Notify wildcard listeners (e.g., for parent paths)
    this.changeListeners.forEach((callbacks, listenerPath) => {
      if (path.startsWith(listenerPath + ".") && listenerPath !== path) {
        callbacks.forEach(cb => cb(change));
      }
    });
     // Notify global listeners (listening on "*")
    const globalListeners = this.changeListeners.get('*');
    if (globalListeners) {
        globalListeners.forEach(cb => cb(change));
    }
  }

  private notifyChangesForObject(current: any, previous: any, basePath: string): void {
    Object.keys(current).forEach(key => {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      const currentValue = current[key];
      const previousValue = previous ? previous[key] : undefined;

      if (typeof currentValue === 'object' && currentValue !== null && typeof previousValue === 'object' && previousValue !== null) {
        this.notifyChangesForObject(currentValue, previousValue, currentPath);
      } else if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
        this.notifyChange(currentPath, previousValue, currentValue);
      }
    });
    // Check for keys removed in current that were in previous
    if (previous) {
        Object.keys(previous).forEach(key => {
            if (!(key in current)) {
                const currentPath = basePath ? `${basePath}.${key}` : key;
                this.notifyChange(currentPath, previous[key], undefined);
            }
        });
    }
  }


  batch(updates: ConfigUpdate[]): void {
    const oldConfigSnapshot = JSON.parse(JSON.stringify(this.config)); // Deep clone
    updates.forEach(update => {
      // We don't notify during batch application, only after all are applied.
      setProperty(this.config, update.key, update.value);
    });
    this.saveSync(); // Save after all batch updates are applied

    // Now, compare the new config with the snapshot to notify changes
    this.notifyChangesForObject(this.config, oldConfigSnapshot, "");
  }

  // Basic stubs for import/export, can be expanded
  async exportToFile(filePath: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log(`Configuration exported to ${filePath}`);
    } catch (error) {
      console.error(`ConfigPersistenceError: Failed to export configuration to ${filePath}:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async importFromFile(filePath: string): Promise<void> {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const importedConfig = JSON.parse(fileContent);
      
      const oldConfigSnapshot = JSON.parse(JSON.stringify(this.config)); // Deep clone
      // Validate importedConfig structure here if necessary before merging
      this.config = this.mergeDeep({ ...DEFAULT_CONFIG }, importedConfig); // Merge with defaults
      await this.save();
      console.log(`Configuration imported from ${filePath}`);
      this.notifyChangesForObject(this.config, oldConfigSnapshot, "");
    } catch (error) {
      console.error(`ConfigPersistenceError: Failed to import configuration from ${filePath}:`, error);
      throw error; // Re-throw
    }
  }

  /**
   * Simple deep merge function.
   * Note: This doesn't handle arrays well (it replaces them).
   * For more sophisticated merging, a library might be better.
   */
  private mergeDeep(target: any, source: any): AppConfig {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target))
            Object.assign(output, { [key]: source[key] });
          else
            output[key] = this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output as AppConfig;
  }

  private isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
}

// Export a singleton instance
export const configManager = new ConfigurationManager();