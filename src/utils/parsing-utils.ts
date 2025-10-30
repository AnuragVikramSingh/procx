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
  ProcessStatus,
  PortState,
  Platform,
  RawProcessInfo,
  NetworkConnection,
} from '../types';

export enum MemoryUnit {
  BYTES = 'bytes',
  KB = 'kb',
  MB = 'mb',
  GB = 'gb',
  TB = 'tb',
}

export enum NetworkFormat {
  NETSTAT = 'netstat',
  SS = 'ss',
  LSOF = 'lsof',
}

interface ProcessStatusMapping {
  [key: string]: ProcessStatus;
}

const PLATFORM_STATUS_MAPPINGS: Record<Platform, ProcessStatusMapping> = {
  [Platform.LINUX]: {
    R: 'running',
    S: 'sleeping',
    D: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    t: 'stopped',
    X: 'zombie',
    I: 'sleeping', // Idle
  },
  [Platform.MACOS]: {
    R: 'running',
    S: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    U: 'sleeping', // Uninterruptible wait
    I: 'sleeping', // Idle
  },
  [Platform.WINDOWS]: {
    Running: 'running',
    Sleeping: 'sleeping',
    Stopped: 'stopped',
    Zombie: 'zombie',
    Unknown: 'unknown',
  },
  [Platform.FREEBSD]: {
    R: 'running',
    S: 'sleeping',
    D: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    I: 'sleeping',
  },
  [Platform.OPENBSD]: {
    R: 'running',
    S: 'sleeping',
    D: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    I: 'sleeping',
  },
  [Platform.SUNOS]: {
    R: 'running',
    S: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    O: 'running', // On processor
  },
  [Platform.AIX]: {
    R: 'running',
    S: 'sleeping',
    T: 'stopped',
    Z: 'zombie',
    A: 'running', // Active
  },
};

const CONNECTION_STATE_MAPPINGS: Record<string, PortState> = {
  LISTEN: 'LISTEN',
  ESTABLISHED: 'ESTABLISHED',
  SYN_SENT: 'SYN_SENT',
  SYN_RECV: 'SYN_RECV',
  FIN_WAIT1: 'FIN_WAIT1',
  FIN_WAIT2: 'FIN_WAIT2',
  TIME_WAIT: 'TIME_WAIT',
  CLOSE: 'CLOSE',
  CLOSE_WAIT: 'CLOSE_WAIT',
  LAST_ACK: 'LAST_ACK',
  CLOSING: 'CLOSING',

  ESTAB: 'ESTABLISHED',
  UNCONN: 'LISTEN',

  'SYN-SENT': 'SYN_SENT',
  'SYN-RECEIVED': 'SYN_RECV',
  'FIN-WAIT-1': 'FIN_WAIT1',
  'FIN-WAIT-2': 'FIN_WAIT2',
  'TIME-WAIT': 'TIME_WAIT',
  'CLOSE-WAIT': 'CLOSE_WAIT',
  'LAST-ACK': 'LAST_ACK',
};

const MEMORY_UNIT_FACTORS: Record<MemoryUnit, number> = {
  [MemoryUnit.BYTES]: 1,
  [MemoryUnit.KB]: 1024,
  [MemoryUnit.MB]: 1024 * 1024,
  [MemoryUnit.GB]: 1024 * 1024 * 1024,
  [MemoryUnit.TB]: 1024 * 1024 * 1024 * 1024,
};

export function parseProcessStatus(
  status: string,
  platform: Platform
): ProcessStatus {
  if (!status || typeof status !== 'string') {
    return 'unknown';
  }

  const platformMapping = PLATFORM_STATUS_MAPPINGS[platform];
  if (!platformMapping) {
    return 'unknown';
  }

  const exactMatch = platformMapping[status];
  if (exactMatch) {
    return exactMatch;
  }

  const firstChar = status.charAt(0);
  const firstCharMatch = platformMapping[firstChar];
  if (firstCharMatch) {
    return firstCharMatch;
  }

  const upperStatus = status.toUpperCase();
  const caseInsensitiveMatch = platformMapping[upperStatus];
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }

  return 'unknown';
}

