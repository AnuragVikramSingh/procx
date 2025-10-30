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

// Utility types and enums for the procx system

export enum Platform {
  WINDOWS = 'win32',
  MACOS = 'darwin',
  LINUX = 'linux',
  FREEBSD = 'freebsd',
  OPENBSD = 'openbsd',
  SUNOS = 'sunos',
  AIX = 'aix',
}

export enum ProcessSignal {
  SIGTERM = 'SIGTERM',
  SIGKILL = 'SIGKILL',
  SIGINT = 'SIGINT',
  SIGHUP = 'SIGHUP',
  SIGQUIT = 'SIGQUIT',
}

export enum OutputFormat {
  TABLE = 'table',
  JSON = 'json',
  CSV = 'csv',
  YAML = 'yaml',
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ProcessSortField {
  PID = 'pid',
  NAME = 'name',
  CPU = 'cpu',
  MEMORY = 'memory',
  START_TIME = 'startTime',
}

export enum PortSortField {
  PORT = 'port',
  PROTOCOL = 'protocol',
  STATE = 'state',
  PROCESS = 'process',
}

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<T>;
export type Callback<T = void> = (error?: Error, result?: T) => void;

export type ProcessLister = () => AsyncResult<RawProcessInfo[]>;
export type ProcessKiller = (
  pid: number,
  signal: ProcessSignal
) => AsyncResult<boolean>;
export type NetworkScanner = () => AsyncResult<NetworkConnection[]>;
export type SystemInfoGetter = () => AsyncResult<SystemMetrics>;

export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type FilterFunction<T> = (item: T) => boolean;
export type SortFunction<T> = (a: T, b: T) => number;

export enum MonitorEvent {
  PROCESS_STARTED = 'process_started',
  PROCESS_STOPPED = 'process_stopped',
  PROCESS_UPDATED = 'process_updated',
  PORT_OPENED = 'port_opened',
  PORT_CLOSED = 'port_closed',
  SYSTEM_UPDATED = 'system_updated',
}

export interface ProcessEvent {
  type: MonitorEvent;
  process: ProcessInfo;
  timestamp: Date;
}

export interface PortEvent {
  type: MonitorEvent;
  port: PortInfo;
  timestamp: Date;
}

export interface SystemEvent {
  type: MonitorEvent;
  system: SystemInfo;
  timestamp: Date;
}

export type ProcxEvent = ProcessEvent | PortEvent | SystemEvent;
export type EventHandler<T extends ProcxEvent> = (event: T) => void;

export interface PortRange {
  start: number;
  end: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Duration {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
}

export interface ValidationResult<T = any> {
  isValid: boolean;
  value?: T;
  error?: string;
  warnings?: string[];
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface PerformanceMetrics {
  operationName: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  success: boolean;
  error?: string;
}

import type {
  ProcessInfo,
  PortInfo,
  SystemInfo,
  NetworkConnection,
  RawProcessInfo,
  SystemMetrics,
} from './index';

export type {
  ProcessInfo,
  PortInfo,
  SystemInfo,
  NetworkConnection,
  RawProcessInfo,
  SystemMetrics,
};
