/**
 * Benchmark Utilities
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Format benchmark results as a table
 */
export function formatResults(results) {
  const headers = ['Implementation', 'Mean (ms)', 'Median', 'P95', 'P99', 'Throughput (docs/s)', 'Speedup'];
  const rows = [];

  const baseline = results['JS Baseline'];

  for (const [name, result] of Object.entries(results)) {
    const speedup = baseline.mean / result.mean;
    rows.push([
      name,
      result.mean.toFixed(2),
      result.median.toFixed(2),
      result.p95.toFixed(2),
      result.p99.toFixed(2),
      result.throughput.toFixed(1),
      speedup.toFixed(2) + 'x'
    ]);
  }

  // Calculate column widths
  const colWidths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map(row => String(row[i]).length))
  );

  // Format table
  let table = '';

  // Header
  table += '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |\n';

  // Separator
  table += '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';

  // Rows
  for (const row of rows) {
    table += '| ' + row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ') + ' |\n';
  }

  return table;
}

/**
 * Save benchmark results to file
 */
export async function saveResults(scenarioName, results) {
  const resultsDir = join(__dirname, 'results');

  // Ensure results directory exists
  try {
    await mkdir(resultsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `${scenarioName}_${timestamp}.json`;
  const filepath = join(resultsDir, filename);

  await writeFile(filepath, JSON.stringify(results, null, 2));

  console.log(`\nResults saved to: ${filepath}`);

  // Also save a "latest" version
  const latestPath = join(resultsDir, `${scenarioName}_latest.json`);
  await writeFile(latestPath, JSON.stringify(results, null, 2));
}

/**
 * Format time in human-readable format
 */
export function formatTime(ms) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else {
    return `${(ms / 1000).toFixed(2)} s`;
  }
}

/**
 * Format throughput
 */
export function formatThroughput(docsPerSec) {
  if (docsPerSec < 1000) {
    return `${docsPerSec.toFixed(1)} docs/s`;
  } else if (docsPerSec < 1000000) {
    return `${(docsPerSec / 1000).toFixed(1)}K docs/s`;
  } else {
    return `${(docsPerSec / 1000000).toFixed(1)}M docs/s`;
  }
}
