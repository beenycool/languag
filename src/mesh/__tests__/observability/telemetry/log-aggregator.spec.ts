// src/mesh/__tests__/observability/telemetry/log-aggregator.spec.ts
import { LogAggregator, ILogExporter, MeshLogEntry } from '../../../observability/telemetry/log-aggregator';
import { ILoggingService, LogLevel, LogEntry as CoreLogEntry } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

const mockExporter: ILogExporter = {
  exportLogs: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined),
};

describe('LogAggregator', () => {
  let logAggregator: LogAggregator;
  const serviceName = 'test-service-logger';
  const bufferSizeLimit = 3;

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    (mockExporter.exportLogs as jest.Mock).mockClear();
    (mockExporter.shutdown as jest.Mock).mockClear();
    
    jest.useFakeTimers();
    logAggregator = new LogAggregator(serviceName, mockExporter, mockLogger, bufferSizeLimit);
  });

  afterEach(async () => {
    await logAggregator.shutdown(); // Ensure timers are cleared and final flush happens
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with exporter and settings', () => {
      expect(logAggregator['exporter']).toBe(mockExporter);
      expect(logAggregator['bufferSizeLimit']).toBe(bufferSizeLimit);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[LogAggregator:${serviceName}] LogAggregator initialized.`,
        expect.objectContaining({ serviceName, bufferSizeLimit })
      );
    });

    test('should set up interval flush if flushIntervalMs is provided', () => {
      const intervalMs = 1000;
      const aggregatorWithInterval = new LogAggregator(serviceName, mockExporter, mockLogger, bufferSizeLimit, intervalMs);
      expect(aggregatorWithInterval['flushTimer']).toBeDefined();
      
      // Fast-forward time to trigger interval
      jest.advanceTimersByTime(intervalMs);
      expect(mockExporter.exportLogs).not.toHaveBeenCalled(); // Buffer is empty initially

      aggregatorWithInterval.processLog({ level: LogLevel.INFO, message: 'Test log for interval' });
      jest.advanceTimersByTime(intervalMs);
      expect(mockExporter.exportLogs).toHaveBeenCalledTimes(1);
      
      aggregatorWithInterval.shutdown(); // Clears timer
    });
  });

  describe('Log Processing', () => {
    const coreLog: Partial<CoreLogEntry> & { message: string; level: LogLevel } = {
      level: LogLevel.INFO,
      message: 'User logged in.',
      timestamp: Date.now(),
      userId: 'user123',
      serviceName: 'auth-service-original', // Original service name
    };
    const meshCtx = {
      sourceService: 'ingress-proxy', // Mesh component that saw the log or request
      traceId: 'trace-abc',
      destinationService: 'auth-service-target',
    };

    test('should enrich log entry with mesh context and default serviceName', () => {
      logAggregator.processLog({ level: LogLevel.WARN, message: 'A simple warning' });
      const bufferedLog = logAggregator['buffer'][0];
      expect(bufferedLog.serviceName).toBe(serviceName); // Default from LogAggregator's serviceName
      expect(bufferedLog.message).toBe('A simple warning');
      expect(bufferedLog.level).toBe(LogLevel.WARN);
    });

    test('should use original serviceName if provided in logEntry, overriding meshContext.sourceService', () => {
      logAggregator.processLog(coreLog, meshCtx);
      const bufferedLog = logAggregator['buffer'][0];
      expect(bufferedLog.serviceName).toBe('auth-service-original');
      expect(bufferedLog.traceId).toBe(meshCtx.traceId);
      expect(bufferedLog.destinationService).toBe(meshCtx.destinationService);
      expect(bufferedLog.userId).toBe(coreLog.userId);
    });
    
    test('should use meshContext.sourceService if logEntry.serviceName is not present', () => {
      const simpleLog = { level: LogLevel.DEBUG, message: 'Debug from proxy' };
      logAggregator.processLog(simpleLog, { sourceService: 'proxy-A', traceId: 't1' });
      const bufferedLog = logAggregator['buffer'][0];
      expect(bufferedLog.serviceName).toBe('proxy-A');
      expect(bufferedLog.traceId).toBe('t1');
    });

    test('should add log to buffer', () => {
      logAggregator.processLog(coreLog, meshCtx);
      expect(logAggregator['buffer']).toHaveLength(1);
      expect(logAggregator['buffer'][0].message).toBe(coreLog.message);
    });

    test('should auto-flush buffer when bufferSizeLimit is reached', async () => {
      for (let i = 0; i < bufferSizeLimit -1; i++) {
        logAggregator.processLog({ level: LogLevel.INFO, message: `Log ${i}` });
      }
      expect(mockExporter.exportLogs).not.toHaveBeenCalled();
      expect(logAggregator['buffer']).toHaveLength(bufferSizeLimit - 1);

      // This one should trigger flush
      logAggregator.processLog({ level: LogLevel.INFO, message: `Log ${bufferSizeLimit -1}` });
      
      // Flush is async, wait for it.
      // In Jest, async operations triggered by sync code might need `Promise.resolve().then()` or `process.nextTick`
      await Promise.resolve(); 

      expect(mockExporter.exportLogs).toHaveBeenCalledTimes(1);
      expect(mockExporter.exportLogs).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ message: 'Log 0' }),
        expect.objectContaining({ message: `Log ${bufferSizeLimit -1}` }),
      ]));
      expect(logAggregator['buffer']).toHaveLength(0); // Buffer should be cleared after flush
    });
  });

  describe('Flushing', () => {
    test('flush should export logs and clear buffer', async () => {
      logAggregator.processLog({ level: LogLevel.ERROR, message: 'Error 1' });
      logAggregator.processLog({ level: LogLevel.WARN, message: 'Warning 1' });
      expect(logAggregator['buffer']).toHaveLength(2);

      await logAggregator.flush();

      expect(mockExporter.exportLogs).toHaveBeenCalledTimes(1);
      expect(mockExporter.exportLogs).toHaveBeenCalledWith([
        expect.objectContaining({ message: 'Error 1' }),
        expect.objectContaining({ message: 'Warning 1' }),
      ]);
      expect(logAggregator['buffer']).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(`[LogAggregator:${serviceName}] 2 log entries successfully exported.`);
    });

    test('flush should do nothing if buffer is empty', async () => {
      await logAggregator.flush();
      expect(mockExporter.exportLogs).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(`[LogAggregator:${serviceName}] Flush called, but buffer is empty.`);
    });
test('should log error if exporter fails (placeholder: logs lost)', async () => {
  (mockExporter.exportLogs as jest.Mock).mockRejectedValueOnce(new Error('Exporter connection failed'));
  logAggregator.processLog({ level: LogLevel.ERROR, message: 'Critical failure' }); // Changed to ERROR
  
  await logAggregator.flush();
  
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[LogAggregator:${serviceName}] Failed to export logs. Re-queueing or handling error (placeholder: logs lost).`,
        expect.objectContaining({ error: 'Exporter connection failed', count: 1 })
      );
      // Current placeholder implementation loses logs on failure.
      expect(logAggregator['buffer']).toHaveLength(0); 
    });
  });

  describe('Shutdown', () => {
    test('shutdown should clear interval timer, flush remaining logs, and call exporter.shutdown', async () => {
      const aggregatorWithInterval = new LogAggregator(serviceName, mockExporter, mockLogger, bufferSizeLimit, 1000);
      aggregatorWithInterval.processLog({ level: LogLevel.INFO, message: 'Log before shutdown' });
      
      const flushSpy = jest.spyOn(aggregatorWithInterval, 'flush');
      
      await aggregatorWithInterval.shutdown();
      
      expect(flushSpy).toHaveBeenCalledTimes(1); // Final flush
      expect(mockExporter.exportLogs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ message: 'Log before shutdown' })])
      );
      expect(mockExporter.shutdown).toHaveBeenCalledTimes(1);
      expect(aggregatorWithInterval['flushTimer']).toBeUndefined(); // Or check clearInterval was called
      expect(mockLogger.info).toHaveBeenCalledWith(`[LogAggregator:${serviceName}] LogAggregator shut down complete.`);
    });
  });
});