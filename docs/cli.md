# CLI Reference

Complete command-line interface reference for Procx. All commands work across macOS, Linux, and Windows.

## Installation

```bash
# Install globally for CLI usage
npm install -g procx

# Or run directly without installation
npx procx <command>
```

## Command Overview

| Task | Commands | Description |
|------|----------|-------------|
| **Find Processes** | `find`, `list` | Discover processes by port, PID, or name |
| **Kill Processes** | `kill` | Terminate processes gracefully or forcefully |
| **Monitor System** | `monitor`, `sysinfo` | Real-time monitoring and system information |
| **Manage Ports** | `ports`, `free`, `resolve` | Port discovery and conflict resolution |

## Find Processes

### `procx find`

Find processes by port, PID, or name with detailed information.

#### Find by Port
```bash
# Find which process is using port 3000
procx find 3000

# Find process using specific port with details
procx find --port 8080

# Check multiple ports
procx find 3000 8080 9000
```

#### Find by Name
```bash
# Find all Node.js processes
procx find --name node

# Find processes with partial name match
procx find --name "webpack"

# Case-insensitive search
procx find --name "NODE" --ignore-case
```

#### Find by PID
```bash
# Get details for specific process ID
procx find --pid 1234

# Check if PID exists
procx find --pid 1234 --quiet
```

### `procx list`

List and filter running processes with sorting and limiting options.

#### Basic Listing
```bash
# List all running processes
procx list

# List with detailed information
procx list --verbose

# Output as JSON for scripting
procx list --json
```

#### Filtering
```bash
# Filter processes by name
procx list --filter node

# Filter by multiple criteria
procx list --filter "node|webpack|vite"

# Filter by resource usage
procx list --min-cpu 50
procx list --min-memory 100
```

#### Sorting and Limiting
```bash
# Sort by CPU usage and limit results
procx list --sort cpu --limit 10

# Sort by memory usage (descending)
procx list --sort memory --desc --limit 5

# Sort by process name
procx list --sort name --limit 20
```

## Kill Processes

### `procx kill`

Terminate processes gracefully or forcefully with safety confirmations.

#### Kill by Port
```bash
# Kill process using port 8080 (with confirmation)
procx kill 8080

# Kill without confirmation prompt
procx kill 3000 --yes

# Force kill if graceful termination fails
procx kill 3000 --force
```

#### Kill by PID
```bash
# Kill process by PID with confirmation
procx kill --pid 1234

# Force kill process by PID
procx kill --pid 1234 --force

# Kill multiple processes by PID
procx kill --pid 1234,5678,9012
```

#### Interactive Killing
```bash
# Kill all Node.js processes interactively
procx find --name node
procx kill --pid <selected_pid> --interactive

# Interactive selection from filtered list
procx list --filter webpack --interactive-kill
```

#### Batch Operations
```bash
# Kill all processes matching pattern
procx kill --name "webpack" --all

# Kill with timeout (wait 5 seconds before force kill)
procx kill 3000 --timeout 5

# Dry run (show what would be killed)
procx kill --name node --dry-run
```

## Monitor System

### `procx monitor`

Real-time process monitoring with customizable refresh intervals and filtering.

#### Basic Monitoring
```bash
# Monitor all processes in real-time
procx monitor

# Monitor with custom refresh interval (seconds)
procx monitor --interval 5

# Monitor specific processes only
procx monitor --filter node
```

#### Advanced Monitoring
```bash
# Monitor with resource thresholds
procx monitor --cpu-threshold 80 --memory-threshold 500

# Monitor and log to file
procx monitor --log monitor.log

# Monitor with alerts
procx monitor --alert-cpu 90 --alert-memory 1000
```

#### Development Monitoring
```bash
# Monitor development processes
procx monitor --filter "node|webpack|vite"

# Monitor with process count limits
procx monitor --limit 20 --sort cpu

# Monitor and auto-restart on crash
procx monitor --restart-on-exit --filter "my-app"
```

### `procx sysinfo`

Get comprehensive system information and resource usage.

#### System Information
```bash
# Get comprehensive system information
procx sysinfo

# Output system info as JSON
procx sysinfo --json

# Get specific system metrics
procx sysinfo --cpu --memory --disk
```

