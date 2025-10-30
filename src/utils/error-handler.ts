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
 * Centralized error handling utilities for CLI and API
 */

import { ProcxError, ErrorCategory, ErrorCodes } from '../types/errors';
import { OutputFormat, LogLevel } from '../types/utils';
import { errorRecovery, RecoveryResult } from './error-recovery';
import { getLogger } from './logger';
import { SharedPerformanceMonitoring } from './shared-logging';

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
  outputFormat: OutputFormat;
  showStackTrace: boolean;
  showRecoverySuggestions: boolean;
  colorOutput: boolean;
  logLevel: LogLevel;
  exitOnError: boolean;
  enableErrorClassification: boolean;
  enableAutoRecovery: boolean;
  enableDetailedContext: boolean;
  enablePerformanceTracking: boolean;
  maxErrorHistorySize: number;
}

/**
 * Error context information for detailed error tracking
 */
export interface ErrorContext {
  operation: string;
  component: string;
  input?: any;
  platform?: string;
  timestamp: Date;
  stackTrace?: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
  metadata?: Record<string, any>;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: number;
  autoRecoverable: boolean;
  userActionRequired: boolean;
  systemImpact: 'none' | 'minimal' | 'moderate' | 'severe';
}

/**
 * Error history entry for tracking and analysis
 */
export interface ErrorHistoryEntry {
  id: string;
  error: ProcxError;
  context: ErrorContext;
  classification: ErrorClassification;
  timestamp: Date;
  resolved: boolean;
  recoveryAttempts: number;
  resolution?: string;
}

/**
 * Default error handler configuration
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  outputFormat: OutputFormat.TABLE,
  showStackTrace: false,
  showRecoverySuggestions: true,
  colorOutput: true,
  logLevel: LogLevel.ERROR,
  exitOnError: true,
  enableErrorClassification: true,
  enableAutoRecovery: true,
  enableDetailedContext: true,
  enablePerformanceTracking: true,
  maxErrorHistorySize: 100,
};

/**
 * Error output formatter
 */
