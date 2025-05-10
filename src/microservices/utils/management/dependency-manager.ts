// src/microservices/utils/management/dependency-manager.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @type ServiceFactory
 * A function that creates or resolves an instance of a service/dependency.
 * @param manager - The dependency manager instance, allowing factories to resolve other dependencies.
 * @param resolveArgs - Optional arguments passed during resolution.
 * @returns The service instance or a Promise resolving to it.
 */
export type ServiceFactory<T = any> = (manager: IDependencyManager, ...resolveArgs: any[]) => T | Promise<T>;

/**
 * @enum Scope
 * Defines the scope of a registered dependency.
 */
export enum Scope {
  /** A new instance is created every time the dependency is resolved. */
  TRANSIENT = 'TRANSIENT',
  /** A single instance is created and reused for all resolutions (singleton). */
  SINGLETON = 'SINGLETON',
  /**
   * (Advanced) A new instance is created for each resolution "context" or "request".
   * Requires a context management mechanism not implemented in this basic version.
   */
  // REQUEST = 'REQUEST',
}

/**
 * @interface RegistrationOptions
 * Options for registering a dependency.
 */
export interface RegistrationOptions {
  scope?: Scope;
  /** Names of other dependencies that this one depends on. Used for eager loading or validation. */
  dependencies?: string[];
  /** If true, the factory will be invoked and instance created when registered (for singletons). Default: false (lazy). */
  eagerLoad?: boolean;
}

/**
 * @interface IDependencyManager (also known as DI Container, Service Locator)
 * Defines a contract for managing and resolving dependencies.
 */
export interface IDependencyManager {
  /**
   * Registers a dependency with a factory function.
   * @param name - A unique name/key for the dependency (string or symbol).
   * @param factory - The function that will create/resolve the dependency instance.
   * @param options - Registration options like scope.
   */
  register<T>(name: string | symbol, factory: ServiceFactory<T>, options?: RegistrationOptions): void;

  /**
   * Registers a dependency with a pre-existing instance (implicitly a singleton).
   * @param name - A unique name/key for the dependency.
   * @param instance - The pre-existing instance.
   */
  registerInstance<T>(name: string | symbol, instance: T): void;

  /**
   * Resolves/retrieves an instance of a dependency.
   * @param name - The name/key of the dependency to resolve.
   * @param resolveArgs - Optional arguments that might be needed by the factory if it's context-sensitive
   *                      (not fully utilized in this basic version but good for extensibility).
   * @returns The resolved dependency instance or a Promise resolving to it.
   * @throws Error if the dependency is not registered or cannot be resolved.
   */
  resolve<T>(name: string | symbol, ...resolveArgs: any[]): T | Promise<T>;

  /**
   * Checks if a dependency is registered.
   * @param name - The name/key of the dependency.
   * @returns True if registered, false otherwise.
   */
  isRegistered(name: string | symbol): boolean;

  /**
   * Clears a specific registration.
   * If it's a singleton that has been instantiated, its instance might also be disposed of if it has a dispose method.
   * @param name - The name/key of the dependency to unregister.
   */
  unregister(name: string | symbol): Promise<void>;

  /**
   * Clears all registrations and singleton instances.
   * Attempts to call `dispose()` or `shutdown()` on singleton instances if they exist.
   */
  reset(): Promise<void>;
}

interface RegisteredDependency<T = any> {
  factory: ServiceFactory<T>;
  options: Required<RegistrationOptions>;
  instance?: T; // For singletons
  isResolving?: boolean; // For circular dependency detection in singletons
}

/**
 * @class DependencyManager
 * A simple dependency injection container or service locator.
 */
export class DependencyManager implements IDependencyManager {
  private registry: Map<string | symbol, RegisteredDependency<any>>;
  private logger?: ILoggingService;
  private managerName: string;

