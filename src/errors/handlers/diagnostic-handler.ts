// Provides tools for diagnosing errors, such as collecting detailed system state
// or running specific diagnostic routines when an error occurs.

import { ErrorReporter, ReportedError } from '../reporting/error-reporter';
import { ContextCollector, ErrorContext } from '../reporting/context-collector';
// import { SystemMetrics } from '../../monitoring/production/metrics/system-metrics'; // If detailed system metrics are needed
// import { AppMetrics } from '../../monitoring/production/metrics/app-metrics'; // If app-specific metrics are needed

export interface DiagnosticReport extends ReportedError {
  diagnosticInfo?: Record<string, any>; // Additional diagnostic data
}

export interface DiagnosticRoutine {
  name: string;
  description?: string;
  canRun(error: Error | any, context: ErrorContext): boolean;
  run(error: Error | any, context: ErrorContext): Promise<Record<string, any>>; // Returns diagnostic data
}

export class DiagnosticHandler {
  private errorReporter: ErrorReporter;
  private contextCollector: ContextCollector;
  // private systemMetrics?: SystemMetrics;
  // private appMetrics?: AppMetrics;
  private routines: DiagnosticRoutine[] = [];

  constructor(
    errorReporter: ErrorReporter,
    contextCollector: ContextCollector
    // systemMetrics?: SystemMetrics,
    // appMetrics?: AppMetrics
  ) {
    this.errorReporter = errorReporter;
    this.contextCollector = contextCollector;
    // this.systemMetrics = systemMetrics;
    // this.appMetrics = appMetrics;
  }

  public addRoutine(routine: DiagnosticRoutine): void {
    this.routines.push(routine);
  }

  /**
   * Collects diagnostic information for a given error and reports it.
   * This might be called after an error has occurred and basic reporting is done,
   * or as part of a more detailed error investigation flow.
   */
  public async diagnoseAndReport(
    error: Error | any,
    baseContext?: Partial<ErrorContext>,
    tags?: Record<string, string | number | boolean>,
    userContext?: { id?: string; username?: string; email?: string }
  ): Promise<string> {
    const collectedContext = this.contextCollector.collectContext(error, baseContext);
    let diagnosticInfo: Record<string, any> = {};

    // Collect general diagnostics
    // if (this.systemMetrics) {
    //   try {
    //     diagnosticInfo.systemMetricsSnapshot = this.systemMetrics.getMetrics();
    //   } catch (smErr) {
    //     diagnosticInfo.systemMetricsError = smErr instanceof Error ? smErr.message : String(smErr);
    //   }
    // }
    // if (this.appMetrics) {
    //   try {
    //     diagnosticInfo.appMetricsSnapshot = this.appMetrics.getAllMetrics();
    //   } catch (amErr) {
    //     diagnosticInfo.appMetricsError = amErr instanceof Error ? amErr.message : String(amErr);
    //   }
    // }

    // Run applicable diagnostic routines
    for (const routine of this.routines) {
      if (routine.canRun(error, collectedContext)) {
        try {
          // console.log(`Running diagnostic routine: ${routine.name}`);
          const routineData = await routine.run(error, collectedContext);
          diagnosticInfo[routine.name || `routine_${Date.now()}`] = routineData;
        } catch (routineError: any) {
          // console.error(`Error in diagnostic routine ${routine.name}:`, routineError);
          diagnosticInfo[`${routine.name}_error`] = routineError instanceof Error ? routineError.message : String(routineError);
        }
      }
    }

    // Report the error with the additional diagnostic information
    // The ErrorReporter's reportError method will create the base ReportedError structure.
    // We are essentially augmenting the context here.
    const augmentedContext: Partial<ErrorContext> = {
      ...collectedContext,
      diagnostics: diagnosticInfo, // Nest diagnostic info under a 'diagnostics' key
    };

    // console.log(`Reporting error with diagnostics: ${error.message || String(error)}`);
    return this.errorReporter.reportError(error, augmentedContext, tags, userContext);
  }
}

// --- Example Diagnostic Routine (could be in a separate file) ---

export class NetworkConnectivityTest implements DiagnosticRoutine {
  name = 'networkConnectivityTest';
  description = 'Tests basic network connectivity to essential services.';

  canRun(error: any, context: ErrorContext): boolean {
    // Run if error seems network-related or if explicitly requested
    return (error instanceof Error && error.message.toLowerCase().includes('network')) ||
           context.runNetworkTest === true;
  }

  async run(error: any, context: ErrorContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const testEndpoints = [
      { name: 'googleDns', url: '8.8.8.8', type: 'ping' }, // Placeholder for ping
      { name: 'apiService', url: process.env.API_ENDPOINT || 'https://api.example.com/health', type: 'fetch' },
    ];

    for (const endpoint of testEndpoints) {
      try {
        if (endpoint.type === 'ping') {
          // Ping requires native capabilities, placeholder for now
          // For Node.js, could use a library like 'ping'
          results[endpoint.name] = { status: 'pending_ping_not_implemented', details: 'Ping test needs native implementation.' };
          // Simulate a ping
          await new Promise(resolve => setTimeout(resolve, 100));
          results[endpoint.name] = Math.random() > 0.3 ? { status: 'success', rtt_ms: 50 + Math.random() * 50 } : { status: 'failed', reason: 'timeout' };

        } else if (endpoint.type === 'fetch') {
          // const response = await fetch(endpoint.url, { method: 'HEAD', timeout: 3000 }); // HEAD to be lightweight
          // results[endpoint.name] = { status: response.ok ? 'success' : 'failed', statusCode: response.status };
          await new Promise(resolve => setTimeout(resolve, 200)); // Simulate fetch
          results[endpoint.name] = Math.random() > 0.2 ? { status: 'success', statusCode: 200 } : { status: 'failed', statusCode: 503 };
        }
      } catch (e: any) {
        results[endpoint.name] = { status: 'error', message: e.message };
      }
    }
    return results;
  }
}

// Usage Example:
// const reporter = new ErrorReporter(); // ... setup
// const contextCollector = new ContextCollector();
// const diagnosticHandler = new DiagnosticHandler(reporter, contextCollector);
// diagnosticHandler.addRoutine(new NetworkConnectivityTest());

// async function someOperationThatMightFail() {
//   try {
//     // ... operation ...
//     throw new Error("Network connection failed during operation X.");
//   } catch (e) {
//     console.error("Operation failed, running diagnostics...");
//     await diagnosticHandler.diagnoseAndReport(e, { operation: "X" });
//   }
// }