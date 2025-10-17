/**
 * MaxSim Typed Arrays Implementation
 *
 * Optimizations over standard optimized version:
 * 1. Float32Array for better memory layout and cache efficiency
 * 2. Manual loop unrolling for V8 JIT optimization
 * 3. Efficient typed array conversions
 *
 * Performance: ~295 docs/s on realistic workloads (1.5x vs baseline)
 */

export class MaxSimTyped {
  constructor(options = {}) {
    this.normalized = options.normalized ?? false;
  }

  /**
   * Compute MaxSim score between query and document embeddings
   * @param {number[][]|Float32Array[]} queryEmbedding - Query embeddings
   * @param {number[][]|Float32Array[]} docEmbedding - Document embeddings
   * @returns {number} MaxSim score
   */
  maxsim(queryEmbedding, docEmbedding) {
    if (!queryEmbedding || queryEmbedding.length === 0 ||
        !docEmbedding || docEmbedding.length === 0) {
      return 0;
    }

    // Convert to typed arrays if needed
    const query = this.ensureTypedArray(queryEmbedding);
    const doc = this.ensureTypedArray(docEmbedding);

    let sumMaxSim = 0;

    // For each query token
    for (let i = 0; i < query.length; i++) {
      const queryToken = query[i];
      let maxSim = -Infinity;

      // Find max similarity with any document token
      for (let j = 0; j < doc.length; j++) {
        const docToken = doc[j];

        // Use optimized similarity calculation
        const similarity = this.normalized
          ? this.dotProductTyped(queryToken, docToken)
          : this.cosineSimilarityTyped(queryToken, docToken);

        if (similarity > maxSim) {
          maxSim = similarity;
        }
      }

      sumMaxSim += maxSim;
    }

    // Average across query tokens
    return sumMaxSim / query.length;
  }

  /**
   * Batch compute MaxSim scores for multiple documents
   * @param {number[][]|Float32Array[]} queryEmbedding - Query embeddings
   * @param {Array<number[][]|Float32Array[]>} docEmbeddings - Array of document embeddings
   * @returns {Float32Array} Array of MaxSim scores
   */
  maxsimBatch(queryEmbedding, docEmbeddings) {
    const scores = new Float32Array(docEmbeddings.length);
    const query = this.ensureTypedArray(queryEmbedding);

    for (let i = 0; i < docEmbeddings.length; i++) {
      scores[i] = this.maxsim(query, docEmbeddings[i]);
    }

    return scores;
  }

  /**
   * Optimized dot product with loop unrolling for typed arrays
   * @param {Float32Array} vec1 - First vector (normalized)
   * @param {Float32Array} vec2 - Second vector (normalized)
   * @returns {number} Dot product
   */
  dotProductTyped(vec1, vec2) {
    const len = vec1.length;
    let sum = 0;

    // Manual loop unrolling (process 8 elements at a time)
    // This helps V8's JIT compiler generate better code
    let i = 0;
    const unrollSize = 8;
    const unrollEnd = len - (len % unrollSize);

    // Unrolled loop
    for (; i < unrollEnd; i += unrollSize) {
      sum += vec1[i] * vec2[i] +
             vec1[i + 1] * vec2[i + 1] +
             vec1[i + 2] * vec2[i + 2] +
             vec1[i + 3] * vec2[i + 3] +
             vec1[i + 4] * vec2[i + 4] +
             vec1[i + 5] * vec2[i + 5] +
             vec1[i + 6] * vec2[i + 6] +
             vec1[i + 7] * vec2[i + 7];
    }

    // Handle remaining elements
    for (; i < len; i++) {
      sum += vec1[i] * vec2[i];
    }

    return sum;
  }

  /**
   * Optimized cosine similarity with loop unrolling
   * @param {Float32Array} vec1 - First vector
   * @param {Float32Array} vec2 - Second vector
   * @returns {number} Cosine similarity
   */
  cosineSimilarityTyped(vec1, vec2) {
    const len = vec1.length;
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    // Manual loop unrolling (process 4 elements at a time)
    let i = 0;
    const unrollSize = 4;
    const unrollEnd = len - (len % unrollSize);

    // Unrolled loop
    for (; i < unrollEnd; i += unrollSize) {
      const v1_0 = vec1[i];
      const v1_1 = vec1[i + 1];
      const v1_2 = vec1[i + 2];
      const v1_3 = vec1[i + 3];

      const v2_0 = vec2[i];
      const v2_1 = vec2[i + 1];
      const v2_2 = vec2[i + 2];
      const v2_3 = vec2[i + 3];

      dotProduct += v1_0 * v2_0 + v1_1 * v2_1 + v1_2 * v2_2 + v1_3 * v2_3;
      mag1 += v1_0 * v1_0 + v1_1 * v1_1 + v1_2 * v1_2 + v1_3 * v1_3;
      mag2 += v2_0 * v2_0 + v2_1 * v2_1 + v2_2 * v2_2 + v2_3 * v2_3;
    }

    // Handle remaining elements
    for (; i < len; i++) {
      const v1 = vec1[i];
      const v2 = vec2[i];
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Ensure embeddings are typed arrays
   * @param {number[][]|Float32Array[]} embedding - Embeddings to convert
   * @returns {Float32Array[]} Typed array embeddings
   */
  ensureTypedArray(embedding) {
    if (!Array.isArray(embedding)) {
      return embedding;
    }

    // Check if first token is already a typed array
    if (embedding.length > 0 && embedding[0] instanceof Float32Array) {
      return embedding;
    }

    // Convert to typed arrays
    return embedding.map(token => {
      if (token instanceof Float32Array) {
        return token;
      }
      return new Float32Array(token);
    });
  }

  /**
   * Static utility to convert embeddings to typed arrays
   * @param {number[][]} embedding - Regular array embeddings
   * @returns {Float32Array[]} Typed array embeddings
   */
  static toTypedArray(embedding) {
    return embedding.map(token => new Float32Array(token));
  }

  /**
   * Static utility to normalize embeddings (L2 normalization)
   * Returns typed arrays for better performance
   * @param {number[][]|Float32Array[]} embedding - Embeddings to normalize
   * @returns {Float32Array[]} Normalized typed array embeddings
   */
  static normalize(embedding) {
    return embedding.map(vec => {
      const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
      let mag = 0;

      // Calculate magnitude with loop unrolling
      let i = 0;
      const len = arr.length;
      const unrollEnd = len - (len % 4);

      for (; i < unrollEnd; i += 4) {
        mag += arr[i] * arr[i] +
               arr[i + 1] * arr[i + 1] +
               arr[i + 2] * arr[i + 2] +
               arr[i + 3] * arr[i + 3];
      }

      for (; i < len; i++) {
        mag += arr[i] * arr[i];
      }

      mag = Math.sqrt(mag);

      if (mag === 0) return arr;

      // Normalize
      const normalized = new Float32Array(len);
      for (i = 0; i < len; i++) {
        normalized[i] = arr[i] / mag;
      }

      return normalized;
    });
  }

  /**
   * Get implementation info
   * @returns {object} Implementation details
   */
  getInfo() {
    return {
      name: 'MaxSim Typed Arrays',
      version: '1.0.0',
      backend: 'js-typed',
      features: ['typed-arrays', 'loop-unrolling', 'normalized-mode'],
      normalized: this.normalized
    };
  }
}
