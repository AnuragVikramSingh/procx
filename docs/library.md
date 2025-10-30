# Procx Node.js Library Documentation

The Procx library provides a comprehensive Node.js API for process and port management. This document covers installation, setup, and detailed usage examples for programmatic integration.

## Installation and Setup

### Installation

```bash
# Install in your project
npm install procx

# Or with yarn
yarn add procx

# For TypeScript projects (types included)
npm install procx
```

### Basic Import

```javascript
// ES6 modules
import { findProcess, killProcess, getFreePort, listProcesses } from 'procx';

// CommonJS
const { findProcess, killProcess, getFreePort, listProcesses } = require('procx');
```

### TypeScript Support

Procx includes full TypeScript definitions. Import types as needed:

```typescript
import { 
  ProcessInfo, 
  ProcessCriteria, 
  KillOptions, 
  PortInfo,
  SystemInfo 
} from 'procx';
```

## Core API Reference

### Process Management

#### `findProcess(criteria: ProcessCriteria): Promise<ProcessInfo[]>`

Find processes by port, PID, name, or command.

**Parameters:**
- `criteria.port?: number` - Find process using specific port
- `criteria.pid?: number` - Find process by PID
- `criteria.name?: string` - Find processes by name
- `criteria.command?: string` - Find processes by command

**Returns:** Array of `ProcessInfo` objects

**Example:**
```typescript
// Find process using port 3000
const processes = await findProcess({ port: 3000 });
if (processes.length > 0) {
  console.log(`Found: ${processes[0].name} (PID: ${processes[0].pid})`);
}

// Find all Node.js processes
const nodeProcesses = await findProcess({ name: 'node' });
console.log(`Found ${nodeProcesses.length} Node.js processes`);

// Find by multiple criteria
const results = await findProcess({ 
  name: 'node', 
  port: 3000 
});
```

#### `killProcess(target: ProcessTarget, options?: KillOptions): Promise<KillResult>`

Kill a process by PID or port.

**Parameters:**
- `target.pid?: number` - Process ID to kill
- `target.port?: number` - Kill process using this port
- `options.force?: boolean` - Use SIGKILL instead of SIGTERM
- `options.interactive?: boolean` - Show confirmation prompt

**Returns:** `KillResult` with success status and details

**Example:**
```typescript
// Kill process by PID
const result = await killProcess({ pid: 1234 });
console.log(result.message);

// Kill process using port 3000
await killProcess({ port: 3000 });

// Force kill with SIGKILL
await killProcess({ pid: 1234 }, { force: true });
```

#### `listProcesses(filters?: ProcessFilters): Promise<ProcessInfo[]>`

List all processes with optional filtering and sorting.

**Parameters:**
- `filters.name?: string` - Filter by process name
- `filters.minCpu?: number` - Minimum CPU usage percentage
- `filters.minMemory?: number` - Minimum memory usage in bytes
- `filters.status?: ProcessStatus` - Filter by process status
- `filters.sortBy?: 'cpu' | 'memory' | 'pid' | 'name'` - Sort criteria
- `filters.sortOrder?: 'asc' | 'desc'` - Sort order

**Example:**
```typescript
// List all processes
const allProcesses = await listProcesses();

// Filter and sort
const highCpuProcesses = await listProcesses({
  minCpu: 50,
  sortBy: 'cpu',
  sortOrder: 'desc'
});

// Filter by name
const nodeProcesses = await listProcesses({ name: 'node' });
```

### Port Management

#### `getFreePort(startPort?: number, endPort?: number, protocol?: 'tcp' | 'udp'): Promise<number>`

Find the next available port starting from a given port number.

**Parameters:**
- `startPort` - Starting port number (default: 3000)
- `endPort` - Ending port number (default: 65535)
- `protocol` - Protocol to check (default: 'tcp')

**Example:**
```typescript
// Find next available port starting from 3000
const freePort = await getFreePort(3000);
console.log(`Available port: ${freePort}`);

// Find port in specific range
const port = await getFreePort(8000, 8100);

// Find UDP port
const udpPort = await getFreePort(5000, 6000, 'udp');
```

#### `getActivePorts(options?: PortScanOptions): Promise<PortInfo[]>`

Get all active ports with their associated processes.

**Parameters:**
- `options.startPort?: number` - Start of port range
- `options.endPort?: number` - End of port range
- `options.protocol?: 'tcp' | 'udp'` - Protocol filter
- `options.timeout?: number` - Scan timeout in milliseconds

