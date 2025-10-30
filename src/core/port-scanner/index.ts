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
  PortInfo,
  PortScanOptions,
  ProcessInfo,
  PortProtocol,
  SystemError,
  ErrorCodes,
  ResolveResult,
  NetworkConnection,
} from '../../types';
import { PlatformAdapter, platformFactory } from '../../platform';
import { ProcessManager } from '../process-manager';
import { CommandExecutor } from '../../utils/command-executor';
import { ParsingUtils } from '../../utils/parsing-utils';
import { errorRecovery } from '../../utils/error-recovery';
import { getLogger } from '../../utils/logger';
import { SharedPerformanceMonitoring } from '../../utils/shared-logging';

/**
 * Network port scanner and management
 */
export class PortScanner {
  private platformAdapter: PlatformAdapter | null = null;
  private processManager: ProcessManager;
  private commandExecutor: CommandExecutor;
  private parsingUtils: ParsingUtils;
  private logger = getLogger('port-scanner');
  private connectionCache = new Map<string, { connections: NetworkConnection[]; timestamp: number }>();
  private readonly cacheExpiry = 5000;

  constructor() {
    this.processManager = new ProcessManager();
    this.commandExecutor = new CommandExecutor();
    this.parsingUtils = new ParsingUtils();
  }

  private async ensurePlatformAdapter(): Promise<PlatformAdapter> {
    if (!this.platformAdapter) {
      this.platformAdapter = await platformFactory.createAdapter();
    }
    return this.platformAdapter;
  }

  // Get network connections with caching
  private async getNetworkConnectionsOptimized(): Promise<NetworkConnection[]> {
    const cacheKey = 'network-connections';
    const cached = this.connectionCache.get(cacheKey);
    
    // Check if cache is valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      this.logger.debug('Using cached network connections');
      return cached.connections;
    }

    // Use error recovery for robust connection retrieval
    const result = await errorRecovery.executeWithRecovery(
      async () => {
        const adapter = await this.ensurePlatformAdapter();
        return await adapter.getNetworkConnections();
      },
      async () => {
        // Fallback: try direct command execution
        this.logger.debug('Platform adapter failed, trying direct command execution');
        return await this.getNetworkConnectionsDirect();
      }
    );

