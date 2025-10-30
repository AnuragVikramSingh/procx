#!/usr/bin/env node

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

// CLI interface for procx

import { Command } from 'commander';
import * as readline from 'readline';
import chalk from 'chalk';
import {
  findProcess,
  listProcesses,
  getActivePorts,
  getFreePort,
  killProcessesByPortRange,
  getSystemInfo,
  resolvePortConflict,
} from '../api';
import { ProcessInfo, ProcessCriteria, ResolveResult } from '../types';
import {
  formatProcessTable,
  formatPortTable,
  formatSystemInfo,
  formatProcessCSV,
  formatPortCSV,
  formatSystemInfoCSV,
  formatJSON,
  formatCSV,
  TableOptions,
  FormatOptions,
} from '../utils/formatting-utils';
// Removed unused import: ConsoleLogging
import { handleCliError } from '../utils/error-handler';
// Removed unused OutputFormat import

const program = new Command();

// Removed unused configureCliErrorHandler function

function formatSuccessMessage(
  message: string,
  useColors: boolean = true
): string {
  return useColors ? chalk.green(`✓ ${message}`) : `✓ ${message}`;
}

function formatWarningMessage(
  message: string,
  useColors: boolean = true
): string {
  return useColors ? chalk.yellow(`⚠ ${message}`) : `⚠ ${message}`;
}

function formatInfoMessage(message: string, useColors: boolean = true): string {
  return useColors ? chalk.blue(`ℹ ${message}`) : `ℹ ${message}`;
}

function formatProcessInfo(process: ProcessInfo): string {
  const memoryMB = (process.memory / 1024).toFixed(1);
  const cpuPercent = process.cpu.toFixed(1);
  const ports =
    process.ports && process.ports.length > 0
      ? ` (ports: ${process.ports.join(', ')})`
      : '';

  return [
    `PID: ${process.pid}`,
    `Name: ${process.name}`,
    `Command: ${process.command}`,
    `CPU: ${cpuPercent}%`,
    `Memory: ${memoryMB} MB`,
    `Status: ${process.status}${ports}`,
  ].join('\n');
}

function askConfirmation(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      const confirmed =
        answer.toLowerCase().trim() === 'y' ||
        answer.toLowerCase().trim() === 'yes';
      resolve(confirmed);
    });
  });
}