**Example:**
```typescript
// Get all active ports
const activePorts = await getActivePorts();

// Get ports in specific range
const webPorts = await getActivePorts({
  startPort: 80,
  endPort: 8080,
  protocol: 'tcp'
});

activePorts.forEach(port => {
  console.log(`Port ${port.port}: ${port.process?.name || 'Unknown'}`);
});
```

#### `resolvePortConflict(port: number, command: string, options?: { force?: boolean }): Promise<ResolveResult>`

Kill processes using a port and execute a command.

**Example:**
```typescript
// Kill process on port 3000 and start new server
const result = await resolvePortConflict(3000, 'npm start');
if (result.success) {
  console.log('Server started successfully');
  console.log(`Killed processes: ${result.killedProcesses.length}`);
}
```

### System Monitoring

#### `getSystemInfo(): Promise<SystemInfo>`

Get current system information and metrics.

**Example:**
```typescript
const sysInfo = await getSystemInfo();
console.log(`CPU Usage: ${sysInfo.cpuUsage}%`);
console.log(`Memory Usage: ${sysInfo.memoryUsage.percentage}%`);
console.log(`Active Processes: ${sysInfo.processCount}`);
```

#### `startMonitor(options?: MonitorOptions): AsyncGenerator<ProcessInfo[]>`

Start monitoring processes with real-time updates.

**Parameters:**
- `options.refreshInterval?: number` - Update interval in milliseconds (default: 2000)
- `options.filters?: ProcessFilters` - Process filters
- `options.maxResults?: number` - Maximum number of results

**Example:**
```typescript
// Monitor all processes
const monitor = startMonitor({ refreshInterval: 5000 });
for await (const processes of monitor) {
  const highCpuProcesses = processes.filter(p => p.cpu > 80);
  if (highCpuProcesses.length > 0) {
    console.warn('High CPU usage detected:', highCpuProcesses);
  }
}

// Monitor specific processes
const nodeMonitor = startMonitor({
  refreshInterval: 3000,
  filters: { name: 'node' },
  maxResults: 10
});
```

## TypeScript Definitions

### Core Types

```typescript
interface ProcessInfo {
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

interface ProcessCriteria {
  port?: number;
  pid?: number;
  name?: string;
  command?: string;
}

interface ProcessTarget {
  pid?: number;
  port?: number;
}

interface KillOptions {
  force?: boolean;
  interactive?: boolean;
}

interface KillResult {
  success: boolean;
  pid: number;
  message: string;
}

interface ProcessFilters {
  name?: string;
  minCpu?: number;
  minMemory?: number;
  status?: ProcessStatus;
  sortBy?: 'cpu' | 'memory' | 'pid' | 'name';
  sortOrder?: 'asc' | 'desc';
}

type ProcessStatus = 'running' | 'sleeping' | 'stopped' | 'zombie' | 'unknown';
```

### Port Types

```typescript
interface PortInfo {
  port: number;
  protocol: PortProtocol;
  state: PortState;
  process?: ProcessInfo;
  localAddress: string;
  remoteAddress?: string;
}

interface PortScanOptions {
  startPort?: number;
  endPort?: number;
  protocol?: PortProtocol;
  timeout?: number;
}

type PortProtocol = 'tcp' | 'udp';
type PortState = 'LISTEN' | 'ESTABLISHED' | 'CLOSE_WAIT' | 'TIME_WAIT' | 'SYN_SENT' | 'SYN_RECV' | string;
```

### System Types

```typescript
interface SystemInfo {
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

interface MonitorOptions {
  refreshInterval: number;
  filters?: ProcessFilters;
  maxResults?: number;
  showDeltas?: boolean;
}

interface ResolveResult {
  success: boolean;
  killedProcesses: ProcessInfo[];
  commandExecuted: boolean;
  commandOutput?: string;
  error?: string;
}
```

## Integration Examples

### Express.js Server with Port Management

```typescript
import express from 'express';
import { getFreePort, findProcess, killProcess } from 'procx';

async function startServer() {
  const app = express();
  
  // Find available port
  const port = await getFreePort(3000);
  
  app.get('/', (req, res) => {
    res.json({ message: 'Server running', port });
  });
  
  app.get('/health', async (req, res) => {
    const process = await findProcess({ port });
    res.json({
      status: 'healthy',
      process: {
        pid: process[0]?.pid,
        cpu: process[0]?.cpu,
        memory: process[0]?.memory
      }
    });
  });
  
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    server.close();
    await killProcess({ port });
  });
}

startServer().catch(console.error);
```

