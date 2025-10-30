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

/**
 * Shared logging utilities to eliminate duplicate logging patterns
 */

import { getLogger, CategoryLogger } from './logger';
import { ProcxError } from '../types/errors';
import { Platform } from '../types';

/**
 * Shared logging patterns and utilities
 */
export class SharedLogging {
  private logger: CategoryLogger;

  constructor(category: string) {
    this.logger = getLogger(category);
  }

  /**
   * Log operation start with consistent formatting
   */
  logOperationStart(
    operation: string,
    platform: Platform,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}`, metadata);
  }

  /**
   * Log operation success with consistent formatting
   */
  logOperationSuccess(
    operation: string,
    platform: Platform,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`Successfully ${operation} on ${platform}`, metadata);
  }

  /**
   * Log operation failure with consistent formatting
   */
  logOperationFailure(
    operation: string,
    platform: Platform,
    error: Error | ProcxError,
    metadata?: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to ${operation} on ${platform}`, {
      ...metadata,
      error: errorMessage,
    });
  }

  /**
   * Log command execution with consistent formatting
   */
  logCommandExecution(
    operation: string,
    platform: Platform,
    command: string[],
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}`, {
      command: command.join(' '),
      ...metadata,
    });
  }

  /**
   * Log process operation with consistent formatting
   */
  logProcessOperation(
    operation: string,
    platform: Platform,
    pid: number,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}`, {
      pid,
      ...metadata,
    });
  }

  /**
   * Log port operation with consistent formatting
   */
  logPortOperation(
    operation: string,
    platform: Platform,
    port: number,
    protocol?: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}`, {
      port,
      ...(protocol && { protocol }),
      ...metadata,
    });
  }

  /**
   * Log validation result with consistent formatting
   */
  logValidationResult(
    operation: string,
    input: any,
    isValid: boolean,
    error?: string
  ): void {
    if (isValid) {
      this.logger.trace(`Validation passed for ${operation}`, { input });
    } else {
      this.logger.warn(`Validation failed for ${operation}`, {
        input,
        error,
      });
    }
  }

  /**
   * Log performance metrics with consistent formatting
   */
  logPerformanceMetrics(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(
      `Performance: ${operation} completed in ${duration.toFixed(2)}ms`,
      {
        duration,
        ...metadata,
      }
    );
  }

  /**
   * Log cache operation with consistent formatting
   */
  logCacheOperation(
    operation: string,
    key: string,
    hit: boolean,
    metadata?: Record<string, any>
  ): void {
    const status = hit ? 'hit' : 'miss';
    this.logger.trace(`Cache ${status} for ${operation}`, {
      key,
      hit,
      ...metadata,
    });
  }

  /**
   * Log system metrics with consistent formatting
   */
  logSystemMetrics(platform: Platform, metrics: Record<string, any>): void {
    this.logger.debug(`Successfully retrieved system metrics on ${platform}`, {
      metrics,
    });
  }

  /**
   * Log network operation with consistent formatting
   */
  logNetworkOperation(
    operation: string,
    platform: Platform,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}`, metadata);
  }

  /**
   * Log fallback operation with consistent formatting
   */
  logFallbackOperation(
    operation: string,
    platform: Platform,
    fallbackMethod: string,
    reason: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(
      `${operation} failed on ${platform}, trying ${fallbackMethod}`,
      {
        reason,
        fallbackMethod,
        ...metadata,
      }
    );
  }

  /**
   * Log assumption with consistent formatting
   */
  logAssumption(
    operation: string,
    platform: Platform,
    assumption: string,
    reason: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${operation} on ${platform}: ${assumption}`, {
      assumption,
      reason,
      ...metadata,
    });
  }
}

/**
 * Console logging utilities for CLI operations
 */
export class ConsoleLogging {
  /**
   * Log error to console with consistent formatting
   */
  static logError(message: string, error?: Error | string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    if (errorMessage) {
      console.error(`❌ ${message}: ${errorMessage}`);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Log success to console with consistent formatting
   */
  static logSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * Log warning to console with consistent formatting
   */
  static logWarning(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  /**
   * Log info to console with consistent formatting
   */
  static logInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Log validation failure with consistent formatting
   */
  static logValidationFailure(field: string, value?: any): void {
    if (value !== undefined) {
      console.error(`❌ Invalid ${field}: ${value}`);
    } else {
      console.error(`❌ Missing ${field}`);
    }
  }

  /**
   * Log build step with consistent formatting
   */
  static logBuildStep(step: string, success: boolean, details?: string): void {
    if (success) {
      console.log(`✓ ${step}`);
    } else {
      if (details) {
        console.error(`❌ ${step}: ${details}`);
      } else {
        console.error(`❌ ${step}`);
      }
    }
  }

  /**
   * Log file check with consistent formatting
   */
  static logFileCheck(file: string, exists: boolean): void {
    if (exists) {
      console.log(`✓ ${file}`);
    } else {
      console.error(`❌ Missing: ${file}`);
    }
  }

  /**
   * Log test result with consistent formatting
   */
  static logTestResult(test: string, passed: boolean, error?: string): void {
    if (passed) {
      console.log(`✅ ${test}`);
    } else {
      if (error) {
        console.error(`❌ ${test}: ${error}`);
      } else {
        console.error(`❌ ${test} failed`);
      }
    }
  }
}

/**
 * Debug output formatting utilities
 */
export class DebugFormatting {
  /**
   * Format debug context with consistent structure
   */
  static formatDebugContext(
    operation: string,
    context: Record<string, any>
  ): string {
    const lines = [`Debug Context for ${operation}:`];

    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const formattedValue =
          typeof value === 'object'
            ? JSON.stringify(value, null, 2).replace(/\n/g, '\n    ')
            : String(value);
        lines.push(`  ${key}: ${formattedValue}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Format error context with consistent structure
   */
  static formatErrorContext(
    operation: string,
    error: Error | ProcxError,
    context?: Record<string, any>
  ): string {
    const lines = [`Error Context for ${operation}:`];
    lines.push(`  Error: ${error.message}`);

    if (error instanceof ProcxError) {
      lines.push(`  Code: ${error.code}`);
      lines.push(`  Category: ${error.category}`);
      lines.push(`  Recoverable: ${error.recoverable}`);
      lines.push(`  Timestamp: ${error.timestamp.toISOString()}`);

      if (error.details) {
        lines.push(
          `  Details: ${JSON.stringify(error.details, null, 2).replace(/\n/g, '\n    ')}`
        );
      }
    }

    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const formattedValue =
            typeof value === 'object'
              ? JSON.stringify(value, null, 2).replace(/\n/g, '\n    ')
              : String(value);
          lines.push(`  ${key}: ${formattedValue}`);
        }
      });
    }

    if (error.stack) {
      lines.push(`  Stack: ${error.stack.replace(/\n/g, '\n    ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format performance metrics with consistent structure
   */
  static formatPerformanceMetrics(
    operation: string,
    metrics: Record<string, number>
  ): string {
    const lines = [`Performance Metrics for ${operation}:`];

    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        const formattedValue =
          key.includes('time') || key.includes('duration')
            ? `${value.toFixed(2)}ms`
            : key.includes('memory') || key.includes('size')
              ? `${(value / 1024 / 1024).toFixed(2)}MB`
              : value.toString();
        lines.push(`  ${key}: ${formattedValue}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Format system diagnostics with consistent structure
   */
  static formatSystemDiagnostics(
    platform: Platform,
    diagnostics: Record<string, any>
  ): string {
    const lines = [`System Diagnostics for ${platform}:`];

    Object.entries(diagnostics).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          lines.push(`  ${key}:`);
          Object.entries(value).forEach(([subKey, subValue]) => {
            lines.push(`    ${subKey}: ${subValue}`);
          });
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      }
    });

    return lines.join('\n');
  }
}