export function parseMemoryUsage(
  memoryStr: string,
  defaultUnit: MemoryUnit = MemoryUnit.KB
): number {
  if (!memoryStr || typeof memoryStr !== 'string') {
    return 0;
  }

  const trimmed = memoryStr.trim();
  if (!trimmed) {
    return 0;
  }

  const match = trimmed.match(/^([\d.,]+)\s*([a-zA-Z]*)$/);
  if (!match) {
    return 0;
  }

  const numericStr = match[1]?.replace(/,/g, '') || '0';
  const unitStr = (match[2] || '').toLowerCase();

  const numericValue = parseFloat(numericStr);
  if (isNaN(numericValue) || numericValue < 0) {
    return 0;
  }

  let unit: MemoryUnit = defaultUnit;

  if (unitStr) {
    const unitMappings: Record<string, MemoryUnit> = {
      b: MemoryUnit.BYTES,
      byte: MemoryUnit.BYTES,
      bytes: MemoryUnit.BYTES,
      k: MemoryUnit.KB,
      kb: MemoryUnit.KB,
      kib: MemoryUnit.KB,
      kilobyte: MemoryUnit.KB,
      kilobytes: MemoryUnit.KB,
      m: MemoryUnit.MB,
      mb: MemoryUnit.MB,
      mib: MemoryUnit.MB,
      megabyte: MemoryUnit.MB,
      megabytes: MemoryUnit.MB,
      g: MemoryUnit.GB,
      gb: MemoryUnit.GB,
      gib: MemoryUnit.GB,
      gigabyte: MemoryUnit.GB,
      gigabytes: MemoryUnit.GB,
      t: MemoryUnit.TB,
      tb: MemoryUnit.TB,
      tib: MemoryUnit.TB,
      terabyte: MemoryUnit.TB,
      terabytes: MemoryUnit.TB,
    };

    const mappedUnit = unitMappings[unitStr];
    if (mappedUnit) {
      unit = mappedUnit;
    }
  }

  const factor = MEMORY_UNIT_FACTORS[unit];
  return Math.round(numericValue * factor);
}

export function parseCpuUsage(cpuStr: string): number {
  if (!cpuStr || typeof cpuStr !== 'string') {
    return 0;
  }

  const trimmed = cpuStr.trim();
  if (!trimmed) {
    return 0;
  }

  const cleanStr = trimmed.replace('%', '');
  const numericValue = parseFloat(cleanStr);

  if (isNaN(numericValue) || numericValue < 0) {
    return 0;
  }

  if (numericValue > 0 && numericValue < 1) {
    return Math.min(numericValue * 100, 100);
  }

  return Math.min(numericValue, 100);
}

/**
 * Normalizes network connection state across different tools and platforms
 *
 * @param {string} state - Raw connection state from network tool
 * @returns {PortState} Normalized connection state
 *
 * @example
 * ```typescript
 * const state1 = normalizeConnectionState('ESTAB'); // 'ESTABLISHED'
 * const state2 = normalizeConnectionState('SYN-SENT'); // 'SYN_SENT'
 * const state3 = normalizeConnectionState('UNCONN'); // 'LISTEN'
 * ```
 */
export function normalizeConnectionState(state: string): PortState {
  if (!state || typeof state !== 'string') {
    return 'UNKNOWN';
  }

  const upperState = state.trim().toUpperCase();

  // Direct mapping
  const mappedState = CONNECTION_STATE_MAPPINGS[upperState];
  if (mappedState) {
    return mappedState;
  }

  // Return as-is if not found in mapping (might be a valid state we don't know about)
  return upperState as PortState;
}

