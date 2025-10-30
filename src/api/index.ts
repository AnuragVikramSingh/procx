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

// Node.js API for procx

import {
  ProcessCriteria,
  ProcessInfo,
  ProcessTarget,
  KillOptions,
  KillResult,
  ProcessFilters,
  PortScanOptions,
  PortInfo,
  SystemInfo,
  MonitorOptions,
  ValidationError,
  ResolveResult,
} from '../types';
import { ProcessManager } from '../core/process-manager';
import { PortScanner } from '../core/port-scanner';
import { systemMonitor } from '../core/system-monitor';

// Global instances
let processManager: ProcessManager | null = null;
let portScanner: PortScanner | null = null;

function getProcessManager(): ProcessManager {
  if (!processManager) {
    processManager = new ProcessManager();
  }
  return processManager;
}

function getPortScanner(): PortScanner {
  if (!portScanner) {
    portScanner = new PortScanner();
  }
  return portScanner;
}

/**
 * Find processes by port, PID, name, or command
 */
export async function findProcess(
  criteria: ProcessCriteria
): Promise<ProcessInfo[]> {
  const manager = getProcessManager();

  if (!criteria.port && !criteria.pid && !criteria.name && !criteria.command) {
    throw new ValidationError(
      'At least one search criteria must be provided (port, pid, name, or command)',
      { criteria }
    );
  }

  const results: ProcessInfo[] = [];

  if (criteria.port !== undefined) {
    const process = await manager.findByPort(criteria.port);
    if (process) {
      results.push(process);
    }
  }

  if (criteria.pid !== undefined) {
    const process = await manager.findByPid(criteria.pid);
    if (process) {
      results.push(process);
    }
  }

  if (criteria.name !== undefined) {
    const processes = await manager.findByName(criteria.name);
    results.push(...processes);
  }

  if (criteria.command !== undefined) {
    const processes = await manager.findByName(criteria.command);
    results.push(...processes);
  }

  const uniqueResults = results.filter(
    (process, index, array) =>
      array.findIndex(p => p.pid === process.pid) === index
  );

  return uniqueResults;
}

/**
 * Kill a process by PID or port
 */
export async function killProcess(
  target: ProcessTarget,
  options: KillOptions = {}
): Promise<KillResult> {
  const manager = getProcessManager();

  if (!target.pid && !target.port) {
    throw new ValidationError(
      'Either PID or port must be specified for kill operation',
      { target }
    );
  }

  try {
    let success = false;
    let pid = target.pid;
    let processInfo: ProcessInfo | null = null;

    if (target.port !== undefined) {
      processInfo = await manager.findByPort(target.port);
      if (!processInfo) {
        return {
          success: false,
          pid: 0,
          message: `No process found using port ${target.port}`,
        };
      }
      pid = processInfo.pid;
      success = await manager.killByPort(target.port, options.force || false);
    } else if (target.pid !== undefined) {
      processInfo = await manager.findByPid(target.pid);
      if (!processInfo) {
        return {
          success: false,
          pid: target.pid,
          message: `No process found with PID ${target.pid}`,
        };
      }
      success = await manager.kill(target.pid, options.force || false);
    }

    const signal = options.force ? 'SIGKILL' : 'SIGTERM';
    const processName = processInfo ? processInfo.name : 'unknown';

    return {
      success,
      pid: pid || 0,
      message: success
        ? `Process '${processName}' (PID: ${pid}) terminated successfully using ${signal}`
        : `Failed to terminate process '${processName}' (PID: ${pid})`,
    };
  } catch (error) {
    return {
      success: false,
      pid: target.pid || 0,
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * List all processes with optional filtering
 */
export async function listProcesses(
  filters?: ProcessFilters
): Promise<ProcessInfo[]> {
  const manager = getProcessManager();
  return await manager.listAll(filters);
}

/**
 * Get all active ports with their associated processes
 */
export async function getActivePorts(
  options?: PortScanOptions
): Promise<PortInfo[]> {
  const scanner = getPortScanner();
  return await scanner.getActivePorts(options);
}

/**
 * Find the next available port starting from a given port number
 */
export async function getFreePort(
  startPort: number = 3000,
  endPort: number = 65535,
  protocol: 'tcp' | 'udp' = 'tcp'
): Promise<number> {
  const scanner = getPortScanner();
  return await scanner.findFreePort(startPort, endPort, protocol);
}

/**
 * Kill processes using ports in a specified range
 */
export async function killProcessesByPortRange(
  startPort: number,
  endPort: number,
  options: KillOptions = {}
): Promise<{ port: number; success: boolean; pid?: number; error?: string }[]> {
  const manager = getProcessManager();
  return await manager.killByPortRange(
    startPort,
    endPort,
    options.force || false
  );
}

/**
 * Get current system information and metrics
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  return await systemMonitor.getSystemInfo();
}

/**
 * Start monitoring processes with real-time updates
 */
export async function* startMonitor(
  options?: MonitorOptions
): AsyncGenerator<ProcessInfo[]> {
  const refreshInterval = options?.refreshInterval || 2000;
  const filters = options?.filters;
  const maxResults = options?.maxResults;

  const manager = getProcessManager();

  while (true) {
    try {
      let processes = await manager.listAll(filters);

      if (maxResults && maxResults > 0) {
        processes = processes.slice(0, maxResults);
      }

      yield processes;

      await new Promise(resolve => setTimeout(resolve, refreshInterval));
    } catch (error) {
      console.error('Error during monitor iteration:', error);
      await new Promise(resolve => setTimeout(resolve, refreshInterval));
    }
  }
}

/**
 * Resolve port conflicts by killing processes and executing a command
 */
export async function resolvePortConflict(
  port: number,
  command: string,
  options: { force?: boolean } = {}
): Promise<ResolveResult> {
  const scanner = getPortScanner();
  return await scanner.resolveConflict(port, command, options.force || false);
}

export type {
  ProcessCriteria,
  ProcessInfo,
  ProcessTarget,
  KillOptions,
  KillResult,
  ProcessFilters,
  PortScanOptions,
  PortInfo,
  SystemInfo,
  MonitorOptions,
  ResolveResult,
};