export class ErrorFormatter {
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
  }

  /**
   * Format error for console output
   */
  formatForConsole(error: ProcxError): string {
    const parts: string[] = [];

    // Error header
    const header = this.config.colorOutput
      ? `\x1b[31m✗ Error [${error.code}]:\x1b[0m`
      : `✗ Error [${error.code}]:`;
    parts.push(header);

    // User-friendly message
    const message = this.config.colorOutput
      ? `\x1b[37m${error.getUserMessage()}\x1b[0m`
      : error.getUserMessage();
    parts.push(`  ${message}`);

    // Recovery suggestions
    if (this.config.showRecoverySuggestions) {
      const suggestions = error.getRecoverySuggestions();
      if (suggestions.length > 0) {
        const suggestionHeader = this.config.colorOutput
          ? `\x1b[33mSuggestions:\x1b[0m`
          : 'Suggestions:';
        parts.push(`\n${suggestionHeader}`);
        suggestions.forEach(suggestion => {
          const formattedSuggestion = this.config.colorOutput
            ? `\x1b[36m• ${suggestion}\x1b[0m`
            : `• ${suggestion}`;
          parts.push(`  ${formattedSuggestion}`);
        });
      }
    }

    // Stack trace (if enabled and in debug mode)
    if (this.config.showStackTrace && this.config.logLevel === LogLevel.DEBUG) {
      parts.push(`\nStack trace:\n${error.stack}`);
    }

    // Additional details (if available and in debug mode)
    if (error.details && this.config.logLevel === LogLevel.DEBUG) {
      parts.push(`\nDetails: ${JSON.stringify(error.details, null, 2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Format error for JSON output
   */
  formatForJSON(error: ProcxError): string {
    const errorObj = {
      success: false,
      error: {
        code: error.code,
        category: error.category,
        message: error.message,
        userMessage: error.getUserMessage(),
        recoverable: error.isRecoverable(),
        retryable: error.isRetryable(),
        timestamp: error.timestamp.toISOString(),
        ...(this.config.showRecoverySuggestions && {
          suggestions: error.getRecoverySuggestions(),
        }),
        ...(this.config.showStackTrace && {
          stack: error.stack,
        }),
        ...(error.details && {
          details: error.details,
        }),
      },
    };

    return JSON.stringify(errorObj, null, 2);
  }

  /**
   * Format recovery result for output
   */
  formatRecoveryResult<T>(result: RecoveryResult<T>): string {
    if (result.success) {
      const parts: string[] = [];

      if (result.fallbackUsed || result.recoveryStrategy) {
        const warningHeader = this.config.colorOutput
          ? `\x1b[33m⚠ Warning:\x1b[0m`
          : '⚠ Warning:';
        parts.push(warningHeader);

        if (result.fallbackUsed) {
          parts.push('  Operation succeeded using fallback strategy');
        }

        if (result.recoveryStrategy) {
          parts.push(`  Recovery strategy used: ${result.recoveryStrategy}`);
        }

        if (result.error) {
          parts.push(`  Original error: ${result.error.getUserMessage()}`);
        }
      }

      return parts.join('\n');
    } else {
      return this.formatForConsole(result.error!);
    }
  }
}

/**
 * Centralized error management system with classification and recovery
 */
export class ErrorManagementSystem {
  protected formatter: ErrorFormatter;
  protected config: ErrorHandlerConfig;
  protected logger = getLogger('error-management');
  private errorHistory: Map<string, ErrorHistoryEntry> = new Map();
  private errorStats: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
    this.formatter = new ErrorFormatter(config);
  }

  /**
   * Classify error based on type, severity, and impact
   */
  classifyError(
    error: ProcxError,
    _context?: Partial<ErrorContext>
  ): ErrorClassification {
    const classification: ErrorClassification = {
      category: error.category,
      severity: this.determineSeverity(error),
      priority: this.calculatePriority(error),
      autoRecoverable: this.isAutoRecoverable(error),
      userActionRequired: this.requiresUserAction(error),
      systemImpact: this.assessSystemImpact(error),
    };

    if (this.config.enablePerformanceTracking) {
      this.updateErrorStats(error.code);
    }

    return classification;
  }

  /**
   * Create detailed error context with suggestions
   */
  createErrorContext(
    operation: string,
    component: string,
    error: ProcxError,
    input?: any,
    metadata?: Record<string, any>
  ): ErrorContext {
    return {
      operation,
      component,
      input,
      platform: process.platform,
      timestamp: new Date(),
      ...(error.stack && { stackTrace: error.stack }),
      suggestions: error.getRecoverySuggestions(),
      recoverable: error.isRecoverable(),
      retryable: error.isRetryable(),
      ...(metadata && { metadata }),
    };
  }

  /**
   * Add error to history for tracking and analysis
   */
  protected addToHistory(
    error: ProcxError,
    context: ErrorContext,
    classification: ErrorClassification
  ): string {
    const id = this.generateErrorId();
    const entry: ErrorHistoryEntry = {
      id,
      error,
      context,
      classification,
      timestamp: new Date(),
      resolved: false,
      recoveryAttempts: 0,
    };

    this.errorHistory.set(id, entry);

    // Maintain history size limit
    if (this.errorHistory.size > this.config.maxErrorHistorySize) {
      const oldestId = this.errorHistory.keys().next().value;
      if (oldestId) {
        this.errorHistory.delete(oldestId);
      }
    }

    return id;
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(
    error: ProcxError
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.code) {
      case ErrorCodes.PLATFORM_UNSUPPORTED:
      case ErrorCodes.SYSTEM_CALL_FAILED:
        return 'critical';

      case ErrorCodes.PERMISSION_DENIED:
      case ErrorCodes.PROCESS_ACCESS_DENIED:
        return 'high';

      case ErrorCodes.TIMEOUT:
      case ErrorCodes.PORT_SCAN_FAILED:
      case ErrorCodes.PROCESS_KILL_FAILED:
        return 'medium';

      case ErrorCodes.INVALID_INPUT:
      case ErrorCodes.INVALID_PORT:
      case ErrorCodes.PROCESS_NOT_FOUND:
        return 'low';

      default:
        return 'medium';
    }
  }

  /**
   * Calculate error priority for handling order
   */
  private calculatePriority(error: ProcxError): number {
    const severityWeights = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    const categoryWeights = {
      [ErrorCategory.SYSTEM]: 20,
      [ErrorCategory.PERMISSION]: 15,
      [ErrorCategory.PLATFORM]: 15,
      [ErrorCategory.PROCESS]: 10,
      [ErrorCategory.PORT]: 10,
      [ErrorCategory.TIMEOUT]: 5,
      [ErrorCategory.VALIDATION]: 1,
    };

    const severity = this.determineSeverity(error);
    const severityScore = severityWeights[severity] || 50;
    const categoryScore = categoryWeights[error.category] || 5;

    return severityScore + categoryScore;
  }

  /**
   * Determine if error can be automatically recovered
   */
  private isAutoRecoverable(error: ProcxError): boolean {
    const autoRecoverableCodes = [
      ErrorCodes.TIMEOUT,
      ErrorCodes.PORT_SCAN_FAILED,
      ErrorCodes.PROCESS_NOT_FOUND,
      ErrorCodes.NO_FREE_PORT,
    ];

    return autoRecoverableCodes.includes(error.code) && error.isRecoverable();
  }

  /**
   * Determine if error requires user action
   */
  private requiresUserAction(error: ProcxError): boolean {
    const userActionCodes = [
      ErrorCodes.PERMISSION_DENIED,
      ErrorCodes.PROCESS_ACCESS_DENIED,
      ErrorCodes.INVALID_INPUT,
      ErrorCodes.CONFIGURATION_ERROR,
      ErrorCodes.PLATFORM_UNSUPPORTED,
    ];

    return userActionCodes.includes(error.code);
  }

  /**
   * Assess system impact of the error
   */
  private assessSystemImpact(
    error: ProcxError
  ): 'none' | 'minimal' | 'moderate' | 'severe' {
    switch (error.code) {
      case ErrorCodes.SYSTEM_CALL_FAILED:
      case ErrorCodes.PLATFORM_UNSUPPORTED:
        return 'severe';

      case ErrorCodes.PERMISSION_DENIED:
      case ErrorCodes.PROCESS_ACCESS_DENIED:
        return 'moderate';

      case ErrorCodes.TIMEOUT:
      case ErrorCodes.PORT_SCAN_FAILED:
      case ErrorCodes.PROCESS_KILL_FAILED:
        return 'minimal';

      default:
        return 'none';
    }
  }

  /**
   * Update error statistics for analysis
   */
  private updateErrorStats(errorCode: string): void {
    const current = this.errorStats.get(errorCode) || 0;
    this.errorStats.set(errorCode, current + 1);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorStats);
  }

  /**
   * Get error history
   */
  getErrorHistory(): ErrorHistoryEntry[] {
    return Array.from(this.errorHistory.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Mark error as resolved
   */
  markErrorResolved(errorId: string, resolution: string): boolean {
    const entry = this.errorHistory.get(errorId);
    if (entry) {
      entry.resolved = true;
      entry.resolution = resolution;
      return true;
    }
    return false;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.errorStats.clear();
  }
}

/**
 * Enhanced centralized error handler with management system
 */
export class ErrorHandler extends ErrorManagementSystem {
  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super(config);
  }

  /**
   * Handle error in CLI context with comprehensive management
   */
  handleCliError(
    error: unknown,
    operation: string = 'unknown',
    component: string = 'cli',
    exitCode: number = 1,
    input?: any
  ): never | void {
    const procxError = this.normalizeError(error);

    // Create detailed error context
    const context = this.createErrorContext(
      operation,
      component,
      procxError,
      input
    );

    // Classify error for better handling
    const classification = this.config.enableErrorClassification
      ? this.classifyError(procxError, context)
      : null;

    // Add to error history
    const errorId = this.addToHistory(procxError, context, classification!);

    // Log error with context
    this.logger.error('CLI error occurred', {
      errorId,
      operation,
      component,
      code: procxError.code,
      category: procxError.category,
      classification,
      context: {
        ...context,
        stackTrace: undefined, // Don't log full stack trace
      },
    });

    // Attempt automatic recovery if enabled and applicable
    if (this.config.enableAutoRecovery && classification?.autoRecoverable) {
      this.logger.info('Attempting automatic error recovery', { errorId });
      // Recovery logic would be implemented here
      // For now, we'll just log the attempt
    }

    // Format and display error
    if (this.config.outputFormat === OutputFormat.JSON) {
      const errorOutput = this.formatter.formatForJSON(procxError);
      console.error(errorOutput);
    } else {
      const errorOutput = this.formatter.formatForConsole(procxError);
      console.error(errorOutput);

      // Show additional context in debug mode
      if (
        this.config.logLevel === LogLevel.DEBUG &&
        this.config.enableDetailedContext
      ) {
        const { DebugFormatting } = require('./shared-logging');
        const debugContext = DebugFormatting.formatErrorContext(
          context.operation,
          procxError,
          {
            component: context.component,
            platform: context.platform,
            timestamp: context.timestamp.toISOString(),
            ...(classification && {
              severity: classification.severity,
              priority: classification.priority,
              autoRecoverable: classification.autoRecoverable,
            }),
          }
        );
        console.error('\n' + debugContext);
      }
    }

    if (this.config.exitOnError) {
      process.exit(exitCode);
    }
  }

  /**
   * Handle error in API context with comprehensive management
   */
  handleApiError(
    error: unknown,
    operation: string = 'unknown',
    component: string = 'api',
    input?: any
  ): ProcxError {
    const procxError = this.normalizeError(error);

    // Create detailed error context
    const context = this.createErrorContext(
      operation,
      component,
      procxError,
      input
    );

    // Classify error for better handling
    const classification = this.config.enableErrorClassification
      ? this.classifyError(procxError, context)
      : null;

    // Add to error history
    const errorId = this.addToHistory(procxError, context, classification!);

    // Log error with context
    this.logger.debug('API error occurred', {
      errorId,
      operation,
      component,
      code: procxError.code,
      category: procxError.category,
      classification,
    });

    // Performance tracking
    if (this.config.enablePerformanceTracking) {
      // Record error in shared performance monitoring
      SharedPerformanceMonitoring.startOperation(`error-${operation}`, {
        errorCode: procxError.code,
        errorCategory: procxError.category,
      });
    }

    return procxError;
  }

  /**
   * Handle recovery result
   */
  handleRecoveryResult<T>(result: RecoveryResult<T>): T {
    if (result.success) {
      // Log warning if fallback was used
      if (result.fallbackUsed || result.recoveryStrategy) {
        const warning = this.formatter.formatRecoveryResult(result);
        if (warning) {
          console.warn(warning);
        }
      }
      return result.data!;
    } else {
      throw result.error!;
    }
  }

  /**
   * Execute operation with comprehensive error handling and recovery
   */
  async executeWithHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    component: string,
    fallback?: () => Promise<T>,
    input?: any
  ): Promise<T> {
    const operationId = this.config.enablePerformanceTracking
      ? SharedPerformanceMonitoring.startOperation(operationName, {
          component,
          input,
        })
      : '';

    try {
      const result = await errorRecovery.executeWithRecovery(
        operation,
        fallback
      );

      if (operationId) {
        SharedPerformanceMonitoring.endOperation(operationId, true);
      }

      return this.handleRecoveryResult(result);
    } catch (error) {
      if (operationId) {
        SharedPerformanceMonitoring.endOperation(
          operationId,
          false,
          error instanceof Error ? error.message : String(error)
        );
      }

      // Handle error with full context
      const procxError = this.handleApiError(
        error,
        operationName,
        component,
        input
      );
      throw procxError;
    }
  }

  /**
   * Normalize any error to ProcxError
   */
  private normalizeError(error: unknown): ProcxError {
    if (error instanceof ProcxError) {
      return error;
    }

    // Use the error recovery manager's normalization
    return errorRecovery['normalizeError'](error);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    this.formatter = new ErrorFormatter(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Convenience functions for common error handling patterns
 */

/**
 * Handle CLI error with proper formatting and exit
 */
export function handleCliError(
  error: unknown,
  operation?: string,
  component?: string,
  exitCode: number = 1,
  input?: any
): never {
  globalErrorHandler.handleCliError(
    error,
    operation,
    component,
    exitCode,
    input
  );
  process.exit(exitCode); // Fallback in case exitOnError is false
}

/**
 * Handle API error and return normalized ProcxError
 */
export function handleApiError(
  error: unknown,
  operation?: string,
  component?: string,
  input?: any
): ProcxError {
  return globalErrorHandler.handleApiError(error, operation, component, input);
}

/**
 * Execute operation with comprehensive error handling
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  operationName: string,
  component: string,
  fallback?: () => Promise<T>,
  input?: any
): Promise<T> {
  return globalErrorHandler.executeWithHandling(
    operation,
    operationName,
    component,
    fallback,
    input
  );
}

/**
 * Configure global error handler
 */
export function configureErrorHandler(
  config: Partial<ErrorHandlerConfig>
): void {
  globalErrorHandler.updateConfig(config);
}

/**
 * Create error handler with specific configuration
 */
export function createErrorHandler(
  config: Partial<ErrorHandlerConfig> = {}
): ErrorHandler {
  return new ErrorHandler(config);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  component: string,
  fallback?: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return safeExecute(
      () => fn(...args),
      operationName,
      component,
      fallback ? () => fallback(...args) : undefined,
      args
    );
  };
}

/**
 * Error boundary for synchronous operations
 */
export function tryCatch<T>(
  operation: () => T,
  errorHandler?: (error: unknown) => T
): T {
  try {
    return operation();
  } catch (error) {
    if (errorHandler) {
      return errorHandler(error);
    }
    throw globalErrorHandler.handleApiError(error);
  }
}
