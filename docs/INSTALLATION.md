# Installation Guide

This guide covers installation and setup for both CLI and Library usage of Procx.

## CLI Installation

### Global Installation (Recommended)
```bash
# Install globally for command-line usage
npm install -g procx

# Verify installation
procx --version
procx --help
```

### Using npx (No Installation Required)
```bash
# Run directly without installation
npx procx <command>

# Example: Find process using port 3000
npx procx find 3000
```

## Library Installation

### Project Installation
```bash
# Install in your project for programmatic use
npm install procx

# Or with yarn
yarn add procx
```

### TypeScript Support
```bash
# TypeScript definitions are included
npm install procx
# No additional @types package needed
```

## System Requirements

### Prerequisites
- **Node.js**: Version 16 or higher
- **npm**: Version 7 or higher (comes with Node.js)
- **Operating System**: macOS, Linux, or Windows

### Platform-Specific Requirements

#### macOS
- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools (usually installed automatically)
- Basic system utilities (`ps`, `lsof`, `netstat`)

#### Linux
- Most distributions include required utilities by default
- For minimal distributions, you may need: `ps`, `netstat`, `lsof`, `ss`
- Example for Ubuntu/Debian:
  ```bash
  sudo apt-get update
  sudo apt-get install procps net-tools lsof
  ```

#### Windows
- Windows 10 or later
- PowerShell 5.1 or later
- Windows Subsystem for Linux (WSL) is supported but not required

## Installation Methods

### CLI Installation Methods

#### Method 1: Global Installation
Best for users who want to use Procx as a command-line tool:

```bash
# Install globally
npm install -g procx

# Test installation
procx --help
procx --version

# Example usage
procx find 3000
procx list --filter node
```

#### Method 2: npx (No Installation)
Best for occasional use or trying out Procx:

```bash
# Use without installing
npx procx find 3000
npx procx list
npx procx kill 8080
```

### Library Installation Methods

#### Method 1: Project Dependency
Best for developers who want to use Procx in their applications:

```bash
# Navigate to your project directory
cd your-project

# Install as a dependency
npm install procx

# Or as a dev dependency
npm install --save-dev procx
```

#### Method 2: Library Usage
Then use in your code:

```javascript
// ES6 modules
import { findProcess, killProcess } from 'procx';

const process = await findProcess({ port: 3000 });
console.log(process);
```

```javascript
// CommonJS
const { findProcess, killProcess } = require('procx');

async function example() {
  const process = await findProcess({ port: 3000 });
  console.log(process);
}
```

## Verification

### CLI Verification
After CLI installation, verify that Procx is working correctly:

```bash
# Check version
procx --version

# Test basic functionality
procx list --limit 5

# Test process discovery
procx find --name node
```

### Library Verification
After library installation, test in your project:

```javascript
// test-procx.js
import { findProcess, listProcesses } from 'procx';

async function test() {
  try {
    const processes = await listProcesses({ limit: 5 });
    console.log('Library working correctly:', processes.length, 'processes found');
  } catch (error) {
    console.error('Library test failed:', error.message);
  }
}

test();
```

```bash
# Run the test
node test-procx.js
```

## Configuration

### CLI Configuration

Create a global configuration file at `~/.procx/config.json`:

```json
{
  "defaultTimeout": 5000,
  "confirmKill": true,
  "outputFormat": "table",
  "colorOutput": true,
  "monitorRefreshRate": 2000,
  "portScanTimeout": 1000
}
```

#### CLI Environment Variables

You can customize CLI behavior with these environment variables:

- `PROCX_TIMEOUT`: Default operation timeout in milliseconds (default: 5000)
- `PROCX_NO_COLOR`: Set to "1" to disable colored output
- `PROCX_CONFIG_PATH`: Custom path to configuration file

Example:
```bash
# Disable colors and set timeout
export PROCX_NO_COLOR=1
export PROCX_TIMEOUT=10000

# Run with custom settings
procx list
```

### Library Configuration

When using Procx as a library, you can configure options programmatically:

```javascript
import { configure, findProcess } from 'procx';

// Configure library defaults
configure({
  timeout: 10000,
  retryAttempts: 3,
  debug: false
});

// Use configured settings
const process = await findProcess({ port: 3000 });
```

#### Library Options

Available configuration options for library usage:

