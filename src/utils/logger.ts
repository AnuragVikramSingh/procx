/**
 * MIT License
 *
 * Copyright (c) 2025 Anurag Vikram Singh
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { LogLevel } from '../types/utils';
import { ProcxError } from '../types/errors';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  category?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize: number;
  maxFiles: number;
  colorOutput: boolean;
  includeTimestamp: boolean;
  includeCategory: boolean;
  dateFormat: string;
  enablePerformanceLogging: boolean;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.WARN, // Changed from INFO to WARN to reduce verbosity
  enableConsole: true,
  enableFile: false,
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 5,
  colorOutput: true,
  includeTimestamp: true,
  includeCategory: true,
  dateFormat: 'ISO',
  enablePerformanceLogging: false,
};

const LOG_LEVEL_HIERARCHY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.TRACE]: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  [LogLevel.ERROR]: '\x1b[31m',
  [LogLevel.WARN]: '\x1b[33m',
  [LogLevel.INFO]: '\x1b[36m',
  [LogLevel.DEBUG]: '\x1b[35m',
  [LogLevel.TRACE]: '\x1b[37m',
};

const RESET_COLOR = '\x1b[0m';

export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class Logger {
  private config: LoggerConfig;
  private performanceMap: Map<string, PerformanceMeasurement> = new Map();
  private logBuffer: LogEntry[] = [];
  private fileHandle?: any;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.initializeFileLogging();
  }

  private async initializeFileLogging(): Promise<void> {
    if (this.config.enableFile && this.config.filePath) {
      try {
        const fs = await import('fs');
        const path = await import('path');

        const dir = path.dirname(this.config.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.fileHandle = fs.createWriteStream(this.config.filePath, {
          flags: 'a',
        });
      } catch (error) {
        console.warn('Failed to initialize file logging:', error);
        this.config.enableFile = false;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_HIERARCHY[level] <= LOG_LEVEL_HIERARCHY[this.config.level];
  }

  private formatTimestamp(date: Date): string {
    switch (this.config.dateFormat) {
      case 'ISO':
        return date.toISOString();
      case 'locale':
        return date.toLocaleString();
      case 'time':
        return date.toLocaleTimeString();
      default:
        return date.toISOString();
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      parts.push(
        this.config.colorOutput ? `\x1b[90m${timestamp}\x1b[0m` : timestamp
      );
    }

    const levelStr = entry.level.toUpperCase().padEnd(5);
    if (this.config.colorOutput) {
      const color = LOG_COLORS[entry.level];
      parts.push(`${color}${levelStr}${RESET_COLOR}`);
    } else {
      parts.push(levelStr);
    }

    if (this.config.includeCategory && entry.category) {
      const category = `[${entry.category}]`;
      parts.push(
        this.config.colorOutput ? `\x1b[90m${category}\x1b[0m` : category
      );
    }

    parts.push(entry.message);

    return parts.join(' ');
  }

  private formatFileMessage(entry: LogEntry): string {
    const baseMessage = `${this.formatTimestamp(entry.timestamp)} ${entry.level.toUpperCase()} ${entry.category ? `[${entry.category}] ` : ''}${entry.message}`;

    if (entry.metadata) {
      return `${baseMessage} | Metadata: ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      return `${baseMessage} | Error: ${entry.error.message} | Stack: ${entry.error.stack}`;
    }

    return baseMessage;
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.config.enableConsole) {
      const message = this.formatConsoleMessage(entry);

      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(message);
          break;
        case LogLevel.WARN:
          console.warn(message);
          break;
        case LogLevel.INFO:
          console.info(message);
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.log(message);
          break;
      }
    }

    if (this.config.enableFile && this.fileHandle) {
      const message = this.formatFileMessage(entry);
      this.fileHandle.write(`${message}\n`);
    }

    this.logBuffer.push(entry);

    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
  }

  error(
    message: string,
    category?: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      ...(category && { category }),
      ...(metadata && { metadata }),
      ...(error && { error }),
    });
  }

  warn(
    message: string,
    category?: string,
    metadata?: Record<string, any>
  ): void {
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      ...(category && { category }),
      ...(metadata && { metadata }),
    });
  }

  info(
    message: string,
    category?: string,
    metadata?: Record<string, any>
  ): void {
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      ...(category && { category }),
      ...(metadata && { metadata }),
    });
  }

  debug(
    message: string,
    category?: string,
    metadata?: Record<string, any>
  ): void {
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      message,
      ...(category && { category }),
      ...(metadata && { metadata }),
    });
  }

  trace(
    message: string,
    category?: string,
    metadata?: Record<string, any>
  ): void {
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.TRACE,
      message,
      ...(category && { category }),
      ...(metadata && { metadata }),
    });
  }

  logError(
    error: ProcxError,
    category?: string,
    additionalMetadata?: Record<string, any>
  ): void {
    const metadata = {
      code: error.code,
      category: error.category,
      recoverable: error.recoverable,
      retryable: error.retryable,
      timestamp: error.timestamp,
      ...error.details,
      ...additionalMetadata,
    };

    this.error(error.message, category || error.category, metadata, error);
  }

  startPerformance(name: string, metadata?: Record<string, any>): void {
    if (!this.config.enablePerformanceLogging) {
      return;
    }

    const measurement: PerformanceMeasurement = {
      name,
      startTime: performance.now(),
      ...(metadata && { metadata }),
    };

    this.performanceMap.set(name, measurement);
    this.trace(
      `Performance measurement started: ${name}`,
      'performance',
      metadata
    );
  }

  endPerformance(
    name: string,
    additionalMetadata?: Record<string, any>
  ): number | undefined {
    if (!this.config.enablePerformanceLogging) {
      return undefined;
    }

    const measurement = this.performanceMap.get(name);
    if (!measurement) {
      this.warn(`Performance measurement not found: ${name}`, 'performance');
      return undefined;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    const metadata = {
      ...measurement.metadata,
      ...additionalMetadata,
      duration: measurement.duration,
      startTime: measurement.startTime,
      endTime: measurement.endTime,
    };

    this.debug(
      `Performance measurement completed: ${name} (${measurement.duration.toFixed(2)}ms)`,
      'performance',
      metadata
    );

    this.performanceMap.delete(name);
    return measurement.duration;
  }

  async measurePerformance<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startPerformance(name, metadata);

    try {
      const result = await operation();
      this.endPerformance(name, { success: true });
      return result;
    } catch (error) {
      this.endPerformance(name, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let logs = this.logBuffer.slice(-count);

    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }

    return logs;
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.enableFile !== undefined || config.filePath !== undefined) {
      this.initializeFileLogging();
    }
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  close(): void {
    if (this.fileHandle) {
      this.fileHandle.end();
      this.fileHandle = undefined;
    }
  }

  child(category: string): CategoryLogger {
    return new CategoryLogger(this, category);
  }
}

export class CategoryLogger {
  constructor(
    private parent: Logger,
    private category: string
  ) {}

  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    this.parent.error(message, this.category, metadata, error);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.parent.warn(message, this.category, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.parent.info(message, this.category, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.parent.debug(message, this.category, metadata);
  }

  trace(message: string, metadata?: Record<string, any>): void {
    this.parent.trace(message, this.category, metadata);
  }

  startPerformance(name: string, metadata?: Record<string, any>): void {
    this.parent.startPerformance(`${this.category}:${name}`, metadata);
  }

  endPerformance(
    name: string,
    additionalMetadata?: Record<string, any>
  ): number | undefined {
    return this.parent.endPerformance(
      `${this.category}:${name}`,
      additionalMetadata
    );
  }

  async measurePerformance<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.parent.measurePerformance(
      `${this.category}:${name}`,
      operation,
      metadata
    );
  }
}

export const logger = new Logger();

export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.updateConfig(config);
}

export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config);
}

export function getLogger(category: string): CategoryLogger {
  return logger.child(category);
}

export function enableDebugLogging(): void {
  logger.updateConfig({ level: LogLevel.DEBUG });
}

export function enableTraceLogging(): void {
  logger.updateConfig({ level: LogLevel.TRACE });
}

export function enablePerformanceLogging(): void {
  logger.updateConfig({ enablePerformanceLogging: true });
}

export function disableColorOutput(): void {
  logger.updateConfig({ colorOutput: false });
}

export function enableFileLogging(filePath: string): void {
  logger.updateConfig({ enableFile: true, filePath });
}

// Decorator for automatic performance logging
export function logPerformance(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const measurementName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return logger.measurePerformance(measurementName, () =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

// Decorator for automatic error logging
export function logErrors(category?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const logCategory = category || target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof ProcxError) {
          logger.logError(error, logCategory);
        } else {
          logger.error(
            `Unhandled error in ${propertyKey}`,
            logCategory,
            { args },
            error as Error
          );
        }
        throw error;
      }
    };

    return descriptor;
  };
}
