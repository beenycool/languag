// src/mesh/observability/telemetry/log-aggregator.ts
import { ILoggingService, LogLevel, LogEntry as CoreLogEntry } from '../../../microservices/services/management/logging-service';

// MeshLogEntry might extend CoreLogEntry with mesh-specific context
export interface MeshLogEntry extends CoreLogEntry {
  sourceService?: string; // Service that originated the log within the mesh
  destinationService?: string; // If the log pertains to an interaction
  traceId?: string; // Link to distributed trace
  spanId?: string;  // Link to specific span
  // Other mesh-specific fields
}

export interface ILogExporter {
  /**
   * Exports a batch of log entries.
   * @param logs - An array of MeshLogEntry objects.
   */
  exportLogs(logs: MeshLogEntry[]): Promise<void>;
  shutdown?(): Promise<void>; // Optional: to flush buffers, close connections
}

export interface ILogAggregator {
  /**
   * Processes a log entry, enriches it with mesh context, and queues it for export.
   * @param logEntry - The original log entry (could be CoreLogEntry or just structured data).
   * @param meshContext - Additional context from the mesh (e.g., source/dest service, trace info).
   */
  processLog(logEntry: Partial<CoreLogEntry> & { message: string; level: LogLevel }, meshContext?: Partial<Pick<MeshLogEntry, 'sourceService' | 'destinationService' | 'traceId' | 'spanId'>>): void;

  /**
   * Manually triggers the export of buffered logs.
   * Useful for shutdown or periodic flushing.
   */
  flush(): Promise<void>;
}

/**
 * Aggregates logs from mesh components and forwards them to a centralized logging backend.
 * It can enrich logs with mesh-specific metadata.
 */
export class LogAggregator implements ILogAggregator {
  private logger?: ILoggingService; // For LogAggregator's own logs
  private buffer: MeshLogEntry[];
  private exporter: ILogExporter; // The backend exporter (e.g., to ELK, Loki)
  private bufferSizeLimit: number;
  private flushIntervalMs?: number;
  private flushTimer?: NodeJS.Timeout;
  private serviceName: string; // Name of the service this aggregator instance might be part of (e.g. sidecar)

  constructor(
    serviceName: string,
    exporter: ILogExporter,
    logger?: ILoggingService,
    bufferSizeLimit: number = 100,
    flushIntervalMs?: number
  ) {
    this.serviceName = serviceName;
    this.exporter = exporter;
    this.logger = logger;
    this.buffer = [];
    this.bufferSizeLimit = bufferSizeLimit;
    this.flushIntervalMs = flushIntervalMs;

    this.log(LogLevel.INFO, 'LogAggregator initialized.', { serviceName, bufferSizeLimit, flushIntervalMs });
    if (this.flushIntervalMs) {
      this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    }
  }

  private log(level: LogLevel, message: string, context?: any) {
    this.logger?.log(level, `[LogAggregator:${this.serviceName}] ${message}`, context);
  }

  public processLog(
    logEntry: Partial<CoreLogEntry> & { message: string; level: LogLevel },
    meshContext?: Partial<Pick<MeshLogEntry, 'sourceService' | 'destinationService' | 'traceId' | 'spanId'>>
  ): void {
    const enrichedLog: MeshLogEntry = {
      timestamp: logEntry.timestamp || Date.now(),
      level: logEntry.level,
      message: logEntry.message,
      serviceName: logEntry.serviceName || meshContext?.sourceService || this.serviceName, // Prefer specific origin
      ...meshContext, // Add mesh-specific context
      ...(logEntry.error && { error: logEntry.error }),
      ...(logEntry.correlationId && { correlationId: logEntry.correlationId }),
      ...(logEntry.requestId && { requestId: logEntry.requestId }),
      ...(logEntry.userId && { userId: logEntry.userId }),
      // Merge other arbitrary context from original log entry
      ...Object.fromEntries(Object.entries(logEntry).filter(([key]) => !['timestamp', 'level', 'message', 'serviceName', 'error', 'correlationId', 'requestId', 'userId'].includes(key)))
    };
    
    this.log(LogLevel.TRACE, 'Processing log entry', { originalMsg: logEntry.message, service: enrichedLog.serviceName });
    this.buffer.push(enrichedLog);

    if (this.buffer.length >= this.bufferSizeLimit) {
      this.flush().catch(err => this.log(LogLevel.ERROR, "Error during auto-flush", { error: err.message }));
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      this.log(LogLevel.DEBUG, 'Flush called, but buffer is empty.');
      return;
    }

    const logsToExport = [...this.buffer];
    this.buffer = []; // Clear buffer immediately

    this.log(LogLevel.INFO, `Flushing ${logsToExport.length} log entries.`);
    try {
      await this.exporter.exportLogs(logsToExport);
      this.log(LogLevel.DEBUG, `${logsToExport.length} log entries successfully exported.`);
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'Failed to export logs. Re-queueing or handling error (placeholder: logs lost).', {
        error: error.message,
        count: logsToExport.length,
      });
      // TODO: Implement retry mechanism or dead-letter queue for failed exports
      // For simplicity now, logs are dropped if exporter fails.
      // this.buffer.unshift(...logsToExport); // Example: re-queue (careful with buffer limits)
    }
  }

  public async shutdown(): Promise<void> {
    this.log(LogLevel.INFO, 'Shutting down LogAggregator...');
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush(); // Final flush
    if (this.exporter.shutdown) {
      await this.exporter.shutdown();
    }
    this.log(LogLevel.INFO, 'LogAggregator shut down complete.');
  }
}