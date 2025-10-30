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

// macOS platform adapter implementation

import {
  RawProcessInfo,
  NetworkConnection,
  SystemMetrics,
  ProcessSignal,
  Platform,
} from '../../types';
import { PlatformAdapter } from '../index';

export class MacOSAdapter extends PlatformAdapter {
  constructor() {
    super(Platform.MACOS);
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

  async killProcess(pid: number, signal: ProcessSignal): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['kill', `-${signal}`, pid.toString()];
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

  // Get system metrics using macOS-specific commands
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      this.logOperationStart('Getting system metrics');
      
      // Get CPU usage using top
      const topResult = await this.executeCommand(['top', '-l', '1', '-n', '0']);
      // Extract CPU usage line from top output
      const cpuLine = topResult.stdout.split('\n').find(line => line.includes('CPU usage')) || '';
      
      // Get memory usage using vm_stat
      const memResult = await this.executeCommand(['vm_stat']);
      
      // Get load average using uptime
      const loadResult = await this.executeCommand(['uptime']);
      
      // Get process count
      const psResult = await this.executeCommand(['ps', 'aux']);
      const processCount = psResult.stdout.split('\n').length - 1; // Subtract header line

      const metrics = this.parseSystemMetrics(
        cpuLine, 
        memResult.stdout, 
        loadResult.stdout, 
        processCount.toString()
      );
      return metrics;
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'get-system-metrics');
      this.log('error', 'Failed to get system metrics on macOS', { 
        error: enhancedError.message
      });
      throw enhancedError;
    }
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['ps', '-p', pid.toString()];
      this.log('debug', 'Checking if process is running on macOS', { pid });
      
      await this.executeCommand(command);
      
      this.log('debug', 'Process is running on macOS', { pid });
      return true;
    } catch {
      this.log('debug', 'Process is not running on macOS', { pid });
      return false;
    }
  }

  async getProcessInfo(pid: number): Promise<RawProcessInfo | null> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['ps', '-p', pid.toString(), '-o', 'pid,ppid,comm,command,rss,%cpu,stat,lstart'];
      this.log('debug', 'Getting process info on macOS', { pid });
      
      const result = await this.executeCommand(command);
      
      if (!result.stdout.trim()) {
        this.log('debug', 'No process info found on macOS', { pid });
        return null;
      }
      
      const lines = result.stdout.trim().split('\n');
      if (lines.length < 2) {
        return null;
      }
      
      // Parse the data line (skip header)
      const dataLine = lines[1]?.trim();
      if (!dataLine) {
        return null;
      }
      
      const parts = dataLine.split(/\s+/);
      if (parts.length >= 7) {
        const parsedPid = parseInt(parts[0] || '', 10);
        const ppid = parseInt(parts[1] || '', 10);
        const cpu = this.parsingUtils.parseCpuUsage(parts[5] || '0');
        const memory = this.parsingUtils.parseMemoryUsage(parts[4] || '0'); // RSS in KB
        const status = this.parsingUtils.parseProcessStatus(parts[6] || 'unknown', this.platform);
        const command = parts.slice(3).join(' ');
        const name = parts[2] || '';
        
        if (!isNaN(parsedPid) && parsedPid === pid) {
          const processInfo = {
            pid: parsedPid,
            ppid: isNaN(ppid) ? undefined : ppid,
            name: name.split('/').pop() || name,
            command,
            cpu,
            memory,
            status,
          };
          
          this.log('debug', 'Successfully retrieved process info on macOS', { 
            pid, 
            processInfo 
          });
          return processInfo;
        }
      }
      
      return null;
    } catch (error) {
      this.log('debug', 'Failed to get process info on macOS', { 
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

      const command = ['lsof', '-i', `${protocol}:${port}`];
      this.log('debug', 'Checking port availability on macOS', { port, protocol });
      
      const result = await this.executeCommand(command);
      
      // If lsof returns output, the port is in use
      const isAvailable = result.stdout.trim().length === 0;
      
      this.log('debug', 'Port availability check completed on macOS', { 
        port, 
        protocol, 
        isAvailable 
      });
      return isAvailable;
    } catch (error) {
      // If command fails (no process using port), port is typically available
      this.log('debug', 'Port availability check failed, assuming available on macOS', { 
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

      const command = ['lsof', `-ti:${port}`];
      this.log('debug', 'Getting process by port on macOS', { port });
      
      const result = await this.executeCommand(command);
      
      const pidStr = result.stdout.trim();
      if (pidStr) {
        const pid = parseInt(pidStr, 10);
        const validPid = isNaN(pid) || pid <= 0 ? null : pid;
        
        this.log('debug', 'Process by port lookup completed on macOS', { 
          port, 
          pid: validPid 
        });
        return validPid;
      }
      
      this.log('debug', 'No process found for port on macOS', { port });
      return null;
    } catch (error) {
      this.log('debug', 'Failed to get process by port on macOS', { 
        port, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  protected getProcessListCommand(): string[] {
    // Use ps -eo format to include PPID
    return ['ps', '-eo', 'user,pid,ppid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,command'];
  }

  protected getNetworkCommand(): string[] {
    return ['lsof', '-i', '-P', '-n'];
  }

  // Parse macOS process output from ps aux
  protected parseProcessOutput(output: string): RawProcessInfo[] {
    const processes: RawProcessInfo[] = [];
    const lines = output.trim().split('\n');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      // Split by whitespace but be careful with command field which can contain spaces
      const parts = line.split(/\s+/);
      if (parts.length >= 11) {
        try {
          // macOS ps aux format: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
          const pid = parseInt(parts[1] || '', 10);
          const cpu = parseFloat(parts[2] || '0');
          const memory = parseInt(parts[5] || '0', 10); // RSS in KB
          const status = parts[7] || 'unknown';
          const command = parts.slice(10).join(' ');
          
          // Extract process name from command (first part of command or basename of path)
          let name = '';
          if (command) {
            const commandParts = command.split(/\s+/);
            const firstPart = commandParts[0] || '';
            if (firstPart.includes('/')) {
              // If it's a path, get the basename
              name = firstPart.split('/').pop() || firstPart;
            } else {
              name = firstPart;
            }
          }
          
          // Extract PPID from ps aux output (not directly available, would need separate call)
          let ppid: number | undefined;
          
          if (!isNaN(pid) && pid > 0 && name) {
            processes.push({
              pid,
              ppid,
              name,
              command,
              cpu,
              memory,
              status: this.parsingUtils.parseProcessStatus(status, this.platform),
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

  // Parse macOS network output from lsof
  protected parseNetworkOutput(output: string): NetworkConnection[] {
    const connections: NetworkConnection[] = [];
    const lines = output.trim().split('\n');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        try {
          const pid = parseInt(parts[1] || '', 10);
          const protocol = (parts[7] || '').toLowerCase() as 'tcp' | 'udp';
          const name = parts[8];
          
          if (name && name.includes(':')) {
            const [address, portStr] = name.split(':');
            const port = parseInt(portStr || '', 10);
            
            if (!isNaN(port) && !isNaN(pid) && address) {
              connections.push({
                localAddress: address,
                localPort: port,
                protocol,
                state: 'LISTEN', // lsof typically shows listening ports
                pid,
              });
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

  // Parse macOS system metrics from command outputs
  private parseSystemMetrics(
    cpuOutput: string,
    memOutput: string,
    loadOutput: string,
    procOutput: string
  ): SystemMetrics {
    // Parse CPU usage from top output
    let cpuUsage = 0;
    const cpuMatch = cpuOutput.match(/(\d+\.\d+)%\s+user/);
    if (cpuMatch && cpuMatch[1]) {
      cpuUsage = parseFloat(cpuMatch[1]);
    }
    
    // Parse memory usage from vm_stat
    let totalMemory = 0;
    let freeMemory = 0;
    
    // Extract page size from vm_stat output
    let pageSize = 4096; // Default fallback
    const pageSizeMatch = memOutput.match(/page size of (\d+) bytes/);
    if (pageSizeMatch && pageSizeMatch[1]) {
      pageSize = parseInt(pageSizeMatch[1], 10);
    }
    
    const freeMatch = memOutput.match(/Pages free:\s+(\d+)/);
    const inactiveMatch = memOutput.match(/Pages inactive:\s+(\d+)/);
    const wiredMatch = memOutput.match(/Pages wired down:\s+(\d+)/);
    const activeMatch = memOutput.match(/Pages active:\s+(\d+)/);
    
    if (freeMatch && inactiveMatch && wiredMatch && activeMatch) {
      const freePages = parseInt(freeMatch[1] || '0', 10);
      const inactivePages = parseInt(inactiveMatch[1] || '0', 10);
      const wiredPages = parseInt(wiredMatch[1] || '0', 10);
      const activePages = parseInt(activeMatch[1] || '0', 10);
      
      freeMemory = (freePages + inactivePages) * pageSize;
      totalMemory = (freePages + inactivePages + wiredPages + activePages) * pageSize;
    }
    
    // Parse load average from uptime
    const loadAverage: number[] = [];
    const loadMatch = loadOutput.match(/load averages?:\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (loadMatch) {
      loadAverage.push(parseFloat(loadMatch[1] || '0'));
      loadAverage.push(parseFloat(loadMatch[2] || '0'));
      loadAverage.push(parseFloat(loadMatch[3] || '0'));
    }
    
    // Parse uptime - handle different formats
    let uptime = 0;
    // Try different uptime formats
    let uptimeMatch = loadOutput.match(/up\s+(\d+)\s+days?,\s+(\d+):(\d+)/);
    if (uptimeMatch) {
      const days = parseInt(uptimeMatch[1] || '0', 10);
      const hours = parseInt(uptimeMatch[2] || '0', 10);
      const minutes = parseInt(uptimeMatch[3] || '0', 10);
      uptime = (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);
    } else {
      // Try format without days but with hours:minutes
      uptimeMatch = loadOutput.match(/up\s+(\d+):(\d+)/);
      if (uptimeMatch) {
        const hours = parseInt(uptimeMatch[1] || '0', 10);
        const minutes = parseInt(uptimeMatch[2] || '0', 10);
        uptime = (hours * 60 * 60) + (minutes * 60);
      } else {
        // Try format with just minutes
        uptimeMatch = loadOutput.match(/up\s+(\d+)\s+mins?/);
        if (uptimeMatch) {
          const minutes = parseInt(uptimeMatch[1] || '0', 10);
          uptime = minutes * 60;
        } else {
          // Try format with just hours
          uptimeMatch = loadOutput.match(/up\s+(\d+)\s+hrs?/);
          if (uptimeMatch) {
            const hours = parseInt(uptimeMatch[1] || '0', 10);
            uptime = hours * 60 * 60;
          }
        }
      }
    }
    
    // Parse process count
    let processCount = 0;
    const procMatch = procOutput.match(/(\d+)/);
    if (procMatch) {
      processCount = parseInt(procMatch[1] || '0', 10) - 1; // Subtract header line
    }
    
    return {
      cpuUsage,
      memoryUsage: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        free: freeMemory,
      },
      loadAverage,
      uptime,
      processCount,
    };
  }


}