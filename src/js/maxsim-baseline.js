/**
 * MaxSim Baseline Implementation
 *
 * This is the baseline pure JavaScript implementation based on the standard
 * MaxSim algorithm used in ColBERT and late-interaction models.
 *
 * Algorithm:
 * For each query token, find the maximum similarity with all document tokens,
 * then sum these maximum similarities: score = Σ max(q_i · d_j)
 *
 * Two methods available:
 * - maxsim(): Official MaxSim (raw sum) - matches ColBERT, pylate-rs, mixedbread-ai
 * - maxsim_normalized(): Normalized MaxSim (averaged) - for cross-query comparison
 *
 * Performance: ~80 docs/s on realistic workloads (32 query tokens × 2000 doc tokens)
 */

export class MaxSimBaseline {
  constructor() {}

  /**
   * Official MaxSim: raw sum with cosine similarity
   * Matches ColBERT, pylate-rs, mixedbread-ai implementations
   * @param {number[][]} queryEmbedding - Query embeddings (tokens × dimensions)
   * @param {number[][]} docEmbedding - Document embeddings (tokens × dimensions)
   * @returns {number} MaxSim score (raw sum)
   */
  maxsim(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, false);
  }

  /**
   * Normalized MaxSim: averaged score for cross-query comparison
   * @param {number[][]} queryEmbedding - Query embeddings (tokens × dimensions)
   * @param {number[][]} docEmbedding - Document embeddings (tokens × dimensions)
   * @returns {number} Normalized MaxSim score (averaged)
   */
  maxsim_normalized(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, true);
  }

  /**
   * Internal implementation shared by both methods
   * @private
   */
  _maxsimImpl(queryEmbedding, docEmbedding, normalized) {
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

    // Official MaxSim = SUM (no averaging)
    // Normalized MaxSim = SUM / query_tokens (for cross-query comparison)
    return normalized ? sumMaxSim / queryEmbedding.length : sumMaxSim;
  }

  /**
   * Official MaxSim batch: raw sum with cosine similarity
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
   * Normalized MaxSim batch: averaged scores for cross-query comparison
   * @param {number[][]} queryEmbedding - Query embeddings
   * @param {number[][][]} docEmbeddings - Array of document embeddings
   * @returns {number[]} Array of normalized MaxSim scores
   */
  maxsimBatch_normalized(queryEmbedding, docEmbeddings) {
    const scores = new Array(docEmbeddings.length);

    for (let i = 0; i < docEmbeddings.length; i++) {
      scores[i] = this.maxsim_normalized(queryEmbedding, docEmbeddings[i]);
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
      version: '2.0.0',
      backend: 'pure-js',
      features: ['baseline', 'cosine-similarity'],
      methods: ['maxsim (official sum)', 'maxsim_normalized (averaged)']
    };
  }
}
