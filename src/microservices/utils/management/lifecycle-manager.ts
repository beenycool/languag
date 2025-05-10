// src/microservices/utils/management/lifecycle-manager.ts

import { ILoggingService, LogLevel } from '../../services/management/logging-service'; // Optional

/**
 * @enum LifecycleStage
 * Represents the lifecycle stage of a component.
 */
export enum LifecycleStage {
  PENDING = 'PENDING',       // Initial state, not yet processed.
  INITIALIZING = 'INITIALIZING',
  STARTING = 'STARTING',
  STARTED = 'STARTED',       // Successfully started.
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',       // Successfully stopped or was never started and is now considered "done".
  FAILED_STARTUP = 'FAILED_STARTUP', // Failed during startup.
  FAILED_SHUTDOWN = 'FAILED_SHUTDOWN', // Failed during shutdown.
}

/**
 * @interface LifecycleAware
 * Interface for components that can be managed by the LifecycleManager.
 */
export interface LifecycleAware {
  /** A unique name for the component. */
  getLifecycleName(): string;
  /** Function to start up the component. */
  startup(): Promise<void>;
  /** Function to shut down the component. */
  shutdown(): Promise<void>;
  /** Optional: Get the current lifecycle stage of the component. */
  getStage?(): LifecycleStage;
  /** Optional: Dependencies, names of other LifecycleAware components that must be started before this one. */
  getDependencies?(): string[];
}

/**
 * @interface LifecycleEvent
 * Represents an event occurring during a component's lifecycle.
 */
export interface LifecycleEvent {
  componentName: string;
  stage: LifecycleStage;
  timestamp: number;
  error?: Error;
  message?: string;
}

/**
 * @type LifecycleEventListener
 * Callback function for lifecycle events.
 */
export type LifecycleEventListener = (event: LifecycleEvent) => void;

/**
 * @interface ILifecycleManager
 * Defines the contract for managing the lifecycle of multiple components.
 */
export interface ILifecycleManager {
  /** Registers a lifecycle-aware component. */
  register(component: LifecycleAware): void;
  /** Deregisters a component by its name. */
  deregister(componentName: string): void;
  /** Starts all registered components in an order respecting dependencies. */
  startupAll(): Promise<void>;
  /** Shuts down all registered components, typically in reverse startup order. */
  shutdownAll(): Promise<void>;
  /** Starts a specific component by name (and its dependencies if not yet started). */
  startupComponent(componentName: string): Promise<void>;
  /** Shuts down a specific component by name (components depending on it might also be affected or need manual handling). */
  shutdownComponent(componentName: string): Promise<void>;
  /** Subscribes to lifecycle events. Returns an unsubscribe function. */
  onEvent(listener: LifecycleEventListener): () => void;
  /** Gets the current stage of a component. */
  getComponentStage(componentName: string): LifecycleStage | undefined;
}

/**
 * @class LifecycleManager
 * Manages the startup and shutdown sequences of various application components,
 * respecting dependencies.
 */
export class LifecycleManager implements ILifecycleManager {
  private components: Map<string, { component: LifecycleAware; stage: LifecycleStage }>;
  private logger?: ILoggingService;
  private managerName: string;
  private eventListeners: Set<LifecycleEventListener>;
  private startupOrder: string[] | null = null; // Cached startup order

