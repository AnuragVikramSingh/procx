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
 * Performance monitoring and metrics collection for procx
 */

import { getLogger } from './logger';

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  slowOperationMs: number;
  memoryWarningMB: number;
  cpuWarningPercent: number;
  maxConcurrentOperations: number;
}

/**
 * Default performance thresholds
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  slowOperationMs: 5000, // 5 seconds
  memoryWarningMB: 100, // 100 MB
  cpuWarningPercent: 80, // 80%
  maxConcurrentOperations: 10,
};

/**
 * Operation metrics interface
 */
export interface OperationMetrics {
  name: string;
  startTime: number;
  endTime?: number | undefined;
  duration?: number | undefined;
  memoryBefore: ReturnType<typeof process.memoryUsage>;
  memoryAfter?: ReturnType<typeof process.memoryUsage> | undefined;
  memoryDelta?: number | undefined;
  success: boolean;
  error?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

/**
 * Performance statistics interface
 */
export interface PerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  slowestOperation: OperationMetrics | null;
  fastestOperation: OperationMetrics | null;
  totalMemoryUsed: number;
  peakMemoryUsage: number;
  currentMemoryUsage: ReturnType<typeof process.memoryUsage>;
  uptime: number;
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private operations: Map<string, OperationMetrics> = new Map();
  private completedOperations: OperationMetrics[] = [];
  private logger = getLogger('performance');
  private startTime: number = Date.now();
  private peakMemory: number = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...thresholds };
    this.updatePeakMemory();
  }

  /**
   * Start monitoring an operation
   */
  startOperation(name: string, metadata?: Record<string, any>): string {
    const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check concurrent operations limit
    if (this.operations.size >= this.thresholds.maxConcurrentOperations) {
      this.logger.warn(
        `Maximum concurrent operations reached (${this.thresholds.maxConcurrentOperations})`,
        {
          currentOperations: this.operations.size,
          newOperation: name,
        }
      );
    }

    const metrics: OperationMetrics = {
      name,
      startTime: performance.now(),
      memoryBefore: process.memoryUsage(),
      success: false,
      ...(metadata && { metadata }),
    };

    this.operations.set(operationId, metrics);
    this.logger.trace(`Operation started: ${name}`, { operationId, metadata });

    return operationId;
  }

  /**
   * End monitoring an operation
   */
  endOperation(
    operationId: string,
    success: boolean = true,
    error?: string
  ): OperationMetrics | null {
    const metrics = this.operations.get(operationId);
    if (!metrics) {
      this.logger.warn(`Operation not found: ${operationId}`);
      return null;
    }

    // Complete the metrics
    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.memoryAfter = process.memoryUsage();
    metrics.memoryDelta =
      metrics.memoryAfter.heapUsed - metrics.memoryBefore.heapUsed;
    metrics.success = success;
    if (error) {
      metrics.error = error;
    }

    // Update peak memory
    this.updatePeakMemory();

    // Check for performance issues
    this.checkPerformanceThresholds(metrics);

    // Move to completed operations
    this.operations.delete(operationId);
    this.completedOperations.push(metrics);

    // Keep only recent operations (last 1000)
    if (this.completedOperations.length > 1000) {
      this.completedOperations = this.completedOperations.slice(-500);
    }

    this.logger.trace(`Operation completed: ${metrics.name}`, {
      operationId,
      duration: metrics.duration,
      success: metrics.success,
      memoryDelta: metrics.memoryDelta,
    });

    return metrics;
  }

  /**
   * Monitor an async operation automatically
   */
  async monitorOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const operationId = this.startOperation(name, metadata);

    try {
      const result = await operation();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(
        operationId,
        false,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(metrics: OperationMetrics): void {
    // Check operation duration
    if (
      metrics.duration &&
      metrics.duration > this.thresholds.slowOperationMs
    ) {
      this.logger.warn(`Slow operation detected: ${metrics.name}`, {
        duration: metrics.duration,
        threshold: this.thresholds.slowOperationMs,
        operationId: metrics.name,
      });
    }

    // Check memory usage
    if (metrics.memoryAfter) {
      const memoryMB = metrics.memoryAfter.heapUsed / (1024 * 1024);
      if (memoryMB > this.thresholds.memoryWarningMB) {
        this.logger.warn(`High memory usage detected: ${metrics.name}`, {
          memoryMB: memoryMB.toFixed(2),
          threshold: this.thresholds.memoryWarningMB,
          memoryDelta: metrics.memoryDelta
            ? (metrics.memoryDelta / (1024 * 1024)).toFixed(2)
            : 'unknown',
        });
      }
    }
  }

  /**
   * Update peak memory usage
   */
  private updatePeakMemory(): void {
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.peakMemory) {
      this.peakMemory = currentMemory;
    }
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    const totalOps = this.completedOperations.length;
    const successfulOps = this.completedOperations.filter(
      op => op.success
    ).length;
    const failedOps = totalOps - successfulOps;

    const durations = this.completedOperations
      .filter(op => op.duration !== undefined)
      .map(op => op.duration!);

    const averageDuration =
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) /
          durations.length
        : 0;

    const slowestOperation =
      durations.length > 0
        ? this.completedOperations.reduce((slowest, current) =>
            (current.duration || 0) > (slowest?.duration || 0)
              ? current
              : slowest
          )
        : null;

    const fastestOperation =
      durations.length > 0
        ? this.completedOperations.reduce((fastest, current) =>
            (current.duration || Infinity) < (fastest?.duration || Infinity)
              ? current
              : fastest
          )
        : null;

    const totalMemoryUsed = this.completedOperations.reduce(
      (total, op) => total + (op.memoryDelta || 0),
      0
    );

    return {
      totalOperations: totalOps,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      averageDuration,
      slowestOperation,
      fastestOperation,
      totalMemoryUsed,
      peakMemoryUsage: this.peakMemory,
      currentMemoryUsage: process.memoryUsage(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get operations by name
   */
  getOperationsByName(name: string): OperationMetrics[] {
    return this.completedOperations.filter(op => op.name === name);
  }

  /**
   * Get slow operations
   */
  getSlowOperations(thresholdMs?: number): OperationMetrics[] {
    const threshold = thresholdMs || this.thresholds.slowOperationMs;
    return this.completedOperations.filter(
      op => op.duration && op.duration > threshold
    );
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): OperationMetrics[] {
    return this.completedOperations.filter(op => !op.success);
  }

  /**
   * Get memory-intensive operations
   */
  getMemoryIntensiveOperations(thresholdMB?: number): OperationMetrics[] {
    const threshold =
      (thresholdMB || this.thresholds.memoryWarningMB) * 1024 * 1024;
    return this.completedOperations.filter(
      op => op.memoryDelta && Math.abs(op.memoryDelta) > threshold
    );
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStats();
    const slowOps = this.getSlowOperations();
    const failedOps = this.getFailedOperations();
    const memoryIntensiveOps = this.getMemoryIntensiveOperations();

    const report = {
      timestamp: new Date().toISOString(),
      uptime: stats.uptime,
      summary: {
        totalOperations: stats.totalOperations,
        successRate:
          stats.totalOperations > 0
            ? (
                (stats.successfulOperations / stats.totalOperations) *
                100
              ).toFixed(2) + '%'
            : '0%',
        averageDuration: stats.averageDuration.toFixed(2) + 'ms',
        peakMemoryUsage:
          (stats.peakMemoryUsage / (1024 * 1024)).toFixed(2) + 'MB',
        currentMemoryUsage:
          (stats.currentMemoryUsage.heapUsed / (1024 * 1024)).toFixed(2) + 'MB',
      },
      performance: {
        slowestOperation:
          stats.slowestOperation && stats.slowestOperation.duration
            ? {
                name: stats.slowestOperation.name,
                duration: stats.slowestOperation.duration.toFixed(2) + 'ms',
              }
            : null,
        fastestOperation:
          stats.fastestOperation && stats.fastestOperation.duration
            ? {
                name: stats.fastestOperation.name,
                duration: stats.fastestOperation.duration.toFixed(2) + 'ms',
              }
            : null,
      },
      issues: {
        slowOperations: slowOps.length,
        failedOperations: failedOps.length,
        memoryIntensiveOperations: memoryIntensiveOps.length,
      },
      thresholds: this.thresholds,
      activeOperations: this.operations.size,
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.completedOperations = [];
    this.operations.clear();
    this.peakMemory = process.memoryUsage().heapUsed;
    this.startTime = Date.now();
    this.logger.debug('Performance metrics cleared');
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.debug('Performance thresholds updated', thresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience functions for performance monitoring
 */

/**
 * Monitor an async operation
 */
export async function monitorPerformance<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.monitorOperation(name, operation, metadata);
}

/**
 * Start performance monitoring for an operation
 */
export function startPerformanceMonitoring(
  name: string,
  metadata?: Record<string, any>
): string {
  return performanceMonitor.startOperation(name, metadata);
}

/**
 * End performance monitoring for an operation
 */
export function endPerformanceMonitoring(
  operationId: string,
  success: boolean = true,
  error?: string
): OperationMetrics | null {
  return performanceMonitor.endOperation(operationId, success, error);
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): PerformanceStats {
  return performanceMonitor.getStats();
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(): string {
  return performanceMonitor.generateReport();
}

/**
 * Configure performance thresholds
 */
export function configurePerformanceThresholds(
  thresholds: Partial<PerformanceThresholds>
): void {
  performanceMonitor.updateThresholds(thresholds);
}

/**
 * Decorator for automatic performance monitoring
 */
export function monitorPerf(name?: string, metadata?: Record<string, any>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return monitorPerformance(
        operationName,
        () => originalMethod.apply(this, args),
        metadata
      );
    };

    return descriptor;
  };
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private snapshots: Array<{
    timestamp: Date;
    usage: ReturnType<typeof process.memoryUsage>;
  }> = [];
  private logger = getLogger('memory');

  /**
   * Take a memory snapshot
   */
  snapshot(label?: string): ReturnType<typeof process.memoryUsage> {
    const usage = process.memoryUsage();
    this.snapshots.push({ timestamp: new Date(), usage });

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-50);
    }

    this.logger.trace(`Memory snapshot taken${label ? ` (${label})` : ''}`, {
      heapUsed: (usage.heapUsed / (1024 * 1024)).toFixed(2) + 'MB',
      heapTotal: (usage.heapTotal / (1024 * 1024)).toFixed(2) + 'MB',
      external: (usage.external / (1024 * 1024)).toFixed(2) + 'MB',
    });

    return usage;
  }

  /**
   * Get memory usage trend
   */
  getTrend(): Array<{ timestamp: Date; heapUsedMB: number }> {
    return this.snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      heapUsedMB: snapshot.usage.heapUsed / (1024 * 1024),
    }));
  }

  /**
   * Check for memory leaks
   */
  checkForLeaks(): { hasLeak: boolean; trend: number; message: string } {
    if (this.snapshots.length < 10) {
      return {
        hasLeak: false,
        trend: 0,
        message: 'Insufficient data for leak detection',
      };
    }

    const recent = this.snapshots.slice(-10);
    const first = recent[0]?.usage.heapUsed || 0;
    const last = recent[recent.length - 1]?.usage.heapUsed || 0;
    const trend = (last - first) / (1024 * 1024); // MB

    const hasLeak = trend > 10; // More than 10MB increase
    const message = hasLeak
      ? `Potential memory leak detected: ${trend.toFixed(2)}MB increase over last 10 snapshots`
      : `Memory usage stable: ${trend.toFixed(2)}MB change over last 10 snapshots`;

    return { hasLeak, trend, message };
  }

  /**
   * Clear snapshots
   */
  clear(): void {
    this.snapshots = [];
    this.logger.debug('Memory snapshots cleared');
  }
}

/**
 * Global memory tracker instance
 */
export const memoryTracker = new MemoryTracker();