// Interactive monitor with keyboard shortcuts
async function runInteractiveMonitor(
  monitorOptions: any,
  cliOptions: any
): Promise<void> {
  const { startMonitor } = await import('../api');
  const useColors = !cliOptions.noColor && process.stdout.isTTY;

  let currentFilters = { ...monitorOptions.filters };
  let currentSort = currentFilters.sortBy || 'cpu';
  let currentOrder = currentFilters.sortOrder || 'desc';
  let currentLimit = monitorOptions.maxResults || 20;
  let paused = false;
  let showHelp = false;
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
  }

  const handleKeypress = (key: string) => {
    switch (key) {
      case 'q':
      case '\u0003': // Ctrl+C
        console.log('\nExiting monitor...');
        process.exit(0);
        break;
      case 'p':
      case ' ':
        paused = !paused;
        break;
      case 'h':
      case '?':
        showHelp = !showHelp;
        break;
      case 'c':
        currentSort = 'cpu';
        currentFilters.sortBy = currentSort;
        break;
      case 'm':
        currentSort = 'memory';
        currentFilters.sortBy = currentSort;
        break;
      case 'n':
        currentSort = 'name';
        currentFilters.sortBy = currentSort;
        break;
      case 'i':
        currentSort = 'pid';
        currentFilters.sortBy = currentSort;
        break;
      case 'r':
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        currentFilters.sortOrder = currentOrder;
        break;
      case '+':
        currentLimit = Math.min(currentLimit + 5, 100);
        break;
      case '-':
        currentLimit = Math.max(currentLimit - 5, 5);
        break;
      case 'f':
        delete currentFilters.name;
        break;
      case '1':
        currentFilters.minCpu = 50;
        break;
      case '2':
        currentFilters.minMemory = 100 * 1024;
        break;
      case '0':
        currentFilters = {
          sortBy: currentSort,
          sortOrder: currentOrder,
        };
        break;
    }
  };

  if (process.stdin.isTTY) {
    process.stdin.on('data', handleKeypress);
  }

  const displayHelp = () => {
    const helpText = [
      '',
      chalk.bold.blue('=== PROCX MONITOR - KEYBOARD SHORTCUTS ==='),
      '',
      chalk.yellow('Navigation & Control:'),
      '  q, Ctrl+C  - Quit monitor',
      '  p, Space   - Pause/Resume updates',
      '  h, ?       - Toggle this help',
      '',
      chalk.yellow('Sorting:'),
      '  c          - Sort by CPU usage',
      '  m          - Sort by Memory usage',
      '  n          - Sort by process Name',
      '  i          - Sort by PID',
      '  r          - Reverse sort order',
      '',
      chalk.yellow('Filtering:'),
      '  1          - Show high CPU processes (>50%)',
      '  2          - Show high memory processes (>100MB)',
      '  f          - Clear name filter',
      '  0          - Clear all filters',
      '',
      chalk.yellow('Display:'),
      '  +          - Increase result limit',
      '  -          - Decrease result limit',
      '',
      chalk.gray('Press any key to continue...'),
      '',
    ].join('\n');

    return helpText;
  };

  const clearScreen = () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  };

  const displayStatus = () => {
    const filterInfo = [];
    if (currentFilters.name) filterInfo.push(`name:"${currentFilters.name}"`);
    if (currentFilters.minCpu) filterInfo.push(`cpu>${currentFilters.minCpu}%`);
    if (currentFilters.minMemory)
      filterInfo.push(`mem>${(currentFilters.minMemory / 1024).toFixed(0)}MB`);

    const statusParts = [
      `Sort: ${currentSort} (${currentOrder})`,
      `Limit: ${currentLimit}`,
      filterInfo.length > 0
        ? `Filters: ${filterInfo.join(', ')}`
        : 'No filters',
      paused ? chalk.red('PAUSED') : chalk.green('LIVE'),
    ];

    const timestamp = new Date().toLocaleTimeString();
    const status = `${chalk.bold.blue('PROCX Monitor')} | ${statusParts.join(' | ')} | ${timestamp}`;
    const helpHint = chalk.gray('Press h for help, q to quit');

    return `${status}\n${helpHint}\n${'='.repeat(80)}\n`;
  };

  console.log(
    chalk.green('Starting procx monitor... Press h for help, q to quit')
  );

  try {
    for await (const processes of startMonitor({
      refreshInterval: monitorOptions.refreshInterval,
      filters: currentFilters,
      maxResults: currentLimit,
    })) {
      if (paused) {
        continue;
      }

      clearScreen();

      if (showHelp) {
        console.log(displayHelp());
        continue;
      }

      console.log(displayStatus());

      if (processes.length === 0) {
        console.log(chalk.yellow('No processes match current filters.'));
      } else {
        const tableOptions: TableOptions = { useColors };
        console.log(
          formatProcessTable(processes.slice(0, currentLimit), tableOptions)
        );
      }

      const activeFilters = [];
      if (currentFilters.name)
        activeFilters.push(`Name filter: "${currentFilters.name}"`);
      if (currentFilters.minCpu)
        activeFilters.push(`Min CPU: ${currentFilters.minCpu}%`);
      if (currentFilters.minMemory)
        activeFilters.push(
          `Min Memory: ${(currentFilters.minMemory / 1024).toFixed(0)}MB`
        );

      if (activeFilters.length > 0) {
        console.log(
          '\n' + chalk.blue('Active filters: ') + activeFilters.join(', ')
        );
      }
    }
  } catch (error) {
    handleCliError(error, 'monitor', 'cli', 1);
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}

