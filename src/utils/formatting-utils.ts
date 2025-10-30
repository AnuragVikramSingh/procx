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

import chalk from 'chalk';
import Table from 'cli-table3';
import { ProcessInfo, PortInfo, SystemInfo, ValidationResult } from '../types';

export interface TableOptions {
  useColors: boolean;
  maxWidth?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  colWidths?: number[];
}

export interface FormatOptions {
  useColors: boolean;
  includeTimestamp: boolean;
  precision: number;
}

export interface CSVOptions {
  separator?: string;
  includeHeaders?: boolean;
  customHeaders?: string[];
}

export interface JSONOptions {
  pretty?: boolean;
  indent?: number;
}

export function formatProcessTable(
  processes: ProcessInfo[],
  options: TableOptions = { useColors: true }
): string {
  if (processes.length === 0) {
    return options.useColors
      ? chalk.yellow('No processes found.')
      : 'No processes found.';
  }

  let sortedProcesses = [...processes];
  if (options.sortBy) {
    sortedProcesses = sortProcesses(
      sortedProcesses,
      options.sortBy,
      options.sortOrder || 'asc'
    );
  }

  const table = new Table({
    head: options.useColors
      ? [
          chalk.bold.blue('PID'),
          chalk.bold.blue('Name'),
          chalk.bold.blue('CPU%'),
          chalk.bold.blue('Memory(MB)'),
          chalk.bold.blue('Status'),
          chalk.bold.blue('Command'),
        ]
      : ['PID', 'Name', 'CPU%', 'Memory(MB)', 'Status', 'Command'],
    colWidths: options.colWidths || [8, 16, 8, 12, 10, 42],
    style: {
      head: options.useColors ? [] : ['bold'],
      border: options.useColors ? ['grey'] : [],
    },
  });

  sortedProcesses.forEach(process => {
    const memoryMB = (process.memory / 1024).toFixed(1);
    const cpuPercent = process.cpu.toFixed(1);
    const truncatedName = truncateString(process.name, 14);
    const truncatedCommand = truncateString(process.command, 60);

    if (options.useColors) {
      const pidColor = process.pid === 1 ? chalk.magenta : chalk.white;
      const nameColor = chalk.cyan;
      const cpuColor = getCpuColor(process.cpu);
      const memoryColor = getMemoryColor(process.memory / 1024);
      const statusColor = getProcessStatusColor(process.status);
      const commandColor = chalk.gray;

      table.push([
        pidColor(process.pid.toString()),
        nameColor(truncatedName),
        cpuColor(cpuPercent),
        memoryColor(memoryMB),
        statusColor(process.status),
        commandColor(truncatedCommand),
      ]);
    } else {
      table.push([
        process.pid.toString(),
        truncatedName,
        cpuPercent,
        memoryMB,
        process.status,
        truncatedCommand,
      ]);
    }
  });

  return table.toString();
}

export function formatPortTable(
  ports: PortInfo[],
  options: TableOptions = { useColors: true }
): string {
  if (ports.length === 0) {
    return options.useColors
      ? chalk.yellow('No active ports found.')
      : 'No active ports found.';
  }

  let sortedPorts = [...ports];
  if (options.sortBy) {
    sortedPorts = sortPorts(
      sortedPorts,
      options.sortBy,
      options.sortOrder || 'asc'
    );
  }

  const table = new Table({
    head: options.useColors
      ? [
          chalk.bold.blue('Port'),
          chalk.bold.blue('Protocol'),
          chalk.bold.blue('State'),
          chalk.bold.blue('PID'),
          chalk.bold.blue('Process'),
          chalk.bold.blue('Address'),
        ]
      : ['Port', 'Protocol', 'State', 'PID', 'Process', 'Address'],
    colWidths: options.colWidths || [8, 10, 12, 8, 20, 20],
    style: {
      head: options.useColors ? [] : ['bold'],
      border: options.useColors ? ['grey'] : [],
    },
  });

  sortedPorts.forEach(port => {
    const pid = port.process?.pid?.toString() || '-';
    const processName = port.process?.name || '-';
    const truncatedProcess = truncateString(processName, 18);
    const address = port.remoteAddress
      ? `${port.localAddress} → ${port.remoteAddress}`
      : port.localAddress;
    const truncatedAddress = truncateString(address, 18);

    if (options.useColors) {
      const portColor = chalk.cyan;
      const protocolColor = port.protocol === 'tcp' ? chalk.green : chalk.blue;
      const stateColor = getPortStateColor(port.state);
      const pidColor = port.process?.pid ? chalk.white : chalk.gray;
      const processColor = port.process?.name ? chalk.yellow : chalk.gray;
      const addressColor = chalk.gray;

      table.push([
        portColor(port.port.toString()),
        protocolColor(port.protocol.toUpperCase()),
        stateColor(port.state),
        pidColor(pid),
        processColor(truncatedProcess),
        addressColor(truncatedAddress),
      ]);
    } else {
      table.push([
        port.port.toString(),
        port.protocol.toUpperCase(),
        port.state,
        pid,
        truncatedProcess,
        truncatedAddress,
      ]);
    }
  });

  return table.toString();
}