/**
 * Factory function to create shared logging instance
 */
export function createSharedLogging(category: string): SharedLogging {
  return new SharedLogging(category);
}

/**
 * Convenience functions for common logging patterns
 */

/**
 * Create platform-specific logger
 */
export function createPlatformLogger(platform: Platform): SharedLogging {
  return new SharedLogging(`platform-${platform.toLowerCase()}`);
}

/**
 * Create component-specific logger
 */
export function createComponentLogger(component: string): SharedLogging {
  return new SharedLogging(component);
}

/**
 * Create operation-specific logger
 */
export function createOperationLogger(operation: string): SharedLogging {
  return new SharedLogging(`operation-${operation}`);
}
/**
 * Sh
ared debugging helper functions
 */
export class DebugHelpers {
  private static logger = getLogger('debug-helpers');

  /**
   * Create a debug session for tracking operations
   */
  static createDebugSession(sessionName: string): DebugSession {
    return {
      id: `${sessionName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: sessionName,
      startTime: new Date(),
      operations: [],
      errors: [],
      warnings: [],
      metadata: {},
    };
  }

  /**
   * Add operation to debug session
   */
  static addOperationToSession(
    session: DebugSession,
    operation: DebugOperation
  ): void {
    session.operations.push(operation);

    // Keep session size manageable
    if (session.operations.length > 100) {
      session.operations = session.operations.slice(-50);
    }
  }

  /**
   * Add error to debug session
   */
  static addErrorToSession(
    session: DebugSession,
    error: Error | ProcxError,
    context?: Record<string, any>
  ): void {
    const errorEntry = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      context,
      ...(error instanceof ProcxError && {
        code: error.code,
        category: error.category,
        recoverable: error.recoverable,
      }),
    };

    session.errors.push(errorEntry);

    // Keep error list manageable
    if (session.errors.length > 50) {
      session.errors = session.errors.slice(-25);
    }
  }

  /**
   * Add warning to debug session
   */
  static addWarningToSession(
    session: DebugSession,
    message: string,
    context?: Record<string, any>
  ): void {
    const warningEntry = {
      timestamp: new Date(),
      message,
      context,
    };

    session.warnings.push(warningEntry);

    // Keep warning list manageable
    if (session.warnings.length > 50) {
      session.warnings = session.warnings.slice(-25);
    }
  }

  /**
   * End debug session
   */
  static endDebugSession(session: DebugSession): DebugSession {
    session.endTime = new Date();
    session.duration = session.endTime.getTime() - session.startTime.getTime();

    this.logger.debug('Debug session completed', {
      sessionId: session.id,
      sessionName: session.name,
      duration: session.duration,
      operationsCount: session.operations.length,
      errorsCount: session.errors.length,
      warningsCount: session.warnings.length,
    });

    return session;
  }

  /**
   * Generate debug session report
   */
  static generateSessionReport(session: DebugSession): string {
    const lines = [
      `Debug Session Report: ${session.name}`,
      `Session ID: ${session.id}`,
      `Start Time: ${session.startTime.toISOString()}`,
      `End Time: ${session.endTime?.toISOString() || 'In Progress'}`,
      `Duration: ${session.duration ? `${session.duration}ms` : 'N/A'}`,
      `Operations: ${session.operations.length}`,
      `Errors: ${session.errors.length}`,
      `Warnings: ${session.warnings.length}`,
      '',
    ];

    if (session.operations.length > 0) {
      lines.push('Operations:');
      session.operations.forEach((op, index) => {
        lines.push(
          `  ${index + 1}. ${op.name} - ${op.success ? 'SUCCESS' : 'FAILED'} (${op.duration || 'N/A'}ms)`
        );
        if (op.error) {
          lines.push(`     Error: ${op.error.message}`);
        }
      });
      lines.push('');
    }

    if (session.errors.length > 0) {
      lines.push('Errors:');
      session.errors.forEach((error, index) => {
        lines.push(
          `  ${index + 1}. ${error.message} (${error.timestamp.toISOString()})`
        );
        if (error.context) {
          lines.push(`     Context: ${JSON.stringify(error.context)}`);
        }
      });
      lines.push('');
    }

    if (session.warnings.length > 0) {
      lines.push('Warnings:');
      session.warnings.forEach((warning, index) => {
        lines.push(
          `  ${index + 1}. ${warning.message} (${warning.timestamp.toISOString()})`
        );
        if (warning.context) {
          lines.push(`     Context: ${JSON.stringify(warning.context)}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Create performance measurement helper
   */
  static createPerformanceMeasurement(
    name: string,
    metadata?: Record<string, any>
  ): PerformanceMeasurement {
    return {
      name,
      startTime: performance.now(),
      metadata: metadata || {},
    };
  }

  /**
   * End performance measurement
   */
  static endPerformanceMeasurement(
    measurement: PerformanceMeasurement
  ): PerformanceMeasurement {
    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    this.logger.debug(
      `Performance: ${measurement.name} completed in ${measurement.duration.toFixed(2)}ms`,
      {
        name: measurement.name,
        duration: measurement.duration,
        metadata: measurement.metadata,
      }
    );

    return measurement;
  }

  /**
   * Measure async operation performance
   */
  static async measureAsyncOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; measurement: PerformanceMeasurement }> {
    const measurement = this.createPerformanceMeasurement(name, metadata);

    try {
      const result = await operation();
      this.endPerformanceMeasurement(measurement);
      return { result, measurement };
    } catch (error) {
      this.endPerformanceMeasurement(measurement);
      this.logger.error(`Performance measurement failed for ${name}`, {
        name,
        duration: measurement.duration,
        error: error instanceof Error ? error.message : String(error),
        metadata,
      });
      throw error;
    }
  }

  /**
   * Create system diagnostic helper
   */
  static async createSystemDiagnostic(
    platform: Platform,
    includePermissions: boolean = false
  ): Promise<SystemDiagnostic> {
    const diagnostic: SystemDiagnostic = {
      timestamp: new Date(),
      platform,
      nodeVersion: process.version,
      processInfo: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      environment: this.getRelevantEnvironment(),
    };

    if (includePermissions) {
      diagnostic.permissions = await this.checkBasicPermissions();
    }

    return diagnostic;
  }

  /**
   * Get relevant environment variables for debugging
   */
  private static getRelevantEnvironment(): Record<string, string | undefined> {
    const relevantVars = [
      'NODE_ENV',
      'DEBUG',
      'PROCX_LOG_LEVEL',
      'PROCX_DEBUG',
      'PATH',
      'HOME',
      'USER',
      'USERNAME',
      'SHELL',
      'TERM',
    ];

    const env: Record<string, string | undefined> = {};
    relevantVars.forEach(varName => {
      env[varName] = process.env[varName];
    });

    return env;
  }

  /**
   * Check basic system permissions
   */
  private static async checkBasicPermissions(): Promise<
    Record<string, boolean>
  > {
    const permissions: Record<string, boolean> = {};

    try {
      // Check process access
      permissions['processAccess'] = process.pid > 0;

      // Check file system access
      const fs = require('fs');
      const os = require('os');
      const tempDir = os.tmpdir();
      fs.accessSync(tempDir, fs.constants.R_OK);
      permissions['fileSystemRead'] = true;

      try {
        fs.accessSync(tempDir, fs.constants.W_OK);
        permissions['fileSystemWrite'] = true;
      } catch {
        permissions['fileSystemWrite'] = false;
      }

      // Check network interfaces access
      try {
        const interfaces = os.networkInterfaces();
        permissions['networkAccess'] = Object.keys(interfaces).length > 0;
      } catch {
        permissions['networkAccess'] = false;
      }
    } catch (error) {
      this.logger.warn('Permission check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return permissions;
  }

  /**
   * Format diagnostic information
   */
  static formatDiagnostic(diagnostic: SystemDiagnostic): string {
    return DebugFormatting.formatSystemDiagnostics(diagnostic.platform, {
      timestamp: diagnostic.timestamp.toISOString(),
      nodeVersion: diagnostic.nodeVersion,
      processInfo: diagnostic.processInfo,
      environment: diagnostic.environment,
      ...(diagnostic.permissions && { permissions: diagnostic.permissions }),
    });
  }

  /**
   * Create operation tracker for debugging
   */
  static createOperationTracker(operationName: string): OperationTracker {
    return {
      name: operationName,
      startTime: new Date(),
      steps: [],
      metadata: {},
    };
  }

  /**
   * Add step to operation tracker
   */
  static addStepToTracker(
    tracker: OperationTracker,
    stepName: string,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const step: OperationStep = {
      name: stepName,
      timestamp: new Date(),
      success,
      metadata: metadata || {},
    };

    tracker.steps.push(step);
  }

  /**
   * End operation tracking
   */
  static endOperationTracking(
    tracker: OperationTracker,
    success: boolean,
    error?: Error
  ): OperationTracker {
    tracker.endTime = new Date();
    tracker.duration = tracker.endTime.getTime() - tracker.startTime.getTime();
    tracker.success = success;
    if (error) {
      tracker.error = error;
    }

    this.logger.debug(`Operation tracking completed: ${tracker.name}`, {
      name: tracker.name,
      duration: tracker.duration,
      success: tracker.success,
      stepsCount: tracker.steps.length,
      error: error?.message,
    });

    return tracker;
  }

  /**
   * Generate operation tracking report
   */
  static generateOperationReport(tracker: OperationTracker): string {
    const lines = [
      `Operation Report: ${tracker.name}`,
      `Start Time: ${tracker.startTime.toISOString()}`,
      `End Time: ${tracker.endTime?.toISOString() || 'In Progress'}`,
      `Duration: ${tracker.duration ? `${tracker.duration}ms` : 'N/A'}`,
      `Success: ${tracker.success !== undefined ? tracker.success : 'Unknown'}`,
      `Steps: ${tracker.steps.length}`,
      '',
    ];

    if (tracker.error) {
      lines.push(`Error: ${tracker.error.message}`);
      lines.push('');
    }

    if (tracker.steps.length > 0) {
      lines.push('Steps:');
      tracker.steps.forEach((step, index) => {
        const status = step.success ? '✓' : '✗';
        lines.push(
          `  ${index + 1}. ${status} ${step.name} (${step.timestamp.toISOString()})`
        );
        if (step.metadata) {
          lines.push(`     Metadata: ${JSON.stringify(step.metadata)}`);
        }
      });
    }

    return lines.join('\n');
  }
}

/**
 * Interface definitions for debugging utilities
 */
interface DebugSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  operations: DebugOperation[];
  errors: any[];
  warnings: any[];
  metadata: Record<string, any>;
}

interface DebugOperation {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  input?: any;
  output?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

interface PerformanceMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface SystemDiagnostic {
  timestamp: Date;
  platform: Platform;
  nodeVersion: string;
  processInfo: {
    pid: number;
    uptime: number;
    // eslint-disable-next-line no-undef
    memoryUsage: NodeJS.MemoryUsage;
    // eslint-disable-next-line no-undef
    cpuUsage: NodeJS.CpuUsage;
  };
  environment: Record<string, string | undefined>;
  permissions?: Record<string, boolean>;
}

interface OperationTracker {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success?: boolean;
  error?: Error;
  steps: OperationStep[];
  metadata: Record<string, any>;
}

interface OperationStep {
  name: string;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Convenience functions for debugging
 */

/**
 * Create a debug session
 */
export function createDebugSession(sessionName: string): DebugSession {
  return DebugHelpers.createDebugSession(sessionName);
}

/**
 * Measure async operation with debugging
 */
export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; measurement: PerformanceMeasurement }> {
  return DebugHelpers.measureAsyncOperation(name, operation, metadata);
}

/**
 * Create system diagnostic
 */
export async function createSystemDiagnostic(
  platform: Platform,
  includePermissions: boolean = false
): Promise<SystemDiagnostic> {
  return DebugHelpers.createSystemDiagnostic(platform, includePermissions);
}

/**
 * Create operation tracker
 */
export function createOperationTracker(
  operationName: string
): OperationTracker {
  return DebugHelpers.createOperationTracker(operationName);
} /**
 * Sha
red performance monitoring utilities
 */
export class SharedPerformanceMonitoring {
  private static measurements: Map<string, PerformanceMeasurement> = new Map();
  private static logger = getLogger('shared-performance');

  /**
   * Start performance monitoring for an operation
   */
  static startOperation(name: string, metadata?: Record<string, any>): string {
    const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const measurement = DebugHelpers.createPerformanceMeasurement(
      name,
      metadata
    );

    this.measurements.set(operationId, measurement);

    this.logger.trace(`Performance monitoring started: ${name}`, {
      operationId,
      metadata,
    });

    return operationId;
  }

  /**
   * End performance monitoring for an operation
   */
  static endOperation(
    operationId: string,
    success: boolean = true,
    error?: string
  ): PerformanceMeasurement | null {
    const measurement = this.measurements.get(operationId);
    if (!measurement) {
      this.logger.warn(`Performance measurement not found: ${operationId}`);
      return null;
    }

    DebugHelpers.endPerformanceMeasurement(measurement);
    this.measurements.delete(operationId);

    this.logger.debug(`Performance monitoring completed: ${measurement.name}`, {
      operationId,
      duration: measurement.duration,
      success,
      error,
    });

    return measurement;
  }

  /**
   * Monitor an async operation with automatic cleanup
   */
  static async monitorOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const { result } = await DebugHelpers.measureAsyncOperation(
      name,
      operation,
      metadata
    );
    return result;
  }

  /**
   * Get current active measurements count
   */
  static getActiveMeasurementsCount(): number {
    return this.measurements.size;
  }

  /**
   * Clear all active measurements (useful for cleanup)
   */
  static clearActiveMeasurements(): void {
    this.measurements.clear();
    this.logger.debug('All active performance measurements cleared');
  }

  /**
   * Get measurement by operation ID
   */
  static getMeasurement(operationId: string): PerformanceMeasurement | null {
    return this.measurements.get(operationId) || null;
  }
}

/**
 * Convenience functions for shared performance monitoring
 */

/**
 * Start performance monitoring
 */
export function startPerformanceMonitoring(
  name: string,
  metadata?: Record<string, any>
): string {
  return SharedPerformanceMonitoring.startOperation(name, metadata);
}

/**
 * End performance monitoring
 */
export function endPerformanceMonitoring(
  operationId: string,
  success: boolean = true,
  error?: string
): PerformanceMeasurement | null {
  return SharedPerformanceMonitoring.endOperation(operationId, success, error);
}

/**
 * Monitor async operation
 */
export async function monitorAsyncOperation<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return SharedPerformanceMonitoring.monitorOperation(
    name,
    operation,
    metadata
  );
}
