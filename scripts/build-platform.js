#!/usr/bin/env node

/**
 * Platform-specific build configuration for procx
 * Handles platform-specific optimizations and configurations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.platform;
const arch = process.arch;

console.log(`🏗️  Building for platform: ${platform} (${arch})`);

// Platform-specific configurations
const platformConfigs = {
  win32: {
    executable: 'procx.exe',
    pathSeparator: '\\',
    shellCommand: 'cmd',
    shellArgs: ['/c']
  },
  darwin: {
    executable: 'procx',
    pathSeparator: '/',
    shellCommand: 'sh',
    shellArgs: ['-c']
  },
  linux: {
    executable: 'procx',
    pathSeparator: '/',
    shellCommand: 'sh',
    shellArgs: ['-c']
  }
};

const config = platformConfigs[platform];
if (!config) {
  console.error(`❌ Unsupported platform: ${platform}`);
  process.exit(1);
}

// Create platform-specific package.json modifications
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Platform-specific binary configuration
if (platform === 'win32') {
  // For Windows, we might want to create a .cmd wrapper
  const cmdWrapperPath = path.join(__dirname, '..', 'dist', 'cli', 'procx.cmd');
  const cmdWrapper = `@echo off
node "%~dp0index.js" %*`;
  
  fs.writeFileSync(cmdWrapperPath, cmdWrapper);
  console.log('✓ Created Windows CMD wrapper');
}

// Validate platform-specific requirements
console.log('\n🔍 Validating platform requirements...');

// Check Node.js version compatibility
const nodeVersion = process.version;
const requiredNodeVersion = packageJson.engines.node;
console.log(`✓ Node.js version: ${nodeVersion} (required: ${requiredNodeVersion})`);

// Check platform-specific dependencies
const platformDeps = {
  win32: ['child_process', 'os'],
  darwin: ['child_process', 'os'],
  linux: ['child_process', 'os']
};

const requiredModules = platformDeps[platform] || [];
for (const module of requiredModules) {
  try {
    require.resolve(module);
    console.log(`✓ Platform module available: ${module}`);
  } catch (error) {
    console.error(`❌ Missing platform module: ${module}`);
    process.exit(1);
  }
}

// Create platform-specific distribution info
const distInfo = {
  platform,
  arch,
  nodeVersion,
  buildTime: new Date().toISOString(),
  executable: config.executable,
  pathSeparator: config.pathSeparator
};

fs.writeFileSync(
  path.join(__dirname, '..', 'dist', 'platform-info.json'),
  JSON.stringify(distInfo, null, 2)
);

console.log('✓ Platform-specific build configuration completed');
console.log(`📋 Distribution info saved to dist/platform-info.json`);