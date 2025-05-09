// Collects and reports errors to various services or logging systems.
// TODO: Implement integrations with actual error reporting services (Sentry, Bugsnag, etc.).
// TODO: Add mechanisms for sampling, rate limiting, and filtering sensitive data.

import { StackAnalyzer, AnalyzedStackFrame } from './stack-analyzer';
import { ContextCollector, ErrorContext } from './context-collector';
// import { LogManager, LogLevel } from '../../logging/core/log-manager'; // Optional: for internal logging

export interface ReportedError {
  id: string; // Unique ID for this error instance
  timestamp: Date;
  message: string;
  name?: string; // e.g., 'TypeError', 'ReferenceError'
  stackTrace?: string; // Raw stack trace string
  analyzedStack?: AnalyzedStackFrame[];
  context?: ErrorContext;
  tags?: Record<string, string | number | boolean>;
  user?: { id?: string; username?: string; email?: string }; // User context
  release?: string; // Application version/release
  environment?: string; // e.g., 'production', 'development'
  // Additional fields specific to the reporting service
}

export interface ErrorReporterAdapter {
  report(errorData: ReportedError): Promise<void>;
  configure?(options: any): void; // For adapter-specific configuration
  isEnabled?(): boolean;
}

export class ErrorReporter {
  private adapters: ErrorReporterAdapter[] = [];
  private stackAnalyzer: StackAnalyzer;
  private contextCollector: ContextCollector;
  // private logger: LogManager; // Optional

  constructor(
    stackAnalyzer?: StackAnalyzer,
    contextCollector?: ContextCollector
  ) {
    this.stackAnalyzer = stackAnalyzer || new StackAnalyzer();
    this.contextCollector = contextCollector || new ContextCollector();
    // this.logger = LogManager.getInstance(); // Optional
    this.loadConfiguration(); // Load environment, release, etc.
  }

  private loadConfiguration() {
    // TODO: Load environment, release version from config or environment variables
    // this.environment = process.env.NODE_ENV || 'unknown';
    // this.release = process.env.APP_VERSION || 'unknown';
  }

  public addAdapter(adapter: ErrorReporterAdapter): void {
    if (adapter.configure) {
      // TODO: Pass relevant global config to adapter
      // adapter.configure({ environment: this.environment, release: this.release });
    }
    this.adapters.push(adapter);
  }

  public reportError(
    error: Error | any,
    contextOverrides?: Partial<ErrorContext>,
    tags?: Record<string, string | number | boolean>,
    userContext?: { id?: string; username?: string; email?: string }
  ): string {
    const id = `err_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date();
    let message: string = 'An unknown error occurred';
    let name: string | undefined;
    let stackTrace: string | undefined;
    let analyzedStack: AnalyzedStackFrame[] | undefined;

    if (error instanceof Error) {
      message = error.message;
      name = error.name;
      stackTrace = error.stack;
      if (stackTrace) {
        analyzedStack = this.stackAnalyzer.parseStack(stackTrace);
      }
    } else if (typeof error === 'string') {
      message = error;
      // Try to generate a synthetic stack
      try {
        throw new Error(message);
      } catch (e: any) {
        stackTrace = e.stack;
        if (stackTrace) analyzedStack = this.stackAnalyzer.parseStack(stackTrace);
      }
    } else {
      // Try to stringify, but be careful with complex objects
      try {
        message = JSON.stringify(error);
      } catch {
        message = 'Could not stringify error object.';
      }
    }

    const collectedContext = this.contextCollector.collectContext(error);
    const finalContext: ErrorContext = { ...collectedContext, ...contextOverrides };

    const reportedError: ReportedError = {
      id,
      timestamp,
      message,
      name,
      stackTrace,
      analyzedStack,
      context: finalContext,
      tags,
      user: userContext,
      // environment: this.environment, // Add from config
      // release: this.release, // Add from config
    };

    // this.logger.log(LogLevel.ERROR, `Reporting error: ${message}`, { errorId: id, rawError: error }); // Optional internal log

    this.adapters.forEach(adapter => {
      if (adapter.isEnabled && !adapter.isEnabled()) {
        return;
      }
      adapter.report(reportedError).catch(adapterError => {
        // this.logger.error('Error reporter adapter failed', adapterError, { adapterName: adapter.constructor.name });
        console.error(`Error reporter adapter ${adapter.constructor.name} failed:`, adapterError);
      });
    });

    return id; // Return the unique ID of the reported error
  }

  // Convenience method for capturing unhandled exceptions/rejections
  public captureUnhandledException(error: Error, type: 'exception' | 'rejection' = 'exception'): void {
    console.error(`Unhandled ${type}:`, error); // Log to console immediately
    this.reportError(error, { unhandled: true, type }, { severity: 'critical' });
  }
}

// Example of a simple console adapter (could be in its own file)
export class ConsoleErrorReporterAdapter implements ErrorReporterAdapter {
  report(errorData: ReportedError): Promise<void> {
    console.error("--- ERROR REPORT ---");
    console.error(`ID: ${errorData.id}`);
    console.error(`Timestamp: ${errorData.timestamp.toISOString()}`);
    console.error(`Name: ${errorData.name || 'N/A'}`);
    console.error(`Message: ${errorData.message}`);
    if (errorData.tags) {
      console.error(`Tags: ${JSON.stringify(errorData.tags)}`);
    }
    if (errorData.user) {
      console.error(`User: ${JSON.stringify(errorData.user)}`);
    }
    if (errorData.context && Object.keys(errorData.context).length > 0) {
      console.error("Context:");
      for (const [key, value] of Object.entries(errorData.context)) {
        console.error(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    }
    if (errorData.analyzedStack && errorData.analyzedStack.length > 0) {
      console.error("Analyzed Stack:");
      errorData.analyzedStack.forEach(frame => {
        console.error(`  at ${frame.functionName || '<anonymous>'} (${frame.fileName || 'unknown'}:${frame.lineNumber || '?'}:${frame.columnNumber || '?'})`);
      });
    } else if (errorData.stackTrace) {
      console.error("Stack Trace:");
      console.error(errorData.stackTrace);
    }
    console.error("--- END ERROR REPORT ---");
    return Promise.resolve();
  }
    isEnabled(): boolean {
        return true; // Always enabled for console
    }
}