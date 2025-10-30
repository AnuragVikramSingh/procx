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
 * @fileoverview Shared process utilities for filtering, sorting, and validation
 * @module utils/process-utils
 * @description Centralized utilities for process operations to eliminate duplicate code
 */

import {
  ProcessInfo,
  ProcessFilters,
  ProcessStatus,
  RawProcessInfo,
  ValidationError,
  ProcessError,
  ErrorCodes,
} from '../types';
import { validatePort, validatePid, validateProcessName } from './index';

/**
 * Process sorting configuration
 */
export interface ProcessSortConfig {
  /** Field to sort by */
  field: keyof ProcessInfo;
  /** Sort order */
  order: 'asc' | 'desc';
}

/**
 * Process filtering utilities class
 */
export class ProcessFilterUtils {
  /**
   * Filters processes by name pattern (case-insensitive)
   *
   * @param processes - Array of processes to filter
   * @param namePattern - Name pattern to match (supports partial matching)
   * @returns Filtered array of processes
   */
  static filterByName(
    processes: ProcessInfo[],
    namePattern: string
  ): ProcessInfo[] {
    if (!namePattern || typeof namePattern !== 'string') {
      return processes;
    }

    const pattern = namePattern.toLowerCase().trim();
    if (!pattern) {
      return processes;
    }

    return processes.filter(
      process =>
        process.name.toLowerCase().includes(pattern) ||
        process.command.toLowerCase().includes(pattern)
    );
  }

  /**
   * Filters processes by minimum CPU usage
   *
   * @param processes - Array of processes to filter
   * @param minCpu - Minimum CPU percentage (0-100)
   * @returns Filtered array of processes
   */
  static filterByMinCpu(
    processes: ProcessInfo[],
    minCpu: number
  ): ProcessInfo[] {
    if (typeof minCpu !== 'number' || isNaN(minCpu) || minCpu < 0) {
      return processes;
    }

    return processes.filter(process => process.cpu >= minCpu);
  }

  /**
   * Filters processes by minimum memory usage
   *
   * @param processes - Array of processes to filter
   * @param minMemory - Minimum memory usage in KB
   * @returns Filtered array of processes
   */
  static filterByMinMemory(
    processes: ProcessInfo[],
    minMemory: number
  ): ProcessInfo[] {
    if (typeof minMemory !== 'number' || isNaN(minMemory) || minMemory < 0) {
      return processes;
    }

    return processes.filter(process => process.memory >= minMemory);
  }

  /**
   * Filters processes by status
   *
   * @param processes - Array of processes to filter
   * @param status - Process status to match
   * @returns Filtered array of processes
   */
  static filterByStatus(
    processes: ProcessInfo[],
    status: ProcessStatus
  ): ProcessInfo[] {
    if (!status) {
      return processes;
    }

    return processes.filter(process => process.status === status);
  }

  /**
   * Filters processes by PID
   *
   * @param processes - Array of processes to filter
   * @param pid - Process ID to match
   * @returns Filtered array of processes (should contain 0 or 1 process)
   */
  static filterByPid(processes: ProcessInfo[], pid: number): ProcessInfo[] {
    if (typeof pid !== 'number' || isNaN(pid) || pid <= 0) {
      return [];
    }

    return processes.filter(process => process.pid === pid);
  }

  /**
   * Filters processes by port usage
   *
   * @param processes - Array of processes to filter
   * @param port - Port number to match
   * @returns Filtered array of processes
   */
  static filterByPort(processes: ProcessInfo[], port: number): ProcessInfo[] {
    if (typeof port !== 'number' || isNaN(port) || port <= 0) {
      return [];
    }

    return processes.filter(
      process => process.ports && process.ports.includes(port)
    );
  }

  /**
   * Applies multiple filters to a process list
   *
   * @param processes - Array of processes to filter
   * @param filters - Filter criteria to apply
   * @returns Filtered array of processes
   */
  static applyFilters(
    processes: ProcessInfo[],
    filters: ProcessFilters
  ): ProcessInfo[] {
    let filtered = [...processes];

    // Apply name filter
    if (filters.name) {
      filtered = this.filterByName(filtered, filters.name);
    }

    // Apply CPU filter
    if (filters.minCpu !== undefined) {
      filtered = this.filterByMinCpu(filtered, filters.minCpu);
    }

    // Apply memory filter
    if (filters.minMemory !== undefined) {
      filtered = this.filterByMinMemory(filtered, filters.minMemory);
    }

    // Apply status filter
    if (filters.status) {
      filtered = this.filterByStatus(filtered, filters.status);
    }

    return filtered;
  }

