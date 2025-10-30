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

// Linux platform adapter implementation

import { readFile } from 'fs/promises';
import {
  RawProcessInfo,
  NetworkConnection,
  SystemMetrics,
  ProcessSignal,
  Platform,
} from '../../types';
import { PlatformAdapter } from '../index';

export class LinuxAdapter extends PlatformAdapter {
  constructor() {
    super(Platform.LINUX);
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

  // Get system metrics using Linux /proc filesystem
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      this.logOperationStart('Getting system metrics');
      
      // Get CPU usage from /proc/stat
      const cpuInfo = await this.getCpuUsage();
      
      // Get memory usage from /proc/meminfo
      const memInfo = await this.getMemoryUsage();
      
      // Get load average from /proc/loadavg
      const loadInfo = await this.getLoadAverage();
      
      // Get uptime from /proc/uptime
      const uptimeInfo = await this.getUptime();
      
      // Get process count
      const procCount = await this.getProcessCount();

      const metrics = {
        cpuUsage: cpuInfo,
        memoryUsage: memInfo,
        loadAverage: loadInfo,
        uptime: uptimeInfo,
        processCount: procCount,
      };
      
      this.sharedLogging.logSystemMetrics(this.platform, metrics);
      return metrics;
    } catch (error) {
      const enhancedError = this.handleError(error as Error, 'get-system-metrics');
      this.logOperationFailure('get system metrics', enhancedError);
      throw enhancedError;
    }
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const statFile = `/proc/${pid}/stat`;
      this.logProcessOperation('Checking if process is running', pid, { statFile });
      
      await readFile(statFile);
      
