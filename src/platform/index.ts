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

// Platform abstraction layer for cross-platform process and port management

import {
  RawProcessInfo,
  NetworkConnection,
  SystemMetrics,
  ProcessSignal,
  Platform,
  PlatformError,
} from '../types';
import {
  CommandExecutor,
  CommandResult,
  CommandOptions,
} from '../utils/command-executor';
import { ParsingUtils } from '../utils/parsing-utils';
import { validatePort, validatePid, validateProcessName } from '../utils';
import { getLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { SharedLogging } from '../utils/shared-logging';

// Abstract base class for platform-specific system operations
export abstract class PlatformAdapter {
  protected readonly platform: Platform;
  protected readonly commandExecutor: CommandExecutor;
  protected readonly parsingUtils: ParsingUtils;
  protected readonly logger = getLogger('platform-adapter');
  protected readonly sharedLogging: SharedLogging;
  protected readonly errorHandler: ErrorHandler;

  constructor(platform: Platform) {
    this.platform = platform;
    this.commandExecutor = new CommandExecutor(platform);
    this.parsingUtils = new ParsingUtils();
    this.sharedLogging = new SharedLogging(
      `platform-${platform.toLowerCase()}`
    );
    this.errorHandler = new ErrorHandler();
  }

  getPlatform(): Platform {
    return this.platform;
  }

  abstract listProcesses(): Promise<RawProcessInfo[]>;

  abstract killProcess(pid: number, signal: ProcessSignal): Promise<boolean>;

  abstract getNetworkConnections(): Promise<NetworkConnection[]>;

  abstract getSystemMetrics(): Promise<SystemMetrics>;

  abstract isProcessRunning(pid: number): Promise<boolean>;

  abstract getProcessInfo(pid: number): Promise<RawProcessInfo | null>;

  abstract isPortAvailable(
    port: number,
    protocol?: 'tcp' | 'udp'
  ): Promise<boolean>;

  abstract getProcessByPort(port: number): Promise<number | null>;

  // Override in specific adapters if needed
  isSupported(): boolean {
    return true;
  }

  protected abstract getProcessListCommand(): string[];

  protected abstract getNetworkCommand(): string[];

  protected abstract parseProcessOutput(output: string): RawProcessInfo[];

  protected abstract parseNetworkOutput(output: string): NetworkConnection[];

  protected async executeCommand(
    command: string[],
    options?: CommandOptions
  ): Promise<CommandResult> {
    try {
      this.logger.debug('Executing platform command', {
        platform: this.platform,
        command: command.join(' '),
        options,
      });

      const result = await this.commandExecutor.execute(command, options);

      this.logger.debug('Platform command executed successfully', {
        platform: this.platform,
        command: command.join(' '),
        exitCode: result.exitCode,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      const enhancedError = this.errorHandler.handleApiError(error);

      this.logger.debug('Platform command execution failed', {
        platform: this.platform,
        command: command.join(' '),
        error: enhancedError.message,
      });

      throw enhancedError;
    }
  }

  protected async executeCommandWithRetry(
    command: string[],
    timeoutMs: number,
    maxRetries: number = 1
  ): Promise<CommandResult> {
    return this.commandExecutor.executeWithRetry(
      command,
      { timeout: timeoutMs },
      maxRetries
    );
  }

  protected validateInput(
    input: any,
    type: 'port' | 'pid' | 'processName'
  ): boolean {
    let result;

    switch (type) {
      case 'port':
        result = validatePort(input);
        break;
      case 'pid':
        result = validatePid(input);
        break;
      case 'processName':
        result = validateProcessName(input);
        break;
      default:
        throw new Error(`Unknown validation type: ${type}`);
    }

    if (!result.isValid) {
      const error = new Error(`Invalid ${type}: ${result.error}`);
      throw this.errorHandler.handleApiError(error);
    }

    if (result.warnings && result.warnings.length > 0) {
      this.logger.warn(`Validation warnings for ${type}`, {
        platform: this.platform,
        input,
        warnings: result.warnings,
      });
    }

    return true;
  }

  protected parseProcessOutputWithSharedUtils(
    output: string
  ): RawProcessInfo[] {
    try {
      return this.parsingUtils.parseProcessList(output, this.platform);
    } catch (error) {
      this.logger.error(
        'Failed to parse process output with shared utilities',
        {
          platform: this.platform,
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // Fallback to platform-specific parsing
      return this.parseProcessOutput(output);
    }
  }

  protected parseNetworkOutputWithSharedUtils(
    output: string
  ): NetworkConnection[] {
    try {
      return this.parsingUtils.parseNetworkConnections(output, this.platform);
    } catch (error) {
      this.logger.error(
        'Failed to parse network output with shared utilities',
        {
          platform: this.platform,
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // Fallback to platform-specific parsing
      return this.parseNetworkOutput(output);
    }
  }

  protected handleError(
    error: Error,
    _operation?: string,
    _context?: any
  ): Error {
    return this.errorHandler.handleApiError(error);
  }

  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: any
  ): void {
    this.logger[level](message, {
      platform: this.platform,
      ...context,
    });
  }

  protected logOperationStart(operation: string, metadata?: any): void {
    this.sharedLogging.logOperationStart(operation, this.platform, metadata);
  }

  protected logOperationSuccess(operation: string, metadata?: any): void {
    this.sharedLogging.logOperationSuccess(operation, this.platform, metadata);
  }

  protected logOperationFailure(
    operation: string,
    error: Error,
    metadata?: any
  ): void {
    this.sharedLogging.logOperationFailure(
      operation,
      this.platform,
      error,
      metadata
    );
  }

  protected logCommandExecution(
    operation: string,
    command: string[],
    metadata?: any
  ): void {
    this.sharedLogging.logCommandExecution(
      operation,
      this.platform,
      command,
      metadata
    );
  }

  protected logProcessOperation(
    operation: string,
    pid: number,
    metadata?: any
  ): void {
    this.sharedLogging.logProcessOperation(
      operation,
      this.platform,
      pid,
      metadata
    );
  }

  protected logPortOperation(
    operation: string,
    port: number,
    protocol?: string,
    metadata?: any
  ): void {
    this.sharedLogging.logPortOperation(
      operation,
      this.platform,
      port,
      protocol,
      metadata
    );
  }
}

// Factory for creating and managing platform-specific adapters
export class PlatformAdapterFactory {
  private static instance: PlatformAdapterFactory;
  private adapters: Map<Platform, PlatformAdapter> = new Map();

  private constructor() {}

  static getInstance(): PlatformAdapterFactory {
    if (!PlatformAdapterFactory.instance) {
      PlatformAdapterFactory.instance = new PlatformAdapterFactory();
    }
    return PlatformAdapterFactory.instance;
  }

  static detectPlatform(): Platform {
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
        throw new PlatformError(`Unsupported platform: ${platform}`);
    }
  }

  async createAdapter(): Promise<PlatformAdapter> {
    const platform = PlatformAdapterFactory.detectPlatform();
    return this.createAdapterForPlatform(platform);
  }

  async createAdapterForPlatform(platform: Platform): Promise<PlatformAdapter> {
    // Check if we already have an adapter for this platform
    const existingAdapter = this.adapters.get(platform);
    if (existingAdapter) {
      return existingAdapter;
    }

    let adapter: PlatformAdapter;

    switch (platform) {
      case Platform.WINDOWS: {
        const { WindowsAdapter } = await import('./windows');
        adapter = new WindowsAdapter();
        break;
      }
      case Platform.MACOS: {
        const { MacOSAdapter } = await import('./macos');
        adapter = new MacOSAdapter();
        break;
      }
      case Platform.LINUX: {
        const { LinuxAdapter } = await import('./linux');
        adapter = new LinuxAdapter();
        break;
      }
      default:
        throw new PlatformError(
          `No adapter available for platform: ${platform}`
        );
    }

    if (!adapter.isSupported()) {
      throw new PlatformError(
        `Platform adapter for ${platform} is not supported on this system`
      );
    }

    this.adapters.set(platform, adapter);
    return adapter;
  }

  getAdapter(platform: Platform): PlatformAdapter | null {
    return this.adapters.get(platform) || null;
  }

  clearCache(): void {
    this.adapters.clear();
  }
}

export const platformFactory = PlatformAdapterFactory.getInstance();
