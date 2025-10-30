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

import {
  ProcxError,
  ErrorCodes,
  ErrorCategory,
  ProcessError,
  PortError,
  SystemError,
  TimeoutError,
  PermissionError,
  PlatformError,
} from '../types/errors';
import { RetryConfig, ValidationResult } from '../types/utils';
// Removed unused retry import
import { getLogger } from './logger';
// Removed unused performanceMonitor import

export interface ErrorRecoveryConfig {
  enableRetry: boolean;
  retryConfig: RetryConfig;
  enableFallback: boolean;
  enableGracefulDegradation: boolean;
  logErrors: boolean;
  userFriendlyMessages: boolean;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableAdaptiveRetry: boolean;
  maxConcurrentRecoveries: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerInfo {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface FallbackStrategyInfo {
  name: string;
  description: string;
  priority: number;
  applicable: (error: ProcxError) => boolean;
  execute: () => Promise<any>;
}

export interface RecoveryAttemptResult<T> {
  success: boolean;
  data?: T;
  error?: ProcxError;
  strategy: string;
  attemptNumber: number;
  duration: number;
  fallbackUsed: boolean;
}

export const DEFAULT_ERROR_RECOVERY_CONFIG: ErrorRecoveryConfig = {
  enableRetry: true,
  retryConfig: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 5000,
  },
  enableFallback: true,
  enableGracefulDegradation: true,
  logErrors: true,
  userFriendlyMessages: true,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000, // 1 minute
  enableAdaptiveRetry: true,
  maxConcurrentRecoveries: 10,
};

export interface RecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: ProcxError;
  recoveryStrategy?: string;
  attempts: number;
  fallbackUsed: boolean;
}

export type FallbackStrategy<T> = () => Promise<T>;

