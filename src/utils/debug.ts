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

import { logger, getLogger } from './logger';
import { ProcxError } from '../types/errors';
import { ProcessInfo, PortInfo, SystemInfo } from '../types';
import { DebugHelpers } from './shared-logging';

export interface DebugInfo {
  timestamp: Date;
  platform: string;
  nodeVersion: string;
  procxVersion: string;
  environment: Record<string, string | undefined>;
  systemInfo?: SystemInfo;
  activeProcesses?: ProcessInfo[];
  activePorts?: PortInfo[];
  recentErrors?: ProcxError[];
  performanceMetrics?: PerformanceDebugInfo;
}

export interface PerformanceDebugInfo {
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  uptime: number;
  loadAverage: number[];
}

export interface DebugSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date | undefined;
  duration?: number;
  operations: DebugOperation[];
  errors: ProcxError[];
  warnings: string[];
  metadata: Record<string, any>;
}

export interface DebugOperation {
  name: string;
  startTime: Date;
  endTime?: Date | undefined;
  duration?: number | undefined;
  success: boolean;
  input?: any;
  output?: any;
  error?: ProcxError | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface DebugConfig {
  enableTracing: boolean;
  enableProfiling: boolean;
  enableMemoryTracking: boolean;
  maxOperations: number;
  maxSessions: number;
  autoCapture: boolean;
}

export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enableTracing: false,
  enableProfiling: false,
  enableMemoryTracking: false,
  maxOperations: 100,
  maxSessions: 10,
  autoCapture: false,
};

