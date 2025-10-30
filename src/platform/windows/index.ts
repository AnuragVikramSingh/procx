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

// Windows platform adapter implementation

import {
  RawProcessInfo,
  NetworkConnection,
  SystemMetrics,
  ProcessSignal,
  Platform,
} from '../../types';
import { PlatformAdapter } from '../index';

export class WindowsAdapter extends PlatformAdapter {
  constructor() {
    super(Platform.WINDOWS);
  }

  async listProcesses(): Promise<RawProcessInfo[]> {
    try {
      const command = this.getProcessListCommand();
      this.logCommandExecution('Listing processes', command);
      
      const result = await this.executeCommand(command);
      
      // Try shared parsing utilities first, fallback to platform-specific
      return this.parseProcessOutputWithSharedUtils(result.stdout);
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'list-processes');
      this.logOperationFailure('list processes', enhancedError);
      throw enhancedError;
    }
  }

  // Kill a process using Windows taskkill command
  async killProcess(pid: number, signal: ProcessSignal): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      // Windows doesn't support POSIX signals, map to taskkill flags
      const command = ['taskkill', '/PID', pid.toString()];
      if (signal === ProcessSignal.SIGKILL || signal === ProcessSignal.SIGTERM) {
        command.push('/F');
      }
      
      this.logProcessOperation('Killing process', pid, { signal, command });
      
      await this.executeCommand(command);
      
      this.logOperationSuccess('killed process', { pid, signal });
      return true;
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'kill-process');
      this.logOperationFailure('kill process', enhancedError, { pid, signal });
      throw enhancedError;
    }
  }

  async getNetworkConnections(): Promise<NetworkConnection[]> {
    try {
      const command = this.getNetworkCommand();
      this.logCommandExecution('Getting network connections', command);
      
      const result = await this.executeCommand(command);
      
      // Try shared parsing utilities first, fallback to platform-specific
      return this.parseNetworkOutputWithSharedUtils(result.stdout);
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'get-network-connections');
      this.logOperationFailure('get network connections', enhancedError);
      throw enhancedError;
    }
  }

  // Get system metrics using Windows-specific commands
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      this.logOperationStart('Getting system metrics');
      
      // Get CPU usage
      const cpuResult = await this.executeCommand(['wmic', 'cpu', 'get', 'loadpercentage', '/value']);
      
      // Get memory usage
      const memResult = await this.executeCommand(['wmic', 'OS', 'get', 'TotalVisibleMemorySize,FreePhysicalMemory', '/value']);
      
      // Get process count
      const procResult = await this.executeCommand(['cmd', '/c', 'tasklist /fo csv | find /c /v ""']);

      const metrics = this.parseSystemMetrics(cpuResult.stdout, memResult.stdout, procResult.stdout);
      
      this.log('debug', 'Successfully retrieved system metrics on Windows', { metrics });
      return metrics;
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'get-system-metrics');
      this.log('error', 'Failed to get system metrics on Windows', { 
        error: enhancedError.message 
      });
      throw enhancedError;
    }
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['tasklist', '/FI', `PID eq ${pid}`, '/FO', 'CSV'];
      this.log('debug', 'Checking if process is running on Windows', { pid });
      
      const result = await this.executeCommand(command);
      
      const lines = result.stdout.trim().split('\n');
      const isRunning = lines.length > 1;
      
      this.log('debug', 'Process running check completed on Windows', { pid, isRunning });
      return isRunning;
    } catch (error) {
      this.log('debug', 'Process running check failed on Windows', { 
        pid, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  async getProcessInfo(pid: number): Promise<RawProcessInfo | null> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['wmic', 'process', 'where', `ProcessId=${pid}`, 'get', 'Name,CommandLine,ParentProcessId,CreationDate,WorkingSetSize', '/format:csv'];
      this.log('debug', 'Getting process info on Windows', { pid });
      
      const result = await this.executeCommand(command);
      
      const processes = this.parseProcessOutput(result.stdout);
      const processInfo = processes.find(p => p.pid === pid) || null;
      
      this.log('debug', 'Process info lookup completed on Windows', { 
        pid, 
        found: !!processInfo 
      });
      return processInfo;
    } catch (error) {
      this.log('debug', 'Failed to get process info on Windows', { 
        pid, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  async isPortAvailable(port: number, protocol: 'tcp' | 'udp' = 'tcp'): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(port, 'port');

      const protocolFlag = protocol.toUpperCase();
      const command = ['cmd', '/c', `netstat -an -p ${protocolFlag} | findstr ":${port} "`];
      this.log('debug', 'Checking port availability on Windows', { port, protocol });
      
      const result = await this.executeCommand(command);
      
      const isAvailable = result.stdout.trim().length === 0;
      
      this.log('debug', 'Port availability check completed on Windows', { 
        port, 
        protocol, 
        isAvailable 
      });
      return isAvailable;
    } catch (error) {
      this.log('debug', 'Port availability check failed, assuming available on Windows', { 
        port, 
        protocol, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return true;
    }
  }

  async getProcessByPort(port: number): Promise<number | null> {
    try {
      // Use shared validation
      this.validateInput(port, 'port');

      const command = ['cmd', '/c', `netstat -ano | findstr ":${port} "`];
      this.log('debug', 'Getting process by port on Windows', { port });
      
      const result = await this.executeCommand(command);
      
      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parseInt(parts[4] || '', 10);
          if (!isNaN(pid) && pid > 0) {
            this.log('debug', 'Process by port lookup completed on Windows', { 
              port, 
              pid 
            });
            return pid;
          }
        }
      }
      
      this.log('debug', 'No process found for port on Windows', { port });
      return null;
    } catch (error) {
      this.log('debug', 'Failed to get process by port on Windows', { 
        port, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  protected getProcessListCommand(): string[] {
    return [
      'wmic',
      'process',
      'get',
      'Name,ProcessId,ParentProcessId,CommandLine,CreationDate,WorkingSetSize,PageFileUsage',
      '/format:csv'
    ];
  }

  protected getNetworkCommand(): string[] {
    return ['netstat', '-ano'];
  }

  // Parse Windows process output from WMIC CSV format
  protected parseProcessOutput(output: string): RawProcessInfo[] {
    const processes: RawProcessInfo[] = [];
    const lines = output.trim().split('\n');
    
    // WMIC CSV format: Node,CommandLine,CreationDate,Name,ParentProcessId,ProcessId,WorkingSetSize
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 6) {
        try {
          const pid = parseInt(parts[5] || '', 10);        // ProcessId
          const ppid = parseInt(parts[4] || '', 10);       // ParentProcessId
          const name = parts[3]?.replace(/"/g, '') || '';  // Name
          const command = parts[1]?.replace(/"/g, '') || '';// CommandLine
          const memory = parseInt(parts[6] || '0', 10) || 0;
          
          if (!isNaN(pid) && pid > 0) {
            processes.push({
              pid,
              ppid: isNaN(ppid) ? undefined : ppid,
              name,
              command,
              memory: Math.round(memory / 1024),
              status: 'running',
            });
          }
        } catch {
          // Skip malformed lines
          continue;
        }
      }
    }
    
    return processes;
  }

  // Parse Windows network output from netstat
  protected parseNetworkOutput(output: string): NetworkConnection[] {
    const connections: NetworkConnection[] = [];
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        try {
          const protocol = (parts[0] || '').toLowerCase() as 'tcp' | 'udp';
          const localAddr = parts[1];
          const remoteAddr = parts[2];
          const state = parts[3] || 'UNKNOWN';
          const pid = parts[4] ? parseInt(parts[4], 10) : undefined;
          
          if (localAddr) {
            let localAddress: string;
            let localPortStr: string;
            
            if (localAddr.startsWith('[')) {
              const bracketEnd = localAddr.lastIndexOf(']:');
              if (bracketEnd !== -1) {
                localAddress = localAddr.substring(1, bracketEnd);
                localPortStr = localAddr.substring(bracketEnd + 2);
              } else {
                continue;
              }
            } else {
              const lastColon = localAddr.lastIndexOf(':');
              localAddress = localAddr.substring(0, lastColon);
              localPortStr = localAddr.substring(lastColon + 1);
            }
            
            const localPort = parseInt(localPortStr || '', 10);
            
            if (!isNaN(localPort) && localAddress) {
              const connection: NetworkConnection = {
                localAddress,
                localPort,
                protocol,
                state,
                pid: isNaN(pid!) ? undefined : pid,
              };
              
              if (remoteAddr && remoteAddr !== '0.0.0.0:0' && remoteAddr !== '*:*') {
                let remoteAddress: string;
                let remotePortStr: string;
                
                if (remoteAddr.startsWith('[')) {
                  const bracketEnd = remoteAddr.lastIndexOf(']:');
                  if (bracketEnd !== -1) {
                    remoteAddress = remoteAddr.substring(1, bracketEnd);
                    remotePortStr = remoteAddr.substring(bracketEnd + 2);
                  } else {
                    remoteAddress = '';
                    remotePortStr = '';
                  }
                } else {
                  const lastColon = remoteAddr.lastIndexOf(':');
                  remoteAddress = remoteAddr.substring(0, lastColon);
                  remotePortStr = remoteAddr.substring(lastColon + 1);
                }
                
                const remotePort = parseInt(remotePortStr || '', 10);
                if (!isNaN(remotePort) && remoteAddress) {
                  connection.remoteAddress = remoteAddress;
                  connection.remotePort = remotePort;
                }
              }
              
              connections.push(connection);
            }
          }
        } catch {
          // Skip malformed lines
          continue;
        }
      }
    }
    
    return connections;
  }

  // Parse Windows system metrics from command outputs
  private parseSystemMetrics(cpuOutput: string, memOutput: string, procOutput: string): SystemMetrics {
    let cpuUsage = 0;
    const cpuMatch = cpuOutput.match(/LoadPercentage=(\d+)/);
    if (cpuMatch && cpuMatch[1]) {
      const parsed = parseInt(cpuMatch[1], 10);
      cpuUsage = Math.min(Math.max(parsed, 0), 100);
    }
    
    let totalMemory = 0;
    let freeMemory = 0;
    
    const totalMatch = memOutput.match(/TotalVisibleMemorySize=(\d+)/);
    const freeMatch = memOutput.match(/FreePhysicalMemory=(\d+)/);
    
    if (totalMatch && totalMatch[1]) {
      const parsed = parseInt(totalMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        totalMemory = parsed * 1024;
      }
    }
    
    if (freeMatch && freeMatch[1]) {
      const parsed = parseInt(freeMatch[1], 10);
      if (!isNaN(parsed) && parsed >= 0) {
        freeMemory = Math.min(parsed * 1024, totalMemory);
      }
    }
    
    const usedMemory = Math.max(totalMemory - freeMemory, 0);
    
    let processCount = 0;
    const procMatch = procOutput.match(/(\d+)/);
    if (procMatch && procMatch[1]) {
      const parsed = parseInt(procMatch[1], 10);
      if (!isNaN(parsed) && parsed > 1) {
        processCount = parsed - 1;
      }
    }
    
    return {
      cpuUsage,
      memoryUsage: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
      },
      loadAverage: [cpuUsage / 100],
      uptime: 0,
      processCount: Math.max(processCount, 0),
    };
  }
}