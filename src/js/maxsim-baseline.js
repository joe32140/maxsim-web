/**
 * MaxSim Baseline Implementation
 *
 * Pure JavaScript implementation of MaxSim for ColBERT and late-interaction models.
 *
 * **IMPORTANT**: This implementation expects **L2-normalized embeddings** as input.
 * Most modern embedding models (ColBERT, BGE, E5, etc.) output normalized embeddings by default.
 * For normalized embeddings, dot product equals cosine similarity, enabling faster computation.
 *
 * Algorithm:
 * - For each query token, find the maximum dot product with all document tokens
 * - Sum these maximum similarities: score = Σ max(qi · dj)
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
   * Official MaxSim: raw sum with dot product
   * Matches ColBERT, pylate-rs, mixedbread-ai implementations
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings (tokens × dimensions)
   * @param {number[][]|Float32Array[]} docEmbedding - L2-normalized document embeddings (tokens × dimensions)
   * @returns {number} MaxSim score (raw sum)
   */
  maxsim(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, false);
  }

  /**
   * Normalized MaxSim: averaged score for cross-query comparison
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings (tokens × dimensions)
   * @param {number[][]|Float32Array[]} docEmbedding - L2-normalized document embeddings (tokens × dimensions)
   * @returns {number} Normalized MaxSim score (averaged)
   */
  maxsim_normalized(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, true);
  }

  /**
   * Internal implementation shared by both methods
   * Uses dot product (assumes L2-normalized embeddings)
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

      // Find max dot product with any document token
      // For L2-normalized embeddings, dot product = cosine similarity
      for (let j = 0; j < docEmbedding.length; j++) {
        const docToken = docEmbedding[j];
        const similarity = this.dotProduct(queryToken, docToken);
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
   * Compute dot product between two vectors
   * For L2-normalized vectors, dot product equals cosine similarity
   * @param {number[]|Float32Array} vec1 - First vector (L2-normalized)
   * @param {number[]|Float32Array} vec2 - Second vector (L2-normalized)
   * @returns {number} Dot product
   */
  dotProduct(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let result = 0;
    for (let i = 0; i < vec1.length; i++) {
      result += vec1[i] * vec2[i];
    }
    return result;
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