  constructor(logger?: ILoggingService, managerName: string = 'AppDependencyManager') {
    this.registry = new Map();
    this.logger = logger;
    this.managerName = managerName;
    this.log(LogLevel.INFO, `DependencyManager "${this.managerName}" initialized.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[DepMgr:${this.managerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[DepMgr:${this.managerName}] ${message}`, context || '');
    }
  }

  public register<T>(
    name: string | symbol,
    factory: ServiceFactory<T>,
    options?: RegistrationOptions
  ): void {
    if (this.isRegistered(name)) {
      this.log(LogLevel.WARN, `Dependency "${String(name)}" is already registered. Overwriting.`);
    }
    const regOptions: Required<RegistrationOptions> = {
      scope: Scope.SINGLETON, // Default to singleton
      dependencies: [],
      eagerLoad: false,
      ...options,
    };

    this.registry.set(name, { factory, options: regOptions });
    this.log(LogLevel.INFO, `Dependency registered: "${String(name)}" with scope ${regOptions.scope}.`);

    if (regOptions.eagerLoad && regOptions.scope === Scope.SINGLETON) {
        this.log(LogLevel.DEBUG, `Eager loading singleton: "${String(name)}".`);
        Promise.resolve(this.resolve<T>(name)).catch(err => {
            this.log(LogLevel.ERROR, `Failed to eager load singleton "${String(name)}".`, { error: err });
        });
    }
  }

  public registerInstance<T>(name: string | symbol, instance: T): void {
    if (this.isRegistered(name)) {
      this.log(LogLevel.WARN, `Dependency "${String(name)}" is already registered (as factory or instance). Overwriting with new instance.`);
    }
    const regOptions: Required<RegistrationOptions> = {
      scope: Scope.SINGLETON,
      dependencies: [],
      eagerLoad: true, // Instance is by definition "eagerly loaded"
    };
    // Wrap instance in a factory for consistent internal structure
    this.registry.set(name, { factory: () => instance, options: regOptions, instance });
    this.log(LogLevel.INFO, `Instance registered for dependency: "${String(name)}".`);
  }

  public isRegistered(name: string | symbol): boolean {
    return this.registry.has(name);
  }

  public resolve<T>(name: string | symbol, ...resolveArgs: any[]): T | Promise<T> {
    const registration = this.registry.get(name);
    if (!registration) {
      const errorMsg = `No dependency registered for name: "${String(name)}".`;
      this.log(LogLevel.ERROR, errorMsg);
      throw new Error(errorMsg);
    }

    if (registration.options.scope === Scope.SINGLETON) {
      if (registration.instance) {
        this.log(LogLevel.DEBUG, `Returning existing singleton instance for "${String(name)}".`);
        return registration.instance as T;
      }
      if (registration.isResolving) {
        const errorMsg = `Circular dependency detected while resolving singleton: "${String(name)}".`;
        this.log(LogLevel.ERROR, errorMsg);
        throw new Error(errorMsg);
      }

      this.log(LogLevel.DEBUG, `Creating new singleton instance for "${String(name)}".`);
      registration.isResolving = true;
      try {
        const instanceOrPromise = registration.factory(this, ...resolveArgs);
        if (instanceOrPromise instanceof Promise) {
          return instanceOrPromise.then(instance => {
            registration.instance = instance;
            registration.isResolving = false;
            this.log(LogLevel.DEBUG, `Async singleton instance created for "${String(name)}".`);
            return instance as T;
          }).catch(err => {
            registration.isResolving = false;
            this.log(LogLevel.ERROR, `Error creating async singleton "${String(name)}".`, { error: err });
            throw err;
          });
        } else {
          registration.instance = instanceOrPromise;
          registration.isResolving = false;
          this.log(LogLevel.DEBUG, `Singleton instance created for "${String(name)}".`);
          return instanceOrPromise as T;
        }
      } catch (error) {
        registration.isResolving = false;
        this.log(LogLevel.ERROR, `Error creating singleton "${String(name)}".`, { error });
        throw error;
      }
    }

    // Scope is TRANSIENT (or other future scopes)
    this.log(LogLevel.DEBUG, `Creating new transient instance for "${String(name)}".`);
    try {
        const instanceOrPromise = registration.factory(this, ...resolveArgs);
        // For transient, if it's a promise, the caller handles it.
        return instanceOrPromise as T | Promise<T>;
    } catch (error) {
        this.log(LogLevel.ERROR, `Error creating transient instance "${String(name)}".`, { error });
        throw error;
    }
  }

  public async unregister(name: string | symbol): Promise<void> {
    const registration = this.registry.get(name);
    if (registration) {
      if (registration.options.scope === Scope.SINGLETON && registration.instance) {
        this.log(LogLevel.DEBUG, `Disposing singleton instance for "${String(name)}" if possible.`);
        const instance = registration.instance as any;
        if (typeof instance.dispose === 'function') {
          await Promise.resolve(instance.dispose()).catch(e => this.log(LogLevel.ERROR, `Error disposing instance of "${String(name)}".`, { error: e }));
        } else if (typeof instance.shutdown === 'function') { // Common in lifecycle aware components
          await Promise.resolve(instance.shutdown()).catch(e => this.log(LogLevel.ERROR, `Error shutting down instance of "${String(name)}".`, { error: e }));
        }
      }
      this.registry.delete(name);
      this.log(LogLevel.INFO, `Dependency "${String(name)}" unregistered.`);
    } else {
      this.log(LogLevel.WARN, `Dependency "${String(name)}" not found for unregistration.`);
    }
  }

  public async reset(): Promise<void> {
    this.log(LogLevel.WARN, 'Resetting DependencyManager: Clearing all registrations and instances.');
    const names = Array.from(this.registry.keys());
    for (const name of names) {
      await this.unregister(name); // unregister will handle disposal
    }
    this.registry.clear(); // Should be empty now, but just in case.
    this.log(LogLevel.INFO, 'DependencyManager reset complete.');
  }
}