    if (result.success) {
      // Cache the results
      this.connectionCache.set(cacheKey, {
        connections: result.data!,
        timestamp: Date.now(),
      });
      
      return result.data!;
    } else {
      throw result.error!;
    }
  }

  // Direct network connection retrieval as fallback
  private async getNetworkConnectionsDirect(): Promise<NetworkConnection[]> {
    const platform = this.commandExecutor.getPlatform();
    
    try {
      let command: string[];
      
      // Platform-specific commands for network connections
      switch (platform) {
        case 'linux':
          command = ['ss', '-tuln'];
          break;
        case 'darwin':
          command = ['netstat', '-an'];
          break;
        case 'win32':
          command = ['netstat', '-an'];
          break;
        default:
          command = ['netstat', '-an'];
      }

      const result = await this.commandExecutor.execute(command, {
        timeout: 10000, // 10 second timeout
      });

      // Parse the output using shared parsing utilities
      return this.parsingUtils.parseNetworkConnections(result.stdout, platform);
    } catch (error) {
      this.logger.debug('Direct network connection retrieval failed', {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Filter network connections based on scan options
  private filterConnections(
    connections: NetworkConnection[],
    options: PortScanOptions
  ): NetworkConnection[] {
    return connections.filter(connection => {
      // Protocol filter
      if (options.protocol && connection.protocol !== options.protocol) {
        return false;
      }

      // Port range filter
      if (options.startPort && connection.localPort < options.startPort) {
        return false;
      }
      if (options.endPort && connection.localPort > options.endPort) {
        return false;
      }

      return true;
    });
  }

  // Convert network connections to port info with process association
  private async convertConnectionsToPortInfo(
    connections: NetworkConnection[]
  ): Promise<PortInfo[]> {
    const portInfos: PortInfo[] = [];
    const processCache = new Map<number, ProcessInfo>();

    // Process connections in batches for better performance
    const batchSize = 50;
    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (connection) => {
        let processInfo: ProcessInfo | undefined;

        // Get process information if PID is available
        if (connection.pid) {
          // Check cache first
          if (processCache.has(connection.pid)) {
            processInfo = processCache.get(connection.pid);
          } else {
            // Fetch process info and cache it
            try {
              const foundProcess = await this.processManager.findByPid(connection.pid);
              if (foundProcess) {
                processInfo = foundProcess;
                processCache.set(connection.pid, foundProcess);
              }
            } catch (error) {
              // Process might have terminated, continue without process info
              this.logger.debug('Failed to get process info for PID', {
                pid: connection.pid,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        const portInfo: PortInfo = {
          port: connection.localPort,
          protocol: connection.protocol,
          state: connection.state,
          localAddress: connection.localAddress,
          ...(connection.remoteAddress && { remoteAddress: connection.remoteAddress }),
          ...(processInfo && { process: processInfo }),
        };

        return portInfo;
      });

      const batchResults = await Promise.all(batchPromises);
      portInfos.push(...batchResults);
    }

    return portInfos;
  }

  // Sort and optimize port results
  private sortAndOptimizePorts(
    portInfos: PortInfo[],
    _options: PortScanOptions
  ): PortInfo[] {
    // Remove duplicates based on port and protocol
    const uniquePorts = new Map<string, PortInfo>();
    
    for (const portInfo of portInfos) {
      const key = `${portInfo.port}-${portInfo.protocol}`;
      
      // Keep the entry with process info if available
      const existing = uniquePorts.get(key);
      if (!existing || (!existing.process && portInfo.process)) {
        uniquePorts.set(key, portInfo);
      }
    }

    // Convert back to array and sort
    const uniquePortsArray = Array.from(uniquePorts.values());
    
    // Sort by port number for consistent output
    return uniquePortsArray.sort((a, b) => {
      // Primary sort: port number
      const portDiff = a.port - b.port;
      if (portDiff !== 0) return portDiff;
      
      // Secondary sort: protocol (tcp before udp)
      return a.protocol.localeCompare(b.protocol);
    });
  }

  // Clear connection cache
  private clearConnectionCache(): void {
    this.connectionCache.clear();
  }



  // Validate port range parameters
  private validatePortRange(startPort: number, endPort: number): void {
    if (startPort < 1 || startPort > 65535) {
      throw new SystemError(
        'Start port must be between 1 and 65535',
        ErrorCodes.INVALID_PORT,
        { startPort }
      );
    }

    if (endPort < startPort || endPort > 65535) {
      throw new SystemError(
        'End port must be between start port and 65535',
        ErrorCodes.INVALID_PORT,
        { startPort, endPort }
      );
    }
  }

  /**
   * Optimized free port finding with batch checking
   * 
   * @private
   * @param {number} startPort - Starting port number
   * @param {number} endPort - Ending port number
   * @param {PortProtocol} protocol - Protocol to check
   * @returns {Promise<number>} First available port
   * @throws {SystemError} If no free ports found
   */
  private async findFreePortOptimized(
    startPort: number,
    endPort: number,
    protocol: PortProtocol
  ): Promise<number> {
    // Get current active ports for the protocol
    const activePorts = await this.getActivePorts({ protocol });
    const activePortSet = new Set(activePorts.map(p => p.port));

    // Check ports in batches for better performance
    const batchSize = 100;
    
    for (let batchStart = startPort; batchStart <= endPort; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, endPort);
      
      // Check batch for available ports
      for (let port = batchStart; port <= batchEnd; port++) {
        if (!activePortSet.has(port)) {
          // Double-check availability using platform adapter
          try {
            const isAvailable = await this.isPortAvailableWithFallback(port, protocol);
            if (isAvailable) {
              return port;
            }
          } catch (error) {
            // If we can't check the port, assume it's not available and continue
            this.logger.debug('Port availability check failed', {
              port,
              protocol,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }
        }
      }
    }

    throw new SystemError(
      `No available ports found in range ${startPort}-${endPort}`,
      ErrorCodes.NO_FREE_PORT,
      { startPort, endPort, protocol }
    );
  }

  /**
   * Check port availability with fallback strategies
   * 
   * @private
   * @param {number} port - Port number to check
   * @param {PortProtocol} protocol - Protocol to check
   * @returns {Promise<boolean>} True if port is available
   */
  private async isPortAvailableWithFallback(
    port: number,
    protocol: PortProtocol
  ): Promise<boolean> {
    const result = await errorRecovery.executeWithRecovery(
      async () => {
        const adapter = await this.ensurePlatformAdapter();
        return await adapter.isPortAvailable(port, protocol);
      },
      async () => {
        // Fallback: direct socket test
        this.logger.debug('Platform adapter failed, using direct socket test', { port, protocol });
        return await this.testPortAvailabilityDirect(port, protocol);
      }
    );

    if (result.success) {
      return result.data!;
    } else {
      // If both methods fail, assume port is not available
      this.logger.warn('All port availability checks failed, assuming port is unavailable', {
        port,
        protocol,
        error: result.error?.message,
      });
      return false;
    }
  }

  /**
   * Direct port availability test using socket binding
   * 
   * @private
   * @param {number} port - Port number to test
   * @param {PortProtocol} protocol - Protocol to test
   * @returns {Promise<boolean>} True if port is available
   */
  private async testPortAvailabilityDirect(
    port: number,
    protocol: PortProtocol
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const dgram = require('dgram');

      if (protocol === 'tcp') {
        const server = net.createServer();
        
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve(true));
        });
        
        server.on('error', () => resolve(false));
      } else {
        const socket = dgram.createSocket('udp4');
        
        socket.bind(port, '127.0.0.1', () => {
          socket.close(() => resolve(true));
        });
        
        socket.on('error', () => resolve(false));
      }
    });
  }

  /**
   * Enhanced port conflict resolution with better error handling and recovery
   * 
   * @private
   * @param {number} port - Port number to resolve conflicts for
   * @param {boolean} force - Whether to use force kill
   * @param {ResolveResult} result - Result object to update
   * @returns {Promise<boolean>} True if conflicts were resolved successfully
   */
  private async resolvePortConflictsEnhanced(
    port: number,
    force: boolean,
    result: ResolveResult
  ): Promise<boolean> {
    try {
      // Find all processes using the port (there might be multiple)
      const conflictingProcesses = await this.findAllProcessesOnPort(port);
      
      if (conflictingProcesses.length === 0) {
        this.logger.debug('No conflicting processes found on port', { port });
        return true;
      }

      this.logger.info('Found conflicting processes on port', {
        port,
        processCount: conflictingProcesses.length,
        processes: conflictingProcesses.map(p => ({ pid: p.pid, name: p.name })),
      });

      // Kill processes with retry logic and graceful degradation
      for (const process of conflictingProcesses) {
        const killResult = await this.killProcessWithRetry(process, force);
        
        if (killResult.success) {
          result.killedProcesses.push(process);
          this.logger.debug('Successfully killed conflicting process', {
            pid: process.pid,
            name: process.name,
            port,
          });
        } else {
          result.error = `Failed to kill process ${process.name} (PID: ${process.pid}): ${killResult.error}`;
          this.logger.error('Failed to kill conflicting process', {
            pid: process.pid,
            name: process.name,
            port,
            error: killResult.error,
          });
          return false;
        }
      }

      // Wait for processes to fully terminate and verify port is free
      const verificationResult = await this.verifyPortIsFreed(port);
      
      if (!verificationResult.success) {
        result.error = `Port ${port} is still in use after killing processes: ${verificationResult.error}`;
        return false;
      }

      return true;
    } catch (error) {
      result.error = `Error during conflict resolution: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return false;
    }
  }

  /**
   * Find all processes using a specific port
   * 
   * @private
   * @param {number} port - Port number to check
   * @returns {Promise<ProcessInfo[]>} Array of processes using the port
   */
  private async findAllProcessesOnPort(port: number): Promise<ProcessInfo[]> {
    const processes: ProcessInfo[] = [];
    
    try {
      // Get all active ports and find processes using the specified port
      const activePorts = await this.getActivePorts({ startPort: port, endPort: port });
      
      for (const portInfo of activePorts) {
        if (portInfo.process && portInfo.port === port) {
          // Verify the process still exists
          try {
            const processExists = await this.processManager.findByPid(portInfo.process.pid);
            if (processExists) {
              processes.push(processExists);
            }
          } catch {
            // Process might have terminated, skip it
          }
        }
      }

      // Also try direct process manager lookup as fallback
      try {
        const directProcess = await this.processManager.findByPort(port);
        if (directProcess && !processes.some(p => p.pid === directProcess.pid)) {
          processes.push(directProcess);
        }
      } catch {
        // Ignore errors from direct lookup
      }

      return processes;
    } catch (error) {
      this.logger.error('Failed to find processes on port', {
        port,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Kill a process with retry logic and graceful degradation
   * 
   * @private
   * @param {ProcessInfo} process - Process to kill
   * @param {boolean} force - Whether to use force kill
   * @returns {Promise<{success: boolean; error?: string}>} Kill result
   */
  private async killProcessWithRetry(
    process: ProcessInfo,
    force: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const maxRetries = 3;
    const retryDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug('Attempting to kill process', {
          pid: process.pid,
          name: process.name,
          attempt,
          force: force || attempt === maxRetries, // Force kill on last attempt
        });

        const killSuccess = await this.processManager.kill(
          process.pid, 
          force || attempt === maxRetries // Use force on last attempt
        );

        if (killSuccess) {
          // Wait for process to terminate
          await this.waitForProcessTermination(process.pid, 2000);
          return { success: true };
        } else {
          if (attempt === maxRetries) {
            return { 
              success: false, 
              error: `Failed to kill process after ${maxRetries} attempts` 
            };
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt === maxRetries) {
          return { success: false, error: errorMessage };
        }
        
        this.logger.warn('Process kill attempt failed, retrying', {
          pid: process.pid,
          attempt,
          error: errorMessage,
        });
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
      }
    }

    return { success: false, error: 'Maximum retry attempts exceeded' };
  }

  /**
   * Wait for a process to terminate
   * 
   * @private
   * @param {number} pid - Process ID to wait for
   * @param {number} timeoutMs - Maximum time to wait
   * @returns {Promise<boolean>} True if process terminated
   */
  private async waitForProcessTermination(pid: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to find the process
        const process = await this.processManager.findByPid(pid);
        if (!process) {
          return true; // Process terminated
        }
      } catch {
        return true; // Process not found, likely terminated
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return false; // Timeout reached
  }

  /**
   * Verify that a port is freed after killing processes
   * 
   * @private
   * @param {number} port - Port number to verify
   * @returns {Promise<{success: boolean; error?: string}>} Verification result
   */
  private async verifyPortIsFreed(port: number): Promise<{ success: boolean; error?: string }> {
    const maxAttempts = 10;
    const checkInterval = 500; // 500ms between checks

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Clear cache to ensure fresh data
        this.clearConnectionCache();
        
        // Check if port is available
        const isAvailable = await this.isPortAvailable(port);
        
        if (isAvailable) {
          this.logger.debug('Port verified as free', { port, attempt });
          return { success: true };
        }

        if (attempt === maxAttempts) {
          return { 
            success: false, 
            error: `Port ${port} is still in use after ${maxAttempts} verification attempts` 
          };
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt === maxAttempts) {
          return { success: false, error: `Port verification failed: ${errorMessage}` };
        }
        
        this.logger.debug('Port verification attempt failed, retrying', {
          port,
          attempt,
          error: errorMessage,
        });
      }
    }

    return { success: false, error: 'Port verification timeout' };
  }

  /**
   * Execute command with recovery strategies and timeout handling
   * 
   * @private
   * @param {string} command - Command to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {ResolveResult} result - Result object to update
   * @returns {Promise<boolean>} True if command executed successfully
   */
  private async executeCommandWithRecovery(
    command: string,
    timeoutMs: number,
    result: ResolveResult
  ): Promise<boolean> {
    try {
      this.logger.debug('Executing command with recovery', {
        command: command.substring(0, 100),
        timeoutMs,
      });

      // Parse and validate command
      const commandParts = this.parseCommand(command);
      
      // Execute command using shared command executor
      const commandResult = await this.commandExecutor.execute(commandParts, {
        timeout: timeoutMs,
        shell: true,
      });

      result.commandExecuted = true;
      result.commandOutput = commandResult.stdout;

      this.logger.debug('Command executed successfully', {
        command: command.substring(0, 100),
        exitCode: commandResult.exitCode,
        duration: commandResult.duration,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.error = `Failed to execute command: ${errorMessage}`;
      result.commandExecuted = false;

      this.logger.error('Command execution failed', {
        command: command.substring(0, 100),
        error: errorMessage,
      });

      return false;
    }
  }

  /**
   * Parse command string into array for safe execution
   * 
   * @private
   * @param {string} command - Command string to parse
   * @returns {string[]} Parsed command array
   */
  private parseCommand(command: string): string[] {
    // Simple command parsing - for more complex parsing, could use a library
    const trimmed = command.trim();
    
    // For shell commands, we'll execute them through the shell
    // The CommandExecutor will handle validation and security
    return [trimmed];
  }

  /**
   * Clear internal caches to force fresh data retrieval
   */
  clearCache(): void {
    this.clearConnectionCache();
    this.logger.debug('Port scanner cache cleared');
  }

  /**
   * Get cache statistics for monitoring and debugging
   */
  getCacheStats(): { entries: number; oldestEntry?: number; newestEntry?: number } {
    const entries = this.connectionCache.size;
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;

    for (const [, value] of this.connectionCache) {
      if (oldestEntry === undefined || value.timestamp < oldestEntry) {
        oldestEntry = value.timestamp;
      }
      if (newestEntry === undefined || value.timestamp > newestEntry) {
        newestEntry = value.timestamp;
      }
    }

    const result: { entries: number; oldestEntry?: number; newestEntry?: number } = {
      entries,
    };

    if (oldestEntry !== undefined) {
      result.oldestEntry = oldestEntry;
    }
    if (newestEntry !== undefined) {
      result.newestEntry = newestEntry;
    }

    return result;
  }

  /**
   * Set cache expiry time
   */
  setCacheExpiry(expiryMs: number): void {
    if (expiryMs < 0) {
      throw new Error('Cache expiry must be non-negative');
    }
    
    // Use reflection to modify the readonly property
    (this as any).cacheExpiry = expiryMs;
    
    this.logger.debug('Cache expiry updated', { expiryMs });
  }

  /**
   * Get current cache expiry time
   */
  getCacheExpiry(): number {
    return this.cacheExpiry;
  }

  /**
   * Get all active network ports with their associated processes
   */
  async getActivePorts(options: PortScanOptions = {}): Promise<PortInfo[]> {
    const operationId = SharedPerformanceMonitoring.startOperation('get-active-ports', { options });

    try {
      // Get network connections using optimized method
      const connections = await this.getNetworkConnectionsOptimized();
      
      // Filter connections based on options
      const filteredConnections = this.filterConnections(connections, options);
      
      // Convert connections to port info with process association
      const portInfos = await this.convertConnectionsToPortInfo(filteredConnections);
      
      // Sort and optimize results
      const sortedPorts = this.sortAndOptimizePorts(portInfos, options);

      SharedPerformanceMonitoring.endOperation(operationId, true);
      
      this.logger.debug('Retrieved active ports', {
        totalConnections: connections.length,
        filteredConnections: filteredConnections.length,
        finalPorts: sortedPorts.length,
        options,
      });

      return sortedPorts;
    } catch (error) {
      SharedPerformanceMonitoring.endOperation(operationId, false, error instanceof Error ? error.message : String(error));
      
      this.logger.error('Failed to get active ports', {
        error: error instanceof Error ? error.message : String(error),
        options,
      });

      throw new SystemError(
        'Failed to get active ports',
        ErrorCodes.SYSTEM_CALL_FAILED,
        { originalError: error, options }
      );
    }
  }

  /**
   * Find the next available port starting from a specified port number
   */
  async findFreePort(
    startPort: number = 3000,
    endPort: number = 65535,
    protocol: PortProtocol = 'tcp'
  ): Promise<number> {
    const operationId = SharedPerformanceMonitoring.startOperation('find-free-port', {
      startPort,
      endPort,
      protocol,
    });

    try {
      // Validate port range
      this.validatePortRange(startPort, endPort);

      // Use optimized port availability checking
      const freePort = await this.findFreePortOptimized(startPort, endPort, protocol);

      SharedPerformanceMonitoring.endOperation(operationId, true);
      
      this.logger.debug('Found free port', {
        port: freePort,
        startPort,
        endPort,
        protocol,
      });

      return freePort;
    } catch (error) {
      SharedPerformanceMonitoring.endOperation(operationId, false, error instanceof Error ? error.message : String(error));
      
      this.logger.error('Failed to find free port', {
        startPort,
        endPort,
        protocol,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Check if a specific port is available for binding
   */
  async isPortAvailable(port: number, protocol: PortProtocol = 'tcp'): Promise<boolean> {
    if (port < 1 || port > 65535) {
      throw new SystemError(
        'Port must be between 1 and 65535',
        ErrorCodes.INVALID_PORT,
        { port }
      );
    }

    const operationId = SharedPerformanceMonitoring.startOperation('is-port-available', { port, protocol });

    try {
      const isAvailable = await this.isPortAvailableWithFallback(port, protocol);
      
      SharedPerformanceMonitoring.endOperation(operationId, true);
      
      this.logger.debug('Port availability check completed', {
        port,
        protocol,
        available: isAvailable,
      });

      return isAvailable;
    } catch (error) {
      SharedPerformanceMonitoring.endOperation(operationId, false, error instanceof Error ? error.message : String(error));
      
      this.logger.error('Port availability check failed', {
        port,
        protocol,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Scan a range of ports for active connections
   */
  async scanRange(
    startPort: number,
    endPort: number,
    protocol?: PortProtocol
  ): Promise<PortInfo[]> {
    const operationId = SharedPerformanceMonitoring.startOperation('scan-port-range', {
      startPort,
      endPort,
      protocol,
    });

    try {
      // Validate port range
      this.validatePortRange(startPort, endPort);

      const options: PortScanOptions = {
        startPort,
        endPort,
        ...(protocol && { protocol }),
      };

      const ports = await this.getActivePorts(options);

      SharedPerformanceMonitoring.endOperation(operationId, true);
      
      this.logger.debug('Port range scan completed', {
        startPort,
        endPort,
        protocol,
        portsFound: ports.length,
      });

      return ports;
    } catch (error) {
      SharedPerformanceMonitoring.endOperation(operationId, false, error instanceof Error ? error.message : String(error));
      
      this.logger.error('Port range scan failed', {
        startPort,
        endPort,
        protocol,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Resolve port conflicts by terminating processes and executing a command
   */
  async resolveConflict(
    port: number, 
    command: string, 
    force: boolean = false,
    timeoutMs: number = 30000
  ): Promise<ResolveResult> {
    const operationId = SharedPerformanceMonitoring.startOperation('resolve-conflict', {
      port,
      command: command.substring(0, 50), // Truncate for logging
      force,
      timeoutMs,
    });

    // Validate inputs
    if (port < 1 || port > 65535) {
      throw new SystemError(
        'Port must be between 1 and 65535',
        ErrorCodes.INVALID_PORT,
        { port }
      );
    }

    if (!command || command.trim().length === 0) {
      throw new SystemError(
        'Command cannot be empty',
        ErrorCodes.INVALID_INPUT,
        { command }
      );
    }

    const result: ResolveResult = {
      success: false,
      killedProcesses: [],
      commandExecuted: false,
    };

    try {
      this.logger.info('Starting port conflict resolution', {
        port,
        command: command.substring(0, 100),
        force,
        timeoutMs,
      });

      // Step 1: Resolve port conflicts with enhanced error handling
      const conflictResolved = await this.resolvePortConflictsEnhanced(port, force, result);
      
      if (!conflictResolved) {
        SharedPerformanceMonitoring.endOperation(operationId, false, result.error || 'Conflict resolution failed');
        return result;
      }

      // Step 2: Execute command with timeout and recovery
      const commandSuccess = await this.executeCommandWithRecovery(command, timeoutMs, result);
      
      if (commandSuccess) {
        result.success = true;
        this.logger.info('Port conflict resolution completed successfully', {
          port,
          killedProcesses: result.killedProcesses.length,
          commandExecuted: result.commandExecuted,
        });
      }

      SharedPerformanceMonitoring.endOperation(operationId, result.success);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      result.error = errorMessage;
      
      SharedPerformanceMonitoring.endOperation(operationId, false, errorMessage);
      
      this.logger.error('Port conflict resolution failed', {
        port,
        command: command.substring(0, 100),
        error: errorMessage,
      });

      return result;
    }
  }


}