export class ErrorRecoveryManager {
  private config: ErrorRecoveryConfig;
  private logger = getLogger('error-recovery');
  private circuitBreakers = new Map<string, CircuitBreakerInfo>();
  private fallbackStrategies = new Map<string, FallbackStrategyInfo[]>();
  private activeRecoveries = new Set<string>();
  private recoveryStats = new Map<
    string,
    { attempts: number; successes: number }
  >();

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_RECOVERY_CONFIG, ...config };
    this.initializeFallbackStrategies();
  }

  private initializeFallbackStrategies(): void {
    this.registerFallbackStrategy('process', {
      name: 'basic-process-list',
      description: 'Use basic process listing when advanced features fail',
      priority: 1,
      applicable: error => error.category === ErrorCategory.PROCESS,
      execute: async () => {
        return { processes: [], message: 'Using basic process listing' };
      },
    });

    this.registerFallbackStrategy('process', {
      name: 'cached-process-info',
      description: 'Return cached process information when live data fails',
      priority: 2,
      applicable: error =>
        error.category === ErrorCategory.PROCESS &&
        error.code === ErrorCodes.PROCESS_NOT_FOUND,
      execute: async () => {
        return {
          processes: [],
          cached: true,
          message: 'Using cached process data',
        };
      },
    });

    this.registerFallbackStrategy('port', {
      name: 'alternative-port-scan',
      description: 'Use alternative port scanning method',
      priority: 1,
      applicable: error =>
        error.category === ErrorCategory.PORT &&
        error.code === ErrorCodes.PORT_SCAN_FAILED,
      execute: async () => {
        return {
          ports: [],
          method: 'alternative',
          message: 'Using alternative port scan',
        };
      },
    });

    this.registerFallbackStrategy('port', {
      name: 'random-port-selection',
      description: 'Select random available port when specific port fails',
      priority: 2,
      applicable: error =>
        error.category === ErrorCategory.PORT &&
        error.code === ErrorCodes.PORT_NOT_AVAILABLE,
      execute: async () => {
        const randomPort = Math.floor(Math.random() * (65535 - 49152) + 49152);
        return { port: randomPort, message: 'Using random available port' };
      },
    });

    this.registerFallbackStrategy('system', {
      name: 'limited-system-info',
      description: 'Provide limited system information when full access fails',
      priority: 1,
      applicable: error =>
        error.category === ErrorCategory.SYSTEM ||
        error.category === ErrorCategory.PERMISSION,
      execute: async () => {
        return {
          system: { platform: process.platform, arch: process.arch },
          limited: true,
          message: 'Using limited system information',
        };
      },
    });
  }

  registerFallbackStrategy(
    category: string,
    strategy: FallbackStrategyInfo
  ): void {
    if (!this.fallbackStrategies.has(category)) {
      this.fallbackStrategies.set(category, []);
    }

    const strategies = this.fallbackStrategies.get(category)!;
    strategies.push(strategy);

    strategies.sort((a, b) => b.priority - a.priority);
  }

  private getCircuitBreakerState(operationKey: string): CircuitBreakerInfo {
    if (!this.circuitBreakers.has(operationKey)) {
      this.circuitBreakers.set(operationKey, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
      });
    }
    return this.circuitBreakers.get(operationKey)!;
  }

  private updateCircuitBreaker(operationKey: string, success: boolean): void {
    if (!this.config.enableCircuitBreaker) return;

    const breaker = this.getCircuitBreakerState(operationKey);

    if (success) {
      breaker.failureCount = 0;
      if (breaker.state === CircuitBreakerState.HALF_OPEN) {
        breaker.state = CircuitBreakerState.CLOSED;
        this.logger.info('Circuit breaker closed', { operationKey });
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();

      if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        breaker.nextAttemptTime = new Date(
          Date.now() + this.config.circuitBreakerTimeout
        );
        this.logger.warn('Circuit breaker opened', {
          operationKey,
          failureCount: breaker.failureCount,
        });
      }
    }
  }

  private shouldAttemptOperation(operationKey: string): boolean {
    if (!this.config.enableCircuitBreaker) return true;

    const breaker = this.getCircuitBreakerState(operationKey);

    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (
          breaker.nextAttemptTime &&
          Date.now() >= breaker.nextAttemptTime.getTime()
        ) {
          breaker.state = CircuitBreakerState.HALF_OPEN;
          this.logger.info('Circuit breaker half-open', { operationKey });
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  // Calculate adaptive retry delay based on error history
  private calculateAdaptiveDelay(
    baseDelay: number,
    attempt: number,
    errorCode: string
  ): number {
    if (!this.config.enableAdaptiveRetry) {
      return (
        baseDelay *
        Math.pow(this.config.retryConfig.backoffMultiplier, attempt - 1)
      );
    }

    const stats = this.recoveryStats.get(errorCode);
    if (!stats || stats.attempts === 0) {
      return (
        baseDelay *
        Math.pow(this.config.retryConfig.backoffMultiplier, attempt - 1)
      );
    }

    const successRate = stats.successes / stats.attempts;
    const adaptiveFactor = successRate < 0.5 ? 1.5 : 0.8;

    return Math.min(
      baseDelay *
        Math.pow(this.config.retryConfig.backoffMultiplier, attempt - 1) *
        adaptiveFactor,
      this.config.retryConfig.maxDelayMs
    );
  }

  private updateRecoveryStats(errorCode: string, success: boolean): void {
    if (!this.recoveryStats.has(errorCode)) {
      this.recoveryStats.set(errorCode, { attempts: 0, successes: 0 });
    }

    const stats = this.recoveryStats.get(errorCode)!;
    stats.attempts++;
    if (success) {
      stats.successes++;
    }
  }

  // Execute operation with comprehensive error recovery including circuit breaker and fallback strategies
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    fallbackStrategy?: FallbackStrategy<T>,
    customConfig?: Partial<ErrorRecoveryConfig>,
    operationKey?: string
  ): Promise<RecoveryResult<T>> {
    const effectiveConfig = { ...this.config, ...customConfig };
    const opKey = operationKey || 'default';
    const recoveryId = `${opKey}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Check concurrent recovery limit
    if (this.activeRecoveries.size >= effectiveConfig.maxConcurrentRecoveries) {
      this.logger.warn('Max concurrent recoveries reached', {
        active: this.activeRecoveries.size,
        max: effectiveConfig.maxConcurrentRecoveries,
      });
      throw new SystemError(
        'System overloaded: too many concurrent recovery operations',
        ErrorCodes.SYSTEM_CALL_FAILED,
        { activeRecoveries: this.activeRecoveries.size }
      );
    }

    this.activeRecoveries.add(recoveryId);
    let lastError: ProcxError | undefined;
    let attempts = 0;
    const startTime = performance.now();

    try {
      // Check circuit breaker
      if (!this.shouldAttemptOperation(opKey)) {
        const breaker = this.getCircuitBreakerState(opKey);
        throw new SystemError(
          'Operation blocked by circuit breaker',
          ErrorCodes.SYSTEM_CALL_FAILED,
          {
            circuitBreakerState: breaker.state,
            nextAttemptTime: breaker.nextAttemptTime,
          }
        );
      }

      // Try the main operation with enhanced retry logic
      if (effectiveConfig.enableRetry) {
        try {
          const result = await this.executeWithEnhancedRetry(
            operation,
            effectiveConfig.retryConfig,
            opKey
          );

          this.updateCircuitBreaker(opKey, true);
          this.updateRecoveryStats(opKey, true);

          return {
            success: true,
            data: result,
            attempts: attempts + 1,
            fallbackUsed: false,
          };
        } catch (error) {
          lastError = this.normalizeError(error);
          attempts = effectiveConfig.retryConfig.maxAttempts;
          this.updateCircuitBreaker(opKey, false);
          this.updateRecoveryStats(opKey, false);
        }
      } else {
        try {
          const result = await operation();
          this.updateCircuitBreaker(opKey, true);
          this.updateRecoveryStats(opKey, true);

          return {
            success: true,
            data: result,
            attempts: 1,
            fallbackUsed: false,
          };
        } catch (error) {
          lastError = this.normalizeError(error);
          attempts = 1;
          this.updateCircuitBreaker(opKey, false);
          this.updateRecoveryStats(opKey, false);
        }
      }

      // Try registered fallback strategies
      if (effectiveConfig.enableFallback && lastError) {
        const fallbackResult = await this.tryFallbackStrategies(
          lastError,
          opKey
        );
        if (fallbackResult.success) {
          return {
            success: true,
            data: fallbackResult.data as T,
            error: lastError,
            ...(fallbackResult.recoveryStrategy && {
              recoveryStrategy: fallbackResult.recoveryStrategy,
            }),
            attempts,
            fallbackUsed: true,
          };
        }
      }

      // Try provided fallback strategy
      if (fallbackStrategy && lastError) {
        try {
          const result = await fallbackStrategy();
          return {
            success: true,
            data: result,
            error: lastError,
            recoveryStrategy: 'custom_fallback',
            attempts,
            fallbackUsed: true,
          };
        } catch (fallbackError) {
          this.logger.warn('Custom fallback strategy failed', {
            operationKey: opKey,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          });
        }
      }

      // Apply graceful degradation if enabled
      if (effectiveConfig.enableGracefulDegradation && lastError) {
        const degradedResult = this.applyGracefulDegradation(lastError);
        if (degradedResult) {
          return {
            success: true,
            data: degradedResult as T,
            error: lastError,
            recoveryStrategy: 'graceful_degradation',
            attempts,
            fallbackUsed: false,
          };
        }
      }

      // All recovery strategies failed
      return {
        success: false,
        error:
          lastError ||
          new ProcxError(
            'Unknown error occurred',
            ErrorCodes.UNKNOWN_ERROR,
            ErrorCategory.SYSTEM
          ),
        attempts,
        fallbackUsed: false,
      };
    } finally {
      this.activeRecoveries.delete(recoveryId);
      const duration = performance.now() - startTime;

      this.logger.debug('Recovery operation completed', {
        operationKey: opKey,
        recoveryId,
        duration,
        attempts,
        success: lastError === undefined,
      });
    }
  }

  private async executeWithEnhancedRetry<T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
    operationKey: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === retryConfig.maxAttempts) {
          throw lastError;
        }

        // Calculate adaptive delay
        const delay = this.calculateAdaptiveDelay(
          retryConfig.delayMs,
          attempt,
          operationKey
        );

        this.logger.debug('Retry attempt failed, waiting before next attempt', {
          operationKey,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private async tryFallbackStrategies<T>(
    error: ProcxError,
    operationKey: string
  ): Promise<RecoveryResult<T>> {
    const categoryStrategies =
      this.fallbackStrategies.get(error.category) || [];
    const applicableStrategies = categoryStrategies.filter(strategy =>
      strategy.applicable(error)
    );

    for (const strategy of applicableStrategies) {
      try {
        this.logger.debug('Trying fallback strategy', {
          operationKey,
          strategy: strategy.name,
          description: strategy.description,
        });

        const result = await strategy.execute();

        this.logger.info('Fallback strategy succeeded', {
          operationKey,
          strategy: strategy.name,
        });

        return {
          success: true,
          data: result as T,
          recoveryStrategy: strategy.name,
          attempts: 0,
          fallbackUsed: true,
        };
      } catch (fallbackError) {
        this.logger.warn('Fallback strategy failed', {
          operationKey,
          strategy: strategy.name,
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
      }
    }

    return {
      success: false,
      error,
      attempts: 0,
      fallbackUsed: false,
    };
  }

  // Normalize any error to a ProcxError with intelligent categorization
  private normalizeError(error: unknown): ProcxError {
    if (error instanceof ProcxError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('permission') || message.includes('access denied')) {
        return new PermissionError(error.message, { originalError: error });
      }

      if (message.includes('timeout') || message.includes('timed out')) {
        return new TimeoutError(error.message, { originalError: error });
      }

      if (message.includes('port') || message.includes('address')) {
        return new PortError(error.message, ErrorCodes.PORT_SCAN_FAILED, {
          originalError: error,
        });
      }

      if (message.includes('process') || message.includes('pid')) {
        return new ProcessError(error.message, ErrorCodes.PROCESS_NOT_FOUND, {
          originalError: error,
        });
      }

      if (message.includes('platform') || message.includes('unsupported')) {
        return new PlatformError(error.message, { originalError: error });
      }

      return new SystemError(error.message, ErrorCodes.SYSTEM_CALL_FAILED, {
        originalError: error,
      });
    }

    return new ProcxError(
      String(error) || 'Unknown error occurred',
      ErrorCodes.UNKNOWN_ERROR,
      ErrorCategory.SYSTEM,
      { originalError: error }
    );
  }

  // Apply graceful degradation based on error type with enhanced strategies
  private applyGracefulDegradation<T>(error: ProcxError): T | null {
    this.logger.info('Applying graceful degradation', {
      errorCode: error.code,
      category: error.category,
    });

    switch (error.category) {
      case ErrorCategory.PERMISSION:
        return this.createLimitedResult(error) as T;

      case ErrorCategory.TIMEOUT:
        return this.createPartialResult(error) as T;

      case ErrorCategory.PLATFORM:
        return this.createBasicResult(error) as T;

      case ErrorCategory.PROCESS:
        return this.createProcessFallbackResult(error) as T;

      case ErrorCategory.PORT:
        return this.createPortFallbackResult(error) as T;

      case ErrorCategory.SYSTEM:
        return this.createSystemFallbackResult(error) as T;

      default:
        return this.createGenericFallbackResult(error) as T;
    }
  }

  private createLimitedResult(error: ProcxError): any {
    switch (error.code) {
      case ErrorCodes.PROCESS_ACCESS_DENIED:
        return {
          processes: [],
          limited: true,
          message:
            'Limited access: Some processes may be hidden due to insufficient permissions',
          suggestion:
            'Try running with elevated privileges for complete results',
          degradationLevel: 'high',
        };

      case ErrorCodes.PERMISSION_DENIED:
        return {
          data: {},
          limited: true,
          message: 'Access denied: Returning available information only',
          suggestion:
            'Check permissions and try again with elevated privileges',
          degradationLevel: 'high',
        };

      default:
        return {
          limited: true,
          message: 'Permission error: Limited functionality available',
          degradationLevel: 'medium',
        };
    }
  }

  private createPartialResult(error: ProcxError): any {
    return {
      partial: true,
      data: {},
      message: 'Operation timed out: Returning available results',
      suggestion: 'Try increasing timeout or filtering results',
      degradationLevel: 'medium',
      timeout: true,
      originalTimeout: error.details?.timeout,
    };
  }

  private createBasicResult(_error?: ProcxError): any {
    return {
      basic: true,
      data: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
      message: 'Using basic cross-platform functionality',
      suggestion:
        'Some advanced features may not be available on this platform',
      degradationLevel: 'high',
      unsupportedPlatform: true,
    };
  }

  private createProcessFallbackResult(error: ProcxError): any {
    switch (error.code) {
      case ErrorCodes.PROCESS_NOT_FOUND:
        return {
          processes: [],
          message: 'Process not found: Returning empty result',
          suggestion: 'Verify process ID or name and try again',
          degradationLevel: 'low',
        };

      case ErrorCodes.PROCESS_KILL_FAILED:
        return {
          killed: false,
          message: 'Process termination failed: Process may still be running',
          suggestion: 'Try using force kill or check process status',
          degradationLevel: 'medium',
        };

      default:
        return {
          processes: [],
          message: 'Process operation failed: Using fallback data',
          degradationLevel: 'medium',
        };
    }
  }

  private createPortFallbackResult(error: ProcxError): any {
    switch (error.code) {
      case ErrorCodes.PORT_NOT_AVAILABLE: {
        const alternativePorts = this.generateAlternativePorts();
        return {
          port: null,
          alternatives: alternativePorts,
          message: 'Port not available: Suggested alternative ports',
          suggestion: 'Try one of the suggested alternative ports',
          degradationLevel: 'low',
        };
      }
      case ErrorCodes.PORT_SCAN_FAILED:
        return {
          ports: [],
          message: 'Port scan failed: Unable to retrieve port information',
          suggestion: 'Check network connectivity and try again',
          degradationLevel: 'high',
        };

      case ErrorCodes.NO_FREE_PORT:
        return {
          port: null,
          message: 'No free ports found in range',
          suggestion: 'Try a different port range or close unused applications',
          degradationLevel: 'medium',
        };

      default:
        return {
          ports: [],
          message: 'Port operation failed: Using fallback data',
          degradationLevel: 'medium',
        };
    }
  }

  private createSystemFallbackResult(_error?: ProcxError): any {
    return {
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
      limited: true,
      message: 'System call failed: Using basic system information',
      suggestion: 'Check system resources and permissions',
      degradationLevel: 'high',
    };
  }

  private createGenericFallbackResult(error: ProcxError): any {
    return {
      data: null,
      error: true,
      message: `Operation failed: ${error.getUserMessage()}`,
      suggestions: error.getRecoverySuggestions(),
      degradationLevel: 'high',
      fallback: true,
    };
  }

  private generateAlternativePorts(): number[] {
    const alternatives: number[] = [];
    const commonPorts = [3000, 3001, 8000, 8080, 8081, 9000, 9001];

    alternatives.push(...commonPorts);

    for (let i = 0; i < 3; i++) {
      const randomPort = Math.floor(Math.random() * (65535 - 49152) + 49152);
      if (!alternatives.includes(randomPort)) {
        alternatives.push(randomPort);
      }
    }

    return alternatives.slice(0, 5);
  }

  getUserFriendlyMessage(error: ProcxError): string {
    const baseMessage = error.getUserMessage();
    const suggestions = this.getRecoverySuggestions(error);

    if (suggestions.length > 0) {
      return `${baseMessage}\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
    }

    return baseMessage;
  }

  private getRecoverySuggestions(error: ProcxError): string[] {
    const suggestions: string[] = [];

    switch (error.code) {
      case ErrorCodes.PERMISSION_DENIED:
        suggestions.push(
          'Run the command with elevated privileges (sudo on Unix, Run as Administrator on Windows)'
        );
        suggestions.push(
          'Check if you have the necessary permissions to access process information'
        );
        break;

      case ErrorCodes.PROCESS_NOT_FOUND:
        suggestions.push('Verify the process ID or name is correct');
        suggestions.push('Check if the process is still running');
        suggestions.push(
          'Try listing all processes to find the correct identifier'
        );
        break;

      case ErrorCodes.INVALID_PORT:
        suggestions.push('Use a port number between 1 and 65535');
        suggestions.push('Check if the port number is typed correctly');
        break;

      case ErrorCodes.PORT_NOT_AVAILABLE:
        suggestions.push('Try a different port number');
        suggestions.push('Use the free port finder to get an available port');
        break;

      case ErrorCodes.TIMEOUT:
        suggestions.push('Increase the timeout value');
        suggestions.push('Try filtering results to reduce processing time');
        suggestions.push('Check system load and try again later');
        break;

      case ErrorCodes.PLATFORM_UNSUPPORTED:
        suggestions.push(
          "Check if there's an updated version that supports your platform"
        );
        suggestions.push('Use basic commands that work across all platforms');
        break;

      case ErrorCodes.SYSTEM_CALL_FAILED:
        suggestions.push('Check system resources and try again');
        suggestions.push('Verify the system is not under heavy load');
        suggestions.push('Try restarting the application');
        break;
    }

    return suggestions;
  }

  validateWithRecovery<T>(
    value: T,
    validator: (value: T) => ValidationResult<T>
  ): ValidationResult<T> {
    const result = validator(value);

    if (!result.isValid && result.error) {
      const suggestions = this.getValidationSuggestions(result.error);
      return {
        ...result,
        warnings: suggestions,
      };
    }

    return result;
  }

  private getValidationSuggestions(error: string): string[] {
    const suggestions: string[] = [];
    const lowerError = error.toLowerCase();

    if (lowerError.includes('port')) {
      suggestions.push('Use a number between 1 and 65535');
      suggestions.push(
        'Common ports: 80 (HTTP), 443 (HTTPS), 3000 (development)'
      );
    }

    if (lowerError.includes('pid')) {
      suggestions.push('Use a positive integer');
      suggestions.push('Get valid PIDs using the list command');
    }

    if (lowerError.includes('range')) {
      suggestions.push('Use format: start-end (e.g., 3000-4000)');
      suggestions.push('Ensure start port is less than end port');
    }

    return suggestions;
  }

  getRecoveryStats(): Record<
    string,
    { attempts: number; successes: number; successRate: number }
  > {
    const stats: Record<
      string,
      { attempts: number; successes: number; successRate: number }
    > = {};

    for (const [key, value] of this.recoveryStats.entries()) {
      stats[key] = {
        attempts: value.attempts,
        successes: value.successes,
        successRate: value.attempts > 0 ? value.successes / value.attempts : 0,
      };
    }

    return stats;
  }

  getCircuitBreakerStatus(): Record<string, CircuitBreakerInfo> {
    return Object.fromEntries(this.circuitBreakers);
  }

  resetCircuitBreaker(operationKey: string): void {
    this.circuitBreakers.delete(operationKey);
    this.logger.info('Circuit breaker reset', { operationKey });
  }

  clearStats(): void {
    this.recoveryStats.clear();
    this.circuitBreakers.clear();
    this.logger.info('Recovery statistics cleared');
  }
}

export const errorRecovery = new ErrorRecoveryManager();

export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  fallback?: FallbackStrategy<T>,
  config?: Partial<ErrorRecoveryConfig>,
  operationKey?: string
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeWithRecovery(
    operation,
    fallback,
    config,
    operationKey
  );
}

export function getUserFriendlyError(error: unknown): string {
  const procxError = errorRecovery['normalizeError'](error);
  return errorRecovery.getUserFriendlyMessage(procxError);
}

export function validateWithSuggestions<T>(
  value: T,
  validator: (value: T) => ValidationResult<T>
): ValidationResult<T> {
  return errorRecovery.validateWithRecovery(value, validator);
}
