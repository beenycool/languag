import { CircuitBreaker, CircuitBreakerState } from '../../../microservices/resilience/circuit/circuit-breaker';

export class SidecarProxy {
  public circuitBreaker: CircuitBreaker;

  constructor(public serviceName: string) {
    // It's good practice to give the circuit breaker a name for logging/identification
    this.circuitBreaker = new CircuitBreaker({ name: `SidecarProxy-${serviceName}` });
  }

  async forwardRequest(destination: string, request: any): Promise<{ data: string; status: number }> {
    if (this.circuitBreaker.getState() === CircuitBreakerState.OPEN) {
      // Log or handle the circuit open state more gracefully if needed
      throw new Error(`Service ${this.serviceName} to ${destination} circuit is OPEN. Request rejected.`);
    }

    try {
      // The operation passed to execute must return a Promise.
      // Simulate a network call that returns a promise.
      const operation = async () => {
        // Placeholder for actual network communication logic
        // For example, using fetch or an HTTP client library
        // await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
        return {
          data: `Response from ${destination} for service ${this.serviceName}`,
          status: 200,
        };
      };

      return await this.circuitBreaker.execute(operation);
    } catch (error: any) {
      // Log the error with more context if possible
      // The circuit breaker itself will throw an error if the operation fails
      // and it trips the circuit, or if the circuit was already open.
      // We might want to distinguish between these cases or add more specific error handling.
      throw new Error(`Request from ${this.serviceName} to ${destination} failed: ${error.message}`);
    }
  }

  // It's good practice to provide a way to dispose of resources like timers in the circuit breaker
  dispose() {
    this.circuitBreaker.dispose();
  }
}