/**
 * Extracts address and port from various network address formats
 *
 * @param {string} addressStr - Address string (e.g., "127.0.0.1:8080", "[::1]:3000")
 * @returns {{ address: string; port: number } | null} Parsed address and port or null if invalid
 *
 * @example
 * ```typescript
 * const result1 = extractAddressAndPort('127.0.0.1:8080'); // { address: '127.0.0.1', port: 8080 }
 * const result2 = extractAddressAndPort('[::1]:3000'); // { address: '::1', port: 3000 }
 * const result3 = extractAddressAndPort('*:80'); // { address: '*', port: 80 }
 * ```
 */
export function extractAddressAndPort(
  addressStr: string
): { address: string; port: number } | null {
  if (!addressStr || typeof addressStr !== 'string') {
    return null;
  }

  const trimmed = addressStr.trim();
  if (!trimmed) {
    return null;
  }

  // Handle IPv6 addresses in brackets [::1]:port
  const ipv6Match = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6Match) {
    const address = ipv6Match[1];
    const port = parseInt(ipv6Match[2] || '', 10);

    if (address && !isNaN(port) && port >= 0 && port <= 65535) {
      return { address, port };
    }
    return null;
  }

  // Handle IPv4 addresses and hostnames address:port
  const lastColonIndex = trimmed.lastIndexOf(':');
  if (lastColonIndex === -1) {
    return null;
  }

  const address = trimmed.substring(0, lastColonIndex);
  const portStr = trimmed.substring(lastColonIndex + 1);
  const port = parseInt(portStr, 10);

  if (!address || isNaN(port) || port < 0 || port > 65535) {
    return null;
  }

  return { address, port };
}

/**
 * Parses a single line of process information from ps-style output
 *
 * @param {string} line - Single line of process output
 * @param {Platform} platform - Platform the output came from
 * @returns {RawProcessInfo | null} Parsed process info or null if invalid
 *
 * @example
 * ```typescript
 * const line = "1000  1234  5678  node     node server.js  25.5  1024  S  Jan01";
 * const info = parseProcessLine(line, Platform.LINUX);
 * // Returns parsed RawProcessInfo object
 * ```
 */
export function parseProcessLine(
  line: string,
  platform: Platform
): RawProcessInfo | null {
  if (!line || typeof line !== 'string') {
    return null;
  }

  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  // Split by whitespace, but preserve command arguments
  const parts = trimmed.split(/\s+/);
  if (parts.length < 8) {
    return null;
  }

  try {
    // Platform-specific ps output formats:
    // Linux: USER PID PPID NAME COMMAND CPU MEMORY STATUS [START_TIME]
    // macOS: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
    let pidIndex,
      ppidIndex,
      nameIndex,
      commandStartIndex,
      cpuIndex,
      memoryIndex,
      statusIndex;

    if (platform === Platform.MACOS) {
      // macOS ps -eo format: USER PID PPID %CPU %MEM VSZ RSS TT STAT START TIME COMM COMMAND
      pidIndex = 1;
      ppidIndex = 2; // Now available with -eo format
      cpuIndex = 3;
      memoryIndex = 6; // RSS
      statusIndex = 8;
      nameIndex = 11; // COMM field
      commandStartIndex = 12;
    } else {
      // Linux/other format: USER PID PPID NAME COMMAND CPU MEMORY STATUS
      pidIndex = 1;
      ppidIndex = 2;
      nameIndex = 3;
      commandStartIndex = 4;
      cpuIndex = 5;
      memoryIndex = 6;
      statusIndex = 7;
    }

    // Parse basic fields
    const pid = parseInt(parts[pidIndex] || '', 10);
    const ppid =
      ppidIndex >= 0 ? parseInt(parts[ppidIndex] || '', 10) : undefined;
    const cpu = parseFloat(parts[cpuIndex] || '0');
    const memoryRaw = parts[memoryIndex] || '0';
    const statusRaw = parts[statusIndex] || '';

    if (isNaN(pid) || pid <= 0) {
      return null;
    }

    // Parse memory (usually in KB for ps output)
    const memory = parseMemoryUsage(memoryRaw, MemoryUnit.KB);

    // Parse status
    const status = parseProcessStatus(statusRaw, platform);

    // Reconstruct command from remaining parts
    const command = parts.slice(commandStartIndex).join(' ');

    // Extract process name
    let name = '';
    if (platform === Platform.MACOS) {
      // For macOS with -eo format, use COMM field if available, otherwise extract from command
      if (nameIndex !== undefined && parts[nameIndex]) {
        name = parts[nameIndex] || '';
      } else if (command) {
        const commandParts = command.split(/\s+/);
        const firstPart = commandParts[0] || '';
        if (firstPart.includes('/')) {
          name = firstPart.split('/').pop() || firstPart;
        } else {
          name = firstPart;
        }
      }
    } else {
      // For Linux, name is in a separate field
      name =
        (parts[nameIndex!] || '').split('/').pop() || parts[nameIndex!] || '';
    }

    return {
      pid,
      ppid: ppid && !isNaN(ppid) ? ppid : undefined,
      name,
      command,
      cpu: parseCpuUsage(cpu.toString()),
      memory,
      status,
    };
  } catch {
    return null;
  }
}

