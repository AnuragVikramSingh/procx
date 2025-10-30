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
 * @fileoverview System monitoring functionality for procx
 * @module core/system-monitor
 */

import {
  SystemInfo,
  ProcessInfo,
  ProcessFilters,
  ProcessMetrics,
  ResourceUsageReport,
  SystemError,
  ErrorCodes,
} from '../../types';
import { PlatformAdapterFactory } from '../../platform';

/**
 * System monitor interface for tracking system resources and processes
 */
export interface SystemMonitor {
  /**
   * Get current system information and metrics
   */
  getSystemInfo(): Promise<SystemInfo>;

  /**
   * Start monitoring processes with real-time updates
   */
  startWatchMode(filters?: ProcessFilters): AsyncGenerator<ProcessInfo[]>;

  /**
   * Get performance metrics for a specific process
   */
  getProcessMetrics(pid: number): Promise<ProcessMetrics>;

  /**
   * Track resource usage over a specified duration
   */
  trackResourceUsage(duration: number): Promise<ResourceUsageReport>;
}

/**
 * Implementation of system monitoring functionality
 */
export class SystemMonitorImpl implements SystemMonitor {
  private platformAdapter: any = null;

  constructor() {
    // Don't call async method in constructor
  }

  /**
   * Initialize the platform adapter
   */
  private async initializePlatformAdapter(): Promise<void> {
    if (!this.platformAdapter) {
      const factory = PlatformAdapterFactory.getInstance();
      this.platformAdapter = await factory.createAdapter();
    }
  }

  /**
   * Get current system information and metrics
   */
  async getSystemInfo(): Promise<SystemInfo> {
    try {
      await this.initializePlatformAdapter();
      
      const systemMetrics = await this.platformAdapter.getSystemMetrics();
      
      return {
        platform: process.platform,
        arch: process.arch,
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: {
          total: systemMetrics.memoryUsage.total,
          used: systemMetrics.memoryUsage.used,
          free: systemMetrics.memoryUsage.free,
          percentage: (systemMetrics.memoryUsage.used / systemMetrics.memoryUsage.total) * 100,
        },
        loadAverage: systemMetrics.loadAverage,
        uptime: systemMetrics.uptime,
        processCount: systemMetrics.processCount,
      };
    } catch (error) {
      throw new SystemError(
        'Failed to get system information',
        ErrorCodes.SYSTEM_CALL_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Start monitoring processes with real-time updates
   */
  async* startWatchMode(filters?: ProcessFilters): AsyncGenerator<ProcessInfo[]> {
    await this.initializePlatformAdapter();
    
    const { ProcessManager } = await import('../process-manager');
    const processManager = new ProcessManager();
    
    while (true) {
      try {
        const processes = await processManager.listAll(filters);
        yield processes;
        
        // Wait for refresh interval (default 2 seconds as per requirements)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        // Continue monitoring even if one iteration fails
        console.error('Error during watch mode iteration:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Get performance metrics for a specific process
   */
  async getProcessMetrics(pid: number): Promise<ProcessMetrics> {
    try {
      await this.initializePlatformAdapter();
      
      const processInfo = await this.platformAdapter.getProcessInfo(pid);
      if (!processInfo) {
        throw new SystemError(
          `Process with PID ${pid} not found`,
          ErrorCodes.PROCESS_NOT_FOUND,
          { pid }
        );
      }

      return {
        pid,
        cpu: processInfo.cpu || 0,
        memory: processInfo.memory || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new SystemError(
        `Failed to get metrics for process ${pid}`,
        ErrorCodes.SYSTEM_CALL_FAILED,
        { pid, originalError: error }
      );
    }
  }

  /**
   * Track resource usage over a specified duration
   */
  async trackResourceUsage(duration: number): Promise<ResourceUsageReport> {
    await this.initializePlatformAdapter();
    
    const samples: ProcessMetrics[] = [];
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    while (Date.now() < endTime) {
      try {
        const systemInfo = await this.getSystemInfo();
        const sample: ProcessMetrics = {
          pid: 0, // System-wide metrics
          cpu: systemInfo.cpuUsage,
          memory: systemInfo.memoryUsage.used,
          timestamp: new Date(),
        };
        samples.push(sample);
        
        // Sample every second
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error during resource usage tracking:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (samples.length === 0) {
      throw new SystemError(
        'No samples collected during resource usage tracking',
        ErrorCodes.SYSTEM_CALL_FAILED,
        { duration }
      );
    }
    
    const cpuValues = samples.map(s => s.cpu);
    const memoryValues = samples.map(s => s.memory);
    
    return {
      duration,
      samples,
      averageCpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      averageMemory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
      peakCpu: Math.max(...cpuValues),
      peakMemory: Math.max(...memoryValues),
    };
  }
}

// Export the default instance
export const systemMonitor = new SystemMonitorImpl();