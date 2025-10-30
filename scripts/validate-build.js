#!/usr/bin/env node

/**
 * Validate the complete build and distribution setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');

console.log('🔍 Validating procx build and distribution...');

// Check required files exist
const requiredFiles = [
  'dist/api/index.js',
  'dist/api/index.d.ts',
  'dist/cli/index.js',
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md'
];

console.log('\n📁 Checking required files...');
let allFilesExist = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file}`);
  } else {
    console.error(`❌ Missing: ${file}`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.error('\n❌ Build validation failed - missing required files');
  process.exit(1);
}

// Check package.json configuration
console.log('\n📦 Validating package.json configuration...');
const requiredFields = ['name', 'version', 'main', 'types', 'bin', 'files', 'engines'];
for (const field of requiredFields) {
  if (packageJson[field]) {
    console.log(`✓ ${field}: ${typeof packageJson[field] === 'object' ? JSON.stringify(packageJson[field]) : packageJson[field]}`);
  } else {
    console.error(`❌ Missing package.json field: ${field}`);
    process.exit(1);
  }
}

// Check CLI executable permissions
console.log('\n🔧 Checking CLI executable...');
try {
  const stats = fs.statSync('dist/cli/index.js');
  const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
  if (isExecutable) {
    console.log('✓ CLI is executable');
  } else {
    console.error('❌ CLI is not executable');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Could not check CLI permissions:', error.message);
  process.exit(1);
}

// Test CLI functionality
console.log('\n🧪 Testing CLI functionality...');
try {
  // Test help command
  const helpOutput = execSync('node dist/cli/index.js --help', { encoding: 'utf8' });
  if (helpOutput.includes('Modern cross-platform process and port management tool')) {
    console.log('✓ CLI help command works');
  } else {
    throw new Error('CLI help output is incorrect');
  }

  // Test version command
  const versionOutput = execSync('node dist/cli/index.js --version', { encoding: 'utf8' });
  if (versionOutput.trim() === packageJson.version) {
    console.log('✓ CLI version command works');
  } else {
    throw new Error(`CLI version mismatch: expected ${packageJson.version}, got ${versionOutput.trim()}`);
  }

  // Test a simple command
  const sysinfoOutput = execSync('node dist/cli/index.js sysinfo --json', { encoding: 'utf8' });
  const sysinfo = JSON.parse(sysinfoOutput);
  if (sysinfo.platform && sysinfo.cpuUsage !== undefined) {
    console.log('✓ CLI sysinfo command works');
  } else {
    throw new Error('CLI sysinfo output is invalid');
  }
} catch (error) {
  console.error('❌ CLI functionality test failed:', error.message);
  process.exit(1);
}

// Check TypeScript declarations
console.log('\n📝 Checking TypeScript declarations...');
const apiDeclarationPath = 'dist/api/index.d.ts';
if (fs.existsSync(apiDeclarationPath)) {
  const declarationContent = fs.readFileSync(apiDeclarationPath, 'utf8');
  if (declarationContent.includes('export') && declarationContent.includes('declare')) {
    console.log('✓ TypeScript declarations generated');
  } else {
    console.error('❌ TypeScript declarations appear invalid');
    process.exit(1);
  }
} else {
  console.error('❌ TypeScript declarations not found');
  process.exit(1);
}

// Check distribution files
console.log('\n📦 Checking distribution files...');
const distFiles = ['test-installation.sh', 'npx-examples.json'];
for (const file of distFiles) {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file}`);
  } else {
    console.error(`❌ Missing distribution file: ${file}`);
    process.exit(1);
  }
}

// Check tarball if it exists
const tarballName = `${packageJson.name}-${packageJson.version}.tgz`;
if (fs.existsSync(tarballName)) {
  console.log(`✓ Distribution tarball: ${tarballName}`);
  
  // Check tarball size
  const stats = fs.statSync(tarballName);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  Size: ${sizeMB} MB`);
  
  if (stats.size > 50 * 1024 * 1024) { // 50MB limit
    console.warn('⚠️  Tarball is quite large (>50MB)');
  }
} else {
  console.log('ℹ️  Distribution tarball not found (run npm run dist to create)');
}

// Platform compatibility check
console.log('\n🌍 Platform compatibility...');
console.log(`✓ Current platform: ${process.platform} (${process.arch})`);
console.log(`✓ Node.js version: ${process.version}`);
console.log(`✓ Supported platforms: ${packageJson.os.join(', ')}`);
console.log(`✓ Supported architectures: ${packageJson.cpu.join(', ')}`);

console.log('\n🎉 Build validation completed successfully!');
console.log('\n📋 Summary:');
console.log(`   Package: ${packageJson.name}@${packageJson.version}`);
console.log(`   Main entry: ${packageJson.main}`);
console.log(`   CLI binary: ${packageJson.bin.procx}`);
console.log(`   TypeScript types: ${packageJson.types}`);
console.log(`   Files included: ${packageJson.files.length} patterns`);

console.log('\n🚀 Ready for:');
console.log('   • Local testing: npm link');
console.log('   • NPX usage: npx procx');
console.log('   • NPM publishing: npm publish');
console.log('   • Global installation: npm install -g procx');