export class DebugManager {
  private config: DebugConfig;
  private sessions: Map<string, DebugSession> = new Map();
  private currentSession?: DebugSession | undefined;
  private logger = getLogger('debug');
  private startCpuUsage?: ReturnType<typeof process.cpuUsage>;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };

    if (this.config.enableProfiling) {
      this.startCpuUsage = process.cpuUsage();
    }
  }

  startSession(id?: string): string {
    const sessionName = id || 'debug-session';
    const session: DebugSession = {
      id: `${sessionName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: sessionName,
      startTime: new Date(),
      operations: [],
      errors: [],
      warnings: [],
      metadata: {},
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    if (this.sessions.size > this.config.maxSessions) {
      const oldestSessionKey = Array.from(this.sessions.keys())[0];
      if (oldestSessionKey) {
        this.sessions.delete(oldestSessionKey);
      }
    }

    this.logger.debug(`Debug session started: ${session.id}`);
    return session.id;
  }

  endSession(sessionId?: string): DebugSession | undefined {
    const targetId = sessionId || this.currentSession?.id;
    if (!targetId) {
      return undefined;
    }

    const session = this.sessions.get(targetId);
    if (session) {
      session.endTime = new Date();
      session.duration =
        session.endTime.getTime() - session.startTime.getTime();

      if (this.currentSession?.id === targetId) {
        this.currentSession = undefined;
      }
    }

    return session;
  }

  startOperation(
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ): string {
    if (!this.config.enableTracing || !this.currentSession) {
      return '';
    }

    const operation: DebugOperation = {
      name,
      startTime: new Date(),
      success: false,
      input,
      ...(metadata && { metadata }),
    };

    this.currentSession.operations.push(operation);

    if (this.currentSession.operations.length > this.config.maxOperations) {
      this.currentSession.operations = this.currentSession.operations.slice(
        -this.config.maxOperations / 2
      );
    }

    this.logger.trace(`Operation started: ${name}`, { input, metadata });
    return `${this.currentSession.id}_${this.currentSession.operations.length - 1}`;
  }

  endOperation(
    operationId: string,
    success: boolean,
    output?: any,
    error?: ProcxError
  ): void {
    if (!this.config.enableTracing || !this.currentSession) {
      return;
    }

    const parts = operationId.split('_');
    if (parts.length < 2) {
      return;
    }

    const sessionId = parts[0];
    const operationIndex = parts[1];

    if (!sessionId || !operationIndex || sessionId !== this.currentSession.id) {
      return;
    }

    const index = parseInt(operationIndex, 10);
    const operation = this.currentSession.operations[index];

    if (operation) {
      operation.endTime = new Date();
      operation.duration =
        operation.endTime.getTime() - operation.startTime.getTime();
      operation.success = success;
      operation.output = output;
      if (error) {
        operation.error = error;
        this.currentSession.errors.push(error);
      }

      this.logger.trace(`Operation ended: ${operation.name}`, {
        success,
        duration: operation.duration,
        error: error?.message,
      });
    }
  }

  addWarning(message: string, metadata?: Record<string, any>): void {
    if (this.currentSession) {
      this.currentSession.warnings.push(message);
      this.logger.warn(message, metadata);
    }
  }

  async captureDebugInfo(): Promise<DebugInfo> {
    const debugInfo: DebugInfo = {
      timestamp: new Date(),
      platform: process.platform,
      nodeVersion: process.version,
      procxVersion: this.getProcxVersion(),
      environment: this.getRelevantEnvironment(),
    };

    if (this.config.enableProfiling) {
      debugInfo.performanceMetrics = this.getPerformanceMetrics();
    }

    if (this.currentSession) {
      debugInfo.recentErrors = this.currentSession.errors.slice(-10);
    }

    this.logger.debug('Debug information captured', {
      platform: debugInfo.platform,
      nodeVersion: debugInfo.nodeVersion,
    });

    return debugInfo;
  }

  private getPerformanceMetrics(): PerformanceDebugInfo {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = this.startCpuUsage
      ? process.cpuUsage(this.startCpuUsage)
      : process.cpuUsage();

    return {
      memoryUsage,
      cpuUsage,
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
    };
  }

  private getRelevantEnvironment(): Record<string, string | undefined> {
    const relevantVars = [
      'NODE_ENV',
      'DEBUG',
      'PROCX_LOG_LEVEL',
      'PROCX_DEBUG',
      'PATH',
      'HOME',
      'USER',
      'SHELL',
    ];

    const env: Record<string, string | undefined> = {};
    relevantVars.forEach(varName => {
      env[varName] = process.env[varName];
    });

    return env;
  }

  private getProcxVersion(): string {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async generateDebugReport(sessionId?: string): Promise<string> {
    const session = sessionId
      ? this.sessions.get(sessionId)
      : this.currentSession;
    if (!session) {
      return JSON.stringify({ error: 'No session found' }, null, 2);
    }

    const sessionReport = this.generateSessionReport(session);
    const debugInfo = await this.captureDebugInfo();
    const recentLogs = logger.getRecentLogs(50);

    const report = {
      sessionReport,
      debugInfo,
      recentLogs,
    };

    return JSON.stringify(report, null, 2);
  }

  async exportDebugData(): Promise<string> {
    const allSessions = Array.from(this.sessions.values());
    const debugInfo = await this.captureDebugInfo();

    const exportData = {
      timestamp: new Date().toISOString(),
      debugInfo,
      sessions: allSessions,
      recentLogs: logger.getRecentLogs(100),
      config: this.config,
    };

    return JSON.stringify(exportData, null, 2);
  }

  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  clearSessions(): void {
    this.sessions.clear();
    this.currentSession = undefined;
    this.logger.debug('All debug sessions cleared');
  }

  updateConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.enableProfiling && !this.startCpuUsage) {
      this.startCpuUsage = process.cpuUsage();
    }
  }

  getConfig(): DebugConfig {
    return { ...this.config };
  }

  private generateSessionReport(session: DebugSession): string {
    const lines = [
      `Debug Session Report: ${session.name}`,
      `Session ID: ${session.id}`,
      `Start Time: ${session.startTime.toISOString()}`,
      `End Time: ${session.endTime?.toISOString() || 'In Progress'}`,
      `Duration: ${session.duration ? `${session.duration}ms` : 'N/A'}`,
      `Operations: ${session.operations.length}`,
      `Errors: ${session.errors.length}`,
      `Warnings: ${session.warnings.length}`,
      '',
    ];

    if (session.operations.length > 0) {
      lines.push('Operations:');
      session.operations.forEach((op, index) => {
        lines.push(
          `  ${index + 1}. ${op.name} - ${op.success ? 'SUCCESS' : 'FAILED'} (${op.duration || 'N/A'}ms)`
        );
        if (op.error) {
          lines.push(`     Error: ${op.error.message}`);
        }
      });
      lines.push('');
    }

    if (session.errors.length > 0) {
      lines.push('Errors:');
      session.errors.forEach((error, index) => {
        lines.push(
          `  ${index + 1}. ${error.message} (${error.timestamp.toISOString()})`
        );
      });
      lines.push('');
    }

    if (session.warnings.length > 0) {
      lines.push('Warnings:');
      session.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. ${warning}`);
      });
    }

    return lines.join('\n');
  }
}

