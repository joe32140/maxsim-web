/**
 * MaxSim WASM Implementation
 *
 * High-performance implementation using WebAssembly with SIMD instructions.
 * Expected performance: 10x faster than pure JavaScript baseline.
 *
 * Requirements:
 * - Browser with WASM SIMD support (Chrome 91+, Firefox 89+, Safari 16.4+)
 * - Compiled WASM module in dist/wasm/
 */

export class MaxSimWasm {
  constructor(options = {}) {
    this.normalized = options.normalized ?? false;
    this.wasmInstance = null;
    this.isInitialized = false;
  }

  /**
   * Initialize WASM module
   * Must be called before using maxsim methods
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamic import of WASM module
      const wasmModule = await import('../../dist/wasm/maxsim_cpu_wasm.js');

      // Initialize WASM
      await wasmModule.default();

      // Create instance
      this.wasmInstance = new wasmModule.MaxSimWasm(this.normalized);
      this.isInitialized = true;

      console.log('✅ WASM MaxSim initialized:', this.wasmInstance.get_info());
    } catch (error) {
      console.error('❌ Failed to initialize WASM MaxSim:', error);
      throw new Error(`WASM initialization failed: ${error.message}`);
    }
  }

  /**
   * Compute MaxSim score between query and document
   * @param {number[][]|Float32Array[]} queryEmbedding - Query embeddings
   * @param {number[][]|Float32Array[]} docEmbedding - Document embeddings
   * @returns {number} MaxSim score
   */
  maxsim(queryEmbedding, docEmbedding) {
    if (!this.isInitialized) {
      throw new Error('WASM not initialized. Call init() first.');
    }

    if (!queryEmbedding || queryEmbedding.length === 0 ||
        !docEmbedding || docEmbedding.length === 0) {
      return 0;
    }

    const { queryFlat, queryTokens, embeddingDim } = this.flattenEmbedding(queryEmbedding);
    const { docFlat, docTokens } = this.flattenEmbedding(docEmbedding);

    return this.wasmInstance.maxsim_single(
      queryFlat,
      queryTokens,
      docFlat,
      docTokens,
      embeddingDim
    );
  }

  /**
   * Batch compute MaxSim scores for multiple documents
   * @param {number[][]|Float32Array[]} queryEmbedding - Query embeddings
   * @param {Array<number[][]|Float32Array[]>} docEmbeddings - Array of document embeddings
   * @returns {Float32Array} Array of MaxSim scores
   */
  maxsimBatch(queryEmbedding, docEmbeddings) {
    if (!this.isInitialized) {
      throw new Error('WASM not initialized. Call init() first.');
    }

    if (!queryEmbedding || queryEmbedding.length === 0 || docEmbeddings.length === 0) {
      return new Float32Array(docEmbeddings.length);
    }

    // Flatten query once
    const { queryFlat, queryTokens, embeddingDim } = this.flattenEmbedding(queryEmbedding);

    // Flatten all documents and track token counts
    const docTokenCounts = [];
    const allDocTokens = [];

    for (const doc of docEmbeddings) {
      docTokenCounts.push(doc.length);
      for (const token of doc) {
        // Ensure it's a regular array or typed array
        if (token instanceof Float32Array || token instanceof Array) {
          allDocTokens.push(...token);
        } else {
          allDocTokens.push(...Array.from(token));
        }
      }
    }

    const docFlat = new Float32Array(allDocTokens);
    const docTokens = new Uint32Array(docTokenCounts);

    // Call WASM batch function
    const scores = this.wasmInstance.maxsim_batch(
      queryFlat,
      queryTokens,
      docFlat,
      docTokens,
      embeddingDim
    );

    return new Float32Array(scores);
  }

  /**
   * Flatten embeddings for WASM
   * @private
   */
  flattenEmbedding(embedding) {
    const numTokens = embedding.length;
    const embeddingDim = embedding[0].length;
    const flat = new Float32Array(numTokens * embeddingDim);

    let offset = 0;
    for (const token of embedding) {
      if (token instanceof Float32Array) {
        flat.set(token, offset);
      } else {
        flat.set(new Float32Array(token), offset);
      }
      offset += embeddingDim;
    }

    return {
      queryFlat: flat,
      docFlat: flat,
      queryTokens: numTokens,
      docTokens: numTokens,
      embeddingDim: embeddingDim
    };
  }

  /**
   * Get implementation info
   * @returns {object} Implementation details
   */
  getInfo() {
    return {
      name: 'MaxSim WASM',
      version: '0.3.0',
      backend: 'wasm-simd',
      features: ['simd', 'normalized-mode', 'batch-processing'],
      normalized: this.normalized,
      initialized: this.isInitialized,
      wasmInfo: this.isInitialized ? this.wasmInstance.get_info() : 'Not initialized'
    };
  }

  /**
   * Static method to check if WASM SIMD is supported
   * @returns {Promise<boolean>}
   */
  static async isSupported() {
    try {
      // Check for basic WASM support
      if (typeof WebAssembly !== 'object') {
        return false;
      }

      // Check for SIMD support using a minimal SIMD module
      const simdTest = new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
        10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]);

      return WebAssembly.validate(simdTest);
    } catch {
      return false;
    }
  }
}
