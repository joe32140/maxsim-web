#!/usr/bin/env node

/**
 * Test GitHub Pages deployment locally
 * 
 * This script simulates the GitHub Pages build process locally
 * to test that everything works before pushing.
 */

import { mkdir, copyFile, readdir, stat, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.txt': 'text/plain'
};

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    const entryStat = await stat(srcPath);

    if (entryStat.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function buildPages() {
  console.log('🏗️  Building GitHub Pages locally...');

  const docsDir = join(rootDir, 'docs');
  const testDir = join(rootDir, 'test-pages');

  // Clean and create test directory
  try {
    await mkdir(testDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  console.log('📁 Copying docs to test directory...');
  await copyDir(docsDir, testDir);

  console.log('📦 Copying benchmark files...');
  await copyDir(join(rootDir, 'benchmark'), join(testDir, 'benchmark'));

  console.log('📦 Copying source files...');
  await copyDir(join(rootDir, 'src'), join(testDir, 'src'));

  console.log('📦 Copying dist files...');
  await copyDir(join(rootDir, 'dist'), join(testDir, 'dist'));

  console.log('✅ Build complete!');
  return testDir;
}

async function startTestServer(testDir) {
  const PORT = 3001;

  async function handleRequest(req, res) {
    let filepath = req.url === '/' ? '/index.html' : req.url;
    filepath = filepath.split('?')[0];

    if (filepath.includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    const fullPath = join(testDir, filepath);
    const ext = extname(filepath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = await readFile(fullPath);

      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      };

      if (ext === '.html') {
        headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      }

      res.writeHead(200, headers);
      res.end(content);

      console.log(`✓ ${req.method} ${req.url} (${contentType})`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        console.log(`✗ ${req.method} ${req.url} - Not Found`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        console.error(`✗ ${req.method} ${req.url} - Error:`, err.message);
      }
    }
  }

  const server = createServer(handleRequest);

  server.listen(PORT, () => {
    console.log('');
    console.log('🌐 GitHub Pages Test Server');
    console.log('━'.repeat(50));
    console.log(`🏠 Landing Page:  http://localhost:${PORT}/`);
    console.log(`📊 Benchmark:     http://localhost:${PORT}/benchmark/`);
    console.log(`🌐 Server running on port ${PORT}`);
    console.log('━'.repeat(50));
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down test server...');
    server.close(() => {
      console.log('✅ Test server stopped');
      process.exit(0);
    });
  });
}

async function main() {
  try {
    const testDir = await buildPages();
    await startTestServer(testDir);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();