  /**
   * Checks if a process matches the given criteria
   *
   * @param process - Process to check
   * @param filters - Filter criteria
   * @returns True if process matches all criteria
   */
  static matchesFilters(
    process: ProcessInfo,
    filters: ProcessFilters
  ): boolean {
    // Check name filter
    if (filters.name) {
      const pattern = filters.name.toLowerCase().trim();
      if (
        pattern &&
        !process.name.toLowerCase().includes(pattern) &&
        !process.command.toLowerCase().includes(pattern)
      ) {
        return false;
      }
    }

    // Check CPU filter
    if (filters.minCpu !== undefined && process.cpu < filters.minCpu) {
      return false;
    }

    // Check memory filter
    if (filters.minMemory !== undefined && process.memory < filters.minMemory) {
      return false;
    }

    // Check status filter
    if (filters.status && process.status !== filters.status) {
      return false;
    }

    return true;
  }
}

/**
 * Process sorting utilities class
 */
export class ProcessSortUtils {
  /**
   * Sorts processes by the specified field and order
   *
   * @param processes - Array of processes to sort
   * @param field - Field to sort by
   * @param order - Sort order (asc or desc)
   * @returns Sorted array of processes
   */
  static sortBy(
    processes: ProcessInfo[],
    field: keyof ProcessInfo,
    order: 'asc' | 'desc' = 'asc'
  ): ProcessInfo[] {
    const sorted = [...processes];
    const multiplier = order === 'desc' ? -1 : 1;

    return sorted.sort((a, b) => {
      let aVal: any = a[field];
      let bVal: any = b[field];

      // Handle string comparisons
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Handle undefined/null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1 * multiplier;
      if (bVal == null) return -1 * multiplier;

      // Compare values
      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });
  }

  /**
   * Sorts processes by PID (ascending)
   *
   * @param processes - Array of processes to sort
   * @returns Sorted array of processes
   */
  static sortByPid(processes: ProcessInfo[]): ProcessInfo[] {
    return this.sortBy(processes, 'pid', 'asc');
  }

  /**
   * Sorts processes by name (ascending)
   *
   * @param processes - Array of processes to sort
   * @returns Sorted array of processes
   */
  static sortByName(processes: ProcessInfo[]): ProcessInfo[] {
    return this.sortBy(processes, 'name', 'asc');
  }

  /**
   * Sorts processes by CPU usage (descending - highest first)
   *
   * @param processes - Array of processes to sort
   * @returns Sorted array of processes
   */
  static sortByCpu(processes: ProcessInfo[]): ProcessInfo[] {
    return this.sortBy(processes, 'cpu', 'desc');
  }

  /**
   * Sorts processes by memory usage (descending - highest first)
   *
   * @param processes - Array of processes to sort
   * @returns Sorted array of processes
   */
  static sortByMemory(processes: ProcessInfo[]): ProcessInfo[] {
    return this.sortBy(processes, 'memory', 'desc');
  }

  /**
   * Applies sorting based on ProcessFilters configuration
   *
   * @param processes - Array of processes to sort
   * @param filters - Filter configuration containing sort options
   * @returns Sorted array of processes
   */
  static applySorting(
    processes: ProcessInfo[],
    filters: ProcessFilters
  ): ProcessInfo[] {
    if (!filters.sortBy) {
      return processes;
    }

    const field = filters.sortBy as keyof ProcessInfo;
    const order = filters.sortOrder || 'asc';

    return this.sortBy(processes, field, order);
  }
}

/**
 * Process validation utilities class
 */
export class ProcessValidationUtils {
  /**
   * Validates that a process exists and is accessible
   *
   * @param process - Process to validate
   * @returns True if process is valid
   */
  static isValidProcess(
    process: ProcessInfo | null | undefined
  ): process is ProcessInfo {
    return !!(
      process &&
      typeof process.pid === 'number' &&
      process.pid > 0 &&
      typeof process.name === 'string' &&
      process.name.length > 0
    );
  }

