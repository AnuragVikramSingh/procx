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

/**
 * @fileoverview Shared utility functions for the procx system
 * @module utils
 */

import { ValidationResult, PortRange, Duration, RetryConfig } from '@/types';

// Re-export error handling utilities
export * from './error-recovery';
export * from './error-handler';

// Re-export logging utilities
export * from './logger';
export * from './debug';

// Re-export performance monitoring utilities
export * from './performance-monitor';

// Re-export command execution utilities
export * from './command-executor';

// Re-export parsing utilities
export * from './parsing-utils';

// Re-export formatting utilities
export * from './formatting-utils';

// Re-export process utilities
export * from './process-utils';

/**
 * Validates a port number with comprehensive error handling
 *
 * @param {number} port - Port number to validate
 * @returns {ValidationResult<number>} Validation result with the port number
 *
 * @example
 * ```typescript
 * const result = validatePort(3000);
 * if (result.isValid) {
 *   console.log(`Port ${result.value} is valid`);
 * } else {
 *   console.error(`Invalid port: ${result.error}`);
 * }
 * ```
 */
export function validatePort(port: number): ValidationResult<number> {
  // Check if port is a number
  if (typeof port !== 'number') {
    return {
      isValid: false,
      error: `Port must be a number, received ${typeof port}`,
      warnings: [
        'Use parseInt() or Number() to convert string values to numbers',
      ],
    };
  }

  // Check if port is NaN
  if (isNaN(port)) {
    return {
      isValid: false,
      error: 'Port cannot be NaN',
      warnings: ['Ensure the port value is a valid numeric value'],
    };
  }

  // Check if port is an integer
  if (!Number.isInteger(port)) {
    return {
      isValid: false,
      error: `Port must be an integer, received ${port}`,
      warnings: ['Use Math.floor() or parseInt() to convert decimal values'],
    };
  }

  // Check for negative values
  if (port < 0) {
    return {
      isValid: false,
      error: `Port cannot be negative, received ${port}`,
      warnings: ['Port numbers must be positive integers'],
    };
  }

  // Check for zero
  if (port === 0) {
    return {
      isValid: false,
      error: 'Port 0 is reserved and cannot be used',
      warnings: ['Use ports 1-65535 for applications'],
    };
  }

  // Check upper bound
  if (port > 65535) {
    return {
      isValid: false,
      error: `Port ${port} exceeds maximum value of 65535`,
      warnings: ['Valid port range is 1-65535'],
    };
  }

  // Add warnings for well-known port ranges
  const warnings: string[] = [];
  if (port <= 1023) {
    warnings.push(
      'Port is in well-known range (1-1023), may require elevated privileges'
    );
  } else if (port >= 49152) {
    warnings.push(
      'Port is in dynamic/private range (49152-65535), may conflict with system assignments'
    );
  }

  const result: ValidationResult<number> = {
    isValid: true,
    value: port,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Validates a process ID (PID) with system-specific constraints
 *
 * @param {number} pid - Process ID to validate
 * @returns {ValidationResult<number>} Validation result with the PID
 *
 * @example
 * ```typescript
 * const result = validatePid(1234);
 * if (result.isValid) {
 *   console.log(`PID ${result.value} is valid`);
 * }
 * ```
 */
export function validatePid(pid: number): ValidationResult<number> {
  // Check if PID is a number
  if (typeof pid !== 'number') {
    return {
      isValid: false,
      error: `PID must be a number, received ${typeof pid}`,
      warnings: [
        'Use parseInt() or Number() to convert string values to numbers',
      ],
    };
  }

  // Check if PID is NaN
  if (isNaN(pid)) {
    return {
      isValid: false,
      error: 'PID cannot be NaN',
      warnings: ['Ensure the PID value is a valid numeric value'],
    };
  }

  // Check if PID is an integer
  if (!Number.isInteger(pid)) {
    return {
      isValid: false,
      error: `PID must be an integer, received ${pid}`,
      warnings: ['Use Math.floor() or parseInt() to convert decimal values'],
    };
  }

  // Check for negative values
  if (pid < 0) {
    return {
      isValid: false,
      error: `PID cannot be negative, received ${pid}`,
      warnings: ['Process IDs are always positive integers'],
    };
  }

  // Check for zero
  if (pid === 0) {
    return {
      isValid: false,
      error:
        'PID 0 is reserved for the kernel scheduler and cannot be targeted',
      warnings: ['Use PIDs greater than 0 for user processes'],
    };
  }

  // System-specific PID constraints
  const warnings: string[] = [];
  const platform = process.platform;

  // Maximum PID values vary by system
  let maxPid = 32768; // Default Linux value
  if (platform === 'darwin') {
    maxPid = 99999; // macOS typical maximum
  } else if (platform === 'win32') {
    maxPid = 4194304; // Windows maximum
  }

  if (pid > maxPid) {
    return {
      isValid: false,
      error: `PID ${pid} exceeds system maximum of ${maxPid} on ${platform}`,
      warnings: [`Maximum PID on ${platform} is typically ${maxPid}`],
    };
  }

  // Add warnings for special PIDs
  if (pid === 1) {
    warnings.push(
      'PID 1 is the init process - terminating it may crash the system'
    );
  } else if (pid < 100) {
    warnings.push(
      'Low PIDs (< 100) are typically system processes - use caution'
    );
  }

  const result: ValidationResult<number> = {
    isValid: true,
    value: pid,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Validates a process name with security sanitization
 *
 * @param {string} name - Process name to validate
 * @returns {ValidationResult<string>} Validation result with the sanitized process name
 *
 * @example
 * ```typescript
 * const result = validateProcessName('node');
 * if (result.isValid) {
 *   console.log(`Process name ${result.value} is valid`);
 * }
 * ```
 */
export function validateProcessName(name: string): ValidationResult<string> {
  // Check if name is a string
  if (typeof name !== 'string') {
    return {
      isValid: false,
      error: `Process name must be a string, received ${typeof name}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  // Check for empty string
  if (name.length === 0) {
    return {
      isValid: false,
      error: 'Process name cannot be empty',
      warnings: ['Provide a valid process name or executable path'],
    };
  }

  // Check for excessive length
  if (name.length > 255) {
    return {
      isValid: false,
      error: `Process name too long (${name.length} characters), maximum is 255`,
      warnings: ['Process names should be concise and under 255 characters'],
    };
  }

  // Security sanitization - check for dangerous characters
  const dangerousChars = /[;&|`$(){}[\]<>'"\\]/;
  if (dangerousChars.test(name)) {
    return {
      isValid: false,
      error: 'Process name contains potentially dangerous characters',
      warnings: [
        'Avoid shell metacharacters: ; & | ` $ ( ) { } [ ] < > \' " \\',
        'Use only alphanumeric characters, hyphens, underscores, and dots',
      ],
    };
  }

  // Check for null bytes (security risk)
  if (name.includes('\0')) {
    return {
      isValid: false,
      error: 'Process name cannot contain null bytes',
      warnings: ['Null bytes can be used for injection attacks'],
    };
  }

  // Check for control characters
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\u0000-\u001F\u007F]/;
  if (controlChars.test(name)) {
    return {
      isValid: false,
      error: 'Process name contains control characters',
      warnings: ['Use only printable ASCII characters'],
    };
  }

  // Sanitize the name by trimming whitespace
  const sanitizedName = name.trim();

  if (sanitizedName.length === 0) {
    return {
      isValid: false,
      error: 'Process name cannot be only whitespace',
      warnings: ['Provide a valid process name'],
    };
  }

  const warnings: string[] = [];

  // Check for leading/trailing whitespace
  if (name !== sanitizedName) {
    warnings.push('Leading/trailing whitespace was removed from process name');
  }

  // Check for common executable extensions
  const hasExtension = /\.(exe|app|bin|sh|bat|cmd|ps1)$/i.test(sanitizedName);
  if (!hasExtension && sanitizedName.includes('.')) {
    warnings.push(
      'Process name contains dots but no recognized executable extension'
    );
  }

  // Check for path separators (might be a full path)
  if (sanitizedName.includes('/') || sanitizedName.includes('\\')) {
    warnings.push(
      'Process name appears to be a path - consider using just the executable name'
    );
  }

  // Check for spaces (might cause issues in some contexts)
  if (sanitizedName.includes(' ')) {
    warnings.push(
      'Process name contains spaces - may need quoting in some contexts'
    );
  }

  const result: ValidationResult<string> = {
    isValid: true,
    value: sanitizedName,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Validates an IPv4 address
 *
 * @param {string} address - IPv4 address to validate
 * @returns {ValidationResult<string>} Validation result with the IPv4 address
 *
 * @example
 * ```typescript
 * const result = validateIPv4('192.168.1.1');
 * if (result.isValid) {
 *   console.log(`IPv4 address ${result.value} is valid`);
 * }
 * ```
 */
export function validateIPv4(address: string): ValidationResult<string> {
  if (typeof address !== 'string') {
    return {
      isValid: false,
      error: `IPv4 address must be a string, received ${typeof address}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return {
      isValid: false,
      error: 'IPv4 address cannot be empty',
      warnings: ['Provide a valid IPv4 address in format x.x.x.x'],
    };
  }

  // Basic format check
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = trimmedAddress.match(ipv4Regex);

  if (!match) {
    return {
      isValid: false,
      error: 'Invalid IPv4 format, expected x.x.x.x where x is 0-255',
      warnings: ['IPv4 addresses must have exactly 4 octets separated by dots'],
    };
  }

  // Validate each octet
  const octets = match.slice(1).map(Number);
  const invalidOctets = octets.filter((octet, index) => {
    if (octet < 0 || octet > 255) return true;
    // Check for leading zeros (except for '0' itself)
    const originalOctet = match[index + 1];
    if (
      originalOctet &&
      originalOctet.length > 1 &&
      originalOctet.startsWith('0')
    )
      return true;
    return false;
  });

  if (invalidOctets.length > 0) {
    return {
      isValid: false,
      error: 'Invalid octets in IPv4 address',
      warnings: [
        'Each octet must be 0-255',
        'Leading zeros are not allowed (except for 0 itself)',
      ],
    };
  }

  const warnings: string[] = [];

  // Check for special address ranges
  const firstOctet = octets[0];
  const secondOctet = octets[1];

  if (firstOctet !== undefined) {
    if (firstOctet === 0) {
      warnings.push(
        'Address starts with 0 - this is reserved for "this network"'
      );
    } else if (firstOctet === 127) {
      warnings.push('Loopback address range (127.x.x.x)');
    } else if (firstOctet === 169 && secondOctet === 254) {
      warnings.push('Link-local address range (169.254.x.x)');
    } else if (firstOctet === 224) {
      warnings.push('Multicast address range (224.x.x.x)');
    } else if (firstOctet >= 240) {
      warnings.push('Reserved address range (240.x.x.x and above)');
    } else if (
      firstOctet === 10 ||
      (firstOctet === 172 &&
        secondOctet !== undefined &&
        secondOctet >= 16 &&
        secondOctet <= 31) ||
      (firstOctet === 192 && secondOctet === 168)
    ) {
      warnings.push('Private address range (RFC 1918)');
    }
  }

  const result: ValidationResult<string> = {
    isValid: true,
    value: trimmedAddress,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Validates an IPv6 address
 *
 * @param {string} address - IPv6 address to validate
 * @returns {ValidationResult<string>} Validation result with the IPv6 address
 *
 * @example
 * ```typescript
 * const result = validateIPv6('2001:db8::1');
 * if (result.isValid) {
 *   console.log(`IPv6 address ${result.value} is valid`);
 * }
 * ```
 */
export function validateIPv6(address: string): ValidationResult<string> {
  if (typeof address !== 'string') {
    return {
      isValid: false,
      error: `IPv6 address must be a string, received ${typeof address}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return {
      isValid: false,
      error: 'IPv6 address cannot be empty',
      warnings: ['Provide a valid IPv6 address'],
    };
  }

  // Check for IPv4-mapped IPv6 addresses
  const ipv4MappedRegex = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
  const ipv4MappedMatch = trimmedAddress.match(ipv4MappedRegex);

  if (ipv4MappedMatch) {
    const ipv4Result = validateIPv4(ipv4MappedMatch[1]!);
    if (!ipv4Result.isValid) {
      return {
        isValid: false,
        error: `Invalid IPv4 part in IPv4-mapped IPv6 address: ${ipv4Result.error}`,
        warnings: ['IPv4-mapped IPv6 addresses must have valid IPv4 part'],
      };
    }

    return {
      isValid: true,
      value: trimmedAddress.toLowerCase(),
      warnings: ['IPv4-mapped IPv6 address'],
    };
  }

  // Basic IPv6 validation
  const parts = trimmedAddress.split(':');

  // Check for double colon (::) compression
  const doubleColonCount = (trimmedAddress.match(/::/g) || []).length;
  if (doubleColonCount > 1) {
    return {
      isValid: false,
      error: 'IPv6 address can contain at most one "::" sequence',
      warnings: ['Use "::" only once to compress consecutive zero groups'],
    };
  }

  // Validate format
  if (doubleColonCount === 0 && parts.length !== 8) {
    return {
      isValid: false,
      error: `IPv6 address must have 8 groups, found ${parts.length}`,
      warnings: ['Use "::" to compress consecutive zero groups if needed'],
    };
  }

  // Validate each part
  for (const part of parts) {
    if (part === '') continue; // Empty parts are OK with :: compression

    if (part.length > 4) {
      return {
        isValid: false,
        error: `IPv6 group "${part}" is too long (max 4 hex digits)`,
        warnings: ['Each IPv6 group must be 1-4 hexadecimal digits'],
      };
    }

    if (!/^[0-9a-fA-F]+$/.test(part)) {
      return {
        isValid: false,
        error: `IPv6 group "${part}" contains invalid characters`,
        warnings: [
          'IPv6 groups must contain only hexadecimal digits (0-9, a-f, A-F)',
        ],
      };
    }
  }

  const warnings: string[] = [];
  const lowerAddress = trimmedAddress.toLowerCase();

  // Check for special addresses
  if (lowerAddress === '::1') {
    warnings.push('IPv6 loopback address');
  } else if (lowerAddress === '::') {
    warnings.push('IPv6 unspecified address');
  } else if (lowerAddress.startsWith('fe80:')) {
    warnings.push('IPv6 link-local address');
  } else if (
    lowerAddress.startsWith('fc00:') ||
    lowerAddress.startsWith('fd00:')
  ) {
    warnings.push('IPv6 unique local address');
  } else if (lowerAddress.startsWith('ff00:')) {
    warnings.push('IPv6 multicast address');
  }

  const result: ValidationResult<string> = {
    isValid: true,
    value: lowerAddress,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Validates a network address (IPv4 or IPv6)
 *
 * @param {string} address - Network address to validate
 * @returns {ValidationResult<string>} Validation result with the network address
 *
 * @example
 * ```typescript
 * const result = validateNetworkAddress('192.168.1.1');
 * if (result.isValid) {
 *   console.log(`Network address ${result.value} is valid`);
 * }
 * ```
 */
export function validateNetworkAddress(
  address: string
): ValidationResult<string> {
  if (typeof address !== 'string') {
    return {
      isValid: false,
      error: `Network address must be a string, received ${typeof address}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length === 0) {
    return {
      isValid: false,
      error: 'Network address cannot be empty',
      warnings: ['Provide a valid IPv4 or IPv6 address'],
    };
  }

  // Try IPv4 first
  if (trimmedAddress.includes('.')) {
    return validateIPv4(trimmedAddress);
  }

  // Try IPv6
  if (trimmedAddress.includes(':')) {
    return validateIPv6(trimmedAddress);
  }

  return {
    isValid: false,
    error: 'Address format not recognized as IPv4 or IPv6',
    warnings: [
      'IPv4 addresses use dots (e.g., 192.168.1.1)',
      'IPv6 addresses use colons (e.g., 2001:db8::1)',
    ],
  };
}

/**
 * Validates a network protocol
 *
 * @param {string} protocol - Network protocol to validate
 * @returns {ValidationResult<string>} Validation result with the protocol
 *
 * @example
 * ```typescript
 * const result = validateNetworkProtocol('tcp');
 * if (result.isValid) {
 *   console.log(`Protocol ${result.value} is valid`);
 * }
 * ```
 */
export function validateNetworkProtocol(
  protocol: string
): ValidationResult<string> {
  if (typeof protocol !== 'string') {
    return {
      isValid: false,
      error: `Protocol must be a string, received ${typeof protocol}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  const trimmedProtocol = protocol.trim().toLowerCase();

  if (trimmedProtocol.length === 0) {
    return {
      isValid: false,
      error: 'Protocol cannot be empty',
      warnings: ['Provide a valid network protocol (tcp, udp, etc.)'],
    };
  }

  const validProtocols = ['tcp', 'udp', 'icmp', 'icmpv6', 'sctp', 'dccp'];

  if (!validProtocols.includes(trimmedProtocol)) {
    return {
      isValid: false,
      error: `Unknown protocol "${trimmedProtocol}"`,
      warnings: [`Valid protocols: ${validProtocols.join(', ')}`],
    };
  }

  const warnings: string[] = [];

  if (protocol !== trimmedProtocol) {
    warnings.push('Protocol was normalized to lowercase');
  }

  const result: ValidationResult<string> = {
    isValid: true,
    value: trimmedProtocol,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Parses and validates a port range string with conflict detection
 *
 * @param {string} rangeStr - Port range string
 * @returns {ValidationResult<PortRange>} Validation result with the parsed range
 *
 * @example
 * ```typescript
 * const result = parsePortRange("3000-4000");
 * if (result.isValid) {
 *   const { start, end } = result.value!;
 *   console.log(`Range: ${start} to ${end}`);
 * }
 * ```
 */
export function parsePortRange(rangeStr: string): ValidationResult<PortRange> {
  if (typeof rangeStr !== 'string') {
    return {
      isValid: false,
      error: `Port range must be a string, received ${typeof rangeStr}`,
      warnings: ['Use String() to convert non-string values'],
    };
  }

  const trimmedRange = rangeStr.trim();

  if (trimmedRange.length === 0) {
    return {
      isValid: false,
      error: 'Port range cannot be empty',
      warnings: ['Provide a valid port range in format "start-end"'],
    };
  }

  // Check for single port (no range)
  if (!trimmedRange.includes('-')) {
    const port = parseInt(trimmedRange, 10);
    const portValidation = validatePort(port);

    if (!portValidation.isValid) {
      const result: ValidationResult<PortRange> = {
        isValid: false,
        error: `Invalid port: ${portValidation.error}`,
      };

      if (portValidation.warnings) {
        result.warnings = portValidation.warnings;
      }

      return result;
    }

    return {
      isValid: true,
      value: { start: port, end: port },
      warnings: ['Single port converted to range'],
    };
  }

  const parts = trimmedRange.split('-');

  if (parts.length !== 2) {
    return {
      isValid: false,
      error:
        'Range must be in format "start-end" or contain exactly one hyphen',
      warnings: [
        'Use format like "3000-4000" for ranges or "3000" for single ports',
      ],
    };
  }

  const startStr = parts[0]?.trim() || '';
  const endStr = parts[1]?.trim() || '';

  if (startStr === '' || endStr === '') {
    return {
      isValid: false,
      error: 'Both start and end ports must be specified',
      warnings: [
        'Format: "start-end" where both start and end are valid port numbers',
      ],
    };
  }

  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);

  const startValidation = validatePort(start);
  if (!startValidation.isValid) {
    const result: ValidationResult<PortRange> = {
      isValid: false,
      error: `Invalid start port: ${startValidation.error}`,
    };

    if (startValidation.warnings) {
      result.warnings = startValidation.warnings;
    }

    return result;
  }

  const endValidation = validatePort(end);
  if (!endValidation.isValid) {
    const result: ValidationResult<PortRange> = {
      isValid: false,
      error: `Invalid end port: ${endValidation.error}`,
    };

    if (endValidation.warnings) {
      result.warnings = endValidation.warnings;
    }

    return result;
  }

  if (start >= end) {
    return {
      isValid: false,
      error: `Start port (${start}) must be less than end port (${end})`,
      warnings: ['Ensure the range is specified as "lower-higher"'],
    };
  }

  const warnings: string[] = [];
  const rangeSize = end - start + 1;

  // Warn about large ranges
  if (rangeSize > 1000) {
    warnings.push(
      `Large port range (${rangeSize} ports) - may impact performance`
    );
  }

  // Warn about ranges crossing privilege boundaries
  if (start <= 1023 && end > 1023) {
    warnings.push('Range spans privileged (1-1023) and unprivileged ports');
  }

  // Warn about ranges in dynamic port area
  if (start >= 49152 || end >= 49152) {
    warnings.push('Range includes dynamic/private ports (49152-65535)');
  }

  // Combine warnings from port validations
  const allWarnings = [
    ...warnings,
    ...(startValidation.warnings || []),
    ...(endValidation.warnings || []),
  ];

  const result: ValidationResult<PortRange> = {
    isValid: true,
    value: { start, end },
  };

  if (allWarnings.length > 0) {
    result.warnings = allWarnings;
  }

  return result;
}

/**
 * Formats bytes into human-readable format
 *
 * @param {number} bytes - Number of bytes
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted string (e.g., "1.5 MB")
 *
 * @example
 * ```typescript
 * console.log(formatBytes(1024)); // "1.00 KB"
 * console.log(formatBytes(1048576)); // "1.00 MB"
 * console.log(formatBytes(1073741824, 1)); // "1.0 GB"
 * ```
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats duration in milliseconds to human-readable format
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {Duration} Duration object with different time units
 *
 * @example
 * ```typescript
 * const duration = formatDuration(90000); // 1.5 minutes
 * console.log(`${duration.minutes}m ${duration.seconds}s`);
 * ```
 */
export function formatDuration(ms: number): Duration {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return {
    milliseconds: ms,
    seconds: seconds % 60,
    minutes: minutes % 60,
    hours,
  };
}

/**
 * Sleeps for the specified number of milliseconds
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * console.log('Starting...');
 * await sleep(1000);
 * console.log('One second later');
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff
 *
 * @param {Function} operation - Async operation to retry
 * @param {RetryConfig} config - Retry configuration
 * @returns {Promise} Result of the operation
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchProcessInfo(pid),
 *   {
 *     maxAttempts: 3,
 *     delayMs: 1000,
 *     backoffMultiplier: 2,
 *     maxDelayMs: 5000
 *   }
 * );
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      await sleep(Math.min(delay, config.maxDelayMs));
      delay *= config.backoffMultiplier;
    }
  }

  throw lastError!;
}

/**
 * Debounces a function call
 *
 * @param {Function} func - Function to debounce
 * @param {number} waitMs - Wait time in milliseconds
 * @returns {Function} Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 *
 * debouncedSearch('test'); // Will only execute after 300ms of no calls
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;

  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), waitMs);
  }) as T;
}
