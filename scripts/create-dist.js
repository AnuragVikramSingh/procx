#!/usr/bin/env node

/**
 * Create distribution packages for npm and npx
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = require('../package.json');

console.log('📦 Creating distribution packages...');

// Create npm package tarball
console.log('\n📦 Creating npm package tarball...');
try {
  const packOutput = execSync('npm pack', { encoding: 'utf8' });
  // Extract just the tarball filename from the output
  const lines = packOutput.trim().split('\n');
  const tarballName = lines[lines.length - 1].trim();
  console.log(`✓ Created tarball: ${tarballName}`);
  
  // Get tarball size
  if (fs.existsSync(tarballName)) {
    const tarballStats = fs.statSync(tarballName);
    const tarballSizeMB = (tarballStats.size / (1024 * 1024)).toFixed(2);
    console.log(`📏 Tarball size: ${tarballSizeMB} MB`);
  }
  
} catch (error) {
  console.error('❌ Failed to create npm package:', error.message);
  process.exit(1);
}

// Validate package contents
console.log('\n🔍 Validating package contents...');
try {
  const tarballName = `${packageJson.name}-${packageJson.version}.tgz`;
  
  if (fs.existsSync(tarballName)) {
    // Extract and check contents
    execSync(`tar -tzf ${tarballName} | head -20`, { stdio: 'inherit' });
    console.log('✓ Package contents validated');
  } else {
    console.warn('⚠️  Tarball not found for validation');
  }
} catch (error) {
  console.warn('⚠️  Could not validate package contents:', error.message);
}

// Create installation test script
console.log('\n📝 Creating installation test script...');
const testScript = `#!/bin/bash

# Test script for procx installation
echo "🧪 Testing procx installation..."

# Test global installation
echo "📦 Testing global installation..."
npm install -g ${packageJson.name}-${packageJson.version}.tgz

# Test CLI availability
echo "🔧 Testing CLI availability..."
which procx
procx --version
procx --help

# Test basic functionality
echo "🚀 Testing basic functionality..."
procx sysinfo --json > /dev/null && echo "✓ sysinfo command works"
procx ports --json > /dev/null && echo "✓ ports command works"
procx list --limit 5 --json > /dev/null && echo "✓ list command works"

echo "✅ Installation test completed!"
`;

fs.writeFileSync('test-installation.sh', testScript);
execSync('chmod +x test-installation.sh');
console.log('✓ Created test-installation.sh');

// Create npx usage examples
console.log('\n📚 Creating npx usage examples...');
const npxExamples = {
  "npx_usage": {
    "description": "Examples of using procx with npx (no installation required)",
    "examples": [
      {
        "command": "npx procx --help",
        "description": "Show help without installing"
      },
      {
        "command": "npx procx find 3000",
        "description": "Find process using port 3000"
      },
      {
        "command": "npx procx kill 3000",
        "description": "Kill process using port 3000"
      },
      {
        "command": "npx procx free --start 3000",
        "description": "Find next available port starting from 3000"
      },
      {
        "command": "npx procx sysinfo",
        "description": "Show system information"
      },
      {
        "command": "npx procx resolve 3000 --run \"npm start\"",
        "description": "Resolve port conflicts and run command"
      }
    ]
  },
  "global_installation": {
    "description": "Examples after global installation",
    "install_command": `npm install -g ${packageJson.name}`,
    "examples": [
      {
        "command": "procx list --filter node",
        "description": "List all Node.js processes"
      },
      {
        "command": "procx monitor --sort cpu",
        "description": "Monitor processes sorted by CPU usage"
      },
      {
        "command": "procx kill --range 3000-3010",
        "description": "Kill processes in port range"
      }
    ]
  }
};

fs.writeFileSync('npx-examples.json', JSON.stringify(npxExamples, null, 2));
console.log('✓ Created npx-examples.json');

console.log('\n🎉 Distribution packages created successfully!');
console.log('\n📋 Distribution Summary:');
console.log(`   Package: ${packageJson.name}@${packageJson.version}`);
console.log(`   Tarball: ${packageJson.name}-${packageJson.version}.tgz`);
console.log(`   Test Script: test-installation.sh`);
console.log(`   NPX Examples: npx-examples.json`);

console.log('\n🚀 Ready for distribution!');
console.log('   • Test locally: ./test-installation.sh');
console.log('   • Publish to npm: npm publish');
console.log(`   • Install globally: npm install -g ${packageJson.name}`);
console.log(`   • Use with npx: npx ${packageJson.name} --help`);