// Handles logging to a file.
// TODO: Implement log rotation, file size limits, and asynchronous writing for performance.

import * as fs from 'fs';
import * as path from 'path';
import { LogHandler } from '../core/log-router'; // Adjust path as needed
import { LogEntry, LogLevel } from '../core/log-manager'; // Adjust path as needed

export interface FileHandlerOptions {
  filePath: string;
  maxFileSize?: number; // In bytes, for rotation
  maxFiles?: number; // Number of rotated files to keep
  // TODO: Add options for encoding, file mode, etc.
}

export class FileLogHandler implements LogHandler {
  private filePath: string;
  private writeStream?: fs.WriteStream;
  private options: FileHandlerOptions;
  private currentFileSize: number = 0;
  private minLevel: LogLevel = LogLevel.DEBUG; // Handler-specific minimum level

  constructor(options: FileHandlerOptions) {
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // Default 10MB
      maxFiles: 5, // Default 5 rotated files
      ...options,
    };
    this.filePath = path.resolve(this.options.filePath);
    this.ensureDirectoryExists();
    this.openWriteStream();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created log directory: ${dir}`);
    }
  }

  private openWriteStream(): void {
    // Check for existing file size if we are appending
    if (fs.existsSync(this.filePath)) {
      try {
        const stats = fs.statSync(this.filePath);
        this.currentFileSize = stats.size;
      } catch (err) {
        console.error(`Error getting stats for log file ${this.filePath}:`, err);
        this.currentFileSize = 0;
      }
    } else {
        this.currentFileSize = 0;
    }

    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' }); // 'a' for append
    this.writeStream.on('error', (err) => {
      console.error('Error with log file write stream:', err);
      // Optionally try to reopen or handle error
    });
    this.writeStream.on('open', () => {
      console.log(`Log file opened for appending: ${this.filePath}`);
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

    if (!this.writeStream || this.writeStream.destroyed) {
      console.error('Log stream not available. Attempting to reopen...');
      this.openWriteStream(); // Attempt to reopen
      if (!this.writeStream || this.writeStream.destroyed) {
        console.error('Failed to reopen log stream. Log to file failed.');
        return;
      }
    }

    const messageToWrite = formattedMessage + '\n'; // Ensure newline
    const messageSize = Buffer.byteLength(messageToWrite, 'utf-8');

    if (this.options.maxFileSize && (this.currentFileSize + messageSize) > this.options.maxFileSize) {
      this.rotateLogFile();
    }

    this.writeStream.write(messageToWrite, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      } else {
        this.currentFileSize += messageSize;
      }
    });
  }

  private rotateLogFile(): void {
    if (!this.writeStream) return;

    this.writeStream.end(() => {
      console.log(`Rotating log file: ${this.filePath}`);
      const baseFilePath = this.filePath;
      const dir = path.dirname(baseFilePath);
      const ext = path.extname(baseFilePath);
      const baseName = path.basename(baseFilePath, ext);

      // Delete oldest if maxFiles exceeded
      if (this.options.maxFiles && this.options.maxFiles > 0) {
        for (let i = this.options.maxFiles -1; i >= 1; i--) {
             const oldRotatedPath = path.join(dir, `${baseName}.${i}${ext}`);
             const newRotatedPath = path.join(dir, `${baseName}.${i+1}${ext}`);
             if (fs.existsSync(oldRotatedPath)) {
                 if (i === this.options.maxFiles -1 && fs.existsSync(newRotatedPath)) {
                     fs.unlinkSync(newRotatedPath); // Delete the oldest (e.g., log.5 if maxFiles is 5)
                 }
                 if (fs.existsSync(oldRotatedPath)) { // Check again as it might have been deleted if it was the oldest
                    fs.renameSync(oldRotatedPath, newRotatedPath);
                 }
             }
        }
      }


      // Rename current log to .1
      const newPath = path.join(dir, `${baseName}.1${ext}`);
      if (fs.existsSync(baseFilePath)) {
        try {
            fs.renameSync(baseFilePath, newPath);
        } catch (renameError) {
            console.error(`Error renaming log file ${baseFilePath} to ${newPath}:`, renameError);
            // Fallback or error handling if rename fails (e.g. file locked)
        }
      }
      this.currentFileSize = 0;
      this.openWriteStream(); // Open a new stream for the original filePath
    });
  }


  public async destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.writeStream && !this.writeStream.destroyed) {
        this.writeStream.end(() => {
          console.log(`Log file stream closed for: ${this.filePath}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}