#### Resource Monitoring
```bash
# Check current resource usage
procx sysinfo --usage

# Get historical resource data
procx sysinfo --history --duration 1h

# Export system info to file
procx sysinfo --export system-report.json
```

## Manage Ports

### `procx ports`

List active ports and their associated processes.

#### Port Listing
```bash
# List all active ports and their processes
procx ports

# List ports with detailed process information
procx ports --verbose

# List only TCP ports
procx ports --tcp

# List only UDP ports
procx ports --udp
```

#### Port Filtering
```bash
# List ports in specific range
procx ports --range 3000-9000

# List ports used by specific process
procx ports --process node

# List only listening ports
procx ports --listening
```

### `procx free`

Find available ports for your applications.

#### Find Free Ports
```bash
# Find next available port starting from 3000
procx free --start 3000

# Find free port in specific range
procx free --start 8000 --end 8100

# Find multiple free ports
procx free --count 5 --start 3000
```

#### Port Availability
```bash
# Check if specific port is available
procx free --check 3000

# Find free port avoiding common ranges
procx free --avoid-common --start 3000

# Find free port with custom increment
procx free --start 3000 --increment 10
```

### `procx resolve`

Resolve port conflicts and manage port assignments.

#### Conflict Resolution
```bash
# Resolve port conflict and start new server
procx resolve 3000 --run "npm start"

# Kill conflicting process and use port
procx resolve 8080 --kill --run "node server.js"

# Find alternative port if conflict exists
procx resolve 3000 --find-alternative
```

#### Advanced Resolution
```bash
# Resolve with custom timeout
procx resolve 3000 --timeout 10 --run "npm start"

# Resolve and monitor new process
procx resolve 3000 --run "npm start" --monitor

# Batch resolve multiple ports
procx resolve 3000,8080,9000 --strategy alternative
```

## Development Workflows

### Common Development Tasks

#### Server Management
```bash
# Kill development server and restart
procx kill 3000 && npm start

# Start server on next available port
PORT=$(procx free --start 3000) npm start

# Clean restart with port resolution
procx resolve 3000 --kill --run "npm run dev"
```

#### Process Cleanup
```bash
# Find and kill all webpack processes
procx find --name webpack
procx kill --pid <webpack_pid>

# Clean up all Node.js development processes
procx list --filter node --json | jq '.[].pid' | xargs -I {} procx kill --pid {}

# Kill all processes on development ports
procx kill 3000,8080,9000 --force
```

#### Resource Monitoring
```bash
# Monitor resource usage during development
procx monitor --filter "node|webpack|vite"

# Check for memory leaks in development
procx list --sort memory --filter node --limit 5

# Monitor build processes
procx monitor --filter "webpack|rollup|vite" --interval 2
```

## Global Options

All commands support these global options:

| Option | Description | Example |
|--------|-------------|---------|
| `--json` | Output as JSON | `procx list --json` |
| `--quiet` | Suppress non-essential output | `procx kill 3000 --quiet` |
| `--verbose` | Show detailed information | `procx find 3000 --verbose` |
| `--help` | Show command help | `procx kill --help` |
| `--version` | Show version information | `procx --version` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Process not found |
| 3 | Permission denied |
| 4 | Port not available |
| 5 | Timeout occurred |

## Platform-Specific Notes

### macOS
- Requires `sudo` for killing system processes
- Uses `lsof` and `ps` under the hood
- Supports Activity Monitor integration

### Linux
- May require elevated permissions for some operations
- Uses `/proc` filesystem for process information
- Supports systemd process management

### Windows
- Uses PowerShell and WMI for process management
- May require "Run as Administrator" for system processes
- Supports Windows Task Manager integration

## Troubleshooting

### Common Issues

#### Permission Denied
```bash
# Try with elevated permissions
sudo procx kill --pid 1234

# Or kill only user processes
procx kill --pid 1234 --user-only
```

#### Process Not Found
```bash
# Verify process exists
procx find --pid 1234

# Search by name instead
procx find --name "process-name"
```

#### Port Already in Use
```bash
# Find what's using the port
procx find 3000

# Resolve automatically
procx resolve 3000 --find-alternative
```

For more troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).