  constructor(logger?: ILoggingService, managerName: string = 'AppLifecycleManager') {
    this.components = new Map();
    this.logger = logger;
    this.managerName = managerName;
    this.eventListeners = new Set();
    this.log(LogLevel.INFO, `LifecycleManager "${this.managerName}" initialized.`);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (this.logger) {
      this.logger.log(level, `[LifecycleMgr:${this.managerName}] ${message}`, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      (level === LogLevel.ERROR ? console.error : console.warn)(`[LifecycleMgr:${this.managerName}] ${message}`, context || '');
    }
  }

  private emitEvent(componentName: string, stage: LifecycleStage, error?: Error, message?: string): void {
    const event: LifecycleEvent = { componentName, stage, timestamp: Date.now(), error, message };
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        this.log(LogLevel.ERROR, 'Error in lifecycle event listener.', { error: e, componentName, stage });
      }
    });
  }

  private setComponentStage(componentName: string, stage: LifecycleStage, error?: Error, message?: string): void {
    const componentEntry = this.components.get(componentName);
    if (componentEntry) {
      componentEntry.stage = stage;
      this.emitEvent(componentName, stage, error, message);
    }
  }

  public register(component: LifecycleAware): void {
    const name = component.getLifecycleName();
    if (this.components.has(name)) {
      this.log(LogLevel.WARN, `Component "${name}" is already registered. Overwriting.`);
    }
    this.components.set(name, { component, stage: LifecycleStage.PENDING });
    this.startupOrder = null; // Invalidate cached order
    this.log(LogLevel.INFO, `Component registered: ${name}`);
    this.emitEvent(name, LifecycleStage.PENDING, undefined, 'Component registered.');
  }

  public deregister(componentName: string): void {
    if (this.components.has(componentName)) {
      const currentStage = this.getComponentStage(componentName);
      if (currentStage === LifecycleStage.STARTED || currentStage === LifecycleStage.STARTING) {
          this.log(LogLevel.WARN, `Deregistering component "${componentName}" which is currently ${currentStage}. Consider shutting it down first.`);
      }
      this.components.delete(componentName);
      this.startupOrder = null; // Invalidate cached order
      this.log(LogLevel.INFO, `Component deregistered: ${componentName}`);
      this.emitEvent(componentName, LifecycleStage.STOPPED, undefined, 'Component deregistered.'); // Or a new DEREGISTERED stage
    } else {
      this.log(LogLevel.WARN, `Component "${componentName}" not found for deregistration.`);
    }
  }

  public getComponentStage(componentName: string): LifecycleStage | undefined {
    return this.components.get(componentName)?.stage;
  }

  private async resolveStartupOrder(): Promise<string[]> {
    if (this.startupOrder) return this.startupOrder;

    this.log(LogLevel.DEBUG, 'Resolving component startup order...');
    const order: string[] = [];
    const visited: Set<string> = new Set(); // For cycle detection and tracking processed nodes
    const processing: Set<string> = new Set(); // For cycle detection within current recursion path

    const visit = async (componentName: string) => {
      if (order.includes(componentName)) return; // Already added to order
      if (processing.has(componentName)) {
        throw new Error(`Circular dependency detected involving component: ${componentName}`);
      }
      if (visited.has(componentName) && !order.includes(componentName)) {
        // This case should ideally not happen if logic is correct, means visited but not added to order.
        // Could indicate an issue or a non-critical path that was visited but whose dependencies weren't fully resolved.
        this.log(LogLevel.WARN, `Component ${componentName} was visited but not added to order, implies complex dependency issue or prior error.`);
      }


      const componentEntry = this.components.get(componentName);
      if (!componentEntry) {
        throw new Error(`Dependency component "${componentName}" not registered.`);
      }

      processing.add(componentName);
      visited.add(componentName);

      const dependencies = componentEntry.component.getDependencies ? componentEntry.component.getDependencies() : [];
      for (const depName of dependencies) {
        if (!this.components.has(depName)) {
            throw new Error(`Component "${componentName}" depends on unregistered component "${depName}".`);
        }
        if (!order.includes(depName)) { // Only visit if not already processed and added to final order
            await visit(depName);
        }
      }

      processing.delete(componentName);
      if (!order.includes(componentName)) { // Ensure it's not added twice
          order.push(componentName);
      }
    };

    for (const name of this.components.keys()) {
      if (!order.includes(name)) { // If not already processed as a dependency of another
        await visit(name);
      }
    }
    this.startupOrder = order;
    this.log(LogLevel.INFO, 'Startup order resolved.', { order: this.startupOrder });
    return this.startupOrder;
  }


  public async startupAll(): Promise<void> {
    let order: string[];
    try {
        order = await this.resolveStartupOrder();
    } catch (error: any) {
        this.log(LogLevel.ERROR, 'Failed to resolve startup order.', { error: error.message });
        this.emitEvent('System', LifecycleStage.FAILED_STARTUP, error, 'Failed to resolve startup order.');
        throw error;
    }

    this.log(LogLevel.INFO, 'Starting all components...', { order });
    for (const componentName of order) {
      const componentEntry = this.components.get(componentName);
      if (componentEntry && componentEntry.stage !== LifecycleStage.STARTED) {
        await this.startupComponent(componentName); // This will handle dependencies implicitly due to order
      }
    }
    this.log(LogLevel.INFO, 'All components started (or attempted).');
    this.emitEvent('System', LifecycleStage.STARTED, undefined, 'All components startup process completed.');
  }

  public async shutdownAll(): Promise<void> {
    let order: string[];
     try {
        // Shutdown in reverse startup order
        order = (this.startupOrder || await this.resolveStartupOrder()).slice().reverse();
    } catch (error: any) {
        this.log(LogLevel.WARN, 'Could not resolve startup order for shutdown, using registration order (reversed). May not be ideal.', { error: error.message });
        // Fallback to reverse registration order if resolution failed (e.g. during a failed startup)
        order = Array.from(this.components.keys()).reverse();
    }

    this.log(LogLevel.INFO, 'Shutting down all components...', { order });
    for (const componentName of order) {
      const componentEntry = this.components.get(componentName);
      // Only shutdown if it was started or in a state that implies it might need shutdown
      if (componentEntry && (
          componentEntry.stage === LifecycleStage.STARTED ||
          componentEntry.stage === LifecycleStage.STARTING ||
          componentEntry.stage === LifecycleStage.FAILED_STARTUP // Attempt cleanup even if startup failed
        )) {
        await this.shutdownComponent(componentName);
      }
    }
    this.log(LogLevel.INFO, 'All components shut down (or attempted).');
    this.emitEvent('System', LifecycleStage.STOPPED, undefined, 'All components shutdown process completed.');
  }

  public async startupComponent(componentName: string): Promise<void> {
    const componentEntry = this.components.get(componentName);
    if (!componentEntry) {
      const error = new Error(`Component "${componentName}" not registered.`);
      this.log(LogLevel.ERROR, error.message);
      this.emitEvent(componentName, LifecycleStage.FAILED_STARTUP, error);
      throw error;
    }

    if (componentEntry.stage === LifecycleStage.STARTED) {
      this.log(LogLevel.DEBUG, `Component "${componentName}" is already started.`);
      return;
    }
    if (componentEntry.stage === LifecycleStage.STARTING) {
      this.log(LogLevel.WARN, `Component "${componentName}" is already starting. Concurrent startup call ignored.`);
      // Optionally, return a promise that resolves when the ongoing startup completes.
      return;
    }

    // Ensure dependencies are started
    const dependencies = componentEntry.component.getDependencies ? componentEntry.component.getDependencies() : [];
    this.log(LogLevel.DEBUG, `Starting dependencies for "${componentName}" if any.`, { dependencies });
    for (const depName of dependencies) {
        const depEntry = this.components.get(depName);
        if (!depEntry || depEntry.stage !== LifecycleStage.STARTED) {
            this.log(LogLevel.INFO, `Dependency "${depName}" for "${componentName}" not started. Starting it now.`);
            await this.startupComponent(depName); // Recursive call to ensure dependency is up
        }
    }


    this.log(LogLevel.INFO, `Starting component: ${componentName}`);
    this.setComponentStage(componentName, LifecycleStage.STARTING);
    try {
      await componentEntry.component.startup();
      this.setComponentStage(componentName, LifecycleStage.STARTED);
      this.log(LogLevel.INFO, `Component "${componentName}" started successfully.`);
    } catch (error: any) {
      this.setComponentStage(componentName, LifecycleStage.FAILED_STARTUP, error);
      this.log(LogLevel.ERROR, `Failed to start component "${componentName}".`, { error: error.message, stack: error.stack });
      throw error; // Re-throw to signal failure
    }
  }

  public async shutdownComponent(componentName: string): Promise<void> {
    const componentEntry = this.components.get(componentName);
    if (!componentEntry) {
      this.log(LogLevel.WARN, `Component "${componentName}" not registered, cannot shut down.`);
      return; // Or throw error, depending on desired strictness
    }

    if (componentEntry.stage === LifecycleStage.STOPPED || componentEntry.stage === LifecycleStage.PENDING) {
      this.log(LogLevel.DEBUG, `Component "${componentName}" is already stopped or was never started.`);
      return;
    }
     if (componentEntry.stage === LifecycleStage.STOPPING) {
      this.log(LogLevel.WARN, `Component "${componentName}" is already stopping. Concurrent shutdown call ignored.`);
      return;
    }

    // Note: Shutting down a component doesn't automatically shut down components that depend on it.
    // That logic would be complex and application-specific. Here, we just shut down the requested one.

    this.log(LogLevel.INFO, `Stopping component: ${componentName}`);
    this.setComponentStage(componentName, LifecycleStage.STOPPING);
    try {
      await componentEntry.component.shutdown();
      this.setComponentStage(componentName, LifecycleStage.STOPPED);
      this.log(LogLevel.INFO, `Component "${componentName}" stopped successfully.`);
    } catch (error: any) {
      this.setComponentStage(componentName, LifecycleStage.FAILED_SHUTDOWN, error);
      this.log(LogLevel.ERROR, `Failed to stop component "${componentName}".`, { error: error.message, stack: error.stack });
      throw error; // Re-throw to signal failure
    }
  }

  public onEvent(listener: LifecycleEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }
}

