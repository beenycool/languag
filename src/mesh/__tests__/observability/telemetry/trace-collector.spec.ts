// src/mesh/__tests__/observability/telemetry/trace-collector.spec.ts
import { TraceCollector, Span, SpanContext, SpanAttribute, SpanEvent } from '../../../observability/telemetry/trace-collector';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('TraceCollector', () => {
  let traceCollector: TraceCollector;
  const serviceName = 'test-app';

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    traceCollector = new TraceCollector(serviceName, mockLogger);
    jest.useFakeTimers(); // Use Jest's fake timers for consistent timestamps
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ID Generation', () => {
    test('generateTraceId should return a non-empty string', () => {
      const traceId = traceCollector.generateTraceId();
      expect(traceId).toBeDefined();
      expect(typeof traceId).toBe('string');
      expect(traceId.length).toBeGreaterThan(0);
    });

    test('generateSpanId should return a non-empty string', () => {
      const spanId = traceCollector.generateSpanId();
      expect(spanId).toBeDefined();
      expect(typeof spanId).toBe('string');
      expect(spanId.length).toBeGreaterThan(0);
    });

    test('generated IDs should be unique (statistically)', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(traceCollector.generateTraceId());
        ids.add(traceCollector.generateSpanId());
      }
      expect(ids.size).toBe(200); // Expect all 200 to be unique
    });
  });

  describe('Span Lifecycle', () => {
    const spanName = 'handleHttpRequest';
    const initialAttrs: SpanAttribute[] = [{ key: 'http.method', value: 'GET' }];

    test('startSpan should create a new root span if no parent context', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      
      const span = traceCollector.startSpan(spanName, undefined, now, initialAttrs, 'SERVER');
      
      expect(span.name).toBe(spanName);
      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.parentSpanId).toBeUndefined();
      expect(span.startTime).toBe(now);
      expect(span.attributes).toEqual(initialAttrs);
      expect(span.kind).toBe('SERVER');
      expect(span.serviceName).toBe(serviceName);
      expect(traceCollector['activeSpans'].has(span.spanId)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[TraceCollector:${serviceName}] Span started: ${spanName}`,
        expect.objectContaining({ traceId: span.traceId, spanId: span.spanId })
      );
    });

    test('startSpan should create a child span with parent context', () => {
      const parentTraceId = traceCollector.generateTraceId();
      const parentSpanId = traceCollector.generateSpanId();
      const parentContext: SpanContext = { traceId: parentTraceId, spanId: parentSpanId };
      const now = Date.now();
      jest.setSystemTime(now);

      const childSpan = traceCollector.startSpan('processData', parentContext, now, [], 'INTERNAL');

      expect(childSpan.traceId).toBe(parentTraceId);
      expect(childSpan.parentSpanId).toBe(parentSpanId);
      expect(childSpan.spanId).not.toBe(parentSpanId);
      expect(childSpan.startTime).toBe(now);
      expect(traceCollector['activeSpans'].has(childSpan.spanId)).toBe(true);
    });

    test('endSpan should mark a span as ended and remove from active spans', () => {
      const span = traceCollector.startSpan(spanName);
      const startTime = span.startTime;
      
      const endTime = startTime + 100;
      jest.setSystemTime(endTime);
      const status = { code: 'OK' as const };

      traceCollector.endSpan(span.spanId, span.traceId, endTime, status);
      
      expect(traceCollector['activeSpans'].has(span.spanId)).toBe(false); // Assuming it's removed
      // If spans are buffered for export, this test would need to check that buffer.
      // The current placeholder implementation removes it.
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[TraceCollector:${serviceName}] Span ended: ${spanName}`,
        expect.objectContaining({ traceId: span.traceId, spanId: span.spanId, duration: endTime - startTime })
      );
    });
    
    test('endSpan should do nothing if spanId is not active or traceId mismatches', () => {
        traceCollector.endSpan('non-existent-span', 'some-trace-id');
        expect(mockLogger.warn).toHaveBeenCalledWith(`[TraceCollector:${serviceName}] Attempted to end non-active or mismatched traceId span: non-existent-span`);
        
        const span = traceCollector.startSpan(spanName);
        traceCollector.endSpan(span.spanId, 'different-trace-id');
        expect(mockLogger.warn).toHaveBeenCalledWith(`[TraceCollector:${serviceName}] Attempted to end non-active or mismatched traceId span: ${span.spanId}`);
        expect(traceCollector['activeSpans'].has(span.spanId)).toBe(true); // Still active
    });
  });

  describe('Span Modification', () => {
    let activeSpan: Span;
    const attr1: SpanAttribute = { key: 'http.status_code', value: 200 };
    const attr2: SpanAttribute = { key: 'user.id', value: 'xyz789' };
    const event1: SpanEvent = { name: 'cache.miss', attributes: [{ key: 'cache.key', value: 'data-123' }] };

    beforeEach(() => {
      activeSpan = traceCollector.startSpan('complexOperation');
    });

    test('addSpanAttributes should add attributes to an active span', () => {
      traceCollector.addSpanAttributes(activeSpan.spanId, activeSpan.traceId, [attr1, attr2]);
      const updatedSpan = traceCollector['activeSpans'].get(activeSpan.spanId);
      expect(updatedSpan?.attributes).toEqual(expect.arrayContaining([attr1, attr2]));
      expect(mockLogger.trace).toHaveBeenCalledWith(
        `[TraceCollector:${serviceName}] Attributes added to span: ${activeSpan.name}`,
        expect.objectContaining({ attributes: [attr1, attr2] })
      );
    });
    
    test('addSpanAttributes should do nothing for non-active span or mismatched traceId', () => {
        traceCollector.addSpanAttributes('fake-id', activeSpan.traceId, [attr1]);
        // Check that logger was not called for successful add, or that span was not modified
        const originalAttributes = [...(activeSpan.attributes || [])];
        traceCollector.addSpanAttributes(activeSpan.spanId, 'fake-trace', [attr1]);
        expect(activeSpan.attributes).toEqual(originalAttributes); // No change
    });

    test('addSpanEvent should add an event to an active span with a timestamp', () => {
      const now = Date.now();
      jest.setSystemTime(now);
      traceCollector.addSpanEvent(activeSpan.spanId, activeSpan.traceId, event1);
      
      const updatedSpan = traceCollector['activeSpans'].get(activeSpan.spanId);
      expect(updatedSpan?.events).toHaveLength(1);
      expect(updatedSpan?.events?.[0].name).toBe(event1.name);
      expect(updatedSpan?.events?.[0].timestamp).toBe(now);
      expect(updatedSpan?.events?.[0].attributes).toEqual(event1.attributes);
      expect(mockLogger.trace).toHaveBeenCalledWith(
        `[TraceCollector:${serviceName}] Event added to span: ${activeSpan.name} - ${event1.name}`,
        expect.objectContaining({ event: expect.objectContaining({ name: event1.name, timestamp: now }) })
      );
    });
    
    test('addSpanEvent should use provided timestamp if available', () => {
      const customTimestamp = Date.now() - 1000;
      const eventWithTimestamp: SpanEvent = { ...event1, timestamp: customTimestamp };
      traceCollector.addSpanEvent(activeSpan.spanId, activeSpan.traceId, eventWithTimestamp);
      const updatedSpan = traceCollector['activeSpans'].get(activeSpan.spanId);
      expect(updatedSpan?.events?.[0].timestamp).toBe(customTimestamp);
    });
  });

  describe('Span Exporting', () => {
    test('exportSpans should log export activity (placeholder)', async () => {
      const span1 = traceCollector.startSpan('op1');
      traceCollector.endSpan(span1.spanId, span1.traceId); // End it so it might be exportable
      // The current implementation removes on end, so we need to capture it before.
      // Let's modify the test to reflect that exportSpans takes an array.
      
      const endedSpan: Span = { ...span1, endTime: Date.now(), status: { code: 'OK'} };
      // In a real system, ended spans would be buffered.
      // For this test, we pass an array directly to exportSpans.

      await traceCollector.exportSpans([endedSpan]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[TraceCollector:${serviceName}] Exporting 1 spans (placeholder)...`,
        { firstTraceId: endedSpan.traceId }
      );
    });

    test('exportSpans should do nothing if no spans provided', async () => {
      await traceCollector.exportSpans([]);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Exporting'), expect.anything()
      );
    });
  });
});