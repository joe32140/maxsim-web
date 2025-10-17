/**
 * Simple HTTP Server for Browser Benchmarks
 *
 * Serves the benchmark HTML and WASM files with proper MIME types
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.txt': 'text/plain'
};

const PORT = process.env.PORT || 8080;

async function handleRequest(req, res) {
  let filepath = req.url === '/' ? '/benchmark/index.html' : req.url;

  // Remove query string
  filepath = filepath.split('?')[0];

  // Security: prevent directory traversal
  if (filepath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const fullPath = join(ROOT_DIR, filepath);
  const ext = extname(filepath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = await readFile(fullPath);

    // Set appropriate headers for WASM and modules
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    };

    // Additional headers for HTML files to enable SharedArrayBuffer
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
  console.log('🚀 MaxSim Benchmark Server');
  console.log('━'.repeat(50));
  console.log(`📊 Benchmark UI:  http://localhost:${PORT}/`);
  console.log(`🌐 Server running on port ${PORT}`);
  console.log('━'.repeat(50));
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
