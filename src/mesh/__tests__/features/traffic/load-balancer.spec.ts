// src/mesh/__tests__/features/traffic/load-balancer.spec.ts
import { LoadBalancer, LoadBalancerOptions, LoadBalancingStrategyType } from '../../../features/traffic/load-balancer';
import { ServiceInstance } from '../../../core/control/service-registry';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;

  const instance1: ServiceInstance = { id: 'i1', host: 'h1', port: 80, status: 'UP', version: 'v1', metadata: { weight: 50 } };
  const instance2: ServiceInstance = { id: 'i2', host: 'h2', port: 80, status: 'UP', version: 'v1', metadata: { weight: 30 } };
  const instance3: ServiceInstance = { id: 'i3', host: 'h3', port: 80, status: 'UP', version: 'v1', metadata: { weight: 20 } };
  const instanceDown: ServiceInstance = { id: 'i4', host: 'h4', port: 80, status: 'DOWN', version: 'v1' };
  const instanceStarting: ServiceInstance = { id: 'i5', host: 'h5', port: 80, status: 'STARTING', version: 'v1' };

  const healthyInstances: ServiceInstance[] = [instance1, instance2, instance3];
  const mixedStatusInstances: ServiceInstance[] = [instance1, instanceDown, instance2, instanceStarting, instance3];


  beforeEach(() => {
    Object.values(mockLogger).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) mockFn.mockClear();
    });
  });

  describe('Initialization and Strategy Update', () => {
    test('should initialize with ROUND_ROBIN strategy by default', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger });
      expect(loadBalancer['strategy']).toBe('ROUND_ROBIN');
      expect(mockLogger.info).toHaveBeenCalledWith('[LoadBalancer] LoadBalancer initialized with strategy: ROUND_ROBIN');
    });

    test('should initialize with a specified strategy', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'RANDOM' });
      expect(loadBalancer['strategy']).toBe('RANDOM');
    });

    test('should update strategy and reset internal state', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'ROUND_ROBIN' });
      // Make some selections to populate roundRobinIndex
      loadBalancer.selectInstance(healthyInstances, { serviceId: 's1' });
      expect(loadBalancer['roundRobinIndex'].size).toBeGreaterThan(0);

      loadBalancer.updateStrategy('RANDOM');
      expect(loadBalancer['strategy']).toBe('RANDOM');
      expect(loadBalancer['roundRobinIndex'].size).toBe(0); // Assuming reset
      expect(mockLogger.info).toHaveBeenCalledWith('[LoadBalancer] Updating load balancing strategy to: RANDOM', undefined);
    });
  });

  describe('Instance Selection', () => {
    test('should return null if no instances are provided', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger });
      expect(loadBalancer.selectInstance([])).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('[LoadBalancer] No instances available for load balancing.');
    });

    test('should return null if all provided instances are not UP', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger });
      expect(loadBalancer.selectInstance([instanceDown, instanceStarting])).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('[LoadBalancer] No healthy (UP) instances available for load balancing.');
    });

    test('should filter out non-UP instances before selection', () => {
      loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'RANDOM' });
      const selected = loadBalancer.selectInstance(mixedStatusInstances);
      expect(selected).not.toBeNull();
      expect(healthyInstances).toContain(selected);
      expect(selected?.id).not.toBe(instanceDown.id);
      expect(selected?.id).not.toBe(instanceStarting.id);
    });

    describe('RANDOM Strategy', () => {
      beforeEach(() => {
        loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'RANDOM' });
      });

      test('should select a random healthy instance', () => {
        const selections = new Set<string | undefined>();
        for (let i = 0; i < 50; i++) { // Multiple selections to check randomness
          const instance = loadBalancer.selectInstance(healthyInstances);
          expect(instance).not.toBeNull();
          expect(healthyInstances).toContain(instance);
          selections.add(instance?.id);
        }
        expect(selections.size).toBeGreaterThan(1); // Expect more than one unique instance selected over time
      });
    });

    describe('ROUND_ROBIN Strategy', () => {
      beforeEach(() => {
        loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'ROUND_ROBIN' });
      });

      test('should select instances in round-robin order for a given serviceId', () => {
        const serviceId = 'checkout-service';
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId })?.id).toBe(instance1.id);
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId })?.id).toBe(instance2.id);
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId })?.id).toBe(instance3.id);
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId })?.id).toBe(instance1.id); // Wraps around
      });

      test('should maintain separate round-robin counters for different serviceIds', () => {
        const serviceId1 = 'serviceA';
        const serviceId2 = 'serviceB';
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId: serviceId1 })?.id).toBe(instance1.id);
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId: serviceId2 })?.id).toBe(instance1.id); // Starts independently
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId: serviceId1 })?.id).toBe(instance2.id);
        expect(loadBalancer.selectInstance(healthyInstances, { serviceId: serviceId2 })?.id).toBe(instance2.id);
      });
       test('should use "default_service" key if no serviceId in context for ROUND_ROBIN', () => {
        expect(loadBalancer.selectInstance(healthyInstances)?.id).toBe(instance1.id);
        expect(loadBalancer.selectInstance(healthyInstances)?.id).toBe(instance2.id);
        // Accessing private member for verification (use with caution in real tests, prefer behavioral)
        expect(loadBalancer['roundRobinIndex'].has('default_service')).toBe(true);
      });
    });

    // Placeholder tests for strategies not yet fully implemented
    describe('LEAST_CONNECTIONS Strategy (Placeholder)', () => {
      beforeEach(() => {
        loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'LEAST_CONNECTIONS' });
      });
      test('should select an instance (currently random due to placeholder)', () => {
        const instance = loadBalancer.selectInstance(healthyInstances);
        expect(instance).not.toBeNull();
        expect(healthyInstances).toContain(instance);
        expect(mockLogger.debug).toHaveBeenCalledWith('[LoadBalancer] LEAST_CONNECTIONS strategy selected (placeholder). Returning random for now.');
      });
    });

    describe('WEIGHTED_ROUND_ROBIN Strategy (Placeholder)', () => {
       beforeEach(() => {
        loadBalancer = new LoadBalancer({ logger: mockLogger, strategy: 'WEIGHTED_ROUND_ROBIN' });
      });
      test('should select an instance (currently random due to placeholder)', () => {
        const instance = loadBalancer.selectInstance(healthyInstances);
        expect(instance).not.toBeNull();
        expect(healthyInstances).toContain(instance);
        expect(mockLogger.debug).toHaveBeenCalledWith('[LoadBalancer] WEIGHTED_ROUND_ROBIN strategy selected (placeholder). Returning random for now.');
      });
    });
    
    test('should default to RANDOM if an unknown strategy is somehow set', () => {
        loadBalancer = new LoadBalancer({ logger: mockLogger });
        loadBalancer['strategy'] = 'UNKNOWN_STRATEGY' as any; // Force unknown strategy
        const instance = loadBalancer.selectInstance(healthyInstances);
        expect(instance).not.toBeNull();
        expect(healthyInstances).toContain(instance);
        expect(mockLogger.warn).toHaveBeenCalledWith('[LoadBalancer] Unknown load balancing strategy: UNKNOWN_STRATEGY. Defaulting to RANDOM.');
    });
  });
});