  /**
   * Validates process existence by PID
   *
   * @param pid - Process ID to validate
   * @param processes - Array of processes to search in
   * @returns Validation result
   */
  static validateProcessExists(
    pid: number,
    processes: ProcessInfo[]
  ): { exists: boolean; process?: ProcessInfo } {
    if (typeof pid !== 'number' || isNaN(pid) || pid <= 0) {
      return { exists: false };
    }

    const process = processes.find(p => p.pid === pid);
    if (process) {
      return { exists: true, process };
    } else {
      return { exists: false };
    }
  }

  /**
   * Validates that a process is killable (not a critical system process)
   *
   * @param process - Process to validate
   * @returns Validation result with warnings
   */
  static validateProcessKillable(process: ProcessInfo): {
    killable: boolean;
    warnings: string[];
    requiresConfirmation: boolean;
  } {
    const warnings: string[] = [];
    let requiresConfirmation = false;

    // Check for init process (PID 1)
    if (process.pid === 1) {
      return {
        killable: false,
        warnings: [
          'Cannot kill init process (PID 1) - this would crash the system',
        ],
        requiresConfirmation: false,
      };
    }

    // Check for low PIDs (system processes)
    if (process.pid < 100) {
      warnings.push('Low PID process - likely a system process');
      requiresConfirmation = true;
    }

    // Check for critical system process names
    const criticalProcesses = [
      'kernel',
      'kthreadd',
      'ksoftirqd',
      'migration',
      'rcu_',
      'watchdog',
      'systemd',
      'init',
      'kworker',
      'dbus',
      'networkmanager',
      'sshd',
    ];

    const processName = process.name.toLowerCase();
    const isCritical = criticalProcesses.some(critical =>
      processName.includes(critical.toLowerCase())
    );

    if (isCritical) {
      warnings.push(
        `Process "${process.name}" appears to be a critical system process`
      );
      requiresConfirmation = true;
    }

    return {
      killable: true,
      warnings,
      requiresConfirmation,
    };
  }

  /**
   * Validates process filters for correctness
   *
   * @param filters - Process filters to validate
   * @returns Validation result
   */
  static validateProcessFilters(filters: ProcessFilters): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate minCpu
    if (filters.minCpu !== undefined) {
      if (typeof filters.minCpu !== 'number' || isNaN(filters.minCpu)) {
        errors.push('minCpu must be a valid number');
      } else if (filters.minCpu < 0) {
        errors.push('minCpu cannot be negative');
      } else if (filters.minCpu > 100) {
        warnings.push('minCpu > 100% may not match any processes');
      }
    }

    // Validate minMemory
    if (filters.minMemory !== undefined) {
      if (typeof filters.minMemory !== 'number' || isNaN(filters.minMemory)) {
        errors.push('minMemory must be a valid number');
      } else if (filters.minMemory < 0) {
        errors.push('minMemory cannot be negative');
      }
    }

    // Validate name
    if (filters.name !== undefined) {
      if (typeof filters.name !== 'string') {
        errors.push('name filter must be a string');
      } else if (filters.name.trim().length === 0) {
        warnings.push('Empty name filter will match all processes');
      }
    }

    // Validate sortBy
    if (filters.sortBy !== undefined) {
      const validSortFields = ['pid', 'name', 'cpu', 'memory', 'status'];
      if (!validSortFields.includes(filters.sortBy)) {
        errors.push(`sortBy must be one of: ${validSortFields.join(', ')}`);
      }
    }

