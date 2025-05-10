import { SidecarProxy } from '../../../core/proxy/sidecar-proxy';
import { mockNetwork } from '../../__mocks__/network'; // Corrected path
import { CircuitBreakerState } from '../../../../microservices/resilience/circuit/circuit-breaker';

// We want to test the actual SidecarProxy, so we don't mock it.
// jest.mock('../../../core/proxy/sidecar-proxy');

describe('SidecarProxy', () => {
  let proxy: SidecarProxy;

  beforeEach(() => {
    // Reset mocks if they have a reset function
    if (mockNetwork.reset) {
      mockNetwork.reset();
    } else {
      mockNetwork.send.mockClear();
    }
    proxy = new SidecarProxy('service-a');
  });

  afterEach(() => {
    // Clean up resources, e.g., timers in circuit breaker
    proxy.dispose();
  });

  test('initializes with service identity and circuit breaker', () => {
    expect(proxy.serviceName).toBe('service-a');
    expect(proxy.circuitBreaker).toBeDefined();
    expect(proxy.circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  test('forwards requests to upstream services when circuit is closed', async () => {
    // Mocking the network call directly if SidecarProxy uses it internally
    // For this test, we assume SidecarProxy's forwardRequest correctly uses its circuit breaker,
    // and the circuit breaker's `execute` method will run the operation.
    // The actual network call is abstracted within the operation passed to `execute`.
    
    const requestPayload = { path: '/api/data' };
    const expectedResponse = {
      data: `Response from service-b for service service-a`,
      status: 200,
    };

    // Spy on the circuit breaker's execute method to ensure it's called
    const executeSpy = jest.spyOn(proxy.circuitBreaker, 'execute');

    const result = await proxy.forwardRequest('service-b', requestPayload);
    
    expect(result).toEqual(expectedResponse);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    
    // We are not directly testing mockNetwork.send here anymore, as it's an internal detail
    // of the operation passed to circuitBreaker.execute. If we wanted to test that,
    // we'd need to mock the operation itself or the underlying network utility.
  });

  test('throws error and opens circuit after configured failures', async () => {
    // Configure circuit breaker for quick failure for the test
    proxy = new SidecarProxy('service-fail');
    // Assuming the default CB options are: failureThreshold: 5. Let's make it 1 for test.
    // This requires modifying the SidecarProxy to accept CB options or having a test-specific setup.
    // For now, let's assume the actual operation within circuit breaker fails.
    
    const failingOperation = jest.fn()
      .mockRejectedValueOnce(new Error('Simulated network failure 1'))
      .mockRejectedValueOnce(new Error('Simulated network failure 2')); // Assuming threshold is >1

    // Replace the circuit breaker's execute with a mock that uses our failingOperation
    // This is a bit complex; simpler if the CB is configurable or the operation is injectable.
    // A more direct way: make the operation inside forwardRequest fail.
    // The current SidecarProxy creates the operation internally.
    // Let's spy on circuitBreaker.execute and make it reject.

    jest.spyOn(proxy.circuitBreaker, 'execute')
        .mockRejectedValueOnce(new Error('Network Error 1')) // 1st failure
        .mockRejectedValueOnce(new Error('Network Error 2')) // 2nd failure
        .mockRejectedValueOnce(new Error('Network Error 3')) // 3rd failure
        .mockRejectedValueOnce(new Error('Network Error 4')) // 4th failure
        .mockRejectedValueOnce(new Error('Network Error 5')); // 5th failure, trips the circuit (default threshold)

    const requestPayload = { path: '/api/fail' };

    for (let i = 0; i < 5; i++) {
        await expect(proxy.forwardRequest('failing-service', requestPayload))
          .rejects.toThrow(`Request from service-fail to failing-service failed: Network Error ${i+1}`);
    }
    
    expect(proxy.circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Subsequent call should be rejected immediately by open circuit
    await expect(proxy.forwardRequest('failing-service', requestPayload))
      .rejects.toThrow('Service service-fail to failing-service circuit is OPEN. Request rejected.');
  });

  test('transitions to HALF_OPEN and closes circuit on success', async () => {
    proxy = new SidecarProxy('service-halfopen');
    const cbOptions = { failureThreshold: 1, successThreshold: 1, timeout: 100 }; // Quick timeout
    proxy.circuitBreaker['options'] = {...proxy.circuitBreaker['options'], ...cbOptions}; // Modify for test

    const requestPayload = { path: '/api/transient' };

    // Fail once to open the circuit
    jest.spyOn(proxy.circuitBreaker, 'execute').mockImplementationOnce(async () => {
      throw new Error("Simulated failure to open circuit");
    });
    await expect(proxy.forwardRequest('transient-service', requestPayload)).rejects.toThrow('failed: Simulated failure to open circuit');
    expect(proxy.circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Wait for timeout to go to HALF_OPEN
    await new Promise(resolve => setTimeout(resolve, cbOptions.timeout + 50));
    expect(proxy.circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    
    // Successful call in HALF_OPEN
    // Restore original execute or make it succeed
    (proxy.circuitBreaker.execute as jest.Mock).mockImplementationOnce(async () => {
        return { data: 'Success in HALF_OPEN', status: 200 };
    });

    const result = await proxy.forwardRequest('transient-service', requestPayload);
    expect(result.data).toBe('Success in HALF_OPEN');
    expect(proxy.circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });
});