function outputResult(
  data: any,
  options: {
    json?: boolean;
    csv?: boolean;
    noColor?: boolean;
    type?: 'process' | 'port';
  } = {}
): void {
  if (options.json) {
    console.log(formatJSON(data, { pretty: true, indent: 2 }));
  } else if (options.csv) {
    if (Array.isArray(data)) {
      if (options.type === 'port') {
        console.log(formatPortCSV(data));
      } else {
        console.log(formatProcessCSV(data));
      }
    } else {
      // For single process info, convert to array and format as CSV
      console.log(formatProcessCSV([data]));
    }
  } else if (Array.isArray(data)) {
    const tableOptions: TableOptions = {
      useColors: !options.noColor && process.stdout.isTTY,
    };
    if (options.type === 'port') {
      console.log(formatPortTable(data, tableOptions));
    } else {
      console.log(formatProcessTable(data, tableOptions));
    }
  } else {
    console.log(formatProcessInfo(data));
  }
}

// Find processes by port, PID, or name
program
  .command('find')
  .description('Find processes by port, PID, or name')
  .argument('[port]', 'Port number to search for')
  .option('--pid <pid>', 'Find process by PID', parseInt)
  .option('--name <name>', 'Find processes by name')
  .option('--ignore-case', 'Case-insensitive name search')
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .option('--no-color', 'Disable colored output')
  .action(async (port: string | undefined, options: any) => {
    try {
      const criteria: ProcessCriteria = {};

      if (port) {
        const portNum = parseInt(port, 10);
        if (isNaN(portNum)) {
          throw new Error(
            `Invalid port number "${port}". Port must be a number between 1 and 65535.`
          );
        }
        criteria.port = portNum;
      }

      if (options.pid) {
        criteria.pid = options.pid;
      }

      if (options.name) {
        criteria.name = options.name;
      }

      if (!criteria.port && !criteria.pid && !criteria.name) {
        throw new Error(
          'Must specify port, --pid, or --name.\n' +
            'Usage: procx find <port> | procx find --pid <pid> | procx find --name <name>'
        );
      }

      const processes = await findProcess(criteria);

      if (processes.length === 0) {
        const useColors = !options.noColor && process.stdout.isTTY;
        let message: string;
        if (criteria.port) {
          message = `No process found using port ${criteria.port}`;
        } else if (criteria.pid) {
          message = `No process found with PID ${criteria.pid}`;
        } else if (criteria.name) {
          message = `No processes found matching name "${criteria.name}"`;
        } else {
          message = 'No processes found matching the specified criteria';
        }

        console.log(formatInfoMessage(message, useColors));
        process.exit(1);
      }

      outputResult(processes, {
        json: options.json,
        csv: options.csv,
        noColor: options.noColor,
      });
    } catch (error) {
      handleCliError(error, 'find', 'cli', 1);
    }
  });

// List all processes with optional filtering
program
  .command('list')
  .description('List all running processes')
  .option('--filter <name>', 'Filter processes by name')
  .option('--min-cpu <percent>', 'Filter by minimum CPU usage', parseFloat)
  .option(
    '--min-memory <mb>',
    'Filter by minimum memory usage (MB)',
    parseFloat
  )
  .option('--sort <field>', 'Sort by field (pid, name, cpu, memory)', 'pid')
  .option('--order <direction>', 'Sort order (asc, desc)', 'asc')
  .option('--desc', 'Sort in descending order (shorthand for --order desc)')
  .option('--limit <count>', 'Limit number of results', parseInt)
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .option('--no-color', 'Disable colored output')
  .action(async (options: any) => {
    try {
      const filters: any = {};

      if (options.filter) {
        filters.name = options.filter;
      }

      if (options.minCpu !== undefined) {
        filters.minCpu = options.minCpu;
      }

      if (options.minMemory !== undefined) {
        filters.minMemory = options.minMemory * 1024;
      }

      if (options.sort) {
        const validSortFields = ['pid', 'name', 'cpu', 'memory'];
        if (!validSortFields.includes(options.sort)) {
          throw new Error(
            `Invalid sort field "${options.sort}". Valid options: ${validSortFields.join(', ')}`
          );
        }
        filters.sortBy = options.sort;
      }

      if (options.desc) {
        filters.sortOrder = 'desc';
      } else if (options.order) {
        const validOrders = ['asc', 'desc'];
        if (!validOrders.includes(options.order)) {
          throw new Error(
            `Invalid sort order "${options.order}". Valid options: ${validOrders.join(', ')}`
          );
        }
        filters.sortOrder = options.order;
      }

      let processes = await listProcesses(filters);

      if (options.limit && options.limit > 0) {
        processes = processes.slice(0, options.limit);
      }

      outputResult(processes, {
        json: options.json,
        csv: options.csv,
        noColor: options.noColor,
      });
    } catch (error) {
      handleCliError(error, 'list', 'cli', 1);
    }
  });