export function formatSystemInfo(
  sysInfo: SystemInfo,
  options: FormatOptions = {
    useColors: true,
    includeTimestamp: false,
    precision: 2,
  }
): string {
  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(options.precision)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const cpuColor = options.useColors
    ? getCpuColor(sysInfo.cpuUsage)
    : (text: string) => text;
  const memoryColor = options.useColors
    ? getMemoryColor(sysInfo.memoryUsage.percentage)
    : (text: string) => text;
  const labelColor = options.useColors
    ? chalk.bold.blue
    : (text: string) => text;
  const valueColor = options.useColors ? chalk.white : (text: string) => text;

  const lines = [
    `${labelColor('Platform:')} ${valueColor(sysInfo.platform)} (${sysInfo.arch})`,
    `${labelColor('CPU Usage:')} ${cpuColor(sysInfo.cpuUsage.toFixed(options.precision) + '%')}`,
    `${labelColor('Memory Usage:')} ${memoryColor(sysInfo.memoryUsage.percentage.toFixed(options.precision) + '%')} (${formatBytes(sysInfo.memoryUsage.used)} / ${formatBytes(sysInfo.memoryUsage.total)})`,
    `${labelColor('Memory Free:')} ${valueColor(formatBytes(sysInfo.memoryUsage.free))}`,
    `${labelColor('Load Average:')} ${valueColor(sysInfo.loadAverage.map(load => load.toFixed(options.precision)).join(', '))}`,
    `${labelColor('Uptime:')} ${valueColor(formatUptime(sysInfo.uptime))}`,
    `${labelColor('Process Count:')} ${valueColor(sysInfo.processCount.toString())}`,
  ];

  if (options.includeTimestamp) {
    const timestamp = new Date().toLocaleString();
    lines.unshift(`${labelColor('Timestamp:')} ${valueColor(timestamp)}`);
  }

  return lines.join('\n');
}

