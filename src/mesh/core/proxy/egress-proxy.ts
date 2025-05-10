// src/mesh/core/proxy/egress-proxy.ts
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerOptions } from '../../../microservices/resilience/circuit/circuit-breaker';
import { ConfigurationManager, MeshGlobalConfig, MeshServiceConfig } from '../control/configuration-manager';
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';

export interface EgressRequest {
  targetHost: string;
  targetPort: number;
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  policyName?: string; // Optional: to apply specific egress policies
  timeoutMs?: number; // Optional: per-request timeout override
}

export interface EgressResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  durationMs?: number;
}

export interface EgressProxyOptions {
  logger?: ILoggingService;
  configManager: ConfigurationManager;
}

export class EgressProxy {
  private logger?: ILoggingService;
  private configManager: ConfigurationManager;
  private circuitBreakers: Map<string, CircuitBreaker>; // Key: targetHost:port or policyName

  constructor(options: EgressProxyOptions) {
    this.logger = options.logger;
    this.configManager = options.configManager;
    this.circuitBreakers = new Map();
    this.log(LogLevel.INFO, 'EgressProxy initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[EgressProxy] ${message}`, context);
  }

  private async getCircuitBreaker(identifier: string, request: EgressRequest): Promise<CircuitBreaker> {
    if (!this.circuitBreakers.has(identifier)) {
      let cbOptions: Partial<CircuitBreakerOptions> = { name: `Egress-${identifier}`, logger: this.logger };
      
      // Try to get config from a named policy if provided
      if (request.policyName) {
        const policyConfig = await this.configManager.getServiceConfig(request.policyName); // Using serviceConfig for named policies
        if (policyConfig) {
          cbOptions.failureThreshold = policyConfig.retries !== undefined ? policyConfig.retries + 1 : cbOptions.failureThreshold; // Example mapping
          cbOptions.timeout = policyConfig.timeoutMs !== undefined ? policyConfig.timeoutMs * 2 : cbOptions.timeout; // CB timeout usually longer than request timeout
          // Add other relevant CB options from policyConfig
        }
      }
      // Override with request-specific timeout for the CB's operation, not the CB's own open-state timeout
      // The CB's own timeout (time it stays open) should be configured separately or use default.
      // The `request.timeoutMs` is for the individual operation attempt.

      const cb = new CircuitBreaker(cbOptions);
      this.circuitBreakers.set(identifier, cb);
      this.log(LogLevel.DEBUG, `Created new CircuitBreaker for identifier: ${identifier}`, cbOptions);
    }
    return this.circuitBreakers.get(identifier)!;
  }

  public async handleRequest(request: EgressRequest): Promise<EgressResponse> {
    const startTime = Date.now();
    const cbIdentifier = request.policyName || `${request.targetHost}:${request.targetPort}`;
    this.log(LogLevel.DEBUG, `Handling egress request to ${request.targetHost}:${request.targetPort}${request.path}`, { policy: request.policyName });

    const circuitBreaker = await this.getCircuitBreaker(cbIdentifier, request);

    if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
      this.log(LogLevel.WARN, `Circuit open for ${cbIdentifier}, rejecting request.`);
      return {
        statusCode: 503, headers: {},
        body: { error: `Service Temporarily Unavailable (Circuit Open for ${cbIdentifier})` },
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // The operation to be wrapped by the circuit breaker
      const operation = async (): Promise<EgressResponse> => {
        const operationStartTime = Date.now();
        this.log(LogLevel.INFO, `Attempting egress call to ${request.targetHost}:${request.targetPort}${request.path}`);
        
        // Simulate actual HTTP/network call here
        // For example, using node-fetch or axios
        // const actualTimeout = request.timeoutMs || (await this.configManager.getGlobalConfig()).defaultTimeoutMs || 2000;
        // This is where you'd use `request.timeoutMs` for the actual call.

        // Mocked response for now:
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // Simulate latency
        
        // Simulate failure for testing CB
        if (request.targetHost === "fail.example.com") {
            throw new Error("Simulated external service failure");
        }

        return {
          statusCode: 200,
          headers: { 'X-Egress-Proxy': 'active' },
          body: { message: `Success response from ${request.targetHost}` },
          durationMs: Date.now() - operationStartTime,
        };
      };

      // Execute the operation through the circuit breaker
      const response = await circuitBreaker.execute(operation);
      return { ...response, durationMs: Date.now() - startTime };

    } catch (error: any) {
      this.log(LogLevel.ERROR, `Error during egress request to ${cbIdentifier}`, { error: error.message, stack: error.stack });
      return {
        statusCode: 502, // Bad Gateway
        headers: {},
        body: { error: 'Bad Gateway to external service', details: error.message },
        durationMs: Date.now() - startTime,
      };
    }
  }

  public dispose(): void {
    this.log(LogLevel.INFO, 'Disposing EgressProxy resources.');
    this.circuitBreakers.forEach(cb => cb.dispose());
    this.circuitBreakers.clear();
  }
}