export const debugManager = new DebugManager();

export function startDebugSession(id?: string): string {
  return debugManager.startSession(id);
}

export function endDebugSession(sessionId?: string): DebugSession | undefined {
  return debugManager.endSession(sessionId);
}

// Track operation with automatic cleanup and error handling
export async function trackOperation<T>(
  name: string,
  operation: () => Promise<T>,
  input?: any,
  metadata?: Record<string, any>
): Promise<T> {
  const operationId = debugManager.startOperation(name, input, metadata);

  try {
    const result = await operation();
    debugManager.endOperation(operationId, true, result);
    return result;
  } catch (error) {
    const procxError =
      error instanceof ProcxError
        ? error
        : new ProcxError(
            error instanceof Error ? error.message : String(error),
            'GEN_999' as any,
            'system' as any
          );
    debugManager.endOperation(operationId, false, undefined, procxError);
    throw error;
  }
}

export function debugWarning(
  message: string,
  metadata?: Record<string, any>
): void {
  debugManager.addWarning(message, metadata);
}

export async function captureDebugSnapshot(): Promise<DebugInfo> {
  return debugManager.captureDebugInfo();
}

export async function generateDebugReport(sessionId?: string): Promise<string> {
  return debugManager.generateDebugReport(sessionId);
}

export async function exportDebugData(): Promise<string> {
  return debugManager.exportDebugData();
}

export function configureDebug(config: Partial<DebugConfig>): void {
  debugManager.updateConfig(config);
}

export function enableDebugTracing(): void {
  debugManager.updateConfig({ enableTracing: true });
}

export function enableDebugProfiling(): void {
  debugManager.updateConfig({ enableProfiling: true });
}

// Decorator for automatic operation tracking
export function debugTrack(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return trackOperation(
        operationName,
        () => originalMethod.apply(this, args),
        args
      );
    };

    return descriptor;
  };
}

export class SystemDiagnostics {
  private logger = getLogger('diagnostics');

  async runDiagnostics(): Promise<Record<string, any>> {
    try {
      const platform = process.platform as any;
      const diagnostic = await DebugHelpers.createSystemDiagnostic(
        platform,
        true
      );

      const diagnostics = {
        platform: {
          type: diagnostic.platform,
          arch: process.arch,
          nodeVersion: diagnostic.nodeVersion,
          uptime: diagnostic.processInfo.uptime,
        },
        memory: diagnostic.processInfo.memoryUsage,
        cpu: diagnostic.processInfo.cpuUsage,
        environment: diagnostic.environment,
        permissions: diagnostic.permissions,
      };

      this.logger.debug('System diagnostics completed', diagnostics);
      return diagnostics;
    } catch (error) {
      this.logger.error('Failed to run system diagnostics');
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const systemDiagnostics = new SystemDiagnostics();
