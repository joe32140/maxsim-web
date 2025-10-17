/**
 * More Realistic Embedding Generation
 * 
 * Generates embeddings that better simulate real-world ColBERT/embedding model outputs
 */

/**
 * Generate embeddings with more realistic statistical properties
 * Based on analysis of actual ColBERT embeddings:
 * - Values typically in range [-0.5, 0.5] after normalization
 * - Some dimensions are more active than others
 * - Slight clustering patterns exist
 */
export function generateRealisticEmbedding(numTokens, dim, options = {}) {
  const {
    normalized = true,
    sparsity = 0.1,        // 10% of dimensions are "inactive" (near zero)
    clustering = 0.3,      // 30% similarity between tokens in same document
    variance = 0.3         // Reduced variance compared to uniform random
  } = options;

  const embedding = [];

  // Create a "document theme" vector that tokens will partially share
  const documentTheme = new Array(dim);
  for (let i = 0; i < dim; i++) {
    documentTheme[i] = (Math.random() - 0.5) * variance;
  }

  for (let tokenIdx = 0; tokenIdx < numTokens; tokenIdx++) {
    const token = new Array(dim);
    
    for (let i = 0; i < dim; i++) {
      // Combine document theme with token-specific variation
      const themeComponent = documentTheme[i] * clustering;
      const randomComponent = (Math.random() - 0.5) * variance * (1 - clustering);
      
      // Add sparsity - some dimensions are near zero
      const isActive = Math.random() > sparsity;
      token[i] = isActive ? (themeComponent + randomComponent) : Math.random() * 0.01;
    }

    if (normalized) {
      // L2 normalize
      const mag = Math.sqrt(token.reduce((sum, v) => sum + v * v, 0));
      if (mag > 0) {
        for (let i = 0; i < dim; i++) {
          token[i] /= mag;
        }
      }
    }

    embedding.push(token);
  }

  return embedding;
}

/**
 * Generate a set of documents with varying similarity to query
 * This creates a more realistic scenario where some documents are more similar
 */
export function generateRealisticDataset(config) {
  const {
    queryTokens,
    docTokens,
    numDocs,
    dim,
    normalized = true
  } = config;

  // Generate query
  const query = generateRealisticEmbedding(queryTokens, dim, { 
    normalized, 
    sparsity: 0.05,  // Queries tend to be less sparse
    clustering: 0.2,  // Less internal clustering in queries
    variance: 0.4 
  });

  const documents = [];

  for (let docIdx = 0; docIdx < numDocs; docIdx++) {
    // Vary similarity to query - some docs more relevant than others
    const relevanceScore = Math.random();
    
    let doc;
    if (relevanceScore > 0.8) {
      // High relevance - share some query characteristics
      doc = generateSimilarEmbedding(query, docTokens, dim, 0.4, { normalized });
    } else if (relevanceScore > 0.5) {
      // Medium relevance - some shared themes
      doc = generateSimilarEmbedding(query, docTokens, dim, 0.2, { normalized });
    } else {
      // Low relevance - mostly independent
      doc = generateRealisticEmbedding(docTokens, dim, { 
        normalized,
        sparsity: 0.15,
        clustering: 0.4,
        variance: 0.3
      });
    }

    documents.push(doc);
  }

  return { query, documents, config };
}

/**
 * Generate an embedding that shares some characteristics with a reference embedding
 */
function generateSimilarEmbedding(reference, numTokens, dim, similarity, options = {}) {
  const { normalized = true } = options;
  
  // Calculate average reference vector
  const refAvg = new Array(dim).fill(0);
  for (const token of reference) {
    for (let i = 0; i < dim; i++) {
      refAvg[i] += token[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    refAvg[i] /= reference.length;
  }

  const embedding = [];

  for (let tokenIdx = 0; tokenIdx < numTokens; tokenIdx++) {
    const token = new Array(dim);
    
    for (let i = 0; i < dim; i++) {
      // Blend reference characteristics with random variation
      const refComponent = refAvg[i] * similarity;
      const randomComponent = (Math.random() - 0.5) * 0.3 * (1 - similarity);
      token[i] = refComponent + randomComponent;
    }

    if (normalized) {
      const mag = Math.sqrt(token.reduce((sum, v) => sum + v * v, 0));
      if (mag > 0) {
        for (let i = 0; i < dim; i++) {
          token[i] /= mag;
        }
      }
    }

    embedding.push(token);
  }

  return embedding;
}

/**
 * Compare realistic vs random embeddings performance
 */
export async function compareEmbeddingTypes(implementation, config) {
  console.log('\n🔬 Comparing Random vs Realistic Embeddings...\n');

  // Generate both types
  const randomData = {
    query: generateRandomEmbedding(config.queryTokens, config.dim, config.normalized),
    documents: Array(config.numDocs).fill(0).map(() => 
      generateRandomEmbedding(config.docTokens, config.dim, config.normalized)
    )
  };

  const realisticData = generateRealisticDataset(config);

  // Benchmark both
  const iterations = 50;

  // Random embeddings
  const randomTimes = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    implementation.maxsimBatch(randomData.query, randomData.documents);
    randomTimes.push(performance.now() - start);
  }

  // Realistic embeddings  
  const realisticTimes = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    implementation.maxsimBatch(realisticData.query, realisticData.documents);
    realisticTimes.push(performance.now() - start);
  }

  const randomMean = randomTimes.reduce((sum, t) => sum + t, 0) / randomTimes.length;
  const realisticMean = realisticTimes.reduce((sum, t) => sum + t, 0) / realisticTimes.length;

  console.log(`Random Embeddings:    ${randomMean.toFixed(2)} ms`);
  console.log(`Realistic Embeddings: ${realisticMean.toFixed(2)} ms`);
  console.log(`Difference:           ${((realisticMean - randomMean) / randomMean * 100).toFixed(1)}%`);

  // Also compare score distributions
  const randomScores = implementation.maxsimBatch(randomData.query, randomData.documents);
  const realisticScores = implementation.maxsimBatch(realisticData.query, realisticData.documents);

  const randomAvg = randomScores.reduce((sum, s) => sum + s, 0) / randomScores.length;
  const realisticAvg = realisticScores.reduce((sum, s) => sum + s, 0) / realisticScores.length;

  console.log(`\nScore Distributions:`);
  console.log(`Random scores avg:    ${randomAvg.toFixed(4)}`);
  console.log(`Realistic scores avg: ${realisticAvg.toFixed(4)}`);
  console.log(`Realistic has ${realisticScores.filter(s => s > 0.5).length} high-similarity docs`);
  console.log(`Random has ${randomScores.filter(s => s > 0.5).length} high-similarity docs`);

  return { randomMean, realisticMean, randomScores, realisticScores };
}

// Helper function for pure random (existing behavior)
function generateRandomEmbedding(numTokens, dim, normalized) {
  const embedding = [];
  for (let i = 0; i < numTokens; i++) {
    const token = new Array(dim);
    for (let j = 0; j < dim; j++) {
      token[j] = Math.random() * 2 - 1;
    }
    
    if (normalized) {
      const mag = Math.sqrt(token.reduce((sum, v) => sum + v * v, 0));
      if (mag > 0) {
        for (let j = 0; j < dim; j++) {
          token[j] /= mag;
        }
      }
    }
    
    embedding.push(token);
  }
  return embedding;
}