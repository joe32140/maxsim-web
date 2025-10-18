#!/usr/bin/env node

/**
 * Test Correctness Script
 * 
 * This script helps run correctness tests for MaxSim implementations.
 * It can run both Node.js tests and serve the browser test page.
 */

import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

function startTestServer(port = 8080) {
  const server = createServer((req, res) => {
    let filePath;
    
    if (req.url === '/' || req.url === '/test') {
      filePath = join(projectRoot, 'test/browser-correctness.html');
      res.setHeader('Content-Type', 'text/html');
    } else if (req.url.startsWith('/src/')) {
      filePath = join(projectRoot, req.url.slice(1));
      res.setHeader('Content-Type', 'application/javascript');
    } else if (req.url.startsWith('/dist/')) {
      filePath = join(projectRoot, req.url.slice(1));
      res.setHeader('Content-Type', 'application/javascript');
    } else if (req.url.startsWith('/benchmark/')) {
      filePath = join(projectRoot, req.url.slice(1));
      res.setHeader('Content-Type', 'application/javascript');
    } else {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    try {
      const content = readFileSync(filePath);
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      console.error(`Error serving ${filePath}:`, error.message);
      res.writeHead(404);
      res.end('File not found');
    }
  });

  server.listen(port, () => {
    console.log(`🌐 Test server running at http://localhost:${port}`);
    console.log(`📊 Browser correctness tests: http://localhost:${port}/test`);
    console.log('Press Ctrl+C to stop the server');
  });

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'node':
    case 'jest':
      console.log('🧪 Running Node.js correctness tests...');
      try {
        await runCommand('npm', ['test']);
        console.log('✅ All Node.js tests passed!');
      } catch (error) {
        console.error('❌ Node.js tests failed:', error.message);
        process.exit(1);
      }
      break;

    case 'browser':
    case 'serve':
      console.log('🌐 Starting browser test server...');
      const port = parseInt(args[1]) || 8080;
      startTestServer(port);
      break;

    case 'all':
      console.log('🧪 Running all correctness tests...');
      
      // First run Node.js tests
      try {
        console.log('\n1️⃣ Running Node.js tests...');
        await runCommand('npm', ['test']);
        console.log('✅ Node.js tests passed!');
      } catch (error) {
        console.error('❌ Node.js tests failed:', error.message);
        process.exit(1);
      }

      // Then start browser test server
      console.log('\n2️⃣ Starting browser test server...');
      const serverPort = parseInt(args[1]) || 8080;
      startTestServer(serverPort);
      break;

    case 'help':
    default:
      console.log(`
🧪 MaxSim Correctness Test Runner

Usage: node scripts/test-correctness.js <command> [options]

Commands:
  node, jest          Run Node.js/Jest correctness tests
  browser, serve      Start browser test server (default port: 8080)
  all                 Run Node.js tests then start browser server
  help                Show this help message

Examples:
  node scripts/test-correctness.js node
  node scripts/test-correctness.js browser 3000
  node scripts/test-correctness.js all 8080

Browser Tests:
  The browser tests verify WASM correctness by comparing results
  with JavaScript implementations. They test:
  
  • Perfect matches and orthogonal vectors
  • Batch processing accuracy
  • Large dimension handling
  • Precision with small differences
  • Edge cases (zero vectors, etc.)

Node.js Tests:
  The Jest tests verify mathematical correctness of all
  implementations including:
  
  • Exact MaxSim calculations for known vectors
  • Implementation consistency between baseline/optimized
  • Edge cases and error handling
  • WASM compatibility (when available)
      `);
      break;
  }
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});