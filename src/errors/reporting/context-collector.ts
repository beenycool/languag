// Collects contextual information at the time of an error.
// TODO: Add more context sources like breadcrumbs, feature flags, network status, etc.
// TODO: Implement sanitization for sensitive data within the context.

// import * as os from 'os'; // If system context is needed directly here

export interface ErrorContext {
  // Application state
  appName?: string;
  appVersion?: string;
  appState?: Record<string, any>; // e.g., current route, active component, Redux state snapshot

  // Device & OS
  osType?: string; // e.g., 'Windows_NT', 'Linux', 'Darwin'
  osRelease?: string;
  arch?: string; // e.g., 'x64'
  platform?: string; // e.g., 'browser', 'node'
  userAgent?: string; // For browser environments
  locale?: string;

  // Runtime
  runtimeName?: string; // e.g., 'Node.js', 'Chrome', 'Firefox'
  runtimeVersion?: string;

  // Request context (for server-side errors)
  url?: string;
  method?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: any; // Be careful with PII

  // Custom context
  [key: string]: any; // Allow arbitrary additional context
}

export class ContextCollector {
  private globalContext: Partial<ErrorContext> = {};

  constructor() {
    this.initializeGlobalContext();
  }

  private initializeGlobalContext(): void {
    // This context is collected once and can be merged with error-specific context.
    this.globalContext.appName = process.env.APP_NAME || 'UnknownApp';
    this.globalContext.appVersion = process.env.APP_VERSION || '0.0.0';

    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      this.globalContext.platform = 'node';
      this.globalContext.runtimeName = 'Node.js';
      this.globalContext.runtimeVersion = process.versions.node;
      this.globalContext.osType = process.platform; // e.g., 'win32', 'linux', 'darwin'
      this.globalContext.arch = process.arch;
      // this.globalContext.osRelease = os.release(); // Requires 'os' module
    } else if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.globalContext.platform = 'browser';
      this.globalContext.userAgent = navigator.userAgent;
      this.globalContext.locale = navigator.language;
      // Try to infer runtime name/version from userAgent or other browser APIs
      // This is a simplification.
      if (navigator.userAgent.includes('Firefox/')) this.globalContext.runtimeName = 'Firefox';
      else if (navigator.userAgent.includes('Chrome/')) this.globalContext.runtimeName = 'Chrome';
      else if (navigator.userAgent.includes('Safari/') && !navigator.userAgent.includes('Chrome/')) this.globalContext.runtimeName = 'Safari';
      // Version extraction would be more complex.
    }
  }

  public setGlobalContext(key: string, value: any): void {
    this.globalContext[key] = value;
  }

  public getGlobalContext(): Partial<ErrorContext> {
    return { ...this.globalContext };
  }

  public collectContext(error?: Error | any, customContext?: Record<string, any>): ErrorContext {
    const dynamicContext: Partial<ErrorContext> = {};

    // Add any error-specific properties if they exist and are not standard Error props
    if (error && typeof error === 'object' && !(error instanceof Error)) {
        for (const key in error) {
            if (Object.prototype.hasOwnProperty.call(error, key) && !['message', 'name', 'stack'].includes(key)) {
                dynamicContext[key] = error[key];
            }
        }
    }


    // TODO: Collect more dynamic context here, e.g.:
    // - Current URL (if in browser)
    // - Network status
    // - Recent user actions (breadcrumbs)
    // - Feature flag states

    if (typeof window !== 'undefined') {
        dynamicContext.url = window.location.href;
    }


    return {
      ...this.globalContext, // Start with globally available context
      ...dynamicContext,    // Add dynamically collected context
      ...customContext,     // Override with any explicitly provided custom context
    };
  }

  // Example: Add breadcrumb (user action)
  // This would typically be managed by a separate BreadcrumbManager and integrated here.
  public addBreadcrumb(message: string, category: string = 'action', data?: Record<string, any>): void {
    // For simplicity, just log it. In a real system, store in a capped array.
    console.log(`BREADCRUMB [${category}]: ${message}`, data || '');
    // this.breadcrumbs.push({ timestamp: new Date(), category, message, data });
    // if (this.breadcrumbs.length > MAX_BREADCRUMBS) this.breadcrumbs.shift();
  }
}