// List all active ports with their associated processes
program
  .command('ports')
  .description('List all active network ports and their associated processes')
  .option('--protocol <protocol>', 'Filter by protocol (tcp, udp)')
  .option('--start <port>', 'Start port for range filtering', parseInt)
  .option('--end <port>', 'End port for range filtering', parseInt)
  .option('--range <range>', 'Port range (format: start-end, e.g., 3000-8080)')
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .option('--no-color', 'Disable colored output')
  .action(async (options: any) => {
    try {
      const scanOptions: any = {};

      if (options.protocol) {
        const validProtocols = ['tcp', 'udp'];
        if (!validProtocols.includes(options.protocol.toLowerCase())) {
          throw new Error(
            `Invalid protocol "${options.protocol}". Valid options: ${validProtocols.join(', ')}`
          );
        }
        scanOptions.protocol = options.protocol.toLowerCase();
      }

      // Handle --range option
      if (options.range) {
        const rangeParts = options.range.split('-');
        if (rangeParts.length !== 2) {
          throw new Error(
            'Invalid range format. Use format: start-end (e.g., 3000-8080)'
          );
        }

        const rangeStart = parseInt(rangeParts[0]?.trim() || '', 10);
        const rangeEnd = parseInt(rangeParts[1]?.trim() || '', 10);

        if (isNaN(rangeStart) || isNaN(rangeEnd)) {
          throw new Error('Invalid port numbers in range');
        }

        if (rangeStart < 1 || rangeStart > 65535 || rangeEnd < 1 || rangeEnd > 65535) {
          throw new Error('Port numbers must be between 1 and 65535');
        }

        if (rangeStart > rangeEnd) {
          throw new Error('Start port must be less than or equal to end port');
        }

        scanOptions.startPort = rangeStart;
        scanOptions.endPort = rangeEnd;
      }

      if (options.start !== undefined) {
        if (options.start < 1 || options.start > 65535) {
          throw new Error('Start port must be between 1 and 65535');
        }
        scanOptions.startPort = options.start;
      }

      if (options.end !== undefined) {
        if (options.end < 1 || options.end > 65535) {
          throw new Error('End port must be between 1 and 65535');
        }
        scanOptions.endPort = options.end;
      }

      if (
        options.start !== undefined &&
        options.end !== undefined &&
        options.start > options.end
      ) {
        throw new Error('Start port must be less than or equal to end port');
      }

      const ports = await getActivePorts(scanOptions);

      outputResult(ports, {
        json: options.json,
        csv: options.csv,
        noColor: options.noColor,
        type: 'port',
      });
    } catch (error) {
      handleCliError(error, 'ports', 'cli', 1);
    }
  });