- `timeout`: Default timeout for operations (milliseconds)
- `retryAttempts`: Number of retry attempts for failed operations
- `debug`: Enable debug logging
- `platform`: Force specific platform adapter (auto-detected by default)

## Permissions

### macOS and Linux

Some operations may require elevated privileges:

```bash
# For system processes, you may need sudo
sudo procx kill 1234

# For network operations on some systems
sudo procx ports
```

### Windows

Run your terminal as Administrator for full functionality:

1. Right-click on Command Prompt or PowerShell
2. Select "Run as Administrator"
3. Run Procx commands normally

## Troubleshooting Installation

### CLI Installation Issues

#### "Command not found" error

**Problem**: `procx: command not found` after global installation

**Solutions**:
1. Check if npm global bin directory is in your PATH:
   ```bash
   npm config get prefix
   echo $PATH
   ```

2. Add npm global bin to your PATH:
   ```bash
   # For bash/zsh
   echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. Use npx instead:
   ```bash
   npx procx --version
   ```

#### Permission errors

**Problem**: Permission denied when installing globally

**Solutions**:
1. Use a Node version manager (recommended):
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   
   # Install and use latest Node.js
   nvm install node
   nvm use node
   
   # Now install procx
   npm install -g procx
   ```

2. Configure npm to use a different directory:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH="~/.npm-global/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

### Library Installation Issues

#### Module not found errors

**Problem**: Cannot find module errors when using the API

**Solutions**:
1. Ensure Procx is installed in your project:
   ```bash
   npm list procx
   ```

2. Reinstall if necessary:
   ```bash
   npm uninstall procx
   npm install procx
   ```

3. Check your import syntax:
   ```javascript
   // ES6 modules
   import { findProcess } from 'procx';
   
   // CommonJS
   const { findProcess } = require('procx');
   ```

#### TypeScript compilation errors

**Problem**: TypeScript errors when importing Procx

**Solutions**:
1. Ensure you're using a compatible TypeScript version:
   ```bash
   npm install typescript@latest
   ```

2. Check your tsconfig.json module resolution:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true
     }
   }
   ```

#### Library API errors

**Problem**: Runtime errors when calling library functions

**Solutions**:
1. Check that you're awaiting async functions:
   ```javascript
   // Correct
   const process = await findProcess({ port: 3000 });
   
   // Incorrect
   const process = findProcess({ port: 3000 });
   ```

2. Handle errors properly:
   ```javascript
   try {
     const process = await findProcess({ port: 3000 });
   } catch (error) {
     console.error('Process not found:', error.message);
   }
   ```

### Platform-Specific Issues

#### macOS
- If you get permission prompts, allow Terminal/iTerm2 to access system information
- Some operations may require Full Disk Access in System Preferences > Security & Privacy

#### Linux
- On minimal distributions, install required system utilities
- Check if your user has permission to access `/proc` filesystem
- Some distributions may require additional packages for network operations

#### Windows
- Ensure PowerShell execution policy allows script execution:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- Windows Defender may flag process operations - add exclusions if needed
- Some operations require Administrator privileges

## Updating

### Update CLI Installation
```bash
# Update global installation
npm update -g procx

# Check for CLI updates
npm outdated -g procx
```

### Update Library Installation
```bash
# Update project installation
npm update procx

# Check for library updates
npm outdated procx
```

## Uninstalling

### Remove CLI Installation
```bash
# Remove global installation
npm uninstall -g procx

# Clean CLI configuration
rm -rf ~/.procx
```

### Remove Library Installation
```bash
# Remove from project
npm uninstall procx

# No additional cleanup needed for library usage
```

## Next Steps

### For CLI Users
After successful CLI installation:

1. Read the [CLI Documentation](cli.md) to learn all available commands and see examples
2. Review [Troubleshooting](TROUBLESHOOTING.md) for CLI-specific issues

### For Library Users
After successful library installation:

1. Read the [Library Documentation](library.md) for complete API reference and examples
2. Review [Troubleshooting](TROUBLESHOOTING.md) for library-specific issues

## Getting Help

If you encounter installation issues:

1. Check this troubleshooting section
2. Search [existing issues](https://github.com/AnuragVikramSingh/procx/issues)
3. Create a [new issue](https://github.com/AnuragVikramSingh/procx/issues/new) with:
   - Your operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Complete error message
   - Installation method you tried