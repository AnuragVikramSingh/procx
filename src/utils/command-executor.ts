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
 * Centralized command execution utilities with timeout handling and error recovery
 */

import { spawn, ChildProcess } from 'child_process';
import { Platform } from '../types/utils';
import { ProcxError, SystemError, ErrorCodes } from '../types/errors';
import { getLogger } from './logger';
import { SharedPerformanceMonitoring } from './shared-logging';

/**
 * Command execution options
 */
export interface CommandOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Whether to use shell for command execution */
  shell?: boolean;
  /** Maximum buffer size for stdout/stderr */
  maxBuffer?: number;
  /** Whether to kill child processes on timeout */
  // eslint-disable-next-line no-undef
  killSignal?: NodeJS.Signals;
  /** Whether to enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Standard output */
  stdout: string;
  /** Standard error output */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether the command was killed due to timeout */
  timedOut: boolean;
  /** Signal used to terminate the process (if any) */
  // eslint-disable-next-line no-undef
  signal?: NodeJS.Signals | null;
}

/**
 * Command validation result
 */
export interface CommandValidationResult {
  /** Whether the command is valid */
  isValid: boolean;
  /** Sanitized command array */
  sanitizedCommand?: string[];
  /** Validation error message */
  error?: string;
  /** Security warnings */
  warnings?: string[];
}

/**
 * Default command execution options
 */
export const DEFAULT_COMMAND_OPTIONS: Required<CommandOptions> = {
  timeout: 30000, // 30 seconds
  cwd: process.cwd(),
  env: process.env as Record<string, string>,
  shell: false,
  maxBuffer: 1024 * 1024 * 10, // 10MB
  killSignal: 'SIGTERM',
  enablePerformanceMonitoring: true,
};

/**
 * Centralized command executor with comprehensive error handling and monitoring
 */
export class CommandExecutor {
  private logger = getLogger('command-executor');
  private platform: Platform;
  private activeProcesses = new Map<string, ChildProcess>();

  constructor(platform?: Platform) {
    this.platform = platform || this.detectPlatform();
  }