// Network Connection Parsing Utilities

/**
 * Parses netstat output format into NetworkConnection objects
 *
 * @param {string} output - Raw netstat output
 * @returns {NetworkConnection[]} Array of parsed network connections
 *
 * @example
 * ```typescript
 * const netstatOutput = `
 * tcp4  0  0  127.0.0.1.8080  *.*  LISTEN
 * tcp4  0  0  127.0.0.1.3000  127.0.0.1.54321  ESTABLISHED
 * `;
 * const connections = parseNetstatOutput(netstatOutput);
 * ```
 */
export function parseNetstatOutput(output: string): NetworkConnection[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const connections: NetworkConnection[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('Proto') ||
      trimmed.startsWith('Active')
    ) {
      continue; // Skip headers and empty lines
    }

    const connection = parseNetstatLine(trimmed);
    if (connection) {
      connections.push(connection);
    }
  }

  return connections;
}

/**
 * Parses ss (socket statistics) output format into NetworkConnection objects
 *
 * @param {string} output - Raw ss output
 * @returns {NetworkConnection[]} Array of parsed network connections
 *
 * @example
 * ```typescript
 * const ssOutput = `
 * tcp   LISTEN  0  128  127.0.0.1:8080  0.0.0.0:*
 * tcp   ESTAB   0  0    127.0.0.1:3000  127.0.0.1:54321
 * `;
 * const connections = parseSsOutput(ssOutput);
 * ```
 */
export function parseSsOutput(output: string): NetworkConnection[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const connections: NetworkConnection[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('Netid') ||
      trimmed.startsWith('State')
    ) {
      continue; // Skip headers and empty lines
    }

    const connection = parseSsLine(trimmed);
    if (connection) {
      connections.push(connection);
    }
  }

  return connections;
}

/**
 * Parses lsof output format into NetworkConnection objects
 *
 * @param {string} output - Raw lsof output
 * @returns {NetworkConnection[]} Array of parsed network connections
 *
 * @example
 * ```typescript
 * const lsofOutput = `
 * node    1234 user  3u  IPv4  12345  0t0  TCP 127.0.0.1:8080 (LISTEN)
 * node    1234 user  4u  IPv4  12346  0t0  TCP 127.0.0.1:3000->127.0.0.1:54321 (ESTABLISHED)
 * `;
 * const connections = parseLsofOutput(lsofOutput);
 * ```
 */
