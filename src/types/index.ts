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

// Core type definitions for the procx system

export type ProcessStatus =
  | 'running'
  | 'sleeping'
  | 'stopped'
  | 'zombie'
  | 'unknown';

export interface ProcessInfo {
  pid: number;
  ppid?: number;
  name: string;
  command: string;
  cpu: number;
  memory: number;
  status: ProcessStatus;
  startTime: Date;
  ports?: number[];
  workingDirectory?: string;
}

export interface ProcessTree {
  process: ProcessInfo;
  children: ProcessTree[];
}

export interface ProcessCriteria {
  port?: number;
  pid?: number;
  name?: string;
  command?: string;
}

export interface ProcessFilters {
  name?: string;
  minCpu?: number;
  minMemory?: number;
  status?: ProcessStatus;
  sortBy?: 'cpu' | 'memory' | 'pid' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ProcessTarget {
  pid?: number;
  port?: number;
}

export interface KillOptions {
  force?: boolean;
  interactive?: boolean;
}

export interface KillResult {
  success: boolean;
  pid: number;
  message: string;
}

// Port-related types

export type PortProtocol = 'tcp' | 'udp';

export type PortState =
  | 'LISTEN'
  | 'ESTABLISHED'
  | 'CLOSE_WAIT'
  | 'TIME_WAIT'
  | 'SYN_SENT'
  | 'SYN_RECV'
  | string;

export interface PortInfo {
  port: number;
  protocol: PortProtocol;
  state: PortState;
  process?: ProcessInfo;
  localAddress: string;
  remoteAddress?: string;
}

export interface PortScanOptions {
  startPort?: number;
  endPort?: number;
  protocol?: PortProtocol;
  timeout?: number;
}

export interface NetworkConnection {
  localAddress: string;
  localPort: number;
  remoteAddress?: string | undefined;
  remotePort?: number | undefined;
  protocol: PortProtocol;
  state: PortState;
  pid?: number | undefined;
}

// System monitoring types

export interface SystemInfo {
  platform: string;
  arch: string;
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  loadAverage: number[];
  uptime: number;
  processCount: number;
}

export interface ProcessMetrics {
  pid: number;
  cpu: number;
  memory: number;
  timestamp: Date;
}

export interface ResourceUsageReport {
  duration: number;
  samples: ProcessMetrics[];
  averageCpu: number;
  averageMemory: number;
  peakCpu: number;
  peakMemory: number;
}

export interface MonitorOptions {
  refreshInterval: number;
  filters?: ProcessFilters;
  maxResults?: number;
  showDeltas?: boolean;
}

// Configuration types

export interface ProcxConfig {
  defaultTimeout: number;
  maxRetries: number;
  outputFormat: 'table' | 'json' | 'csv';
  colorOutput: boolean;
  confirmKill: boolean;
  monitorRefreshRate: number;
  portScanTimeout: number;
}

// Platform abstraction types

export interface RawProcessInfo {
  pid: number;
  ppid?: number | undefined;
  name: string;
  command: string;
  cpu?: number | undefined;
  memory?: number | undefined;
  status?: string | undefined;
  startTime?: Date | undefined;
  workingDirectory?: string | undefined;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  loadAverage: number[];
  uptime: number;
  processCount: number;
}

// Conflict resolution types

export interface ResolveResult {
  success: boolean;
  killedProcesses: ProcessInfo[];
  commandExecuted: boolean;
  commandOutput?: string;
  error?: string;
}

export * from './errors';
export * from './utils';