// Example Usage:
async function exampleDependencyManager() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  const dm = new DependencyManager(/* logger */);

  // --- Service Definitions ---
  interface IEmailService { send(to: string, message: string): void; }
  class EmailService implements IEmailService {
    constructor(private depMgr: IDependencyManager) {
      console.log('EmailService constructor called.');
    }
    send(to: string, message: string) { console.log(`Email to ${to}: ${message} (via ${this.constructor.name})`); }
    dispose() { console.log('EmailService disposed.'); }
  }

  class MockEmailService implements IEmailService {
    constructor() { console.log('MockEmailService constructor called.'); }
    send(to: string, message: string) { console.log(`MOCK Email to ${to}: ${message}`); }
  }

  interface IUserService { greet(userId: string): string; }
  class UserService implements IUserService {
    private emailService: IEmailService;
    constructor(private depMgr: IDependencyManager) {
      console.log('UserService constructor called.');
      // Lazy resolve dependency (or could be constructor injected if factory passes dm)
      this.emailService = depMgr.resolve<IEmailService>('EmailService') as IEmailService; // Factory is sync
    }
    greet(userId: string) {
      const message = `Hello, ${userId}!`;
      this.emailService.send(userId + '@example.com', message);
      return message;
    }
  }

  // --- Registration ---
  dm.register<IEmailService>('EmailService', (manager) => new EmailService(manager), { scope: Scope.SINGLETON });
  // dm.registerInstance<IEmailService>('EmailService', new MockEmailService()); // Alternative: register instance

  dm.register<IUserService>('UserService', (manager) => new UserService(manager), { scope: Scope.TRANSIENT, dependencies: ['EmailService'] });

  // --- Resolution & Usage ---
  console.log('\n--- Resolving UserService (Transient) ---');
  const userService1 = dm.resolve<IUserService>('UserService') as IUserService; // Factory is sync
  userService1.greet('Alice');

  const userService2 = dm.resolve<IUserService>('UserService') as IUserService; // Factory is sync
  userService2.greet('Bob');
  console.log('userService1 === userService2:', userService1 === userService2); // false for Transient

  console.log('\n--- Resolving EmailService (Singleton) ---');
  const emailService1 = dm.resolve<IEmailService>('EmailService') as IEmailService; // Factory is sync
  const emailService2 = dm.resolve<IEmailService>('EmailService') as IEmailService; // Factory is sync
  console.log('emailService1 === emailService2:', emailService1 === emailService2); // true for Singleton

  // Eager load example
  class ConfigService {
      constructor() { console.log("ConfigService (eagerly loaded) constructor called."); this.settings = { appName: "MyApp" }; }
      settings: any;
      dispose() { console.log("ConfigService disposed."); }
  }
  dm.register<ConfigService>('ConfigService', () => new ConfigService(), { eagerLoad: true, scope: Scope.SINGLETON });
  // The constructor log for ConfigService should appear before this line if eagerLoad works:
  console.log("After ConfigService registration (check logs for eager load).");
  const config = dm.resolve<ConfigService>('ConfigService') as ConfigService; // Factory is sync
  console.log("Config settings:", config.settings);


  // --- Reset ---
  console.log('\n--- Resetting DependencyManager ---');
  await dm.reset();
  console.log('Is EmailService registered after reset?', dm.isRegistered('EmailService')); // false

  // Example of async factory
  dm.register<string>('AsyncData', async (manager) => {
      console.log("AsyncData factory: starting fetch...");
      await new Promise(r => setTimeout(r, 500));
      console.log("AsyncData factory: fetch complete.");
      return "Fetched Asynchronously";
  }, {scope: Scope.SINGLETON});

  console.log("\n--- Resolving AsyncData (Singleton, Async Factory) ---");
  const asyncDataPromise = dm.resolve<string>('AsyncData') as Promise<string>;
  asyncDataPromise.then(data => {
      console.log("AsyncData resolved:", data);
      const asyncDataAgain = dm.resolve<string>('AsyncData'); // Should be the resolved instance now
      console.log("AsyncData resolved again (should be instance):", asyncDataAgain);
  }).catch(err => console.error("Error resolving async data:", err));

  await asyncDataPromise; // Wait for it to complete for clean exit of example
  await dm.reset();
}

// To run the example:
// exampleDependencyManager().catch(e => console.error("Example usage main error:", e));