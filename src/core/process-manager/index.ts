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
  ProcessInfo,
  ProcessFilters,
  ProcessTree,
  ProcessError,
  ValidationError,
  ErrorCodes,
} from '../../types';
import { PlatformAdapter, platformFactory } from '../../platform';
import { 
  ProcessUtils,
  ProcessFilterUtils,
  ProcessConversionUtils,
  ProcessErrorUtils,
  ProcessValidationAndErrorUtils
} from '../../utils';

/**
 * Cross-platform process management operations
 */
export class ProcessManager {
  private platformAdapter: PlatformAdapter | null = null;

  constructor(platformAdapter?: PlatformAdapter) {
    this.platformAdapter = platformAdapter || null;
  }

  private async getPlatformAdapter(): Promise<PlatformAdapter> {
    if (!this.platformAdapter) {
      this.platformAdapter = await platformFactory.createAdapter();
    }
    return this.platformAdapter;
  }

  /**
   * Find the process using a specific port
   */
  async findByPort(port: number): Promise<ProcessInfo | null> {
    ProcessValidationAndErrorUtils.validatePortOrThrow(port);
    
    try {
      const adapter = await this.getPlatformAdapter();
      const pid = await adapter.getProcessByPort(port);
      
      if (!pid) {
        return null;
      }
      
      const rawProcess = await adapter.getProcessInfo(pid);
      if (!rawProcess) {
        return null;
      }
      
      return ProcessConversionUtils.convertRawProcessInfo(rawProcess, [port]);
    } catch (error) {
      throw ProcessErrorUtils.createProcessNotFoundError(port, 'port');
    }
  }

  /**
   * Find a process by its process identifier
   */
  async findByPid(pid: number): Promise<ProcessInfo | null> {
    ProcessValidationAndErrorUtils.validatePidOrThrow(pid);
    
    try {
      const adapter = await this.getPlatformAdapter();
      const rawProcess = await adapter.getProcessInfo(pid);
      
      if (!rawProcess) {
        return null;
      }
      
      return ProcessConversionUtils.convertRawProcessInfo(rawProcess);
    } catch (error) {
      throw ProcessErrorUtils.createProcessNotFoundError(pid, 'pid');
    }
  }

  /**
   * Find all processes matching a name pattern
   */
  async findByName(name: string): Promise<ProcessInfo[]> {
    ProcessValidationAndErrorUtils.validateProcessNameOrThrow(name);
    
    try {
      const adapter = await this.getPlatformAdapter();
      const rawProcesses = await adapter.listProcesses();
      
      // Convert raw processes to ProcessInfo
      const processes = rawProcesses.map(raw => ProcessConversionUtils.convertRawProcessInfo(raw));
      
      // Use shared filtering utility
      return ProcessFilterUtils.filterByName(processes, name);
    } catch (error) {
      throw ProcessErrorUtils.createProcessNotFoundError(name, 'name');
    }
  }

  /**
   * List all running processes with optional filtering
   */
  async listAll(filters?: ProcessFilters): Promise<ProcessInfo[]> {
    try {
      const adapter = await this.getPlatformAdapter();
      const rawProcesses = await adapter.listProcesses();
      
      // Convert raw processes to ProcessInfo
      let processes = rawProcesses.map(raw => ProcessConversionUtils.convertRawProcessInfo(raw));
      
      // Use shared filtering and sorting utilities
      if (filters) {
        processes = ProcessUtils.processProcessList(processes, filters);
      }
      
      return processes;
    } catch (error) {
      throw new ProcessError(
        'Failed to list processes',
        ErrorCodes.PROCESS_NOT_FOUND,
        { originalError: error }
      );
    }
  }

  /**
   * Terminate a process by its process identifier
   */
  async kill(pid: number, force: boolean = false): Promise<boolean> {
    ProcessValidationAndErrorUtils.validatePidOrThrow(pid);
    
    try {
      const adapter = await this.getPlatformAdapter();
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      
      return await adapter.killProcess(pid, signal as any);
    } catch (error) {
      throw ProcessErrorUtils.createProcessOperationError('kill', pid, error as Error);
    }
  }

  /**
   * Terminate the process using a specific port
   */
  async killByPort(port: number, force: boolean = false): Promise<boolean> {
    ProcessValidationAndErrorUtils.validatePortOrThrow(port);
    
    const process = await this.findByPort(port);
    ProcessValidationAndErrorUtils.validateProcessExistsOrThrow(process, port, 'port');
    
    return await this.kill(process.pid, force);
  }

  /**
   * Terminate all processes using ports within a specified range
   */
  async killByPortRange(startPort: number, endPort: number, force: boolean = false): Promise<{ port: number; success: boolean; pid?: number; error?: string }[]> {
    ProcessValidationAndErrorUtils.validatePortOrThrow(startPort);
    ProcessValidationAndErrorUtils.validatePortOrThrow(endPort);
    
    if (startPort > endPort) {
      throw new ValidationError(
        'Start port must be less than or equal to end port',
        { startPort, endPort }
      );
    }
    
    const results: { port: number; success: boolean; pid?: number; error?: string }[] = [];
    
    for (let port = startPort; port <= endPort; port++) {
      try {
        const process = await this.findByPort(port);
        if (process) {
          const success = await this.kill(process.pid, force);
          results.push({
            port,
            success,
            pid: process.pid,
          });
        }
        // If no process is using the port, we don't add it to results
      } catch (error) {
        results.push({
          port,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }

  /**
   * Get the process hierarchy tree starting from a specific process
   */
  async getProcessTree(pid: number): Promise<ProcessTree> {
    ProcessValidationAndErrorUtils.validatePidOrThrow(pid);
    
    const rootProcess = await this.findByPid(pid);
    ProcessValidationAndErrorUtils.validateProcessExistsOrThrow(rootProcess, pid, 'pid');
    
    const allProcesses = await this.listAll();
    const children = this.buildProcessTree(rootProcess, allProcesses);
    
    return {
      process: rootProcess,
      children
    };
  }



  // Build process tree structure from parent-child relationships
  private buildProcessTree(parent: ProcessInfo, allProcesses: ProcessInfo[]): ProcessTree[] {
    const children = allProcesses.filter(p => p.ppid === parent.pid);
    
    return children.map(child => ({
      process: child,
      children: this.buildProcessTree(child, allProcesses)
    }));
  }


}