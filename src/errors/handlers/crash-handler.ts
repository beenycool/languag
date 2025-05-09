// Handles catastrophic crashes, attempting to report them before the process exits.
// This is particularly important for unhandled exceptions and rejections.

import { ErrorReporter } from '../reporting/error-reporter';
// import { LogManager, LogLevel } from '../../logging/core/log-manager'; // For last-gasp logging

export class CrashHandler {
  private static instance: CrashHandler;
  private errorReporter: ErrorReporter;
  private isHandlingCrash: boolean = false;
  // private logger: LogManager;

  private constructor(errorReporter: ErrorReporter) {
    this.errorReporter = errorReporter;
    // this.logger = LogManager.getInstance();
  }

  public static getInstance(errorReporter: ErrorReporter): CrashHandler {
    if (!CrashHandler.instance) {
      CrashHandler.instance = new CrashHandler(errorReporter);
    }
    return CrashHandler.instance;
  }

  public setupGlobalHandlers(): void {
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
    // Optional: Listen for SIGTERM/SIGINT for graceful shutdown attempts
    // process.on('SIGTERM', () => this.handleSignal('SIGTERM'));
    // process.on('SIGINT', () => this.handleSignal('SIGINT'));
  }

  private async handleUncaughtException(error: Error, origin: NodeJS.UncaughtExceptionOrigin): Promise<void> {
    // this.logger.fatal('UNCAUGHT EXCEPTION', error, { origin });
    console.error('--- UNCAUGHT EXCEPTION ---');
    console.error(error);
    console.error(`Origin: ${origin}`);
    console.error('--------------------------');


    if (this.isHandlingCrash) {
      console.error('Recursive crash detected. Forcing exit.');
      process.exit(1); // Avoid infinite loops
    }
    this.isHandlingCrash = true;

    try {
      this.errorReporter.reportError(
        error,
        { unhandled: true, type: 'uncaughtException', origin },
        { severity: 'critical', crash: true }
      );
      // Attempt to give a very short time for the report to be sent.
      // This is best-effort as the process is unstable.
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (reportError) {
      console.error('Failed to report uncaught exception:', reportError);
    } finally {
      // Ensure the process exits after attempting to report.
      // Some recommend not resuming from uncaught exceptions.
      console.error('Exiting due to uncaught exception.');
      process.exit(1);
    }
  }

  private async handleUnhandledRejection(reason: any, promise: Promise<any>): Promise<void> {
    // this.logger.fatal('UNHANDLED REJECTION', reason instanceof Error ? reason : new Error(String(reason)), { promiseDetails: String(promise) });
    console.error('--- UNHANDLED REJECTION ---');
    if (reason instanceof Error) {
        console.error(reason);
    } else {
        console.error('Reason:', reason);
    }
    console.error('Promise:', promise);
    console.error('---------------------------');

    if (this.isHandlingCrash) {
      console.error('Recursive crash (unhandledRejection) detected. Forcing exit.');
      process.exit(1);
    }
    this.isHandlingCrash = true; // Set flag early

    const errorToReport = reason instanceof Error ? reason : new Error(String(reason || 'Unknown unhandled rejection'));

    try {
      this.errorReporter.reportError(
        errorToReport,
        { unhandled: true, type: 'unhandledRejection', promiseDetails: String(promise) },
        { severity: 'critical', crash: true }
      );
      await new Promise(resolve => setTimeout(resolve, 500)); // Best effort
    } catch (reportError) {
      console.error('Failed to report unhandled rejection:', reportError);
    } finally {
      // Node.js behavior for unhandled rejections is changing.
      // In future versions, they might terminate the process by default.
      // For now, explicitly exit if it's considered a crash scenario.
      console.error('Exiting due to unhandled rejection (simulating crash behavior).');
      process.exit(1); // Or decide based on policy if to exit or just log heavily.
    }
  }

  // private async handleSignal(signal: string) {
  //   this.logger.info(`Received signal: ${signal}. Attempting graceful shutdown.`);
  //   // Perform cleanup, flush logs/reports
  //   await this.errorReporter.flushPendingReports(); // Assuming reporter has such a method
  //   await this.logger.destroyAllHandlers(); // Assuming logger has such a method
  //   process.exit(0);
  // }

  // Call this method if you want to manually trigger a crash report and exit
  public async triggerHardCrash(error: Error, message: string = "Manual hard crash triggered"): Promise<void> {
    console.error(`--- MANUAL HARD CRASH: ${message} ---`);
    console.error(error);
    console.error('------------------------------------');

    if (this.isHandlingCrash) {
      console.error('Recursive crash (manual) detected. Forcing exit.');
      process.exit(1);
    }
    this.isHandlingCrash = true;

    try {
      this.errorReporter.reportError(
        error,
        { manualCrash: true, triggerMessage: message },
        { severity: 'critical', crash: true }
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (reportError) {
      console.error('Failed to report manual hard crash:', reportError);
    } finally {
      console.error('Exiting due to manual hard crash.');
      process.exit(1);
    }
  }
}

// Usage (typically in your main application file):
// import { ErrorReporter, ConsoleErrorReporterAdapter } from '../reporting/error-reporter';
// const errorReporter = new ErrorReporter();
// errorReporter.addAdapter(new ConsoleErrorReporterAdapter()); // Add Sentry, etc.
// const crashHandler = CrashHandler.getInstance(errorReporter);
// crashHandler.setupGlobalHandlers();

// To test:
// setTimeout(() => { throw new Error("Test Uncaught Exception!"); }, 2000);
// setTimeout(() => { Promise.reject("Test Unhandled Rejection!"); }, 4000);
// setTimeout(() => { crashHandler.triggerHardCrash(new Error("Simulated critical failure"), "Testing hard crash"); }, 6000);