    // Validate sortOrder
    if (filters.sortOrder !== undefined) {
      const validSortOrders = ['asc', 'desc'];
      if (!validSortOrders.includes(filters.sortOrder)) {
        errors.push(`sortOrder must be one of: ${validSortOrders.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Process information conversion utilities
 */
export class ProcessConversionUtils {
  /**
   * Converts raw process information to normalized ProcessInfo
   *
   * @param raw - Raw process data from platform adapter
   * @param ports - Optional array of ports used by this process
   * @returns Normalized process information
   */
  static convertRawProcessInfo(
    raw: RawProcessInfo,
    ports?: number[]
  ): ProcessInfo {
    const processInfo: ProcessInfo = {
      pid: raw.pid,
      name: raw.name,
      command: raw.command,
      cpu: raw.cpu || 0,
      memory: raw.memory || 0,
      status: this.normalizeProcessStatus(raw.status),
      startTime: raw.startTime || new Date(),
    };

    if (raw.ppid !== undefined) {
      processInfo.ppid = raw.ppid;
    }

    if (ports && ports.length > 0) {
      processInfo.ports = ports;
    }

    if (raw.workingDirectory !== undefined) {
      processInfo.workingDirectory = raw.workingDirectory;
    }

    return processInfo;
  }

  /**
   * Normalizes platform-specific process status to standard ProcessStatus enum
   *
   * @param status - Platform-specific status string
   * @returns Normalized process status
   */
  static normalizeProcessStatus(status?: string): ProcessStatus {
    if (!status) return 'unknown';

    const normalized = status.toLowerCase();
    if (normalized.includes('run')) return 'running';
    if (normalized.includes('sleep')) return 'sleeping';
    if (normalized.includes('stop')) return 'stopped';
    if (normalized.includes('zombie')) return 'zombie';

    return 'unknown';
  }

  /**
   * Extracts process name from command path
   *
   * @param command - Full command path
   * @returns Process name (basename)
   */
  static extractProcessName(command: string): string {
    if (!command || typeof command !== 'string') {
      return 'unknown';
    }

    // Extract basename from path
    const parts = command.split(/[/\\]/);
    const basename = parts[parts.length - 1] || command;

    // Remove common executable extensions
    return basename.replace(/\.(exe|app|bin)$/i, '');
  }

  /**
   * Formats process information for display
   *
   * @param process - Process information
   * @returns Formatted process information string
   */
  static formatProcessInfo(process: ProcessInfo): string {
    const memoryMB = (process.memory / 1024).toFixed(1);
    const cpuPercent = process.cpu.toFixed(1);
    const ports =
      process.ports && process.ports.length > 0
        ? ` (ports: ${process.ports.join(', ')})`
        : '';

    return [
      `PID: ${process.pid}`,
      `Name: ${process.name}`,
      `Command: ${process.command}`,
      `CPU: ${cpuPercent}%`,
      `Memory: ${memoryMB} MB`,
      `Status: ${process.status}${ports}`,
    ].join('\n');
  }
}

/**
 * Process validation and error handling utilities
 */
export class ProcessValidationAndErrorUtils {
  /**
   * Validates a port and throws ValidationError if invalid
   *
   * @param port - Port number to validate
   * @throws ValidationError if port is invalid
   */
  static validatePortOrThrow(port: number): void {
    const validation = validatePort(port);
    if (!validation.isValid) {
      throw new ValidationError(validation.error!, { port });
    }
  }

  /**
   * Validates a PID and throws ValidationError if invalid
   *
   * @param pid - Process ID to validate
   * @throws ValidationError if PID is invalid
   */
  static validatePidOrThrow(pid: number): void {
    const validation = validatePid(pid);
    if (!validation.isValid) {
      throw new ValidationError(validation.error!, { pid });
    }
  }

  /**
   * Validates a process name and throws ValidationError if invalid
   *
   * @param name - Process name to validate
   * @throws ValidationError if name is invalid
   */
  static validateProcessNameOrThrow(name: string): void {
    const validation = validateProcessName(name);
    if (!validation.isValid) {
      throw new ValidationError(validation.error!, { name });
    }
  }

  /**
   * Validates process existence and throws appropriate error if not found
   *
   * @param process - Process to validate
   * @param identifier - Identifier used to find the process
   * @param identifierType - Type of identifier
   * @throws ProcessError if process is null/undefined
   */
  static validateProcessExistsOrThrow(
    process: ProcessInfo | null | undefined,
    identifier: string | number,
    identifierType: 'pid' | 'name' | 'port'
  ): asserts process is ProcessInfo {
    if (!process) {
      throw ProcessErrorUtils.createProcessNotFoundError(
        identifier,
        identifierType
      );
    }
  }

  /**
   * Validates that a process is safe to kill and returns warnings
   *
   * @param process - Process to validate for killing
   * @returns Validation result with warnings
   */
  static validateProcessKillSafety(process: ProcessInfo): {
    safe: boolean;
    warnings: string[];
    requiresConfirmation: boolean;
  } {
    const result = ProcessValidationUtils.validateProcessKillable(process);
    return {
      safe: result.killable,
      warnings: result.warnings,
      requiresConfirmation: result.requiresConfirmation,
    };
  }
}

/**
 * Process error handling utilities
 */
export class ProcessErrorUtils {
  /**
   * Creates a standardized process not found error
   *
   * @param identifier - Process identifier (PID, name, or port)
   * @param identifierType - Type of identifier
   * @returns ProcessError instance
   */
  static createProcessNotFoundError(
    identifier: string | number,
    identifierType: 'pid' | 'name' | 'port'
  ): ProcessError {
    const message = `No process found ${identifierType === 'pid' ? 'with' : 'using'} ${identifierType} ${identifier}`;

    return new ProcessError(message, ErrorCodes.PROCESS_NOT_FOUND, {
      [identifierType]: identifier,
    });
  }

  /**
   * Creates a standardized process operation failed error
   *
   * @param operation - Operation that failed
   * @param pid - Process ID
   * @param originalError - Original error that caused the failure
   * @returns ProcessError instance
   */
  static createProcessOperationError(
    operation: string,
    pid: number,
    originalError?: Error
  ): ProcessError {
    const message = `Failed to ${operation} process ${pid}`;

    return new ProcessError(
      message,
      ErrorCodes.PROCESS_KILL_FAILED, // Use existing error code
      { pid, operation, originalError }
    );
  }

  /**
   * Creates a validation error for invalid process parameters
   *
   * @param parameter - Parameter name
   * @param value - Invalid value
   * @param reason - Reason why it's invalid
   * @returns ValidationError instance
   */
  static createValidationError(
    parameter: string,
    value: any,
    reason: string
  ): ValidationError {
    const message = `Invalid ${parameter}: ${reason}`;

    return new ValidationError(message, { [parameter]: value, reason });
  }
}

/**
 * Centralized process utilities class that combines all utility functions
 */
export class ProcessUtils {
  static readonly Filter = ProcessFilterUtils;
  static readonly Sort = ProcessSortUtils;
  static readonly Validation = ProcessValidationUtils;
  static readonly ValidationAndError = ProcessValidationAndErrorUtils;
  static readonly Conversion = ProcessConversionUtils;
  static readonly Error = ProcessErrorUtils;

  /**
   * Applies comprehensive filtering and sorting to a process list
   *
   * @param processes - Array of processes to process
   * @param filters - Filter and sort criteria
   * @returns Processed array of processes
   */
  static processProcessList(
    processes: ProcessInfo[],
    filters?: ProcessFilters
  ): ProcessInfo[] {
    if (!filters) {
      return processes;
    }

    // Validate filters first
    const validation = ProcessValidationUtils.validateProcessFilters(filters);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid process filters: ${validation.errors.join(', ')}`,
        { filters, errors: validation.errors }
      );
    }

    // Apply filters
    let result = ProcessFilterUtils.applyFilters(processes, filters);

    // Apply sorting
    result = ProcessSortUtils.applySorting(result, filters);

    return result;
  }