  /**
   * Execute a command with comprehensive error handling and monitoring
   */
  async execute(
    command: string[],
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    const mergedOptions = { ...DEFAULT_COMMAND_OPTIONS, ...options };
    const operationId = mergedOptions.enablePerformanceMonitoring
      ? SharedPerformanceMonitoring.startOperation('command-execution', {
          command: command.join(' '),
          platform: this.platform,
        })
      : '';

    try {
      // Validate and sanitize command
      const validation = this.validateCommand(command);
      if (!validation.isValid) {
        throw new SystemError(
          `Command validation failed: ${validation.error}`,
          ErrorCodes.SYSTEM_CALL_FAILED,
          { command, validation }
        );
      }

      const sanitizedCommand = validation.sanitizedCommand!;

      this.logger.debug('Executing command', {
        command: sanitizedCommand.join(' '),
        options: mergedOptions,
        platform: this.platform,
      });

      // Execute command with timeout
      const result = await this.executeWithTimeout(
        sanitizedCommand,
        mergedOptions
      );

      this.logger.debug('Command executed successfully', {
        command: sanitizedCommand.join(' '),
        exitCode: result.exitCode,
        duration: result.duration,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
      });

      if (operationId) {
        SharedPerformanceMonitoring.endOperation(operationId, true);
      }

      return result;
    } catch (error) {
      this.logger.debug('Command execution failed', {
        command: command.join(' '),
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
      });

      if (operationId) {
        SharedPerformanceMonitoring.endOperation(
          operationId,
          false,
          error instanceof Error ? error.message : String(error)
        );
      }

      // Normalize error
      if (error instanceof ProcxError) {
        throw error;
      }

      throw new SystemError(
        `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCodes.SYSTEM_CALL_FAILED,
        { command, originalError: error }
      );
    }
  }

  /**
   * Execute command with timeout handling
   */
  async executeWithTimeout(
    command: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    const startTime = performance.now();
    const processId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      let timedOut = false;
      // eslint-disable-next-line no-undef
      let timeoutHandle: NodeJS.Timeout | undefined;

      // Prepare command execution
      const [cmd, ...args] = command;
      const execOptions = {
        cwd: options.cwd,
        env: options.env,
        maxBuffer: options.maxBuffer,
        shell: options.shell,
      };

      // Use spawn for better control over the process
      const childProcess = spawn(cmd!, args, execOptions);
      this.activeProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';
      let exitCode = 0;
      // eslint-disable-next-line no-undef
      let signal: NodeJS.Signals | undefined;

      // Set up timeout
      if (options.timeout && options.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          this.logger.warn('Command execution timed out', {
            command: command.join(' '),
            timeout: options.timeout,
            pid: childProcess.pid,
          });

          // Try graceful termination first
          if (childProcess.pid) {
            try {
              process.kill(
                childProcess.pid,
                (options.killSignal as string) || 'SIGTERM'
              );

              // Force kill after additional timeout
              setTimeout(() => {
                if (!childProcess.killed) {
                  try {
                    process.kill(childProcess.pid!, 'SIGKILL');
                  } catch (killError) {
                    this.logger.error('Failed to force kill process', {
                      pid: childProcess.pid,
                      error: killError,
                    });
                  }
                }
              }, 5000); // 5 second grace period
            } catch (killError) {
              this.logger.error('Failed to kill timed out process', {
                pid: childProcess.pid,
                error: killError,
              });
            }
          }
        }, options.timeout);
      }

      // Handle stdout
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      // Handle stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Handle process exit
      childProcess.on('exit', (code, sig) => {
        exitCode = code || 0;
        signal = sig || undefined;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        this.activeProcesses.delete(processId);

        const duration = performance.now() - startTime;

        const result: CommandResult = {
          stdout,
          stderr,
          exitCode,
          duration,
          timedOut,
          signal: signal || null,
        };

        if (timedOut) {
          reject(
            new SystemError(
              `Command execution timed out after ${options.timeout}ms`,
              ErrorCodes.SYSTEM_CALL_FAILED,
              { command, timeout: options.timeout, result }
            )
          );
        } else if (exitCode !== 0 && !options.shell) {
          // For non-shell commands, non-zero exit codes are typically errors
          reject(
            new SystemError(
              `Command failed with exit code ${exitCode}`,
              ErrorCodes.SYSTEM_CALL_FAILED,
              { command, exitCode, stderr, result }
            )
          );
        } else {
          resolve(result);
        }
      });

      // Handle process errors
      childProcess.on('error', error => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        this.activeProcesses.delete(processId);

        reject(
          new SystemError(
            `Process execution error: ${error.message}`,
            ErrorCodes.SYSTEM_CALL_FAILED,
            { command, originalError: error }
          )
        );
      });
    });
  }

  /**
   * Validate and sanitize command for security
   */
  validateCommand(command: string[]): CommandValidationResult {
    if (!Array.isArray(command) || command.length === 0) {
      return {
        isValid: false,
        error: 'Command must be a non-empty array',
      };
    }

    const warnings: string[] = [];
    const sanitizedCommand: string[] = [];

    for (let i = 0; i < command.length; i++) {
      const arg = command[i];

      if (typeof arg !== 'string') {
        return {
          isValid: false,
          error: `Command argument at index ${i} must be a string`,
        };
      }

      // Check for potentially dangerous patterns
      if (this.containsDangerousPatterns(arg)) {
        return {
          isValid: false,
          error: `Command argument contains potentially dangerous patterns: ${arg}`,
        };
      }

      // Sanitize argument
      const sanitized = this.sanitizeArgument(arg);
      if (sanitized !== arg) {
        warnings.push(`Argument sanitized: "${arg}" -> "${sanitized}"`);
      }

      sanitizedCommand.push(sanitized);
    }

    // Platform-specific validation
    const platformValidation = this.validatePlatformSpecific(sanitizedCommand);
    if (!platformValidation.isValid) {
      return platformValidation;
    }

    const result: CommandValidationResult = {
      isValid: true,
      sanitizedCommand,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Check for dangerous patterns in command arguments
   */
  private containsDangerousPatterns(arg: string): boolean {
    // Patterns that could indicate command injection attempts
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/, // Shell metacharacters
      /\.\.\//, // Path traversal
      /\/etc\/passwd/, // System file access
      /\/proc\//, // Process filesystem access (except for legitimate use)
      /rm\s+-rf/, // Dangerous deletion commands
      /sudo/, // Privilege escalation
      /su\s/, // User switching
      /chmod\s+777/, // Dangerous permission changes
    ];

    return dangerousPatterns.some(pattern => pattern.test(arg));
  }

  /**
   * Sanitize command argument
   */
  private sanitizeArgument(arg: string): string {
    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    let sanitized = arg.replace(/[\u0000-\u001f\u007f]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length to prevent buffer overflow attacks
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }

    return sanitized;
  }

  /**
   * Platform-specific command validation
   */
  private validatePlatformSpecific(command: string[]): CommandValidationResult {
    switch (this.platform) {
      case Platform.WINDOWS:
        return this.validateWindowsCommand(command);
      case Platform.MACOS:
      case Platform.LINUX:
        return this.validateUnixCommand(command);
      default:
        // For unknown platforms, allow but warn
        return {
          isValid: true,
          warnings: [
            `Unknown platform ${this.platform}, skipping platform-specific validation`,
          ],
        };
    }
  }

  /**
   * Validate Windows-specific commands
   */
  private validateWindowsCommand(command: string[]): CommandValidationResult {
    const [cmd] = command;

    // List of allowed Windows commands for process/port management
    const allowedCommands = [
      'tasklist',
      'taskkill',
      'netstat',
      'wmic',
      'powershell',
      'cmd',
      'findstr',
      'sort',
      'more',
    ];

    const cmdName = cmd?.toLowerCase().replace(/\.exe$/, '') || '';

    if (!allowedCommands.includes(cmdName)) {
      return {
        isValid: false,
        error: `Command '${cmd}' is not in the allowed list for Windows platform`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate Unix-specific commands (macOS/Linux)
   */
  private validateUnixCommand(command: string[]): CommandValidationResult {
    const [cmd] = command;

    // List of allowed Unix commands for process/port management
    const allowedCommands = [
      'ps',
      'kill',
      'killall',
      'lsof',
      'netstat',
      'ss',
      'top',
      'grep',
      'awk',
      'sed',
      'sort',
      'head',
      'tail',
      'wc',
      'uptime',
      'vm_stat',
      'free',
      'cat',
      'echo',
    ];

    const cmdName = cmd?.split('/').pop() || cmd || '';

    if (!allowedCommands.includes(cmdName)) {
      return {
        isValid: false,
        error: `Command '${cmd}' is not in the allowed list for Unix platform`,
      };
    }

    return { isValid: true };
  }

  /**
   * Execute command with automatic retry on failure
   */
  async executeWithRetry(
    command: string[],
    options: CommandOptions = {},
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ): Promise<CommandResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(command, options);
      } catch (error) {
        lastError = error as Error;

        this.logger.warn(`Command execution attempt ${attempt} failed`, {
          command: command.join(' '),
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new SystemError(
      `Command execution failed after ${maxRetries} attempts`,
      ErrorCodes.SYSTEM_CALL_FAILED,
      { command, maxRetries, lastError }
    );
  }

  /**
   * Kill all active processes managed by this executor
   */
  async killAllActiveProcesses(): Promise<void> {
    const processIds = Array.from(this.activeProcesses.keys());

    this.logger.info(`Killing ${processIds.length} active processes`);

    for (const processId of processIds) {
      const childProcess = this.activeProcesses.get(processId);
      if (childProcess && childProcess.pid && !childProcess.killed) {
        try {
          process.kill(childProcess.pid, 'SIGTERM');

          // Force kill after timeout
          setTimeout(() => {
            if (!childProcess.killed && childProcess.pid) {
              try {
                process.kill(childProcess.pid, 'SIGKILL');
              } catch (error) {
                this.logger.error('Failed to force kill process', {
                  processId,
                  pid: childProcess.pid,
                  error,
                });
              }
            }
          }, 5000);
        } catch (error) {
          this.logger.error('Failed to kill active process', {
            processId,
            pid: childProcess.pid,
            error,
          });
        }
      }
    }

    this.activeProcesses.clear();
  }

  /**
   * Get information about active processes
   */
  getActiveProcesses(): Array<{ id: string; pid?: number; command?: string }> {
    return Array.from(this.activeProcesses.entries()).map(([id, process]) => {
      const result: { id: string; pid?: number; command?: string } = { id };

      if (process.pid !== undefined) {
        result.pid = process.pid;
      }

      if (process.spawnargs) {
        result.command = process.spawnargs.join(' ');
      }

      return result;
    });
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): Platform {
    const platform = process.platform;

    switch (platform) {
      case 'win32':
        return Platform.WINDOWS;
      case 'darwin':
        return Platform.MACOS;
      case 'linux':
        return Platform.LINUX;
      case 'freebsd':
        return Platform.FREEBSD;
      case 'openbsd':
        return Platform.OPENBSD;
      case 'sunos':
        return Platform.SUNOS;
      case 'aix':
        return Platform.AIX;
      default:
        this.logger.warn(`Unknown platform: ${platform}, defaulting to Linux`);
        return Platform.LINUX;
    }
  }

  /**
   * Update platform (useful for testing)
   */
  setPlatform(platform: Platform): void {
    this.platform = platform;
  }

  /**
   * Get current platform
   */
  getPlatform(): Platform {
    return this.platform;
  }
}

/**
 * Global command executor instance
 */
export const commandExecutor = new CommandExecutor();

/**
 * Convenience functions for command execution
 */

/**
 * Execute a command with default options
 */
export async function executeCommand(
  command: string[],
  options?: CommandOptions
): Promise<CommandResult> {
  return commandExecutor.execute(command, options);
}

/**
 * Execute a command with timeout
 */
export async function executeCommandWithTimeout(
  command: string[],
  timeoutMs: number,
  options?: Omit<CommandOptions, 'timeout'>
): Promise<CommandResult> {
  return commandExecutor.execute(command, { ...options, timeout: timeoutMs });
}

/**
 * Execute a command with retry logic
 */
export async function executeCommandWithRetry(
  command: string[],
  options?: CommandOptions,
  maxRetries?: number,
  retryDelayMs?: number
): Promise<CommandResult> {
  return commandExecutor.executeWithRetry(
    command,
    options,
    maxRetries,
    retryDelayMs
  );
}

/**
 * Validate a command before execution
 */
export function validateCommand(command: string[]): CommandValidationResult {
  return commandExecutor.validateCommand(command);
}

/**
 * Create a command executor for a specific platform
 */
export function createCommandExecutor(platform: Platform): CommandExecutor {
  return new CommandExecutor(platform);
}