      this.logProcessOperation('Process is running', pid);
      return true;
    } catch (error) {
      this.logProcessOperation('Process is not running', pid, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  async getProcessInfo(pid: number): Promise<RawProcessInfo | null> {
    try {
      // Use shared validation
      this.validateInput(pid, 'pid');

      const command = ['ps', '-p', pid.toString(), '-o', 'pid,ppid,comm,command,rss,%cpu,stat,lstart', '--no-headers'];
      this.logProcessOperation('Getting process info', pid);
      
      const result = await this.executeCommand(command);
      
      if (!result.stdout.trim()) {
        this.logProcessOperation('No process info found', pid);
        return null;
      }
      
      const dataLine = result.stdout.trim();
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
          
          this.logOperationSuccess('retrieved process info', { 
            pid, 
            processInfo 
          });
          return processInfo;
        }
      }
      
      return null;
    } catch (error) {
      this.logOperationFailure('get process info', error as Error, { pid });
      return null;
    }
  }

  async isPortAvailable(port: number, protocol: 'tcp' | 'udp' = 'tcp'): Promise<boolean> {
    try {
      // Use shared validation
      this.validateInput(port, 'port');

      const protocolFlag = protocol === 'tcp' ? '-t' : '-u';
      const command = ['sh', '-c', `ss -ln ${protocolFlag} | grep ":${port} "`];
      this.logPortOperation('Checking port availability with ss', port, protocol);
      
      const result = await this.executeCommand(command);
      
      // If ss returns output, the port is in use
      const isAvailable = result.stdout.trim().length === 0;
      
      this.logPortOperation('Port availability check completed', port, protocol, { 
        isAvailable 
      });
      return isAvailable;
    } catch (error) {
      // If ss command fails, try with netstat as fallback
      try {
        this.sharedLogging.logFallbackOperation(
          'Port availability check', 
          this.platform, 
          'netstat', 
          'ss command failed',
          { port, protocol }
        );
        
        const fallbackCommand = ['sh', '-c', `netstat -ln | grep ":${port} "`];
        const result = await this.executeCommand(fallbackCommand);
        
        const isAvailable = result.stdout.trim().length === 0;
        
        this.logPortOperation('Port availability check with netstat completed', port, protocol, { 
          isAvailable 
        });
        return isAvailable;
      } catch (fallbackError) {
        // If both fail, assume port is available
        this.sharedLogging.logAssumption(
          'Port availability check',
          this.platform,
          'port is available',
          'both ss and netstat failed',
          { 
            port, 
            protocol, 
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) 
          }
        );
        return true;
      }
    }
  }

  async getProcessByPort(port: number): Promise<number | null> {
    try {
      // Use shared validation
      this.validateInput(port, 'port');

      const command = ['sh', '-c', `ss -lpn | grep ":${port} "`];
      this.logPortOperation('Getting process by port with ss', port);
      
      const result = await this.executeCommand(command);
      
      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        const pidMatch = line.match(/pid=(\d+)/);
        if (pidMatch && pidMatch[1]) {
          const pid = parseInt(pidMatch[1], 10);
          if (!isNaN(pid) && pid > 0) {
            this.logPortOperation('Process by port lookup completed', port, undefined, { pid });
            return pid;
          }
        }
      }
      
      this.sharedLogging.logFallbackOperation(
        'Process by port lookup',
        this.platform,
        'lsof',
        'no process found with ss',
        { port }
      );
      return null;
    } catch (error) {
      // Fallback to lsof if available
      try {
        this.sharedLogging.logFallbackOperation(
          'Process by port lookup',
          this.platform,
          'lsof',
          'ss command failed',
          { 
            port, 
            error: error instanceof Error ? error.message : String(error) 
          }
        );
        
        const fallbackCommand = ['lsof', `-ti:${port}`];
        const result = await this.executeCommand(fallbackCommand);
        
        const pidStr = result.stdout.trim();
        if (pidStr) {
          const pid = parseInt(pidStr, 10);
          const validPid = isNaN(pid) || pid <= 0 ? null : pid;
          
          this.logPortOperation('Process by port lookup with lsof completed', port, undefined, { 
            pid: validPid 
          });
          return validPid;
        }
      } catch (fallbackError) {
        this.logOperationFailure('process by port lookup', fallbackError as Error, { 
          port,
          methods: ['ss', 'lsof']
        });
      }
      
      return null;
    }
  }

  protected getProcessListCommand(): string[] {
    return ['ps', 'aux', '--no-headers'];
  }

  protected getNetworkCommand(): string[] {
    return ['ss', '-tuln'];
  }

  // Parse Linux process output from ps aux
  protected parseProcessOutput(output: string): RawProcessInfo[] {
    const processes: RawProcessInfo[] = [];
    const lines = output.trim().split('\n');
    
    // Skip header line if present
    const startIndex = lines[0]?.includes('PID') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 11) {
        try {
          const pid = parseInt(parts[1] || '', 10);
          const cpu = parseFloat(parts[2] || '0');
          const memory = parseInt(parts[5] || '0', 10); // RSS in KB
          const status = parts[7] || 'unknown';
          const command = parts.slice(10).join(' ');
          const name = parts[10] || '';
          
          // Extract PPID from ps aux output (not directly available, would need separate call)
          let ppid: number | undefined;
          
          if (!isNaN(pid) && pid > 0) {
            processes.push({
              pid,
              ppid,
              name: name.split('/').pop() || name,
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

  // Parse Linux network output from ss
  protected parseNetworkOutput(output: string): NetworkConnection[] {
    const connections: NetworkConnection[] = [];
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        try {
          const protocol = (parts[0] || '').toLowerCase() as 'tcp' | 'udp';
          const state = parts[1] || 'UNKNOWN';
          const localAddr = parts[4];
          
          if (localAddr && localAddr.includes(':')) {
            const lastColonIndex = localAddr.lastIndexOf(':');
            const address = localAddr.substring(0, lastColonIndex);
            const portStr = localAddr.substring(lastColonIndex + 1);
            const port = parseInt(portStr, 10);
            
            if (!isNaN(port)) {
              connections.push({
                localAddress: address,
                localPort: port,
                protocol,
                state,
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

  private async getCpuUsage(): Promise<number> {
    try {
      const stat = await readFile('/proc/stat', 'utf8');
      const cpuLine = stat.split('\n')[0];
      if (!cpuLine) return 0;
      
      const values = cpuLine.split(/\s+/).slice(1).map(Number);
      
      const idle = values[3] || 0;
      const total = values.reduce((sum, val) => sum + val, 0);
      
      return total > 0 ? ((total - idle) / total) * 100 : 0;
    } catch {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<{ total: number; used: number; free: number }> {
    try {
      const meminfo = await readFile('/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      
      let total = 0;
      let free = 0;
      let available = 0;
      
      for (const line of lines) {
        if (line.startsWith('MemTotal:')) {
          total = parseInt(line.split(/\s+/)[1] || '0', 10) * 1024; // Convert KB to bytes
        } else if (line.startsWith('MemFree:')) {
          free = parseInt(line.split(/\s+/)[1] || '0', 10) * 1024;
        } else if (line.startsWith('MemAvailable:')) {
          available = parseInt(line.split(/\s+/)[1] || '0', 10) * 1024;
        }
      }
      
      const used = total - (available || free);
      
      return {
        total,
        used,
        free: available || free,
      };
    } catch {
      return { total: 0, used: 0, free: 0 };
    }
  }

  private async getLoadAverage(): Promise<number[]> {
    try {
      const loadavg = await readFile('/proc/loadavg', 'utf8');
      const values = loadavg.trim().split(/\s+/).slice(0, 3);
      return values.map(Number);
    } catch {
      return [0, 0, 0];
    }
  }

  private async getUptime(): Promise<number> {
    try {
      const uptime = await readFile('/proc/uptime', 'utf8');
      const seconds = parseFloat(uptime.split(/\s+/)[0] || '0');
      return Math.floor(seconds);
    } catch {
      return 0;
    }
  }

  private async getProcessCount(): Promise<number> {
    try {
      const result = await this.executeCommand(['sh', '-c', 'ps aux --no-headers | wc -l']);
      return parseInt(result.stdout.trim(), 10);
    } catch {
      return 0;
    }
  }


}