# Troubleshooting Guide

Common issues and solutions when using Procx.

## Installation Issues

### Command Not Found
**Problem**: `procx: command not found` after installation

**Solutions**:
1. **Use npx instead**: `npx procx --version`
2. **Check PATH**: Ensure npm global bin is in your PATH
   ```bash
   echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```
3. **Reinstall**: `npm uninstall -g procx && npm install -g procx`

### Permission Errors
**Problem**: Permission denied during global installation

**Solutions**:
1. **Use Node version manager (recommended)**:
   ```bash
   # Install nvm and latest Node.js
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install node && npm install -g procx
   ```
2. **Configure npm directory**:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH="~/.npm-global/bin:$PATH"' >> ~/.bashrc
   ```

### Module Not Found (API)
**Problem**: `Cannot find module 'procx'` in Node.js projects

**Solutions**:
1. **Install locally**: `npm install procx`
2. **Check import syntax**:
   ```javascript
   // ES6 modules
   import { findProcess } from 'procx';
   
   // CommonJS
   const { findProcess } = require('procx');
   ```

## Runtime Issues

### Permission Denied
**Problem**: Cannot access or kill processes

**Solutions**:
1. **Use elevated privileges**: `sudo procx kill 1234` (macOS/Linux)
2. **Run as Administrator** (Windows)
3. **Use interactive mode**: `procx kill 1234 --interactive`

### Port Already in Use
**Problem**: `EADDRINUSE` error when starting applications

**Solutions**:
1. **Find and kill conflicting process**:
   ```bash
   procx find 3000
   procx kill 3000 --interactive
   ```
2. **Auto-resolve conflicts**: `procx resolve 3000 --run "npm start"`
3. **Find alternative port**: `procx free --start 3000`

### Process Not Found
**Problem**: Process disappears between discovery and action

**Solutions**:
1. **Verify process exists**: `procx find --pid 1234`
2. **Use interactive mode**: `procx kill 3000 --interactive`
3. **Process may have terminated naturally**

### Slow Performance
**Problem**: Commands take too long to execute

**Solutions**:
1. **Use filters**: `procx list --filter node --limit 20`
2. **Increase intervals**: `procx monitor --interval 5`
3. **Check system load**: `procx sysinfo`

## Platform-Specific Issues

### macOS
- **Permission prompts**: Grant Full Disk Access in System Preferences > Security & Privacy
- **System processes**: Some system processes are protected by SIP (expected behavior)

### Linux
- **Missing utilities**: Install required packages
  ```bash
  # Ubuntu/Debian
  sudo apt-get install procps net-tools lsof
  
  # CentOS/RHEL/Fedora
  sudo dnf install procps-ng net-tools lsof
  ```

### Windows
- **Execution policy**: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **Administrator privileges**: Run terminal as Administrator for system processes
- **Windows Defender**: Add exclusions for Node.js directories if needed

## API Issues

### Async/Await Errors
**Problem**: Unhandled promise rejections

**Solution**: Always use try-catch
```javascript
try {
  const process = await findProcess({ port: 3000 });
  console.log(process);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Memory Leaks in Monitoring
**Problem**: Memory usage increases over time

**Solution**: Properly clean up monitoring
```javascript
const monitor = startMonitor();

// Clean up after use
setTimeout(() => {
  monitor.return(); // Stop the async iterator
}, 60000);
```

### TypeScript Errors
**Problem**: Type compilation errors

**Solutions**:
1. **Install types**: `npm install --save-dev @types/node`
2. **Use proper imports**:
   ```typescript
   import { ProcessInfo, findProcess } from 'procx';
   ```

## Quick Diagnostics

### Check Installation
```bash
procx --version
which procx
node --version
npm --version
```

### Test Basic Functionality
```bash
procx list --limit 5
procx sysinfo
procx find 3000 --json
```

### Debug with System Tools
```bash
# Verify with native tools
ps aux | grep node          # macOS/Linux
netstat -tulpn | grep 3000  # Linux
lsof -i :3000               # macOS/Linux

tasklist | findstr node     # Windows
netstat -ano | findstr 3000 # Windows
```

## Getting Help

### Before Reporting Issues
1. Check this troubleshooting guide
2. Search [GitHub Issues](https://github.com/AnuragVikramSingh/procx/issues)
3. Try latest version: `npm update -g procx`
4. Test with minimal example

### Include This Information
- Environment: `node --version`, `npm --version`, `procx --version`
- Complete error message
- Steps to reproduce
- Expected vs actual behavior
- Minimal code example (for API issues)

### Environment Variables
```bash
export PROCX_TIMEOUT=10000    # Increase timeout
export PROCX_NO_COLOR=1       # Disable colors
export DEBUG=procx:*          # Enable debug logging
```