### Process Health Monitor

```typescript
import { findProcess, getSystemInfo, startMonitor } from 'procx';

class ProcessHealthMonitor {
  private monitoredPorts: number[] = [];
  private alertThresholds = {
    cpu: 80,
    memory: 500 * 1024 * 1024 // 500MB
  };
  
  addPort(port: number) {
    this.monitoredPorts.push(port);
  }
  
  async checkHealth(): Promise<void> {
    for (const port of this.monitoredPorts) {
      try {
        const processes = await findProcess({ port });
        
        if (processes.length === 0) {
          console.warn(`⚠️  No process found on port ${port}`);
          continue;
        }
        
        const process = processes[0];
        
        // Check CPU usage
        if (process.cpu > this.alertThresholds.cpu) {
          console.warn(`🔥 High CPU usage on port ${port}: ${process.cpu}%`);
        }
        
        // Check memory usage
        if (process.memory > this.alertThresholds.memory) {
          const memoryMB = Math.round(process.memory / 1024 / 1024);
          console.warn(`💾 High memory usage on port ${port}: ${memoryMB}MB`);
        }
        
        console.log(`✅ Port ${port}: ${process.name} (CPU: ${process.cpu}%, Memory: ${Math.round(process.memory / 1024 / 1024)}MB)`);
        
      } catch (error) {
        console.error(`❌ Error checking port ${port}:`, error);
      }
    }
  }
  
  async startMonitoring(interval: number = 30000): Promise<void> {
    console.log('🔍 Starting process health monitoring...');
    
    // Initial check
    await this.checkHealth();
    
    // Periodic checks
    setInterval(() => {
      this.checkHealth();
    }, interval);
  }
  
  async getSystemOverview(): Promise<void> {
    const sysInfo = await getSystemInfo();
    
    console.log('\n📊 System Overview:');
    console.log(`Platform: ${sysInfo.platform} (${sysInfo.arch})`);
    console.log(`CPU Usage: ${sysInfo.cpuUsage}%`);
    console.log(`Memory Usage: ${sysInfo.memoryUsage.percentage}% (${Math.round(sysInfo.memoryUsage.used / 1024 / 1024 / 1024)}GB / ${Math.round(sysInfo.memoryUsage.total / 1024 / 1024 / 1024)}GB)`);
    console.log(`Active Processes: ${sysInfo.processCount}`);
    console.log(`Uptime: ${Math.round(sysInfo.uptime / 3600)} hours\n`);
  }
}

// Usage
const monitor = new ProcessHealthMonitor();
monitor.addPort(3000);
monitor.addPort(3001);
monitor.addPort(8080);

monitor.getSystemOverview();
monitor.startMonitoring(10000); // Check every 10 seconds
```

### Development Environment Manager

