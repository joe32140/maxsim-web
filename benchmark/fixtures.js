/**
 * Benchmark Fixtures
 *
 * Generate test data for benchmarking MaxSim implementations
 */

/**
 * Generate random embedding vector
 * @param {number} dim - Vector dimension
 * @param {boolean} normalized - Whether to normalize the vector
 * @returns {number[]} Random vector
 */
export function randomVector(dim, normalized = false) {
  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = Math.random() * 2 - 1; // Range: [-1, 1]
  }

  if (normalized) {
    const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (mag > 0) {
      for (let i = 0; i < dim; i++) {
        vec[i] /= mag;
      }
    }
  }

  return vec;
}

/**
 * Generate random embeddings (multiple tokens)
 * @param {number} numTokens - Number of tokens
 * @param {number} dim - Embedding dimension
 * @param {boolean} normalized - Whether to normalize vectors
 * @returns {number[][]} Random embeddings
 */
export function randomEmbedding(numTokens, dim, normalized = false) {
  const embedding = new Array(numTokens);
  for (let i = 0; i < numTokens; i++) {
    embedding[i] = randomVector(dim, normalized);
  }
  return embedding;
}

/**
 * Generate test fixtures for benchmarking
 * @param {object} config - Configuration
 * @param {number} config.queryTokens - Number of query tokens
 * @param {number} config.docTokens - Number of document tokens (or max if variableLength)
 * @param {number} config.numDocs - Number of documents
 * @param {number} config.dim - Embedding dimension
 * @param {boolean} config.normalized - Whether to normalize embeddings
 * @param {boolean} config.variableLength - Whether to use variable-length documents
 * @param {number} config.minDocTokens - Minimum document tokens (for variable length)
 * @returns {object} Test fixtures
 */
export function generateFixtures(config) {
  const {
    queryTokens,
    docTokens,
    numDocs,
    dim,
    normalized = false,
    variableLength = false,
    minDocTokens = Math.floor(docTokens * 0.5)
  } = config;

  const query = randomEmbedding(queryTokens, dim, normalized);
  const documents = new Array(numDocs);

  for (let i = 0; i < numDocs; i++) {
    let tokens = docTokens;
    if (variableLength) {
      // Generate random length between minDocTokens and docTokens
      tokens = Math.floor(Math.random() * (docTokens - minDocTokens + 1)) + minDocTokens;
    }
    documents[i] = randomEmbedding(tokens, dim, normalized);
  }

  return { query, documents, config };
}

/**
 * Predefined benchmark scenarios
 */
export const scenarios = {
  'tiny': {
    name: 'Tiny',
    description: '10 docs, 64 tokens each',
    queryTokens: 32,
    docTokens: 64,
    numDocs: 10,
    dim: 128,
    normalized: false
  },
  'small': {
    name: 'Small',
    description: '10 docs, 256 tokens each',
    queryTokens: 32,
    docTokens: 256,
    numDocs: 10,
    dim: 128,
    normalized: false
  },
  'medium': {
    name: 'Medium',
    description: '100 docs, 256 tokens each',
    queryTokens: 32,
    docTokens: 256,
    numDocs: 100,
    dim: 128,
    normalized: false
  },
  'large': {
    name: 'Large',
    description: '100 docs, 512 tokens each',
    queryTokens: 64,
    docTokens: 512,
    numDocs: 100,
    dim: 128,
    normalized: false
  },
  'realistic': {
    name: 'Realistic',
    description: '100 docs, 2000 tokens each (typical web chunks)',
    queryTokens: 32,
    docTokens: 2000,
    numDocs: 100,
    dim: 128,
    normalized: false
  },
  'xl': {
    name: 'Extra Large',
    description: '1000 docs, 512 tokens each',
    queryTokens: 32,
    docTokens: 512,
    numDocs: 1000,
    dim: 128,
    normalized: false
  },
  'variable-small': {
    name: 'Variable Small',
    description: '100 docs, 128-256 tokens (variable)',
    queryTokens: 32,
    docTokens: 256,
    minDocTokens: 128,
    numDocs: 100,
    dim: 128,
    normalized: false,
    variableLength: true
  },
  'variable-medium': {
    name: 'Variable Medium',
    description: '1000 docs, 128-512 tokens (variable) - REAL WORLD',
    queryTokens: 13,
    docTokens: 512,
    minDocTokens: 128,
    numDocs: 1000,
    dim: 48,
    normalized: false,
    variableLength: true
  },
  'variable-large': {
    name: 'Variable Large',
    description: '1000 docs, 200-400 tokens (variable, low variance)',
    queryTokens: 32,
    docTokens: 400,
    minDocTokens: 200,
    numDocs: 1000,
    dim: 128,
    normalized: false,
    variableLength: true
  }
};

/**
 * Calculate total operations for a scenario
 * @param {object} scenario - Scenario configuration
 * @returns {number} Total dot product operations
 */
export function calculateOperations(scenario) {
  return scenario.queryTokens * scenario.docTokens * scenario.numDocs * scenario.dim;
}
