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

// Error types and classes for the procx system

export enum ErrorCodes {
  PROCESS_NOT_FOUND = 'PROC_001',
  PROCESS_ACCESS_DENIED = 'PROC_002',
  PROCESS_KILL_FAILED = 'PROC_003',
  INVALID_PORT = 'PORT_001',
  PORT_NOT_AVAILABLE = 'PORT_002',
  PORT_SCAN_FAILED = 'PORT_003',
  NO_FREE_PORT = 'PORT_004',
  PERMISSION_DENIED = 'SYS_001',
  PLATFORM_UNSUPPORTED = 'SYS_002',
  SYSTEM_CALL_FAILED = 'SYS_003',
  TIMEOUT = 'GEN_001',
  INVALID_INPUT = 'GEN_002',
  CONFIGURATION_ERROR = 'GEN_003',
  UNKNOWN_ERROR = 'GEN_999',
}

export enum ErrorCategory {
  PROCESS = 'process',
  PORT = 'port',
  SYSTEM = 'system',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  PERMISSION = 'permission',
  PLATFORM = 'platform',
}

// Base error class for all procx-specific errors
export class ProcxError extends Error {
  public readonly code: ErrorCodes;
  public readonly category: ErrorCategory;
  public readonly details?: any;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCodes,
    category: ErrorCategory,
    details?: any,
    recoverable: boolean = true,
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'ProcxError';
    this.code = code;
    this.category = category;
    this.details = details;
    this.timestamp = new Date();
    this.recoverable = recoverable;
    this.retryable = retryable;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcxError);
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  getUserMessage(): string {
    switch (this.code) {
      case ErrorCodes.PROCESS_NOT_FOUND:
        return `Process not found. ${this.details?.hint || 'Please check the PID or process name.'}`;
      case ErrorCodes.PROCESS_ACCESS_DENIED:
        return `Access denied to process. ${this.details?.hint || 'Try running with elevated privileges or check process permissions.'}`;
      case ErrorCodes.PROCESS_KILL_FAILED:
        return `Failed to terminate process. ${this.details?.hint || 'Process may be protected or already terminated.'}`;
      case ErrorCodes.PERMISSION_DENIED:
        return `Permission denied. ${this.details?.hint || 'Try running with elevated privileges.'}`;
      case ErrorCodes.INVALID_PORT:
        return `Invalid port number. ${this.details?.hint || 'Port must be between 1 and 65535.'}`;
      case ErrorCodes.PORT_NOT_AVAILABLE:
        return `Port is not available. ${this.details?.hint || 'Port may be in use or reserved.'}`;
      case ErrorCodes.PORT_SCAN_FAILED:
        return `Port scan failed. ${this.details?.hint || 'Network interface may be unavailable.'}`;
      case ErrorCodes.NO_FREE_PORT:
        return `No free port found. ${this.details?.hint || 'Try a different port range or check system limits.'}`;
      case ErrorCodes.PLATFORM_UNSUPPORTED:
        return `Platform not supported. ${this.details?.hint || 'This feature is not available on your operating system.'}`;
      case ErrorCodes.SYSTEM_CALL_FAILED:
        return `System call failed. ${this.details?.hint || 'Check system resources and permissions.'}`;
      case ErrorCodes.TIMEOUT:
        return `Operation timed out. ${this.details?.hint || 'The operation took too long to complete.'}`;
      case ErrorCodes.INVALID_INPUT:
        return `Invalid input provided. ${this.details?.hint || 'Please check the input parameters.'}`;
      case ErrorCodes.CONFIGURATION_ERROR:
        return `Configuration error. ${this.details?.hint || 'Please check the application configuration.'}`;
      default:
        return this.message;
    }
  }

  getRecoverySuggestions(): string[] {
    const suggestions: string[] = [];

    switch (this.code) {
      case ErrorCodes.PERMISSION_DENIED:
      case ErrorCodes.PROCESS_ACCESS_DENIED:
        suggestions.push(
          'Run with elevated privileges (sudo on Unix, Run as Administrator on Windows)'
        );
        suggestions.push('Check if you have the necessary permissions');
        break;

      case ErrorCodes.PROCESS_NOT_FOUND:
        suggestions.push('Verify the process ID or name is correct');
        suggestions.push('Check if the process is still running');
        suggestions.push('Use the list command to find available processes');
        break;

      case ErrorCodes.INVALID_PORT:
        suggestions.push('Use a port number between 1 and 65535');
        suggestions.push('Check for typos in the port number');
        break;

      case ErrorCodes.PORT_NOT_AVAILABLE:
        suggestions.push('Try a different port number');
        suggestions.push('Use the free port finder command');
        suggestions.push('Check if another process is using the port');
        break;

      case ErrorCodes.TIMEOUT:
        suggestions.push('Increase the timeout value');
        suggestions.push('Try filtering results to reduce processing time');
        suggestions.push('Check system load and try again later');
        break;

      case ErrorCodes.PLATFORM_UNSUPPORTED:
        suggestions.push('Check for updated version with platform support');
        suggestions.push('Use basic cross-platform commands');
        break;

      case ErrorCodes.SYSTEM_CALL_FAILED:
        suggestions.push('Check system resources and try again');
        suggestions.push('Verify the system is not under heavy load');
        suggestions.push('Try restarting the application');
        break;

      case ErrorCodes.NO_FREE_PORT:
        suggestions.push('Try a different port range');
        suggestions.push('Check system port limits');
        suggestions.push('Close unused applications to free up ports');
        break;
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return this.recoverable;
  }

  isRetryable(): boolean {
    return this.retryable;
  }
}

export class ProcessError extends ProcxError {
  constructor(
    message: string,
    code: ErrorCodes,
    details?: any,
    recoverable: boolean = true,
    retryable: boolean = true
  ) {
    const isRetryable =
      code !== ErrorCodes.PROCESS_ACCESS_DENIED ? retryable : false;
    super(
      message,
      code,
      ErrorCategory.PROCESS,
      details,
      recoverable,
      isRetryable
    );
  }
}

export class PortError extends ProcxError {
  constructor(
    message: string,
    code: ErrorCodes,
    details?: any,
    recoverable: boolean = true,
    retryable: boolean = true
  ) {
    super(message, code, ErrorCategory.PORT, details, recoverable, retryable);
  }
}

export class SystemError extends ProcxError {
  constructor(
    message: string,
    code: ErrorCodes,
    details?: any,
    recoverable: boolean = true,
    retryable: boolean = true
  ) {
    const isRecoverable =
      code !== ErrorCodes.SYSTEM_CALL_FAILED ? recoverable : false;
    super(
      message,
      code,
      ErrorCategory.SYSTEM,
      details,
      isRecoverable,
      retryable
    );
  }
}

export class ValidationError extends ProcxError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCodes.INVALID_INPUT,
      ErrorCategory.VALIDATION,
      details,
      true,
      false
    );
  }
}

export class TimeoutError extends ProcxError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCodes.TIMEOUT,
      ErrorCategory.TIMEOUT,
      details,
      true,
      true
    );
  }
}

export class PermissionError extends ProcxError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCodes.PERMISSION_DENIED,
      ErrorCategory.PERMISSION,
      details,
      true,
      false
    );
  }
}

export class PlatformError extends ProcxError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCodes.PLATFORM_UNSUPPORTED,
      ErrorCategory.PLATFORM,
      details,
      false,
      false
    );
  }
}