// Find available ports starting from a specific port
program
  .command('free')
  .description(
    'Find the next available port starting from a specific port number'
  )
  .option('--start <port>', 'Starting port number (default: 3000)', parseInt)
  .option('--end <port>', 'Ending port number (default: 65535)', parseInt)
  .option('--protocol <protocol>', 'Protocol to check (tcp, udp)', 'tcp')
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .action(async (options: any) => {
    try {
      const startPort = options.start || 3000;
      const endPort = options.end || 65535;

      if (startPort < 1 || startPort > 65535) {
        throw new Error('Start port must be between 1 and 65535');
      }

      if (endPort < startPort || endPort > 65535) {
        throw new Error('End port must be between start port and 65535');
      }

      const validProtocols = ['tcp', 'udp'];
      if (!validProtocols.includes(options.protocol.toLowerCase())) {
        throw new Error(
          `Invalid protocol "${options.protocol}". Valid options: ${validProtocols.join(', ')}`
        );
      }

      const freePort = await getFreePort(
        startPort,
        endPort,
        options.protocol.toLowerCase()
      );

      if (options.json) {
        console.log(
          formatJSON(
            { port: freePort, protocol: options.protocol },
            { pretty: true, indent: 2 }
          )
        );
      } else if (options.csv) {
        const csvData = [
          {
            Port: freePort,
            Protocol: options.protocol.toUpperCase(),
          },
        ];
        console.log(
          formatCSV(csvData, { customHeaders: ['Port', 'Protocol'] })
        );
      } else {
        const useColors = !options.noColor && process.stdout.isTTY;
        console.log(
          formatSuccessMessage(
            `Next available ${options.protocol.toUpperCase()} port: ${freePort}`,
            useColors
          )
        );
      }
    } catch (error) {
      handleCliError(error, 'free', 'cli', 1);
    }
  });

