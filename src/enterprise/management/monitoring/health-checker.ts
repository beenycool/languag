/**
 * @file Health Checker
 *
 * This file defines the health checker component responsible for performing
 * health checks on various services and endpoints (e.g., HTTP, TCP, database).
 *
 * Focus areas:
 * - Reliability: Provides accurate health status.
 * - Performance monitoring: Can measure response times of health checks.
 * - Error handling: Clearly indicates reasons for health check failures.
 */

interface IHealthCheckConfig {
  type: 'http' | 'tcp' | 'database' | 'custom'; // Type of health check
  target: string; // e.g., URL for HTTP, host:port for TCP, connection string for DB
  timeoutMs?: number; // Timeout for the health check
  expectedHttpStatus?: number; // For HTTP checks
  expectedResponseContains?: string; // For HTTP checks, verify body content
  query?: string; // For database checks (e.g., 'SELECT 1')
  customCheck?: (config: IHealthCheckConfig) => Promise<IHealthCheckResult>; // For custom checks
  // Other type-specific options
  method?: 'GET' | 'POST'; // for HTTP
  headers?: Record<string, string>; // for HTTP
  body?: any; // for HTTP POST
}

export interface IHealthCheckResult {
  isHealthy: boolean;
  responseTimeMs?: number;
  details?: any; // Additional details (e.g., status code, error message, custom output)
  checkedAt: Date;
  configUsed: IHealthCheckConfig;
}

interface IHealthChecker {
  /**
   * Performs a health check based on the provided configuration.
   * @param config The configuration for the health check.
   * @returns A promise that resolves with the health check result.
   */
  check(config: IHealthCheckConfig): Promise<IHealthCheckResult>;
}

export class HealthChecker implements IHealthChecker {
  constructor() {
    console.log('Health Checker initialized.');
  }

  public async check(config: IHealthCheckConfig): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    let result: Partial<IHealthCheckResult> = { isHealthy: false };

    try {
      switch (config.type) {
        case 'http':
          result = await this.checkHttp(config);
          break;
        case 'tcp':
          result = await this.checkTcp(config);
          break;
        case 'database':
          result = await this.checkDatabase(config);
          break;
        case 'custom':
          if (config.customCheck) {
            result = await config.customCheck(config);
          } else {
            throw new Error('Custom check function not provided for type "custom".');
          }
          break;
        default:
          throw new Error(`Unsupported health check type: ${(config as any).type}`);
      }
    } catch (error: any) {
      result.isHealthy = false;
      result.details = { error: `Health check failed: ${error.message}`, stack: error.stack };
      console.warn(`Health check for ${config.target} (${config.type}) failed: ${error.message}`);
    }

    const endTime = Date.now();
    result.responseTimeMs = endTime - startTime;
    result.checkedAt = new Date();
    result.configUsed = config;

    return result as IHealthCheckResult;
  }

  private async checkHttp(config: IHealthCheckConfig): Promise<Partial<IHealthCheckResult>> {
    const timeout = config.timeoutMs || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    console.log(`Performing HTTP check for ${config.target}, method: ${config.method || 'GET'}`);
    try {
      const response = await fetch(config.target, {
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const details: Record<string, any> = { statusCode: response.status, statusText: response.statusText };
      let isHealthy = response.ok; // Default check for 2xx status codes

      if (config.expectedHttpStatus && response.status !== config.expectedHttpStatus) {
        isHealthy = false;
        details.error = `Expected status ${config.expectedHttpStatus}, got ${response.status}`;
      }

      if (isHealthy && config.expectedResponseContains) {
        const text = await response.text();
        if (!text.includes(config.expectedResponseContains)) {
          isHealthy = false;
          details.error = `Response did not contain expected text: "${config.expectedResponseContains}"`;
        }
        // details.responseText = text.substring(0, 200); // Include a snippet for debugging
      }
      return { isHealthy, details };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return { isHealthy: false, details: { error: `HTTP check timed out after ${timeout}ms` } };
      }
      return { isHealthy: false, details: { error: `HTTP check failed: ${error.message}` } };
    }
  }

  private async checkTcp(config: IHealthCheckConfig): Promise<Partial<IHealthCheckResult>> {
    // Node.js 'net' module would be used here. This is a conceptual placeholder.
    // import * as net from 'net';
    const [host, portStr] = config.target.split(':');
    const port = parseInt(portStr, 10);
    if (!host || isNaN(port)) {
      return { isHealthy: false, details: { error: 'Invalid TCP target format. Expected host:port.' } };
    }
    const timeout = config.timeoutMs || 3000;
    console.log(`Performing TCP check for ${host}:${port}`);

    return new Promise((resolve) => {
      // const socket = net.createConnection({ host, port, timeout }, () => {
      //   socket.end();
      //   resolve({ isHealthy: true, details: { message: 'TCP connection successful' } });
      // });
      // socket.on('timeout', () => {
      //   socket.destroy();
      //   resolve({ isHealthy: false, details: { error: `TCP connection timed out after ${timeout}ms` } });
      // });
      // socket.on('error', (err) => {
      //   resolve({ isHealthy: false, details: { error: `TCP connection failed: ${err.message}` } });
      // });

      // Simulated TCP check
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate for simulation
          resolve({ isHealthy: true, details: { message: 'TCP connection successful (simulated)' } });
        } else {
          resolve({ isHealthy: false, details: { error: 'TCP connection failed (simulated)' } });
        }
      }, Math.random() * 500 + 50); // Simulate network latency
    });
  }

  private async checkDatabase(config: IHealthCheckConfig): Promise<Partial<IHealthCheckResult>> {
    // This would involve using a specific database client (e.g., pg, mysql2, oracledb).
    // The 'config.target' would be a connection string or object.
    // The 'config.query' would be a simple query like 'SELECT 1'.
    console.log(`Performing Database check for ${config.target} with query "${config.query || 'default ping'}" (simulated).`);
    // Placeholder simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        if (Math.random() > 0.03) { // 97% success rate
          resolve({ isHealthy: true, details: { message: 'Database query successful (simulated)' } });
        } else {
          resolve({ isHealthy: false, details: { error: 'Database query failed (simulated)' } });
        }
      }, Math.random() * 800 + 100);
    });
  }
}

// Example Usage (Conceptual)
// async function runHealthCheckExample() {
//   const checker = new HealthChecker();

//   const httpConfig: IHealthCheckConfig = {
//     type: 'http',
//     target: 'https://jsonplaceholder.typicode.com/todos/1',
//     expectedHttpStatus: 200,
//     expectedResponseContains: 'userId'
//   };
//   const httpResult = await checker.check(httpConfig);
//   console.log('HTTP Health Check Result:', httpResult);

//   const tcpConfig: IHealthCheckConfig = {
//     type: 'tcp',
//     target: 'google.com:80', // A known open port
//     timeoutMs: 1000
//   };
//   // const tcpResult = await checker.check(tcpConfig); // Needs net module
//   // console.log('TCP Health Check Result:', tcpResult);
//   console.log('TCP Health Check (simulated for google.com:80):', await checker.check(tcpConfig));


//   const customConfig: IHealthCheckConfig = {
//     type: 'custom',
//     target: 'my-custom-service-logic',
//     customCheck: async (conf) => {
//       // Simulate some custom logic
//       const isOk = Math.random() > 0.2;
//       return { isHealthy: isOk, details: { customMessage: isOk ? 'Custom logic passed' : 'Custom logic failed' } };
//     }
//   };
//   const customResult = await checker.check(customConfig);
//   console.log('Custom Health Check Result:', customResult);
// }

// runHealthCheckExample();