export function parseLsofOutput(output: string): NetworkConnection[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const connections: NetworkConnection[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('COMMAND') ||
      trimmed.startsWith('PID')
    ) {
      continue; // Skip headers and empty lines
    }

    const connection = parseLsofLine(trimmed);
    if (connection) {
      connections.push(connection);
    }
  }

  return connections;
}

/**
 * Parses a single line of netstat output
 *
 * @param {string} line - Single line from netstat output
 * @returns {NetworkConnection | null} Parsed connection or null if invalid
 */
function parseNetstatLine(line: string): NetworkConnection | null {
  const parts = line.split(/\s+/);
  if (parts.length < 6) {
    return null;
  }

  try {
    const protocol = (parts[0] || '').toLowerCase();
    const localAddr = parts[3] || '';
    const remoteAddr = parts[4] || '';
    const state = parts[5] || '';

    // Extract protocol (tcp/udp) from protocol field (e.g., "tcp4", "tcp6", "udp")
    let cleanProtocol: 'tcp' | 'udp';
    if (protocol.startsWith('tcp')) {
      cleanProtocol = 'tcp';
    } else if (protocol.startsWith('udp')) {
      cleanProtocol = 'udp';
    } else {
      return null;
    }

    // Parse local address
    const localParsed = extractAddressAndPort(localAddr);
    if (!localParsed) {
      return null;
    }

    // Parse remote address (optional for listening sockets)
    let remoteAddress: string | undefined;
    let remotePort: number | undefined;

    if (
      remoteAddr &&
      remoteAddr !== '*.*' &&
      remoteAddr !== '0.0.0.0:*' &&
      remoteAddr !== '*:*'
    ) {
      const remoteParsed = extractAddressAndPort(remoteAddr);
      if (remoteParsed) {
        remoteAddress = remoteParsed.address;
        remotePort = remoteParsed.port;
      }
    }

    return {
      localAddress: localParsed.address,
      localPort: localParsed.port,
      remoteAddress,
      remotePort,
      protocol: cleanProtocol,
      state: normalizeConnectionState(state),
    };
  } catch {
    return null;
  }
}

/**
 * Parses a single line of ss output
 *
 * @param {string} line - Single line from ss output
 * @returns {NetworkConnection | null} Parsed connection or null if invalid
 */
function parseSsLine(line: string): NetworkConnection | null {
  const parts = line.split(/\s+/);
  if (parts.length < 5) {
    return null;
  }

  try {
    const protocol = (parts[0] || '').toLowerCase() as 'tcp' | 'udp';
    const state = parts[1] || '';
    const localAddr = parts[4] || '';
    const remoteAddr = parts.length > 5 ? parts[5] : '';

    if (protocol !== 'tcp' && protocol !== 'udp') {
      return null;
    }

    // Parse local address
    const localParsed = extractAddressAndPort(localAddr);
    if (!localParsed) {
      return null;
    }

    // Parse remote address (optional)
    let remoteAddress: string | undefined;
    let remotePort: number | undefined;

    if (
      remoteAddr &&
      remoteAddr !== '0.0.0.0:*' &&
      remoteAddr !== '*:*' &&
      remoteAddr !== ''
    ) {
      const remoteParsed = extractAddressAndPort(remoteAddr);
      if (remoteParsed) {
        remoteAddress = remoteParsed.address;
        remotePort = remoteParsed.port;
      }
    }

    // Extract PID if present in the line (ss -p format)
    let pid: number | undefined;
    const pidMatch = line.match(/pid=(\d+)/);
    if (pidMatch && pidMatch[1]) {
      const parsedPid = parseInt(pidMatch[1], 10);
      if (!isNaN(parsedPid) && parsedPid > 0) {
        pid = parsedPid;
      }
    }

    return {
      localAddress: localParsed.address,
      localPort: localParsed.port,
      remoteAddress,
      remotePort,
      protocol,
      state: normalizeConnectionState(state),
      pid,
    };
  } catch {
    return null;
  }
}

