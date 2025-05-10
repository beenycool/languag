// src/mesh/__tests__/core/control/service-registry.spec.ts
import { ServiceRegistry, ServiceInstance, ServiceDefinition } from '../../../core/control/service-registry';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLoggerInstance: ILoggingService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined),
  setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO),
  getChildLogger: jest.fn().mockReturnThis(),
};

describe('ServiceRegistry', () => {
  let serviceRegistry: ServiceRegistry;

  beforeEach(() => {
    // Clear mock logger calls before each test
    (mockLoggerInstance.log as jest.Mock).mockClear();
    (mockLoggerInstance.info as jest.Mock).mockClear();
    (mockLoggerInstance.warn as jest.Mock).mockClear();
    (mockLoggerInstance.error as jest.Mock).mockClear();
    (mockLoggerInstance.debug as jest.Mock).mockClear();

    serviceRegistry = new ServiceRegistry({ logger: mockLoggerInstance });
  });

  describe('Registration', () => {
    const serviceId = 'user-service';
    const instance1Info = { instanceId: 'user-service-1', host: 'localhost', port: 3001, version: '1.0.0', tags: ['api', 'rest'] };
    const instance2Info = { instanceId: 'user-service-2', host: 'localhost', port: 3002, version: '1.0.1', tags: ['api', 'grpc'] };

    test('should register a new service instance', async () => {
      await serviceRegistry.registerService(serviceId, instance1Info);
      const services = await serviceRegistry.getAllServices();
      const serviceDef = services[serviceId];

      expect(serviceDef).toBeDefined();
      expect(serviceDef.instances.size).toBe(1);
      const registeredInstance = serviceDef.instances.get(instance1Info.instanceId);
      expect(registeredInstance).toBeDefined();
      expect(registeredInstance?.host).toBe(instance1Info.host);
      expect(registeredInstance?.port).toBe(instance1Info.port);
      expect(registeredInstance?.status).toBe('UP');
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('[ServiceRegistry] Service instance registered'),
        expect.objectContaining(instance1Info)
      );
    });

    test('should register multiple instances for the same service', async () => {
      await serviceRegistry.registerService(serviceId, instance1Info);
      await serviceRegistry.registerService(serviceId, instance2Info);
      
      const services = await serviceRegistry.getAllServices();
      const serviceDef = services[serviceId];
      expect(serviceDef.instances.size).toBe(2);
      expect(serviceDef.instances.has(instance1Info.instanceId)).toBe(true);
      expect(serviceDef.instances.has(instance2Info.instanceId)).toBe(true);
    });

    test('should update instance if registered again with the same serviceId and instanceId', async () => {
      await serviceRegistry.registerService(serviceId, instance1Info);
      const updatedInstance1Info = { ...instance1Info, version: '1.0.2', metadata: { updated: true } };
      await serviceRegistry.registerService(serviceId, updatedInstance1Info);

      const services = await serviceRegistry.getAllServices();
      const serviceDef = services[serviceId];
      expect(serviceDef.instances.size).toBe(1);
      const registeredInstance = serviceDef.instances.get(instance1Info.instanceId);
      expect(registeredInstance?.version).toBe('1.0.2');
      expect(registeredInstance?.metadata?.updated).toBe(true);
    });
  });

  describe('Deregistration', () => {
    const serviceId = 'product-service';
    const instanceId = 'product-service-1';
    const instanceInfo = { instanceId, host: 'localhost', port: 4001 };

    beforeEach(async () => {
      await serviceRegistry.registerService(serviceId, instanceInfo);
    });

    test('should deregister an existing service instance', async () => {
      await serviceRegistry.deregisterService(serviceId, instanceId);
      const services = await serviceRegistry.getAllServices();
      const serviceDef = services[serviceId]; // Service definition might still exist
      
      // Check if instance is removed from the service definition
      if (serviceDef) {
        expect(serviceDef.instances.has(instanceId)).toBe(false);
      } else {
        // Or if the service definition itself is removed when no instances are left (depends on implementation)
        expect(services[serviceId]).toBeUndefined(); // This depends on the chosen strategy in ServiceRegistry
      }
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('[ServiceRegistry] Service instance deregistered'),
        undefined // Context for deregister might be different or undefined
      );
    });

    test('should not fail if deregistering a non-existent instance or service', async () => {
      await expect(serviceRegistry.deregisterService(serviceId, 'non-existent-instance')).resolves.not.toThrow();
      await expect(serviceRegistry.deregisterService('non-existent-service', instanceId)).resolves.not.toThrow();
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        expect.stringContaining('[ServiceRegistry] Attempted to deregister non-existent instance'),
        undefined
      );
    });
  });

  describe('Service Discovery', () => {
    const serviceAId = 'service-a';
    const instanceA1 = { instanceId: 'a1', host: 'host-a1', port: 5001, status: 'UP' as const };
    const instanceA2 = { instanceId: 'a2', host: 'host-a2', port: 5002, status: 'DOWN' as const }; // Explicitly DOWN
    const instanceA3 = { instanceId: 'a3', host: 'host-a3', port: 5003, status: 'UP' as const };


    beforeEach(async () => {
      await serviceRegistry.registerService(serviceAId, instanceA1);
      // Simulate instanceA2 going down by directly manipulating its status after registration,
      // or have a method in ServiceRegistry to update instance status.
      // For now, let's assume registration sets it to UP, then we'd need a way to make it DOWN.
      // The current ServiceRegistry.registerService sets status to 'UP'.
      // To test filtering by status, we'd need to modify an instance or register with status.
      // Let's assume for this test, we can register with a specific status or update it.
      // The current `registerService` doesn't allow setting status.
      // Let's modify the test to reflect what's possible or assume an updateStatus method.
      // For simplicity, we'll register A2 and then imagine it went down (not testable with current SR methods directly for getServiceEndpoints filtering)
      // The current `getServiceEndpoints` filters by 'UP'.
      await serviceRegistry.registerService(serviceAId, instanceA2); // Will be UP initially
      await serviceRegistry.registerService(serviceAId, instanceA3);
      
      // Manually update status for testing (not ideal, but ServiceRegistry needs status update method)
      const services = await serviceRegistry.getAllServices();
      if(services[serviceAId] && services[serviceAId].instances.has(instanceA2.instanceId)) {
        services[serviceAId].instances.get(instanceA2.instanceId)!.status = 'DOWN';
      }
    });

    test('should get endpoints for a given serviceId, filtering by UP status', async () => {
      const endpoints = await serviceRegistry.getServiceEndpoints(serviceAId);
      expect(endpoints).toHaveLength(2); // A1 and A3 should be UP
      expect(endpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining(instanceA1),
          expect.objectContaining(instanceA3),
        ])
      );
      expect(endpoints).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining(instanceA2), // A2 is DOWN
        ])
      );
    });

    test('should return an empty array if serviceId does not exist', async () => {
      const endpoints = await serviceRegistry.getServiceEndpoints('non-existent-service');
      expect(endpoints).toEqual([]);
    });

    test('should get all registered services and their instances', async () => {
      const serviceBId = 'service-b';
      const instanceB1 = { instanceId: 'b1', host: 'host-b1', port: 6001 };
      await serviceRegistry.registerService(serviceBId, instanceB1);

      const allServices = await serviceRegistry.getAllServices();
      expect(Object.keys(allServices)).toHaveLength(2); // service-a and service-b
      expect(allServices[serviceAId]).toBeDefined();
      expect(allServices[serviceBId]).toBeDefined();
      expect(allServices[serviceAId].instances.size).toBe(3); // A1, A2, A3
      expect(allServices[serviceBId].instances.size).toBe(1);
    });
  });
  
  describe('Metadata Update', () => {
    const serviceId = 'metadata-service';
    const instanceId = 'meta-instance-1';
    const initialInfo = { instanceId, host: 'meta-host', port: 7001, metadata: { region: 'us-east-1' } };

    beforeEach(async () => {
      await serviceRegistry.registerService(serviceId, initialInfo);
    });

    test('should update metadata for a service instance', async () => {
      const newMetadata = { load: 0.75, status: 'healthy' };
      await serviceRegistry.updateServiceMetadata(serviceId, instanceId, newMetadata);

      const services = await serviceRegistry.getAllServices();
      const instance = services[serviceId]?.instances.get(instanceId);
      expect(instance?.metadata?.region).toBe('us-east-1');
      expect(instance?.metadata?.load).toBe(0.75);
      expect(instance?.metadata?.status).toBe('healthy');
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        expect.stringContaining('[ServiceRegistry] Metadata updated'),
        newMetadata
      );
    });

    test('should not fail if updating metadata for non-existent instance/service', async () => {
      await expect(serviceRegistry.updateServiceMetadata(serviceId, 'non-existent', { a: 1 })).resolves.not.toThrow();
      await expect(serviceRegistry.updateServiceMetadata('non-existent', instanceId, { a: 1 })).resolves.not.toThrow();
    });
  });

  describe('Subscription to Changes', () => {
    test('should notify listeners on service registration', (done) => {
      const serviceId = 'listener-service';
      const instanceInfo = { instanceId: 'listen-1', host: 'localhost', port: 8001 };

      const listener = jest.fn((eventType, sId, instance, serviceDef) => {
        try {
          expect(eventType).toBe('REGISTER');
          expect(sId).toBe(serviceId);
          expect(instance?.id).toBe(instanceInfo.instanceId);
          expect(serviceDef?.serviceId).toBe(serviceId);
          done(); // Call done to finish the async test
        } catch (error) {
          done(error);
        }
      });

      serviceRegistry.subscribeToChanges(listener);
      serviceRegistry.registerService(serviceId, instanceInfo); // This should trigger the listener
    });

    test('should notify listeners on service deregistration', (done) => {
      const serviceId = 'listener-service-dereg';
      const instanceId = 'listen-dereg-1';
      const instanceInfo = { instanceId, host: 'localhost', port: 8002 };
      
      serviceRegistry.registerService(serviceId, instanceInfo).then(() => {
        const listener = jest.fn((eventType, sId, instance) => {
          try {
            expect(eventType).toBe('DEREGISTER');
            expect(sId).toBe(serviceId);
            expect(instance?.id).toBe(instanceId);
            done();
          } catch (error) {
            done(error);
          }
        });
        serviceRegistry.subscribeToChanges(listener);
        serviceRegistry.deregisterService(serviceId, instanceId);
      });
    });

    test('unsubscribe should remove listener', async () => {
      const listener = jest.fn();
      const unsubscribe = serviceRegistry.subscribeToChanges(listener);
      unsubscribe();

      await serviceRegistry.registerService('test-unsub', { instanceId: 'unsub-1', host: 'localhost', port: 1 });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});