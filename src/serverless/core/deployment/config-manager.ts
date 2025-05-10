type ConfigValue = string | number | boolean | Record<string, unknown>;

export class ConfigManager {
  private configs = new Map<string, Record<string, ConfigValue>>();
  private globalConfig: Record<string, ConfigValue> = {};

  update(functionId: string, config: Record<string, ConfigValue>) {
    this.configs.set(functionId, {
      ...this.configs.get(functionId),
      ...config
    });
  }

  get<T extends ConfigValue>(key: string, functionId?: string): T | undefined {
    if (functionId) {
      return this.configs.get(functionId)?.[key] as T;
    }
    return this.globalConfig[key] as T;
  }

  setGlobal(config: Record<string, ConfigValue>) {
    this.globalConfig = { ...this.globalConfig, ...config };
  }

  getAll(functionId?: string) {
    return functionId 
      ? { ...this.globalConfig, ...this.configs.get(functionId) }
      : this.globalConfig;
  }
}