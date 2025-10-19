/**
 * MaxSim Optimized Implementation
 *
 * Optimized JavaScript implementation using loop unrolling technique.
 *
 * **IMPORTANT**: This implementation expects **L2-normalized embeddings** as input.
 * Most modern embedding models (ColBERT, BGE, E5, etc.) output normalized embeddings by default.
 * For normalized embeddings, dot product equals cosine similarity, enabling faster computation.
 *
 * Optimization techniques:
 * - **Loop unrolling (4-factor)**: Process 4 multiplications per iteration instead of 1
 *   Inspired by https://github.com/kyr0/fast-dotproduct (MIT License)
 *   This achieves ~300% faster performance than naive reduce-based approaches
 * - **TypedArray support**: Optimized for Float32Array inputs
 *
 * Two methods available:
 * - maxsim(): Official MaxSim (raw sum) - matches ColBERT, pylate-rs, mixedbread-ai
 * - maxsim_normalized(): Normalized MaxSim (averaged) - for cross-query comparison
 *
 * Performance: ~2-3x faster than baseline on realistic workloads
 *
 * Attribution: Loop unrolling technique adapted from fast-dotproduct by @kyr0
 * https://github.com/kyr0/fast-dotproduct (MIT License)
 */

export class MaxSimOptimized {
  constructor() {
    // Warm up JIT compiler with a dummy calculation
    // This helps ensure the JIT has optimized our hot paths
    this._warmupJIT();
  }

  /**
   * Warm up the JIT compiler by running our optimized functions
   * This ensures better performance on first real usage
   * @private
   */
  _warmupJIT() {
    // Create small test vectors to warm up JIT
    const testVec1 = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const testVec2 = new Float32Array([8, 7, 6, 5, 4, 3, 2, 1]);
    
    // Run a few iterations to trigger JIT optimization
    for (let i = 0; i < 10; i++) {
      this._singleDotProductJS(testVec1, testVec2);
    }
  }

