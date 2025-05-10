// src/microservices/utils/management/version-manager.ts

import { IConfigService } from '../../services/infrastructure/config-service'; // For fetching app version
import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @interface VersionInfo
 * Represents version information for a component or the application.
 */
export interface VersionInfo {
  /** The primary version string (e.g., "1.2.3", "2.0.0-beta1"). Should follow SemVer if possible. */
  version: string;
  /** Optional build number or commit hash. */
  build?: string;
  /** Optional name of the component this version info pertains to. */
  componentName?: string;
  /** Optional date of the build or version release. */
  buildDate?: string; // ISO 8601 format preferably
  /** Additional arbitrary metadata. */
  [key: string]: any;
}

/**
 * @interface IVersionManager
 * Defines a contract for managing and retrieving version information.
 */
export interface IVersionManager {
  /**
   * Gets the primary application version information.
   * @returns A Promise resolving to VersionInfo for the main application.
   */
  getApplicationVersion(): Promise<VersionInfo>;

  /**
   * Gets version information for a specific component.
   * @param componentName - The name of the component.
   * @returns A Promise resolving to VersionInfo for the component, or undefined if not found.
   */
  getComponentVersion(componentName: string): Promise<VersionInfo | undefined>;

  /**
   * Registers or updates version information for a component.
   * @param componentName - The name of the component.
   * @param versionInfo - The version information to register.
   */
  registerComponentVersion(componentName: string, versionInfo: Omit<VersionInfo, 'componentName'>): Promise<void>;

  /**
   * Lists all known component versions.
   * @returns A Promise resolving to a record dificuldades component names to their VersionInfo.
   */
  getAllComponentVersions(): Promise<Record<string, VersionInfo>>;
}

/**
 * @class VersionManager
 * Manages version information for the application and its components.
 * It can fetch application version from config, environment variables, or a build file.
 */
export class VersionManager implements IVersionManager {
  private appVersion: VersionInfo;
  private componentVersions: Map<string, VersionInfo>;
  private configService?: IConfigService;
  private logger?: ILoggingService;
  private managerName: string;

  constructor(
    initialAppVersion?: Partial<VersionInfo>,
    configService?: IConfigService,
    logger?: ILoggingService,
    managerName: string = 'AppVersionManager'
  ) {
    this.configService = configService;
    this.logger = logger;
    this.managerName = managerName;
    this.componentVersions = new Map();

    // Initialize appVersion with sensible defaults, potentially overridden by config or environment
    const defaultVersion = '0.0.0-unknown';
    const appVersionFromConfig = this.configService?.get<string>('application.version', defaultVersion) || defaultVersion;
    const appBuildFromConfig = this.configService?.get<string>('application.build');
    const appBuildDateFromConfig = this.configService?.get<string>('application.buildDate');

    this.appVersion = {
      version: initialAppVersion?.version || appVersionFromConfig,
      build: initialAppVersion?.build || appBuildFromConfig,
      buildDate: initialAppVersion?.buildDate || appBuildDateFromConfig,
      componentName: initialAppVersion?.componentName || this.configService?.get<string>('application.name', 'MainApplication'),
      ...initialAppVersion // Allow other initial properties
    };

    this.log(LogLevel.INFO, `VersionManager "${this.managerName}" initialized. App Version: ${this.appVersion.version}${this.appVersion.build ? ` (Build: ${this.appVersion.build})` : ''}`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[VersionMgr:${this.managerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[VersionMgr:${this.managerName}] ${message}`, context || '');
    }
  }

  public async getApplicationVersion(): Promise<VersionInfo> {
    // Potentially re-fetch from config if it can change dynamically, though version usually doesn't.
    // For simplicity, return the version set at construction or last update.
    return { ...this.appVersion };
  }

  /**
   * Allows updating the main application version information post-construction.
   * Useful if version info is loaded asynchronously after VersionManager is created.
   */
  public async setApplicationVersion(versionInfo: Partial<VersionInfo>): Promise<void> {
    this.appVersion = { ...this.appVersion, ...versionInfo };
    this.log(LogLevel.INFO, `Application version updated: ${this.appVersion.version}${this.appVersion.build ? ` (Build: ${this.appVersion.build})` : ''}`);
  }


  public async getComponentVersion(componentName: string): Promise<VersionInfo | undefined> {
    const versionInfo = this.componentVersions.get(componentName);
    return versionInfo ? { ...versionInfo } : undefined;
  }

  public async registerComponentVersion(
    componentName: string,
    versionDetails: Omit<VersionInfo, 'componentName'> // This already requires 'version'
  ): Promise<void> {
    // versionDetails is guaranteed to have 'version: string' by its type Omit<VersionInfo, 'componentName'>.
    // Explicitly destructure to make the 'version' property clear to the type checker.
    const { version, ...otherDetailsFromVersionDetails } = versionDetails;
    
    const versionInfo: VersionInfo = {
      version: version, // Explicitly use the 'version' from versionDetails
      ...otherDetailsFromVersionDetails, // Spread the rest of the properties
      componentName: componentName, // Add/override componentName
    };
    this.componentVersions.set(componentName, versionInfo);
    this.log(LogLevel.INFO, `Version registered for component "${componentName}": ${versionInfo.version}${versionInfo.build ? ` (Build: ${versionInfo.build})` : ''}`);
  }

  public async getAllComponentVersions(): Promise<Record<string, VersionInfo>> {
    const allVersions: Record<string, VersionInfo> = {};
    this.componentVersions.forEach((value, key) => {
      allVersions[key] = { ...value };
    });
    return allVersions;
  }
}

// Example Usage:
async function exampleVersionManagerUsage() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  // const config = new ConfigService();
  // config.addSource(new ObjectConfigSource({
  //   application: {
  //     name: 'MyMicroserviceApp',
  //     version: '1.5.0',
  //     build: 'b1024-prod',
  //     buildDate: new Date().toISOString()
  //   }
  // }));
  // await config.loadConfiguration();

  const versionManager = new VersionManager(
    // undefined, // Or provide initial hardcoded version here
    // config,
    // logger
  );

  const appInfo = await versionManager.getApplicationVersion();
  console.log('Application Version Info:', JSON.stringify(appInfo, null, 2));

  await versionManager.registerComponentVersion('AuthService', { version: '2.1.0', build: 'auth-commit-abc' });
  await versionManager.registerComponentVersion('PaymentModule', { version: '1.0.5-alpha', buildDate: '2024-01-15T10:00:00Z' });

  const authVersion = await versionManager.getComponentVersion('AuthService');
  console.log('\nAuthService Version:', JSON.stringify(authVersion, null, 2));

  const allVersions = await versionManager.getAllComponentVersions();
  console.log('\nAll Component Versions:', JSON.stringify(allVersions, null, 2));

  // Example of updating app version post-init (e.g., if loaded from a dynamic source)
  // await versionManager.setApplicationVersion({ version: '1.5.1', build: 'hotfix-b1025' });
  // const updatedAppInfo = await versionManager.getApplicationVersion();
  // console.log('\nUpdated Application Version Info:', JSON.stringify(updatedAppInfo, null, 2));
}

// To run the example:
// exampleVersionManagerUsage().catch(e => console.error("Example usage main error:", e));