import { configManager } from './config-manager';
import { AppConfig, LoggingConfig } from '../../shared/types/config';
import path from 'path';
import { app } from 'electron';
import winston from 'winston';
import fs from 'fs-extra';

// Function to determine log file path based on configuration
function getLogFilePath(loggingConfig: LoggingConfig): string | undefined {
  if (loggingConfig.filePath) {
    try {
      return path.isAbsolute(loggingConfig.filePath)
        ? loggingConfig.filePath
        : path.join(app.getPath('userData'), loggingConfig.filePath);
    } catch (e) {
        // app.getPath('userData') might fail in some environments (e.g. unit tests)
        console.warn("Could not determine user data path for logs. If using a relative path, it will be relative to CWD.", e);
        return loggingConfig.filePath; // Fallback to relative path if userData path fails
    }
  }
  return undefined;
}

// Initialize logger with current configuration
let currentLoggingConfig = configManager.get<LoggingConfig>('logging');
const initialLogFilePath = getLogFilePath(currentLoggingConfig);

const loggerTransports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: currentLoggingConfig.level || 'info',
    handleExceptions: true,
    handleRejections: true,
  }),
];

if (initialLogFilePath) {
  try {
    fs.ensureDirSync(path.dirname(initialLogFilePath)); // Use fs-extra's ensureDirSync
    loggerTransports.push(
      new winston.transports.File({
        filename: initialLogFilePath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        level: currentLoggingConfig.level || 'info',
        handleExceptions: true,
        handleRejections: true,
      })
    );
  } catch (e) {
    console.error("Failed to initialize file logger transport:", e);
  }
}

const logger = winston.createLogger({
  level: currentLoggingConfig.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lingualens-app' },
  transports: loggerTransports,
});

// Function to update logger configuration
export function updateLoggerConfiguration(newLoggingConfig: LoggingConfig) {
  logger.level = newLoggingConfig.level || 'info';

  logger.transports.forEach(transport => {
    transport.level = newLoggingConfig.level || 'info';

    if (transport instanceof winston.transports.File) {
      const newLogFilePath = getLogFilePath(newLoggingConfig);
      // Winston doesn't easily allow changing filename of an active transport.
      // If path changes, it typically requires removing old and adding new transport.
      // For simplicity, we'll log a warning.
      if (newLogFilePath && transport.filename !== newLogFilePath) {
        logger.warn(`Log file path changed to '${newLogFilePath}'. The logger will continue writing to the old path ('${transport.filename}') until the application is restarted or the logger is re-initialized.`);
      }
    }
  });
  logger.info(`Logger configuration updated. New level: ${newLoggingConfig.level}`);
}

// Subscribe to configuration changes for the 'logging' section
configManager.onChange('logging', (change) => {
  if (change.newValue) {
    const newLoggingConfig = change.newValue as LoggingConfig;
    currentLoggingConfig = newLoggingConfig; // Update local cache
    updateLoggerConfiguration(newLoggingConfig);
  }
});

// Initial log to confirm setup
logger.info(`Logger initialized. Level: ${currentLoggingConfig.level}. File logging to: ${initialLogFilePath || 'Console only'}`);

export default logger;