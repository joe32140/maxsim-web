/**
 * Basic MaxSim Example
 *
 * This example demonstrates basic usage of the maxsim-web library
 */

import { MaxSim } from '../src/js/index.js';

async function main() {
  console.log('MaxSim Web - Basic Example\n');

  // Create MaxSim instance (auto-selects best backend)
  const maxsim = await MaxSim.create({
    backend: 'auto',
    normalized: true  // Embeddings are pre-normalized
  });

  console.log('Using backend:', maxsim.getInfo().backend);
  console.log('');

  // Example embeddings (in practice, these come from a model like ColBERT)
  const queryEmbedding = [
    [0.5, 0.5, 0.5, 0.5],  // Token 1
    [0.7, 0.2, 0.1, 0.0]   // Token 2
  ];

  const doc1Embedding = [
    [0.6, 0.4, 0.5, 0.5],  // Token 1
    [0.8, 0.1, 0.1, 0.0],  // Token 2
    [0.3, 0.3, 0.2, 0.2]   // Token 3
  ];

  const doc2Embedding = [
    [0.1, 0.1, 0.8, 0.0],  // Token 1
    [0.2, 0.2, 0.6, 0.0]   // Token 2
  ];

  // Normalize embeddings
  const normalizedQuery = MaxSim.normalize(queryEmbedding);
  const normalizedDoc1 = MaxSim.normalize(doc1Embedding);
  const normalizedDoc2 = MaxSim.normalize(doc2Embedding);

  console.log('Computing MaxSim scores...\n');

  // Single document scoring
  const score1 = maxsim.maxsim(normalizedQuery, normalizedDoc1);
  console.log('Query vs Document 1:', score1.toFixed(4));

  const score2 = maxsim.maxsim(normalizedQuery, normalizedDoc2);
  console.log('Query vs Document 2:', score2.toFixed(4));

  // Batch scoring (more efficient)
  console.log('\nBatch scoring:');
  const scores = maxsim.maxsimBatch(normalizedQuery, [normalizedDoc1, normalizedDoc2]);
  scores.forEach((score, i) => {
    console.log(`  Document ${i + 1}: ${score.toFixed(4)}`);
  });

  // Benchmark
  console.log('\nBenchmark (1000 iterations):');
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    maxsim.maxsimBatch(normalizedQuery, [normalizedDoc1, normalizedDoc2]);
  }

  const elapsed = performance.now() - start;
  console.log(`  Total time: ${elapsed.toFixed(2)} ms`);
  console.log(`  Average time: ${(elapsed / iterations).toFixed(3)} ms`);
  console.log(`  Throughput: ${(2 * iterations / elapsed * 1000).toFixed(0)} docs/sec`);
}

main().catch(console.error);
