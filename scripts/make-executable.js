#!/usr/bin/env node

/**
 * Make CLI executable after build
 */

const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

if (fs.existsSync(cliPath)) {
  // Make the CLI file executable
  fs.chmodSync(cliPath, '755');
  console.log('✓ Made CLI executable:', cliPath);
} else {
  console.warn('⚠ CLI file not found:', cliPath);
}