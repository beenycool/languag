// Defines interfaces and classes for formatting log entries.

import { LogEntry, LogLevel } from './log-manager'; // Assuming LogEntry and LogLevel are in log-manager.ts

export interface LogFormatter {
  format(entry: LogEntry): string;
}

export class DefaultLogFormatter implements LogFormatter {
  public format(entry: LogEntry): string {
    const { timestamp, level, message, context, source } = entry;
    const timeString = timestamp.toISOString();
    const levelString = level.toUpperCase().padEnd(5); // DEBUG, INFO , WARN , ERROR, FATAL
    const sourceString = source ? `[${source}]` : '';

    let contextString = '';
    if (context && Object.keys(context).length > 0) {
      // Simple context formatting; could be more sophisticated (e.g., JSON.stringify for nested objects)
      contextString = ' ' + Object.entries(context)
        .map(([key, value]) => `${key}=${this.formatContextValue(value)}`)
        .join(' ');
    }

    return `${timeString} ${levelString}${sourceString} ${message}${contextString}`;
  }

  private formatContextValue(value: any): string {
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value);
  }
}

export class JsonLogFormatter implements LogFormatter {
  public format(entry: LogEntry): string {
    // Ensure all parts of the entry are serializable
    const serializableEntry = {
      ...entry,
      timestamp: entry.timestamp.toISOString(), // Convert Date to ISO string
      // Error objects are not directly serializable, extract relevant info if present in context
      context: this.serializeContext(entry.context),
    };
    return JSON.stringify(serializableEntry);
  }

  private serializeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;
    const serialized: Record<string, any> = {};
    for (const key in context) {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        const value = context[key];
        if (value instanceof Error) {
          serialized[key] = {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        } else {
          serialized[key] = value;
        }
      }
    }
    return serialized;
  }
}

// Example of a more verbose, human-readable formatter
export class DetailedLogFormatter implements LogFormatter {
  public format(entry: LogEntry): string {
    const { timestamp, level, message, context, source } = entry;
    let output = `[${timestamp.toISOString()}] [${level.toUpperCase()}]`;
    if (source) {
      output += ` [Source: ${source}]`;
    }
    output += `\nMessage: ${message}\n`;

    if (context && Object.keys(context).length > 0) {
      output += 'Context:\n';
      for (const [key, value] of Object.entries(context)) {
        if (value instanceof Error) {
          output += `  ${key}: [Error] ${value.name}: ${value.message}\n`;
          if (value.stack) {
            output += `    Stack: ${value.stack.split('\n').join('\n           ')}\n`;
          }
        } else if (typeof value === 'object' && value !== null) {
          output += `  ${key}: ${JSON.stringify(value, null, 2).split('\n').join('\n         ')}\n`;
        } else {
          output += `  ${key}: ${value}\n`;
        }
      }
    }
    output += '--------------------------------------------------';
    return output;
  }
}