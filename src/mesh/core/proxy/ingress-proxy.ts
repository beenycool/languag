// src/mesh/core/proxy/ingress-proxy.ts
import { CircuitBreaker, CircuitBreakerState } from '../../../microservices/resilience/circuit/circuit-breaker';
import { ServiceRegistry } from '../control/service-registry';
import { ConfigurationManager, MeshServiceConfig } from '../control/configuration-manager';
import { ILoggingService, LogLevel } from '../../../microservices/services/management/logging-service';

export interface IngressRequest {
  host: string;
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface IngressResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
}

export interface IngressProxyOptions {
  logger?: ILoggingService;
  serviceRegistry: ServiceRegistry;
  configManager: ConfigurationManager;
}

export class IngressProxy {
  private logger?: ILoggingService;
  private serviceRegistry: ServiceRegistry;
  private configManager: ConfigurationManager;
  private circuitBreakers: Map<string, CircuitBreaker>; // Keyed by serviceId

  constructor(options: IngressProxyOptions) {
    this.logger = options.logger;
    this.serviceRegistry = options.serviceRegistry;
    this.configManager = options.configManager;
    this.circuitBreakers = new Map();
    this.log(LogLevel.INFO, 'IngressProxy initialized.');
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[IngressProxy] ${message}`, context);
  }

  private getCircuitBreaker(serviceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceId)) {
      const cb = new CircuitBreaker({
        name: `IngressProxy-${serviceId}`,
        logger: this.logger,
        // Potentially configure CB from serviceConfig
      });
      this.circuitBreakers.set(serviceId, cb);
    }
    return this.circuitBreakers.get(serviceId)!;
  }

  public async handleRequest(request: IngressRequest): Promise<IngressResponse> {
    this.log(LogLevel.DEBUG, 'Handling incoming request', { host: request.host, path: request.path });

    // 1. Determine target service (basic example: based on path prefix or host)
    // This logic would be more sophisticated, using routing rules from ConfigurationManager
    let targetServiceId: string | null = null;
    if (request.path.startsWith('/service-a')) {
      targetServiceId = 'service-a';
    } else if (request.path.startsWith('/service-b')) {
      targetServiceId = 'service-b';
    } else {
      this.log(LogLevel.WARN, 'No route matched for request', { path: request.path });
      return { statusCode: 404, headers: {}, body: { error: 'Not Found' } };
    }
    
    // 2. Get service configuration (e.g., for timeouts, retries specific to this service)
    const serviceConfig = await this.configManager.getServiceConfig(targetServiceId);

    // 3. Discover service instances
    const instances = await this.serviceRegistry.getServiceEndpoints(targetServiceId);
    if (!instances || instances.length === 0) {
      this.log(LogLevel.ERROR, `No healthy instances found for service: ${targetServiceId}`);
      return { statusCode: 503, headers: {}, body: { error: 'Service Unavailable' } };
    }

    // 4. Select an instance (basic load balancing: random or first)
    const targetInstance = instances[Math.floor(Math.random() * instances.length)];
    this.log(LogLevel.DEBUG, `Routing to instance ${targetInstance.id} of ${targetServiceId}`, targetInstance);

    // 5. Use Circuit Breaker for the call
    const circuitBreaker = this.getCircuitBreaker(targetServiceId);
    if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
      this.log(LogLevel.WARN, `Circuit open for ${targetServiceId}, rejecting request.`);
      return { statusCode: 503, headers: {}, body: { error: 'Service Temporarily Unavailable (Circuit Open)' } };
    }

    try {
      // Simulate forwarding the request to the target instance
      // In a real scenario, this would be an HTTP/gRPC call
      const operation = async (): Promise<IngressResponse> => {
        // Mock network call
        this.log(LogLevel.INFO, `Forwarding request to ${targetServiceId}/${targetInstance.id} (${targetInstance.host}:${targetInstance.port}${request.path})`);
        // Simulate response from backend service
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // Simulate latency
        
        // Simulate potential failure for testing CB
        if (targetInstance.port === 9999) { // Arbitrary condition for failure
            throw new Error("Simulated backend failure");
        }

        return {
          statusCode: 200,
          headers: { 'X-Forwarded-By': 'IngressProxy', 'X-Target-Service': targetServiceId },
          body: { message: `Response from ${targetServiceId}/${targetInstance.id}`, originalPath: request.path },
        };
      };

      return await circuitBreaker.execute(operation);
    } catch (error: any) {
      this.log(LogLevel.ERROR, `Error forwarding request to ${targetServiceId}/${targetInstance.id}`, { error: error.message });
      // The circuit breaker might have already recorded the failure.
      // If the error is from the CB itself (e.g., it's open), this catch might not be strictly necessary
      // if the CB re-throws, but good for logging.
      return { statusCode: 502, headers: {}, body: { error: 'Bad Gateway', details: error.message } };
    }
  }

  public dispose(): void {
    this.log(LogLevel.INFO, 'Disposing IngressProxy resources.');
    this.circuitBreakers.forEach(cb => cb.dispose());
    this.circuitBreakers.clear();
  }
}