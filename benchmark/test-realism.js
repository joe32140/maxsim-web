#!/usr/bin/env node

/**
 * Test script to compare random vs realistic embeddings
 */

import { MaxSimOptimized } from '../src/js/maxsim-optimized.js';
import { compareEmbeddingTypes } from './realistic-embeddings.js';

async function main() {
  console.log('🧪 Testing Embedding Realism Impact on Performance\n');

  const config = {
    queryTokens: 32,
    docTokens: 256,
    numDocs: 50,
    dim: 128,
    normalized: true
  };

  const implementation = new MaxSimOptimized({ normalized: true });

  await compareEmbeddingTypes(implementation, config);

  console.log('\n✅ Realism test complete!');
  console.log('\nKey Insights:');
  console.log('- Performance difference shows if algorithm is sensitive to data distribution');
  console.log('- Score distributions show if realistic data produces more meaningful results');
  console.log('- Realistic embeddings better simulate real ColBERT/embedding model outputs');
}

main().catch(console.error);