export function formatCSV<T extends Record<string, any>>(
  data: T[],
  options: CSVOptions = {}
): string {
  const separator = options.separator || ',';
  const includeHeaders = options.includeHeaders !== false;

  if (data.length === 0) {
    return includeHeaders && options.customHeaders
      ? options.customHeaders.join(separator) + '\n'
      : '';
  }

  const headers = options.customHeaders || Object.keys(data[0]!);
  const escapeCsvValue = (value: any): string => {
    const stringValue = String(value);
    if (
      stringValue.includes(separator) ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(headers.map(escapeCsvValue).join(separator));
  }

  data.forEach(item => {
    const row = headers.map(header => escapeCsvValue(item[header] ?? ''));
    lines.push(row.join(separator));
  });

  return lines.join('\n');
}

export function formatProcessCSV(
  processes: ProcessInfo[],
  options: CSVOptions = {}
): string {
  const processData = processes.map(p => ({
    PID: p.pid,
    Name: p.name,
    'CPU%': p.cpu.toFixed(1),
    'Memory(MB)': (p.memory / 1024).toFixed(1),
    Status: p.status,
    Command: p.command,
  }));

  return formatCSV(processData, {
    ...options,
    customHeaders: options.customHeaders || [
      'PID',
      'Name',
      'CPU%',
      'Memory(MB)',
      'Status',
      'Command',
    ],
  });
}

export function formatPortCSV(
  ports: PortInfo[],
  options: CSVOptions = {}
): string {
  const portData = ports.map(port => ({
    Port: port.port,
    Protocol: port.protocol.toUpperCase(),
    State: port.state,
    PID: port.process?.pid || '',
    Process: port.process?.name || '',
    LocalAddress: port.localAddress,
    RemoteAddress: port.remoteAddress || '',
  }));

  return formatCSV(portData, {
    ...options,
    customHeaders: options.customHeaders || [
      'Port',
      'Protocol',
      'State',
      'PID',
      'Process',
      'LocalAddress',
      'RemoteAddress',
    ],
  });
}

export function formatSystemInfoCSV(
  sysInfo: SystemInfo,
  options: CSVOptions = {}
): string {
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const totalGB = (sysInfo.memoryUsage.total / (1024 * 1024 * 1024)).toFixed(2);
  const usedGB = (sysInfo.memoryUsage.used / (1024 * 1024 * 1024)).toFixed(2);
  const freeGB = (sysInfo.memoryUsage.free / (1024 * 1024 * 1024)).toFixed(2);

  const systemData = [
    {
      Platform: sysInfo.platform,
      Architecture: sysInfo.arch,
      'CPU_Usage_%': sysInfo.cpuUsage.toFixed(1),
      Memory_Total_GB: totalGB,
      Memory_Used_GB: usedGB,
      Memory_Free_GB: freeGB,
      'Memory_Usage_%': sysInfo.memoryUsage.percentage.toFixed(1),
      Load_Average_1m: sysInfo.loadAverage[0]?.toFixed(2) || '0',
      Load_Average_5m: sysInfo.loadAverage[1]?.toFixed(2) || '0',
      Load_Average_15m: sysInfo.loadAverage[2]?.toFixed(2) || '0',
      Uptime: formatUptime(sysInfo.uptime),
      Process_Count: sysInfo.processCount.toString(),
    },
  ];

  return formatCSV(systemData, options);
}

export function formatJSON<T>(
  data: T,
  options: JSONOptions = { pretty: true, indent: 2 }
): string {
  if (options.pretty) {
    return JSON.stringify(data, null, options.indent || 2);
  }
  return JSON.stringify(data);
}

export function validateFormat(format: string): ValidationResult<string> {
  const validFormats = ['table', 'csv', 'json', 'yaml'];
  const normalizedFormat = format.toLowerCase().trim();

  if (!validFormats.includes(normalizedFormat)) {
    return {
      isValid: false,
      error: `Invalid format "${format}"`,
      warnings: [`Valid formats: ${validFormats.join(', ')}`],
    };
  }

  return {
    isValid: true,
    value: normalizedFormat,
  };
}

export function validateCSVOptions(
  options: CSVOptions
): ValidationResult<CSVOptions> {
  const warnings: string[] = [];

  if (options.separator && options.separator.length !== 1) {
    return {
      isValid: false,
      error: 'CSV separator must be a single character',
      warnings: ['Common separators: comma (,), semicolon (;), tab (\\t)'],
    };
  }

  if (options.separator && /[\r\n"]/.test(options.separator)) {
    return {
      isValid: false,
      error: 'CSV separator cannot be a newline or quote character',
      warnings: ['Use standard separators like comma, semicolon, or tab'],
    };
  }

  if (options.customHeaders) {
    if (!Array.isArray(options.customHeaders)) {
      return {
        isValid: false,
        error: 'Custom headers must be an array of strings',
      };
    }

    if (options.customHeaders.length === 0) {
      warnings.push('Empty custom headers array - no headers will be included');
    }

    const duplicates = options.customHeaders.filter(
      (header, index) => options.customHeaders!.indexOf(header) !== index
    );
    if (duplicates.length > 0) {
      warnings.push(`Duplicate headers found: ${duplicates.join(', ')}`);
    }
  }

  const result: ValidationResult<CSVOptions> = {
    isValid: true,
    value: options,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

export function validateJSONOptions(
  options: JSONOptions
): ValidationResult<JSONOptions> {
  const warnings: string[] = [];

  if (options.indent !== undefined) {
    if (typeof options.indent !== 'number') {
      return {
        isValid: false,
        error: 'JSON indent must be a number',
        warnings: ['Use a positive integer for indentation spaces'],
      };
    }

    if (options.indent < 0) {
      return {
        isValid: false,
        error: 'JSON indent cannot be negative',
        warnings: ['Use 0 for no indentation or a positive number'],
      };
    }

    if (options.indent > 10) {
      warnings.push('Large indentation (>10) may result in very wide output');
    }

    if (!Number.isInteger(options.indent)) {
      warnings.push('Non-integer indent will be rounded down');
    }
  }

  const result: ValidationResult<JSONOptions> = {
    isValid: true,
    value: options,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

export function safeFormat<T>(
  data: T,
  format: string,
  options: any = {}
): { success: boolean; result?: string; error?: string } {
  try {
    const formatValidation = validateFormat(format);
    if (!formatValidation.isValid) {
      return {
        success: false,
        error: formatValidation.error!,
      };
    }

    const normalizedFormat = formatValidation.value!;

    switch (normalizedFormat) {
      case 'json': {
        const jsonValidation = validateJSONOptions(options);
        if (!jsonValidation.isValid) {
          return {
            success: false,
            error: jsonValidation.error!,
          };
        }
        return {
          success: true,
          result: formatJSON(data, jsonValidation.value),
        };
      }
      case 'csv':
        if (Array.isArray(data)) {
          const csvValidation = validateCSVOptions(options);
          if (!csvValidation.isValid) {
            return {
              success: false,
              error: csvValidation.error!,
            };
          }
          return {
            success: true,
            result: formatCSV(data as any[], csvValidation.value),
          };
        } else {
          return {
            success: false,
            error: 'CSV format requires array data',
          };
        }

      case 'table':
        if (Array.isArray(data) && data.length > 0) {
          const firstItem = data[0];
          if (
            firstItem &&
            typeof firstItem === 'object' &&
            'pid' in firstItem
          ) {
            return {
              success: true,
              result: formatProcessTable(data as ProcessInfo[], options),
            };
          } else if (
            firstItem &&
            typeof firstItem === 'object' &&
            'port' in firstItem
          ) {
            return {
              success: true,
              result: formatPortTable(data as PortInfo[], options),
            };
          }
        }
        return {
          success: false,
          error: 'Table format requires array of processes or ports',
        };

      default:
        return {
          success: false,
          error: `Format "${normalizedFormat}" not implemented`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `Formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }

  // For commands, try to keep the executable name and important parts
  if (str.includes('/') && str.includes(' ')) {
    const parts = str.split(' ');
    const executable = parts[0]?.split('/').pop() || parts[0] || '';
    const args = parts.slice(1).join(' ');

    if (executable.length + 3 < maxLength) {
      const remainingSpace = maxLength - executable.length - 3; // 3 for ' …'
      if (args.length <= remainingSpace) {
        return `${executable} ${args}`;
      } else {
        return `${executable} ${args.substring(0, remainingSpace)}…`;
      }
    }
  }

  return str.substring(0, maxLength - 1) + '…';
}

function getCpuColor(cpu: number): (text: string) => string {
  if (cpu > 80) return chalk.red;
  if (cpu > 50) return chalk.yellow;
  return chalk.green;
}

function getMemoryColor(memoryMB: number): (text: string) => string {
  if (memoryMB > 500) return chalk.red;
  if (memoryMB > 100) return chalk.yellow;
  return chalk.green;
}

function getProcessStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'running':
      return chalk.green;
    case 'sleeping':
      return chalk.blue;
    case 'stopped':
      return chalk.yellow;
    case 'zombie':
      return chalk.red;
    default:
      return chalk.gray;
  }
}

function getPortStateColor(state: string): (text: string) => string {
  switch (state.toUpperCase()) {
    case 'LISTEN':
      return chalk.green;
    case 'ESTABLISHED':
      return chalk.blue;
    case 'CLOSE_WAIT':
    case 'TIME_WAIT':
      return chalk.yellow;
    case 'SYN_SENT':
    case 'SYN_RECV':
      return chalk.cyan;
    default:
      return chalk.gray;
  }
}

function sortProcesses(
  processes: ProcessInfo[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): ProcessInfo[] {
  return processes.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'pid':
        comparison = a.pid - b.pid;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'cpu':
        comparison = a.cpu - b.cpu;
        break;
      case 'memory':
        comparison = a.memory - b.memory;
        break;
      default:
        comparison = a.pid - b.pid;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
}

function sortPorts(
  ports: PortInfo[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): PortInfo[] {
  return ports.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'port':
        comparison = a.port - b.port;
        break;
      case 'protocol':
        comparison = a.protocol.localeCompare(b.protocol);
        break;
      case 'state':
        comparison = a.state.localeCompare(b.state);
        break;
      case 'process': {
        const aProcess = a.process?.name || '';
        const bProcess = b.process?.name || '';
        comparison = aProcess.localeCompare(bProcess);
        break;
      }
      default:
        comparison = a.port - b.port;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
}
