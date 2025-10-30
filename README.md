# ⚙️ Procx — Modern Process & Port Management CLI & API

[![npm version](https://badge.fury.io/js/procx.svg)](https://badge.fury.io/js/procx)
[![npm downloads](https://img.shields.io/npm/dm/procx.svg)](https://www.npmjs.com/package/procx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

**Procx** is a fast, cross-platform command-line tool and Node.js library for managing, inspecting, and controlling system processes and network ports. Built for developers who need reliable process management across macOS, Linux, and Windows.

Think of it as a modern, developer-friendly replacement for `ps`, `kill`, `netstat`, and `lsof` — all unified in one powerful tool with both CLI and programmatic interfaces.

## Key Features

- **Process Discovery**: Find processes by port, PID, or name with detailed information
- **Safe Termination**: Kill processes gracefully or forcefully with confirmation prompts
- **Port Management**: List active ports, find free ports, and resolve conflicts automatically
- **System Monitoring**: Real-time process monitoring with CPU, memory, and resource tracking
- **Smart Filtering**: Filter and sort processes by various criteria
- **Cross-Platform**: Native support for macOS, Linux, and Windows
- **Programmatic API**: Full Node.js API for integration into applications and scripts

## Installation

### CLI Usage (Global)
```bash
# Install globally for CLI usage
npm install -g procx

# Or run directly without installation
npx procx <command>
```

### Library Usage (Project)
```bash
# Install in your project for programmatic use
npm install procx
```

## Common CLI Examples

### Find and Kill Processes
```bash
# Find which process is using port 3000
procx find 3000

# Kill process using port 8080 (with confirmation)
procx kill 8080

# Force kill process by PID
procx kill --pid 1234 --force

# Kill all Node.js processes interactively
procx find --name node
procx kill --pid <selected_pid> --interactive
```

### Port Management
```bash
# List all active ports and their processes
procx ports

# Find next available port starting from 3000
procx free --start 3000

# Find free port in specific range
procx free --start 8000 --end 8100

# Resolve port conflict and start new server
procx resolve 3000 --run "npm start"
```

### Process Monitoring
```bash
# List all running processes
procx list

# Filter processes by name
procx list --filter node

# Sort by CPU usage and limit results
procx list --sort cpu --limit 10

# Monitor processes in real-time
procx monitor

# Monitor with custom refresh interval
procx monitor --interval 5 --filter node
```

### System Information
```bash
# Get comprehensive system information
procx sysinfo

# Output system info as JSON
procx sysinfo --json

# Check system resource usage
procx list --sort memory --limit 5
```

### Development Workflows
```bash
# Kill development server and restart
procx kill 3000 && npm start

# Find and kill all webpack processes
procx find --name webpack
procx kill --pid <webpack_pid>

# Clean up all Node.js development processes
procx list --filter node --json | jq '.[].pid' | xargs -I {} procx kill --pid {}

# Start server on next available port
PORT=$(procx free --start 3000) npm start

# Monitor resource usage during development
procx monitor --filter "node|webpack|vite"
```

## Basic Library Usage

### Quick Start
```javascript
import { findProcess, killProcess, getFreePort, listProcesses } from 'procx';

// Find process using a specific port
const process = await findProcess({ port: 3000 });
console.log(`Found: ${process.name} (PID: ${process.pid})`);

// Kill a process by PID
await killProcess({ pid: 1234 });

// Find next available port
const freePort = await getFreePort(3000);
console.log(`Available port: ${freePort}`);

// List processes with filtering
const nodeProcesses = await listProcesses({ 
  name: 'node',
  sortBy: 'cpu' 
});
```

### Common Integration Patterns
```javascript
// Automatic port conflict resolution
import { getFreePort, resolvePortConflict } from 'procx';

// Find free port for your application
const port = await getFreePort(3000);
app.listen(port);

// Or resolve conflicts automatically
await resolvePortConflict(3000, 'npm start');

// Process monitoring in applications
import { startMonitor } from 'procx';

const monitor = startMonitor({ refreshInterval: 5000 });
for await (const processes of monitor) {
  const highCpuProcesses = processes.filter(p => p.cpu > 80);
  if (highCpuProcesses.length > 0) {
    console.warn('High CPU usage detected:', highCpuProcesses);
  }
}
```

## Documentation

Choose your path based on how you want to use Procx:

### For CLI Users
**Using Procx from the command line to manage processes and ports**

- **[CLI Commands & Examples](docs/cli.md)** - Complete command reference with real-world examples
- **[Installation Guide](docs/INSTALLATION.md)** - Setup instructions for CLI usage
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Fix common CLI issues

### For Library Users  
**Integrating Procx into your Node.js applications**

- **[Library Documentation](docs/library.md)** - Complete Node.js API reference and examples
- **[Installation Guide](docs/INSTALLATION.md)** - Setup instructions for programmatic usage

### I Want To...

#### Get Started
- **Install and use CLI commands** → [CLI Documentation](docs/cli.md)
- **Integrate into my Node.js app** → [Library Documentation](docs/library.md)

#### Manage Processes & Ports
- **Find what's using a port** → [CLI Commands - Port Management](docs/cli.md#port-management)
- **Kill processes safely** → [CLI Commands - Process Management](docs/cli.md#process-management)
- **Monitor system resources** → [CLI Commands - System Monitoring](docs/cli.md#system-monitoring)

#### Develop with Procx
- **Use Procx in my code** → [Library Documentation](docs/library.md)
- **Handle errors properly** → [Library Documentation - Error Handling](docs/library.md#error-handling)

#### Solve Problems
- **Fix installation issues** → [Troubleshooting](docs/TROUBLESHOOTING.md)
- **Get help with commands** → [CLI Documentation](docs/cli.md)
- **Debug API integration** → [Library Documentation](docs/library.md)

### All Documentation

#### Core Guides
- **[CLI Documentation](docs/cli.md)** - Complete command reference and examples
- **[Library Documentation](docs/library.md)** - Node.js API reference and integration
- **[Installation Guide](docs/INSTALLATION.md)** - Setup for both CLI and library usage
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions for common issues

### Need Help?

- **Installation issues** → [Troubleshooting](docs/TROUBLESHOOTING.md)
- **CLI questions** → [CLI Documentation](docs/cli.md)
- **Library integration** → [Library Documentation](docs/library.md)
- **Report bugs** → [GitHub Issues](https://github.com/AnuragVikramSingh/procx/issues)
- **Contribute** → [Contributing Guidelines](CONTRIBUTING.md)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

```bash
# Quick setup for contributors
git clone https://github.com/AnuragVikramSingh/procx.git
cd procx
npm install
npm run build
npm run lint
```

## License

MIT License © 2025 Anurag Vikram Singh. See [LICENSE](LICENSE) for details.

---

**Built for developers who need reliable process management** • [Documentation](docs/) • [Issues](https://github.com/AnuragVikramSingh/procx/issues) • [Contributing](CONTRIBUTING.md)