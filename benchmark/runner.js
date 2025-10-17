/**
 * Benchmark Runner
 *
 * Measures performance of different MaxSim implementations
 */

import { MaxSimBaseline } from '../src/js/maxsim-baseline.js';
import { MaxSimOptimized } from '../src/js/maxsim-optimized.js';
import { MaxSimTyped } from '../src/js/maxsim-typed.js';
import { generateFixtures, scenarios, calculateOperations } from './fixtures.js';
import { formatResults, saveResults } from './utils.js';

/**
 * Statistical helpers
 */
function mean(arr) {
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stdDev(arr) {
  const avg = mean(arr);
  const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Benchmark a single implementation
 */
async function benchmarkImplementation(implementation, fixtures, options = {}) {
  const { warmup = 10, iterations = 100 } = options;
  const { query, documents } = fixtures;

  console.log(`  Warming up (${warmup} iterations)...`);

  // Warmup
  for (let i = 0; i < warmup; i++) {
    implementation.maxsimBatch(query, documents);
  }

  console.log(`  Running benchmark (${iterations} iterations)...`);

  const times = [];

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const scores = implementation.maxsimBatch(query, documents);
    const end = performance.now();

    times.push(end - start);

    // Sanity check
    if (i === 0 && scores.length !== documents.length) {
      throw new Error(`Expected ${documents.length} scores, got ${scores.length}`);
    }
  }

  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const throughput = (documents.length * iterations) / totalTime * 1000;

  return {
    mean: mean(times),
    median: median(times),
    min: Math.min(...times),
    max: Math.max(...times),
    stdDev: stdDev(times),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    throughput: throughput,
    totalTime: totalTime,
    iterations: iterations
  };
}

/**
 * Run benchmarks for all implementations
 */
async function runBenchmark(scenarioName, options = {}) {
  const scenario = scenarios[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Benchmark: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Query: ${scenario.queryTokens} tokens × ${scenario.dim} dims`);
  console.log(`Docs: ${scenario.numDocs} docs × ${scenario.docTokens} tokens × ${scenario.dim} dims`);
  console.log(`Normalized: ${scenario.normalized}`);
  console.log(`Total operations: ${calculateOperations(scenario).toLocaleString()}`);
  console.log(`${'='.repeat(80)}\n`);

  // Generate fixtures
  console.log('Generating test data...');
  const fixtures = generateFixtures(scenario);

  const implementations = [
    {
      name: 'JS Baseline',
      impl: new MaxSimBaseline({ normalized: scenario.normalized })
    },
    {
      name: 'JS Optimized',
      impl: new MaxSimOptimized({ normalized: scenario.normalized })
    },
    {
      name: 'JS Typed Arrays',
      impl: new MaxSimTyped({ normalized: scenario.normalized })
    }
  ];

  const results = {};

  for (const { name, impl } of implementations) {
    console.log(`\nBenchmarking: ${name}`);
    const result = await benchmarkImplementation(impl, fixtures, options);
    results[name] = result;

    console.log(`  Mean: ${result.mean.toFixed(2)} ms`);
    console.log(`  Median: ${result.median.toFixed(2)} ms`);
    console.log(`  P95: ${result.p95.toFixed(2)} ms`);
    console.log(`  Throughput: ${result.throughput.toFixed(1)} docs/sec`);
  }

  // Calculate speedups
  const baseline = results['JS Baseline'];
  console.log(`\n${'-'.repeat(80)}`);
  console.log('Speedup Comparison (vs JS Baseline):');
  console.log(`${'-'.repeat(80)}`);

  for (const [name, result] of Object.entries(results)) {
    const speedup = baseline.mean / result.mean;
    console.log(`  ${name.padEnd(20)} ${speedup.toFixed(2)}x`);
  }

  // Save results
  const benchmarkResults = {
    scenario: scenario,
    timestamp: new Date().toISOString(),
    platform: {
      runtime: typeof process !== 'undefined' ? 'node' : 'browser',
      version: typeof process !== 'undefined' ? process.version : navigator.userAgent
    },
    results: results,
    operations: calculateOperations(scenario)
  };

  await saveResults(scenarioName, benchmarkResults);

  return benchmarkResults;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const scenarioName = args[0] || 'realistic';
  const runAll = args.includes('--all');

  if (runAll) {
    console.log('Running all benchmark scenarios...\n');
    for (const scenario of Object.keys(scenarios)) {
      await runBenchmark(scenario, { warmup: 10, iterations: 50 });
    }
  } else {
    await runBenchmark(scenarioName, { warmup: 10, iterations: 100 });
  }

  console.log('\n✅ Benchmark complete!');
  console.log(`Results saved to: benchmark/results/\n`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runBenchmark, benchmarkImplementation };