// Kill processes by port or PID
program
  .command('kill')
  .description('Kill processes by port, PID, or port range')
  .argument('[port]', 'Port number to kill process using it')
  .option('--pid <pid>', 'Kill process by PID', parseInt)
  .option(
    '--range <range>',
    'Kill processes in port range (format: start-end, e.g., 3000-3010)'
  )
  .option('--force', 'Force kill using SIGKILL instead of SIGTERM')
  .option(
    '--interactive',
    'Show process information and ask for confirmation before killing'
  )
  .option('--timeout <seconds>', 'Timeout in seconds before force kill', parseInt)
  .option('--dry-run', 'Show what would be killed without actually killing')
  .option('--yes', 'Skip confirmation prompts')
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .action(async (port: string | undefined, options: any) => {
    try {
      let target: any = {};

      // Handle positional port argument
      if (port) {
        const portNum = parseInt(port, 10);
        if (isNaN(portNum)) {
          throw new Error(
            `Invalid port number "${port}". Port must be a number between 1 and 65535.`
          );
        }
        target.port = portNum;
      }

      if (options.pid) {
        target.pid = options.pid;
      }

      let rangeStart: number | undefined;
      let rangeEnd: number | undefined;
      if (options.range) {
        const rangeParts = options.range.split('-');
        if (rangeParts.length !== 2) {
          throw new Error(
            'Invalid range format. Use format: start-end (e.g., 3000-3010)'
          );
        }

        rangeStart = parseInt(rangeParts[0]?.trim() || '', 10);
        rangeEnd = parseInt(rangeParts[1]?.trim() || '', 10);

        if (isNaN(rangeStart) || isNaN(rangeEnd)) {
          throw new Error('Invalid port numbers in range');
        }

        if (
          rangeStart < 1 ||
          rangeStart > 65535 ||
          rangeEnd < 1 ||
          rangeEnd > 65535
        ) {
          throw new Error('Port numbers must be between 1 and 65535');
        }

        if (rangeStart > rangeEnd) {
          throw new Error('Start port must be less than or equal to end port');
        }
      }

      if (!target.port && !target.pid && !options.range) {
        throw new Error(
          'Must specify port, --pid, or --range.\n' +
            'Usage: procx kill <port> | procx kill --pid <pid> | procx kill --range <start-end>\n' +
            'Options:\n' +
            '  --force        Force kill using SIGKILL instead of SIGTERM\n' +
            '  --interactive  Show process information and ask for confirmation\n' +
            '  --range        Kill processes in port range (e.g., --range 3000-3010)'
        );
      }

      if (options.range && rangeStart !== undefined && rangeEnd !== undefined) {
        if (options.interactive && !options.json) {
          const signal = options.force ? 'SIGKILL' : 'SIGTERM';
          const confirmed = await askConfirmation(
            `Are you sure you want to kill all processes using ports ${rangeStart}-${rangeEnd} using ${signal}?`
          );

          if (!confirmed) {
            console.log('Operation cancelled.');
            process.exit(0);
          }
        }

        const killOptions: any = {};
        if (options.force) {
          killOptions.force = true;
        }

        const results = await killProcessesByPortRange(
          rangeStart,
          rangeEnd,
          killOptions
        );

        if (options.json) {
          console.log(formatJSON(results, { pretty: true, indent: 2 }));
        } else if (options.csv) {
          const csvData = results.map(r => ({
            Port: r.port,
            Success: r.success,
            PID: r.pid || '',
            Error: r.error || '',
          }));
          console.log(
            formatCSV(csvData, {
              customHeaders: ['Port', 'Success', 'PID', 'Error'],
            })
          );
        } else {
          const useColors = !options.noColor && process.stdout.isTTY;
          if (results.length === 0) {
            console.log(
              formatInfoMessage(
                `No processes found using ports in range ${rangeStart}-${rangeEnd}`,
                useColors
              )
            );
          } else {
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            if (successful.length > 0) {
              console.log(
                formatSuccessMessage(
                  `Successfully killed ${successful.length} process(es):`,
                  useColors
                )
              );
              successful.forEach(r => {
                console.log(`  Port ${r.port}: PID ${r.pid}`);
              });
            }

            if (failed.length > 0) {
              console.log(
                formatWarningMessage(
                  `Failed to kill ${failed.length} process(es):`,
                  useColors
                )
              );
              failed.forEach(r => {
                console.log(`  Port ${r.port}: ${r.error}`);
              });
            }
          }
        }
        return;
      }

      if (options.interactive && !options.json) {
        let processInfo: ProcessInfo | null = null;

        if (target.port) {
          const processes = await findProcess({ port: target.port });
          processInfo = processes.length > 0 ? processes[0] || null : null;
        } else if (target.pid) {
          const processes = await findProcess({ pid: target.pid });
          processInfo = processes.length > 0 ? processes[0] || null : null;
        }

        if (!processInfo) {
          const identifier = target.port
            ? `port ${target.port}`
            : `PID ${target.pid}`;
          throw new Error(`No process found using ${identifier}`);
        }

        console.log('\nProcess Information:');
        console.log(formatProcessInfo(processInfo));
        console.log('');

        const signal = options.force ? 'SIGKILL' : 'SIGTERM';
        const confirmed = await askConfirmation(
          `Are you sure you want to kill process '${processInfo.name}' (PID: ${processInfo.pid}) using ${signal}?`
        );

        if (!confirmed) {
          console.log('Operation cancelled.');
          process.exit(0);
        }
      }

      const { killProcess } = await import('../api');
      const killOptions: any = {};
      if (options.force) {
        killOptions.force = true;
      }
      if (options.interactive) {
        killOptions.interactive = true;
      }

      const result = await killProcess(target, killOptions);

      if (options.json) {
        console.log(formatJSON(result, { pretty: true, indent: 2 }));
      } else if (options.csv) {
        const csvData = [
          {
            Success: result.success,
            PID: result.pid,
            Message: result.message,
          },
        ];
        console.log(
          formatCSV(csvData, { customHeaders: ['Success', 'PID', 'Message'] })
        );
      } else {
        const useColors = !options.noColor && process.stdout.isTTY;
        if (result.success) {
          const forceIndicator = options.force ? ' (forced)' : '';
          console.log(
            formatSuccessMessage(
              `${result.message}${forceIndicator}`,
              useColors
            )
          );
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      handleCliError(error, 'kill', 'cli', 1);
    }
  });

// Display system information and metrics
program
  .command('sysinfo')
  .description('Display system information and resource usage')
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .option('--no-color', 'Disable colored output')
  .action(async (options: any) => {
    try {
      const sysInfo = await getSystemInfo();

      if (options.json) {
        console.log(formatJSON(sysInfo, { pretty: true, indent: 2 }));
      } else if (options.csv) {
        console.log(formatSystemInfoCSV(sysInfo));
      } else {
        const formatOptions: FormatOptions = {
          useColors: !options.noColor && process.stdout.isTTY,
          includeTimestamp: false,
          precision: 2,
        };
        console.log(formatSystemInfo(sysInfo, formatOptions));
      }
    } catch (error) {
      handleCliError(error, 'sysinfo', 'cli', 1);
    }
  });

// Monitor processes with real-time updates
program
  .command('monitor')
  .description(
    'Monitor processes with real-time updates and interactive filtering'
  )
  .option('--filter <name>', 'Filter processes by name')
  .option('--min-cpu <percent>', 'Filter by minimum CPU usage', parseFloat)
  .option(
    '--min-memory <mb>',
    'Filter by minimum memory usage (MB)',
    parseFloat
  )
  .option('--sort <field>', 'Sort by field (pid, name, cpu, memory)', 'cpu')
  .option('--order <direction>', 'Sort order (asc, desc)', 'desc')
  .option('--limit <count>', 'Limit number of results', parseInt)
  .option('--interval <ms>', 'Refresh interval in milliseconds', parseInt)
  .option('--json', 'Output in JSON format (disables interactive mode)')
  .option('--csv', 'Output in CSV format (disables interactive mode)')
  .option('--no-color', 'Disable colored output')
  .action(async (options: any) => {
    try {
      const { startMonitor } = await import('../api');
      const filters: any = {};

      if (options.filter) {
        filters.name = options.filter;
      }

      if (options.minCpu !== undefined) {
        filters.minCpu = options.minCpu;
      }

      if (options.minMemory !== undefined) {
        filters.minMemory = options.minMemory * 1024;
      }

      if (options.sort) {
        const validSortFields = ['pid', 'name', 'cpu', 'memory'];
        if (!validSortFields.includes(options.sort)) {
          throw new Error(
            `Invalid sort field "${options.sort}". Valid options: ${validSortFields.join(', ')}`
          );
        }
        filters.sortBy = options.sort;
      }

      if (options.order) {
        const validOrders = ['asc', 'desc'];
        if (!validOrders.includes(options.order)) {
          throw new Error(
            `Invalid sort order "${options.order}". Valid options: ${validOrders.join(', ')}`
          );
        }
        filters.sortOrder = options.order;
      }

      const monitorOptions: any = {
        refreshInterval: options.interval || 2000,
        filters,
        maxResults: options.limit,
      };

      if (options.json) {
        for await (const processes of startMonitor(monitorOptions)) {
          console.log(
            formatJSON(
              {
                timestamp: new Date().toISOString(),
                processCount: processes.length,
                processes,
              },
              { pretty: true, indent: 2 }
            )
          );
        }
        return;
      }

      if (options.csv) {
        let headerPrinted = false;
        for await (const processes of startMonitor(monitorOptions)) {
          if (!headerPrinted) {
            console.log('Timestamp,ProcessCount');
            console.log(formatProcessCSV(processes));
            headerPrinted = true;
          } else {
            const csvData = formatProcessCSV(processes);
            const lines = csvData.split('\n');
            for (let i = 1; i < lines.length; i++) {
              if (lines[i]?.trim()) {
                console.log(lines[i]);
              }
            }
          }
        }
        return;
      }

      await runInteractiveMonitor(monitorOptions, options);
    } catch (error) {
      handleCliError(error, 'monitor', 'cli', 1);
    }
  });

// Resolve port conflicts and execute command
program
  .command('resolve')
  .description(
    'Resolve port conflicts by killing processes and executing a command'
  )
  .argument('<port>', 'Port number to resolve conflicts for', parseInt)
  .option('--run <command>', 'Command to execute after resolving conflicts')
  .option(
    '--force',
    'Force kill conflicting processes using SIGKILL instead of SIGTERM'
  )
  .option(
    '--interactive',
    'Show process information and ask for confirmation before killing'
  )
  .option('--json', 'Output in JSON format')
  .option('--csv', 'Output in CSV format')
  .option('--no-color', 'Disable colored output')
  .action(async (port: number, options: any) => {
    try {
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Port must be a number between 1 and 65535');
      }

      if (!options.run) {
        throw new Error(
          '--run option is required.\n' +
            'Usage: procx resolve <port> --run "<command>"\n' +
            'Example: procx resolve 3000 --run "npm start"'
        );
      }

      if (options.interactive && !options.json) {
        try {
          const processes = await findProcess({ port });

          if (processes.length > 0) {
            const conflictingProcess = processes[0];

            console.log('\nPort Conflict Detected:');
            console.log(formatProcessInfo(conflictingProcess!));
            console.log('');

            const signal = options.force ? 'SIGKILL' : 'SIGTERM';
            const confirmed = await askConfirmation(
              `Kill process '${conflictingProcess!.name}' (PID: ${conflictingProcess!.pid}) using ${signal} and run "${options.run}"?`
            );

            if (!confirmed) {
              console.log('Operation cancelled.');
              process.exit(0);
            }
          } else {
            const useColors = !options.noColor && process.stdout.isTTY;
            console.log(
              formatInfoMessage(
                `No process found using port ${port}. Proceeding to execute command.`,
                useColors
              )
            );
          }
        } catch (error) {
          console.log(
            `Could not check for conflicts on port ${port}. Proceeding with command execution.`
          );
        }
      }

      const result: ResolveResult = await resolvePortConflict(
        port,
        options.run,
        {
          force: options.force,
        }
      );

      if (options.json) {
        console.log(formatJSON(result, { pretty: true, indent: 2 }));
      } else if (options.csv) {
        const csvData = [
          {
            Success: result.success,
            Port: port,
            KilledProcessCount: result.killedProcesses.length,
            CommandExecuted: result.commandExecuted,
            Error: result.error || '',
          },
        ];
        console.log(
          formatCSV(csvData, {
            customHeaders: [
              'Success',
              'Port',
              'KilledProcessCount',
              'CommandExecuted',
              'Error',
            ],
          })
        );

        if (result.killedProcesses.length > 0) {
          console.log('\nKilledProcesses:');
          const killedProcessData = result.killedProcesses.map(proc => ({
            PID: proc.pid,
            Name: proc.name,
            Command: proc.command,
          }));
          console.log(
            formatCSV(killedProcessData, {
              customHeaders: ['PID', 'Name', 'Command'],
            })
          );
        }
      } else {
        const useColors = !options.noColor && process.stdout.isTTY;
        if (result.success) {
          if (result.killedProcesses.length > 0) {
            const signal = options.force ? 'SIGKILL' : 'SIGTERM';
            console.log(
              formatSuccessMessage(
                `Killed ${result.killedProcesses.length} conflicting process(es) using ${signal}:`,
                useColors
              )
            );
            result.killedProcesses.forEach(proc => {
              console.log(`  - ${proc.name} (PID: ${proc.pid})`);
            });
          } else {
            console.log(
              formatSuccessMessage(
                `No conflicts found on port ${port}`,
                useColors
              )
            );
          }

          if (result.commandExecuted) {
            console.log(
              formatSuccessMessage(
                `Successfully executed: ${options.run}`,
                useColors
              )
            );
            if (result.commandOutput && result.commandOutput.trim()) {
              console.log('\nCommand output:');
              console.log(result.commandOutput);
            }
          }
        } else {
          let errorMessage = `Failed to resolve port ${port} conflict`;
          if (result.error) {
            errorMessage += `: ${result.error}`;
          }

          if (result.killedProcesses.length > 0) {
            console.log(
              formatWarningMessage(
                `Successfully killed ${result.killedProcesses.length} process(es) before failure`,
                useColors
              )
            );
          }

          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      handleCliError(error, 'resolve', 'cli', 1);
    }
  });

// Set up program metadata
program
  .name('procx')
  .description('Modern cross-platform process and port management tool')
  .version('1.0.0');

// Parse command line arguments
if (require.main === module) {
  program.parse();
}

export { program };
