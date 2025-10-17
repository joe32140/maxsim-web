/**
 * MaxSim Baseline Implementation
 *
 * This is the baseline pure JavaScript implementation based on the standard
 * MaxSim algorithm used in ColBERT and late-interaction models.
 *
 * Algorithm:
 * For each query token, find the maximum cosine similarity with all document tokens,
 * then average these maximum similarities across all query tokens.
 *
 * Performance: ~80 docs/s on realistic workloads (32 query tokens × 2000 doc tokens)
 */

export class MaxSimBaseline {
  constructor(options = {}) {
    this.normalized = options.normalized ?? false;
  }

  /**
   * Compute MaxSim score between query and document embeddings
   * @param {number[][]} queryEmbedding - Query embeddings (tokens × dimensions)
   * @param {number[][]} docEmbedding - Document embeddings (tokens × dimensions)
   * @returns {number} MaxSim score
   */
  maxsim(queryEmbedding, docEmbedding) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0 ||
        !Array.isArray(docEmbedding) || docEmbedding.length === 0) {
      return 0;
    }

    let sumMaxSim = 0;

    // For each query token
    for (let i = 0; i < queryEmbedding.length; i++) {
      const queryToken = queryEmbedding[i];
      let maxSim = -Infinity;

      // Find max similarity with any document token
      for (let j = 0; j < docEmbedding.length; j++) {
        const docToken = docEmbedding[j];
        const similarity = this.cosineSimilarity(queryToken, docToken);
        maxSim = Math.max(maxSim, similarity);
      }

      sumMaxSim += maxSim;
    }

    // Average across query tokens
    return sumMaxSim / queryEmbedding.length;
  }

  /**
   * Batch compute MaxSim scores for multiple documents
   * @param {number[][]} queryEmbedding - Query embeddings
   * @param {number[][][]} docEmbeddings - Array of document embeddings
   * @returns {number[]} Array of MaxSim scores
   */
  maxsimBatch(queryEmbedding, docEmbeddings) {
    const scores = new Array(docEmbeddings.length);

    for (let i = 0; i < docEmbeddings.length; i++) {
      scores[i] = this.maxsim(queryEmbedding, docEmbeddings[i]);
    }

    return scores;
  }

  /**
   * Compute cosine similarity between two vectors
   * @param {number[]} vec1 - First vector
   * @param {number[]} vec2 - Second vector
   * @returns {number} Cosine similarity
   */
  cosineSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Static utility to normalize embeddings (L2 normalization)
   * @param {number[][]} embedding - Embeddings to normalize
   * @returns {number[][]} Normalized embeddings
   */
  static normalize(embedding) {
    return embedding.map(vec => {
      const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      if (mag === 0) return vec;
      return vec.map(v => v / mag);
    });
  }

  /**
   * Get implementation info
   * @returns {object} Implementation details
   */
  getInfo() {
    return {
      name: 'MaxSim Baseline',
      version: '1.0.0',
      backend: 'pure-js',
      features: ['baseline', 'cosine-similarity'],
      normalized: this.normalized
    };
  }
}
