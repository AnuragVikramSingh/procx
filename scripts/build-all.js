#!/usr/bin/env node

/**
 * Cross-platform build script for procx
 * Builds the project and creates distribution packages for npm and npx
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');

console.log('🚀 Starting cross-platform build for procx...');
console.log(`📦 Version: ${packageJson.version}`);
console.log(`🏗️  Platform: ${process.platform} (${process.arch})`);

// Clean previous builds
console.log('\n🧹 Cleaning previous builds...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
  console.log('✓ Clean completed');
} catch (error) {
  console.error('❌ Clean failed:', error.message);
  process.exit(1);
}

// Run TypeScript build
console.log('\n🔨 Building TypeScript...');
try {
  execSync('tsc', { stdio: 'inherit' });
  console.log('✓ TypeScript build completed');
} catch (error) {
  console.error('❌ TypeScript build failed:', error.message);
  process.exit(1);
}

// Make CLI executable
console.log('\n🔧 Making CLI executable...');
try {
  execSync('node scripts/make-executable.js', { stdio: 'inherit' });
  console.log('✓ CLI made executable');
} catch (error) {
  console.error('❌ Failed to make CLI executable:', error.message);
  process.exit(1);
}

// Validate build output
console.log('\n✅ Validating build output...');
const requiredFiles = [
  'dist/api/index.js',
  'dist/api/index.d.ts',
  'dist/cli/index.js',
  'dist/core/index.js',
  'dist/types/index.js',
  'dist/utils/index.js',
  'dist/platform/index.js'
];

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

// Test CLI functionality
console.log('\n🧪 Testing CLI functionality...');
try {
  const helpOutput = execSync('node dist/cli/index.js --help', { encoding: 'utf8' });
  if (helpOutput.includes('Modern cross-platform process and port management tool')) {
    console.log('✓ CLI help command works');
  } else {
    throw new Error('CLI help output is incorrect');
  }

  const versionOutput = execSync('node dist/cli/index.js --version', { encoding: 'utf8' });
  if (versionOutput.trim() === packageJson.version) {
    console.log('✓ CLI version command works');
  } else {
    throw new Error(`CLI version mismatch: expected ${packageJson.version}, got ${versionOutput.trim()}`);
  }
} catch (error) {
  console.error('❌ CLI functionality test failed:', error.message);
  process.exit(1);
}

// Generate package info
console.log('\n📋 Package Information:');
console.log(`   Name: ${packageJson.name}`);
console.log(`   Version: ${packageJson.version}`);
console.log(`   Main: ${packageJson.main}`);
console.log(`   Types: ${packageJson.types}`);
console.log(`   Binary: ${packageJson.bin.procx}`);
console.log(`   Files: ${packageJson.files.join(', ')}`);

// Calculate package size
const distSize = execSync('du -sh dist', { encoding: 'utf8' }).split('\t')[0];
console.log(`   Build Size: ${distSize.trim()}`);

console.log('\n🎉 Cross-platform build completed successfully!');
console.log('\n📝 Next steps:');
console.log('   • Run "npm pack" to create a tarball for testing');
console.log('   • Run "npm publish" to publish to npm registry');
console.log('   • Test installation with "npm install -g procx"');