#!/usr/bin/env node

/**
 * Build script for maxsim-web
 *
 * For now, this is a simple copy script since we're using pure ES modules.
 * In the future, this will handle WASM compilation and bundling.
 */

import { mkdir, copyFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    const entryStat = await stat(srcPath);

    if (entryStat.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.endsWith('.js')) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  console.log('Building maxsim-web...');

  const srcDir = join(rootDir, 'src', 'js');
  const distDir = join(rootDir, 'dist');

  console.log('  Copying source files to dist/...');
  await copyDir(srcDir, distDir);

  console.log('✅ Build complete!');
  console.log('   Output: dist/');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
