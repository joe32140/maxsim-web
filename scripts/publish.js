#!/usr/bin/env node

/**
 * Publishing preparation script
 * Ensures everything is built and ready for NPM publish
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();

function run(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: ROOT_DIR });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function checkFile(path, description) {
  const fullPath = join(ROOT_DIR, path);
  if (existsSync(fullPath)) {
    console.log(`✅ ${description} exists`);
    return true;
  } else {
    console.error(`❌ ${description} missing: ${path}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Preparing MaxSim WASM for publishing...\n');

  // Check prerequisites
  console.log('📋 Checking prerequisites...');
  let allGood = true;
  
  allGood &= checkFile('src/rust/Cargo.toml', 'Rust source');
  allGood &= checkFile('src/js/maxsim-wasm.js', 'WASM wrapper');
  allGood &= checkFile('package.json', 'Package config');
  allGood &= checkFile('README.md', 'README');

  if (!allGood) {
    console.error('\n❌ Prerequisites missing. Please fix and try again.');
    process.exit(1);
  }

  // Build WASM
  run('npm run build:wasm', 'Building WASM module');

  // Build JavaScript
  if (existsSync(join(ROOT_DIR, 'scripts/build.js'))) {
    run('npm run build', 'Building JavaScript');
  }

  // Check built files
  console.log('\n📦 Checking built files...');
  allGood = true;
  allGood &= checkFile('dist/wasm/maxsim_web_wasm.js', 'WASM JS bindings');
  allGood &= checkFile('dist/wasm/maxsim_web_wasm_bg.wasm', 'WASM binary');
  allGood &= checkFile('dist/maxsim-wasm.js', 'WASM wrapper');

  if (!allGood) {
    console.error('\n❌ Build files missing. Build may have failed.');
    process.exit(1);
  }

  // Run tests
  if (existsSync(join(ROOT_DIR, 'test'))) {
    run('npm test', 'Running tests');
  }

  // Check package contents
  console.log('\n📋 Checking package contents...');
  run('npm pack --dry-run', 'Previewing package contents');

  console.log('\n✅ Ready to publish!');
  console.log('\nNext steps:');
  console.log('1. npm login (if not already logged in)');
  console.log('2. npm publish');
  console.log('3. Or: npm publish --tag beta');
  console.log('\nPackage will be available as: npm install maxsim-web');
}

main().catch(console.error);