// Example Usage:
async function exampleLifecycleManager() {
  // const logger = new LoggingService();
  // await logger.addTransport(new ConsoleTransport());
  // logger.setLogLevel(LogLevel.DEBUG);

  class MockService implements LifecycleAware {
    private stage: LifecycleStage = LifecycleStage.PENDING;
    constructor(public name: string, private startupDelay: number, private shutdownDelay: number, private dependencies: string[] = [], private failStartup: boolean = false, private failShutdown: boolean = false) {}
    getLifecycleName = () => this.name;
    getDependencies = () => this.dependencies;
    getStage = () => this.stage;

    async startup() {
      this.stage = LifecycleStage.STARTING;
      console.log(`[${this.name}] Starting... (will take ${this.startupDelay}ms)`);
      await new Promise(r => setTimeout(r, this.startupDelay));
      if (this.failStartup) {
        this.stage = LifecycleStage.FAILED_STARTUP;
        throw new Error(`${this.name} deliberately failed to start.`);
      }
      this.stage = LifecycleStage.STARTED;
      console.log(`[${this.name}] Started.`);
    }
    async shutdown() {
      this.stage = LifecycleStage.STOPPING;
      console.log(`[${this.name}] Stopping... (will take ${this.shutdownDelay}ms)`);
      await new Promise(r => setTimeout(r, this.shutdownDelay));
       if (this.failShutdown) {
        this.stage = LifecycleStage.FAILED_SHUTDOWN;
        throw new Error(`${this.name} deliberately failed to stop.`);
      }
      this.stage = LifecycleStage.STOPPED;
      console.log(`[${this.name}] Stopped.`);
    }
  }

  const lifecycleManager = new LifecycleManager(/* logger */);
  lifecycleManager.onEvent(event => {
    console.log(`LIFECYCLE EVENT: ${event.componentName} -> ${event.stage}${event.error ? ` (Error: ${event.error.message})` : ''}`);
  });

  const serviceA = new MockService('ServiceA', 500, 200);
  const serviceB = new MockService('ServiceB', 300, 100, ['ServiceA']); // B depends on A
  const serviceC = new MockService('ServiceC', 400, 150, ['ServiceB']); // C depends on B
  const serviceD = new MockService('ServiceD', 200, 50, [], true); // D will fail startup
  const serviceE = new MockService('ServiceE', 100, 300, ['ServiceD']); // E depends on D (which fails)

  lifecycleManager.register(serviceC); // Register in non-dependency order
  lifecycleManager.register(serviceA);
  lifecycleManager.register(serviceB);
  lifecycleManager.register(serviceD);
  lifecycleManager.register(serviceE);


  console.log('\n--- Attempting to startup all ---');
  try {
    await lifecycleManager.startupAll();
    console.log('StartupAll completed (or reached point of failure).');
  } catch (error: any) {
    console.error('Error during startupAll:', error.message);
  }

  console.log('\n--- Current Stages ---');
  for (const name of ['ServiceA', 'ServiceB', 'ServiceC', 'ServiceD', 'ServiceE']) {
      console.log(`${name}: ${lifecycleManager.getComponentStage(name)}`);
  }


  console.log('\n--- Attempting to shutdown all ---');
  try {
    await lifecycleManager.shutdownAll();
    console.log('ShutdownAll completed.');
  } catch (error: any) {
    console.error('Error during shutdownAll:', error.message);
  }

   console.log('\n--- Final Stages ---');
  for (const name of ['ServiceA', 'ServiceB', 'ServiceC', 'ServiceD', 'ServiceE']) {
      console.log(`${name}: ${lifecycleManager.getComponentStage(name)}`);
  }
}

// To run the example:
// exampleLifecycleManager().catch(e => console.error("Example usage main error:", e));