/**
 * Parses a single line of lsof output
 *
 * @param {string} line - Single line from lsof output
 * @returns {NetworkConnection | null} Parsed connection or null if invalid
 */
function parseLsofLine(line: string): NetworkConnection | null {
  const parts = line.split(/\s+/);
  if (parts.length < 8) {
    return null;
  }

  try {
    const pid = parseInt(parts[1] || '', 10);
    const protocolInfo = parts[7] || ''; // e.g., "TCP"
    const addressInfo = parts[8] || ''; // e.g., "127.0.0.1:8080->127.0.0.1:54321"
    const stateInfo = parts.length > 9 ? parts[9] || '' : ''; // e.g., "(ESTABLISHED)"

    if (isNaN(pid) || pid <= 0) {
      return null;
    }

    const protocol = protocolInfo.toLowerCase() as 'tcp' | 'udp';
    if (protocol !== 'tcp' && protocol !== 'udp') {
      return null;
    }

    // Extract state from parentheses
    let state = 'UNKNOWN';
    const stateMatch = stateInfo.match(/\(([^)]+)\)/);
    if (stateMatch && stateMatch[1]) {
      state = stateMatch[1];
    }

    // Parse address information
    let localAddress: string;
    let localPort: number;
    let remoteAddress: string | undefined;
    let remotePort: number | undefined;

    if (addressInfo.includes('->')) {
      // Established connection: local->remote
      const [localPart, remotePart] = addressInfo.split('->');
      const localParsed = extractAddressAndPort(localPart || '');
      const remoteParsed = extractAddressAndPort(remotePart || '');

      if (!localParsed) {
        return null;
      }

      localAddress = localParsed.address;
      localPort = localParsed.port;

      if (remoteParsed) {
        remoteAddress = remoteParsed.address;
        remotePort = remoteParsed.port;
      }
    } else {
      // Listening socket: just local address
      const localParsed = extractAddressAndPort(addressInfo);
      if (!localParsed) {
        return null;
      }

      localAddress = localParsed.address;
      localPort = localParsed.port;
    }

    return {
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
      protocol,
      state: normalizeConnectionState(state),
      pid,
    };
  } catch {
    return null;
  }
}

/**
 * Generic network connection parser that detects format and uses appropriate parser
 *
 * @param {string} output - Raw network command output
 * @param {NetworkFormat} format - Expected format of the output
 * @returns {NetworkConnection[]} Array of parsed network connections
 *
 * @example
 * ```typescript
 * const connections1 = parseNetworkConnections(netstatOutput, NetworkFormat.NETSTAT);
 * const connections2 = parseNetworkConnections(ssOutput, NetworkFormat.SS);
 * const connections3 = parseNetworkConnections(lsofOutput, NetworkFormat.LSOF);
 * ```
 */
export function parseNetworkConnections(
  output: string,
  format: NetworkFormat
): NetworkConnection[] {
  switch (format) {
    case NetworkFormat.NETSTAT:
      return parseNetstatOutput(output);
    case NetworkFormat.SS:
      return parseSsOutput(output);
    case NetworkFormat.LSOF:
      return parseLsofOutput(output);
    default:
      return [];
  }
}

/**
 * Auto-detects network output format and parses accordingly
 *
 * @param {string} output - Raw network command output
 * @returns {NetworkConnection[]} Array of parsed network connections
 *
 * @example
 * ```typescript
 * const connections = autoParseNetworkConnections(unknownFormatOutput);
 * ```
 */
