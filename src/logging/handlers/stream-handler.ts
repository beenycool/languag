// Handles logging to a generic Node.js WritableStream.
// This can be used for logging to stdout, stderr, network sockets, etc.

import { Writable } from 'stream';
import { LogHandler } from '../core/log-router';
import { LogEntry, LogLevel } from '../core/log-manager';

export interface StreamHandlerOptions {
  stream: Writable;
  closeStreamOnDestroy?: boolean; // Whether to call stream.end() on destroy
}

export class StreamLogHandler implements LogHandler {
  private stream: Writable;
  private closeStreamOnDestroy: boolean;
  private minLevel: LogLevel = LogLevel.DEBUG; // Handler-specific minimum level

  constructor(options: StreamHandlerOptions) {
    this.stream = options.stream;
    this.closeStreamOnDestroy = options.closeStreamOnDestroy === undefined ? true : options.closeStreamOnDestroy;

    this.stream.on('error', (err) => {
      // Avoid using console.error if it might also use a StreamLogHandler to stdout/stderr
      // to prevent potential infinite loops.
      process.stderr.write(`Error in StreamLogHandler's stream: ${err.message}\n`);
    });
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private levelToNumeric(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 0;
      case LogLevel.INFO: return 1;
      case LogLevel.WARN: return 2;
      case LogLevel.ERROR: return 3;
      case LogLevel.FATAL: return 4;
      default: return 1;
    }
  }

  public handle(entry: LogEntry, formattedMessage: string): void {
    if (this.levelToNumeric(entry.level) < this.levelToNumeric(this.minLevel)) {
      return;
    }

    if (this.stream.writable) {
      this.stream.write(formattedMessage + '\n', (err) => {
        if (err) {
          process.stderr.write(`Failed to write to stream in StreamLogHandler: ${err.message}\n`);
        }
      });
    } else {
      process.stderr.write('StreamLogHandler: Stream is not writable. Log lost.\n');
    }
  }

  public async destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stream && this.closeStreamOnDestroy && this.stream.writable && !this.stream.destroyed) {
        this.stream.end(() => {
          // Using process.stdout for this message as console.log might be routed here
          process.stdout.write('StreamLogHandler: Underlying stream closed.\n');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Example Usage:
// import { LogManager } from '../core/log-manager';
// import { DefaultLogFormatter } from '../core/log-formatter';

// const logger = LogManager.getInstance();
// logger.setFormatter(new DefaultLogFormatter());

// // Log to stdout
// const stdoutHandler = new StreamLogHandler({ stream: process.stdout });
// logger.addHandler(stdoutHandler);

// // Log to stderr for WARN and above
// const stderrHandler = new StreamLogHandler({ stream: process.stderr });
// stderrHandler.setMinLevel(LogLevel.WARN);
// logger.addHandler(stderrHandler);

// logger.info('This goes to stdout.');
// logger.warn('This goes to stdout and stderr.');
// logger.error('This also goes to stdout and stderr.');

// To test destroy:
// setTimeout(async () => {
//   await logger.destroyAllHandlers(); // Assuming LogManager has such a method
//   console.log('All handlers destroyed');
// }, 1000);