  /**
   * Finds a single process by various criteria
   *
   * @param processes - Array of processes to search
   * @param criteria - Search criteria
   * @returns Found process or null
   */
  static findProcess(
    processes: ProcessInfo[],
    criteria: { pid?: number; name?: string; port?: number }
  ): ProcessInfo | null {
    if (criteria.pid !== undefined) {
      const filtered = ProcessFilterUtils.filterByPid(processes, criteria.pid);
      return filtered.length > 0 ? filtered[0]! : null;
    }

    if (criteria.name !== undefined) {
      const filtered = ProcessFilterUtils.filterByName(
        processes,
        criteria.name
      );
      return filtered.length > 0 ? filtered[0]! : null;
    }

    if (criteria.port !== undefined) {
      const filtered = ProcessFilterUtils.filterByPort(
        processes,
        criteria.port
      );
      return filtered.length > 0 ? filtered[0]! : null;
    }

    return null;
  }

  /**
   * Finds multiple processes by various criteria
   *
   * @param processes - Array of processes to search
   * @param criteria - Search criteria
   * @returns Array of matching processes
   */
  static findProcesses(
    processes: ProcessInfo[],
    criteria: {
      name?: string;
      minCpu?: number;
      minMemory?: number;
      status?: ProcessStatus;
    }
  ): ProcessInfo[] {
    const filters: ProcessFilters = {};

    if (criteria.name !== undefined) {
      filters.name = criteria.name;
    }
    if (criteria.minCpu !== undefined) {
      filters.minCpu = criteria.minCpu;
    }
    if (criteria.minMemory !== undefined) {
      filters.minMemory = criteria.minMemory;
    }
    if (criteria.status !== undefined) {
      filters.status = criteria.status;
    }

    return ProcessFilterUtils.applyFilters(processes, filters);
  }
}