export function autoParseNetworkConnections(
  output: string
): NetworkConnection[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  // Try to detect format based on content
  if (
    trimmed.includes('COMMAND') &&
    trimmed.includes('PID') &&
    trimmed.includes('TYPE')
  ) {
    // Looks like lsof output
    return parseLsofOutput(output);
  } else if (
    trimmed.includes('Netid') ||
    trimmed.includes('State') ||
    /^(tcp|udp)\s+\w+/.test(trimmed)
  ) {
    // Looks like ss output
    return parseSsOutput(output);
  } else if (trimmed.includes('Proto') || /^tcp\d?\s+/.test(trimmed)) {
    // Looks like netstat output
    return parseNetstatOutput(output);
  }

  // If we can't detect, try all parsers and return the one with most results
  const netstatResults = parseNetstatOutput(output);
  const ssResults = parseSsOutput(output);
  const lsofResults = parseLsofOutput(output);

  const results = [netstatResults, ssResults, lsofResults];
  return results.reduce(
    (best, current) => (current.length > best.length ? current : best),
    []
  );
}

/**
 * Centralized parsing utilities class for consistent data parsing across platforms
 */
export class ParsingUtils {
  /**
   * Parse process list output from various platforms
   *
   * @param {string} output - Raw process list output
   * @param {Platform} platform - Platform the output came from
   * @returns {RawProcessInfo[]} Array of parsed process information
   */
  parseProcessList(output: string, platform: Platform): RawProcessInfo[] {
    if (!output || typeof output !== 'string') {
      return [];
    }

    const processes: RawProcessInfo[] = [];
    const lines = output.trim().split('\n');

    // Skip header line if present
    const startIndex =
      lines[0]?.includes('PID') || lines[0]?.includes('USER') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const processInfo = parseProcessLine(line, platform);
      if (processInfo) {
        processes.push(processInfo);
      }
    }

    return processes;
  }

  /**
   * Parse network connections output from various platforms and tools
   *
   * @param {string} output - Raw network connections output
   * @param {Platform} platform - Platform the output came from
   * @returns {NetworkConnection[]} Array of parsed network connections
   */
  parseNetworkConnections(
    output: string,
    _platform?: Platform
  ): NetworkConnection[] {
    // Auto-detect format and parse
    return autoParseNetworkConnections(output);
  }

  /**
   * Parse system metrics from platform-specific output
   *
   * @param {string} output - Raw system metrics output
   * @param {Platform} platform - Platform the output came from
   * @returns {any} Parsed system metrics (platform-specific structure)
   */
  parseSystemMetrics(_output?: string, _platform?: Platform): any {
    // This would be implemented based on specific platform requirements
    // For now, return empty object as this is typically handled by platform-specific code
    return {};
  }

  /**
   * Parse memory usage with unit conversion
   *
   * @param {string} memoryStr - Memory string to parse
   * @param {MemoryUnit} defaultUnit - Default unit if none specified
   * @returns {number} Memory usage in bytes
   */
  parseMemoryUsage(
    memoryStr: string,
    defaultUnit: MemoryUnit = MemoryUnit.KB
  ): number {
    return parseMemoryUsage(memoryStr, defaultUnit);
  }

  /**
   * Parse CPU usage percentage
   *
   * @param {string} cpuStr - CPU usage string to parse
   * @returns {number} CPU usage percentage (0-100)
   */
  parseCpuUsage(cpuStr: string): number {
    return parseCpuUsage(cpuStr);
  }

  /**
   * Parse process status for platform
   *
   * @param {string} status - Raw process status
   * @param {Platform} platform - Platform the status came from
   * @returns {ProcessStatus} Normalized process status
   */
  parseProcessStatus(status: string, platform: Platform): ProcessStatus {
    return parseProcessStatus(status, platform);
  }

  /**
   * Extract address and port from network address string
   *
   * @param {string} addressStr - Address string to parse
   * @returns {{ address: string; port: number } | null} Parsed address and port
   */
  extractAddressAndPort(
    addressStr: string
  ): { address: string; port: number } | null {
    return extractAddressAndPort(addressStr);
  }

  /**
   * Normalize connection state across platforms
   *
   * @param {string} state - Raw connection state
   * @returns {PortState} Normalized connection state
   */
  normalizeConnectionState(state: string): PortState {
    return normalizeConnectionState(state);
  }
}