```typescript
import { getFreePort, killProcess, findProcess, resolvePortConflict } from 'procx';

interface ServiceConfig {
  name: string;
  command: string;
  preferredPort: number;
  env?: Record<string, string>;
}

class DevEnvironmentManager {
  private services: Map<string, { port: number; pid?: number }> = new Map();
  
  async startService(config: ServiceConfig): Promise<number> {
    console.log(`🚀 Starting ${config.name}...`);
    
    try {
      // Check if service is already running
      const existing = this.services.get(config.name);
      if (existing) {
        const processes = await findProcess({ port: existing.port });
        if (processes.length > 0) {
          console.log(`✅ ${config.name} is already running on port ${existing.port}`);
          return existing.port;
        }
      }
      
      // Find available port
      const port = await getFreePort(config.preferredPort);
      
      if (port !== config.preferredPort) {
        console.log(`⚠️  Port ${config.preferredPort} is busy, using port ${port} for ${config.name}`);
      }
      
      // Start the service
      const result = await resolvePortConflict(port, config.command);
      
      if (result.success) {
        this.services.set(config.name, { port });
        console.log(`✅ ${config.name} started successfully on port ${port}`);
        return port;
      } else {
        throw new Error(`Failed to start ${config.name}: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to start ${config.name}:`, error);
      throw error;
    }
  }
  
  async stopService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    
    if (!service) {
      console.warn(`⚠️  Service ${serviceName} is not registered`);
      return;
    }
    
    try {
      const processes = await findProcess({ port: service.port });
      
      if (processes.length > 0) {
        await killProcess({ port: service.port });
        console.log(`🛑 Stopped ${serviceName} on port ${service.port}`);
      } else {
        console.log(`ℹ️  ${serviceName} was not running`);
      }
      
      this.services.delete(serviceName);
      
    } catch (error) {
      console.error(`❌ Failed to stop ${serviceName}:`, error);
      throw error;
    }
  }
  
  async stopAllServices(): Promise<void> {
    console.log('🛑 Stopping all services...');
    
    const serviceNames = Array.from(this.services.keys());
    
    for (const serviceName of serviceNames) {
      await this.stopService(serviceName);
    }
    
    console.log('✅ All services stopped');
  }
  
  getRunningServices(): Array<{ name: string; port: number }> {
    return Array.from(this.services.entries()).map(([name, { port }]) => ({
      name,
      port
    }));
  }
  
  async getServiceStatus(): Promise<void> {
    console.log('\n📋 Service Status:');
    
    for (const [name, { port }] of this.services) {
      try {
        const processes = await findProcess({ port });
        
        if (processes.length > 0) {
          const process = processes[0];
          console.log(`✅ ${name}: Running on port ${port} (PID: ${process.pid}, CPU: ${process.cpu}%, Memory: ${Math.round(process.memory / 1024 / 1024)}MB)`);
        } else {
          console.log(`❌ ${name}: Not running (expected port: ${port})`);
        }
      } catch (error) {
        console.log(`❌ ${name}: Error checking status - ${error}`);
      }
    }
    console.log();
  }
}

// Usage example
async function setupDevelopmentEnvironment() {
  const devManager = new DevEnvironmentManager();
  
  // Define services
  const services: ServiceConfig[] = [
    {
      name: 'API Server',
      command: 'npm run api',
      preferredPort: 3000
    },
    {
      name: 'Web Server',
      command: 'npm run web',
      preferredPort: 3001
    },
    {
      name: 'WebSocket Server',
      command: 'npm run ws',
      preferredPort: 3002
    }
  ];
  
  try {
    // Start all services
    for (const service of services) {
      await devManager.startService(service);
    }
    
    // Show status
    await devManager.getServiceStatus();
    
    // Setup cleanup on exit
    process.on('SIGINT', async () => {
      console.log('\n🧹 Cleaning up development environment...');
      await devManager.stopAllServices();
      process.exit(0);
    });
    
    console.log('🎉 Development environment is ready!');
    console.log('Press Ctrl+C to stop all services and exit.');
    
  } catch (error) {
    console.error('❌ Failed to setup development environment:', error);
    await devManager.stopAllServices();
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  setupDevelopmentEnvironment();
}
```

## Error Handling

The Procx library uses custom error types for better error handling:

```typescript
import { ValidationError } from 'procx';

try {
  await findProcess({}); // Invalid: no criteria provided
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

### 1. Resource Cleanup

Always clean up processes and resources:

```typescript
class ProcessManager {
  private managedProcesses: number[] = [];
  
  async cleanup() {
    for (const pid of this.managedProcesses) {
      try {
        await killProcess({ pid });
      } catch (error) {
        console.warn(`Failed to kill process ${pid}:`, error);
      }
    }
    this.managedProcesses = [];
  }
}

// Setup cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
```

### 2. Error Handling

Handle errors gracefully:

```typescript
async function safeKillProcess(target: ProcessTarget) {
  try {
    const result = await killProcess(target);
    if (!result.success) {
      console.warn(`Failed to kill process: ${result.message}`);
    }
    return result.success;
  } catch (error) {
    console.error('Error killing process:', error);
    return false;
  }
}
```

### 3. Performance Considerations

Use appropriate intervals for monitoring:

```typescript
// Good: Reasonable interval for monitoring
const monitor = startMonitor({ refreshInterval: 5000 });

// Avoid: Too frequent updates can impact performance
// const monitor = startMonitor({ refreshInterval: 100 });
```

### 4. Port Management

Always check port availability before starting services:

```typescript
async function startServiceSafely(port: number, startCommand: () => void) {
  const processes = await findProcess({ port });
  
  if (processes.length > 0) {
    console.warn(`Port ${port} is already in use by ${processes[0].name}`);
    const freePort = await getFreePort(port);
    console.log(`Using port ${freePort} instead`);
    return freePort;
  }
  
  startCommand();
  return port;
}
```

This comprehensive library documentation provides everything needed to integrate Procx into Node.js applications with proper TypeScript support and real-world examples.