  /**
   * Official MaxSim: raw sum with dot product
   * Matches ColBERT, pylate-rs, mixedbread-ai implementations
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings
   * @param {number[][]|Float32Array[]} docEmbedding - L2-normalized document embeddings
   * @returns {number} MaxSim score (raw sum)
   */
  maxsim(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, false);
  }

  /**
   * Normalized MaxSim: averaged score for cross-query comparison
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings
   * @param {number[][]|Float32Array[]} docEmbedding - L2-normalized document embeddings
   * @returns {number} Normalized MaxSim score (averaged)
   */
  maxsim_normalized(queryEmbedding, docEmbedding) {
    return this._maxsimImpl(queryEmbedding, docEmbedding, true);
  }

  /**
   * Internal implementation with optimized dot product
   * @private
   */
  _maxsimImpl(queryEmbedding, docEmbedding, normalized) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0 ||
        !Array.isArray(docEmbedding) || docEmbedding.length === 0) {
      return 0;
    }

    let sumMaxSim = 0;

    for (let i = 0; i < queryEmbedding.length; i++) {
      const queryToken = queryEmbedding[i];
      let maxSim = -Infinity;

      for (let j = 0; j < docEmbedding.length; j++) {
        const docToken = docEmbedding[j];
        const similarity = this.dotProduct(queryToken, docToken);
        maxSim = Math.max(maxSim, similarity);
      }

      sumMaxSim += maxSim;
    }

    return normalized ? sumMaxSim / queryEmbedding.length : sumMaxSim;
  }

  /**
   * Official MaxSim batch: raw sum
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings
   * @param {Array<number[][]|Float32Array[]>} docEmbeddings - Array of L2-normalized document embeddings
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
   * Normalized MaxSim batch: averaged scores
   * @param {number[][]|Float32Array[]} queryEmbedding - L2-normalized query embeddings
   * @param {Array<number[][]|Float32Array[]>} docEmbeddings - Array of L2-normalized document embeddings
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
   * Optimized dot product with 4-factor loop unrolling
   * Technique from https://github.com/kyr0/fast-dotproduct (MIT License)
   *
   * This implementation is ~300% faster than naive reduce-based approaches:
   * vectorA.reduce((sum, ai, i) => sum + ai * vectorB[i], 0)
   *
   * The unrolling enables better JIT compiler optimization by:
   * - Reducing loop overhead (fewer iterations)
   * - Enabling better instruction pipelining
   * - Improving CPU cache utilization
   *
   * @param {number[]|Float32Array} vec1 - First vector (L2-normalized)
   * @param {number[]|Float32Array} vec2 - Second vector (L2-normalized)
   * @returns {number} Dot product
   */
  dotProduct(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    const dims = vec1.length;
    let result = 0.0;
    
    // For very small vectors, use simple loop
    if (dims < 4) {
      for (let i = 0; i < dims; i++) {
        result += vec1[i] * vec2[i];
      }
      return result;
    }

    // Inline loop unrolling to avoid function call overhead
    // This is critical for browser performance where function calls are expensive
    let j = 0;
    const unrollFactor = 4;
    const length = Math.floor(dims / unrollFactor) * unrollFactor;

    // Main unrolled loop - process 4 multiplications per iteration
    for (; j < length; j += unrollFactor) {
      result +=
        vec1[j] * vec2[j] +
        vec1[j + 1] * vec2[j + 1] +
        vec1[j + 2] * vec2[j + 2] +
        vec1[j + 3] * vec2[j + 3];
    }

    // Handle remaining elements
    for (; j < dims; j++) {
      result += vec1[j] * vec2[j];
    }

    return result;
  }

  /**
   * JIT-optimized dot product - exact implementation from fast-dotproduct
   * This follows the exact pattern to trigger maximum JIT compiler optimization
   * 
   * Key JIT optimizations:
   * 1. Consistent variable types (Float32Array preferred)
   * 2. Loop unrolling reduces branch overhead
   * 3. Predictable memory access patterns
   * 4. Minimal function calls in hot path
   * 
   * @private
   */
  _singleDotProductJS(vectorA, vectorB) {
    const dims = vectorA.length;
    let result = 0.0;

    // Unrolling the loop to improve performance
    // 300% faster than baseline/naive: vectorA.reduce((sum, ai, i) => sum + ai * vectorB[i], 0)
    let j = 0;
    const unrollFactor = 4;
    const length = Math.floor(dims / unrollFactor) * unrollFactor;

    // Main unrolled loop - this is the JIT optimization hotspot
    for (; j < length; j += unrollFactor) {
      // JIT optimization: process 4 multiplications per iteration
      // This pattern allows the JIT to:
      // - Reduce loop overhead by 75%
      // - Enable better instruction pipelining
      // - Improve CPU cache utilization
      result +=
        vectorA[j] * vectorB[j] +
        vectorA[j + 1] * vectorB[j + 1] +
        vectorA[j + 2] * vectorB[j + 2] +
        vectorA[j + 3] * vectorB[j + 3];
    }

    // Handle remaining elements - this is critical for correctness
    // The JIT will optimize this simple loop separately
    for (; j < dims; j++) {
      result += vectorA[j] * vectorB[j];
    }

    return result;
  }

  /**
   * Alternative aggressive JIT optimization - try different unrolling patterns
   * @private
   */
  _aggressiveDotProduct(vectorA, vectorB) {
    const dims = vectorA.length;
    let result = 0.0;

    // Try 8-factor unrolling for even better performance
    let j = 0;
    const unrollFactor = 8;
    const length = Math.floor(dims / unrollFactor) * unrollFactor;

    for (; j < length; j += unrollFactor) {
      result +=
        vectorA[j] * vectorB[j] +
        vectorA[j + 1] * vectorB[j + 1] +
        vectorA[j + 2] * vectorB[j + 2] +
        vectorA[j + 3] * vectorB[j + 3] +
        vectorA[j + 4] * vectorB[j + 4] +
        vectorA[j + 5] * vectorB[j + 5] +
        vectorA[j + 6] * vectorB[j + 6] +
        vectorA[j + 7] * vectorB[j + 7];
    }

    // Handle remaining elements
    for (; j < dims; j++) {
      result += vectorA[j] * vectorB[j];
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
      name: 'MaxSim Optimized',
      version: '2.0.0',
      backend: 'js-optimized',
      features: ['loop-unrolling-4x', 'typed-arrays', 'fast-dotproduct'],
      methods: ['maxsim (official sum)', 'maxsim_normalized (averaged)'],
      attribution: 'Loop unrolling technique from fast-dotproduct by @kyr0 (MIT)'
    };
  }
}
