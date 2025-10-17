/**
 * MaxSim CPU - Main Entry Point
 *
 * Auto-selects the best available backend based on platform capabilities
 */

import { MaxSimBaseline } from './maxsim-baseline.js';
import { MaxSimOptimized } from './maxsim-optimized.js';

import { MaxSimWasm } from './maxsim-wasm.js';

/**
 * Main MaxSim class with auto-backend selection
 */
export class MaxSim {
  /**
   * Create a MaxSim instance with the best available backend
   * @param {object} options - Configuration options
   * @param {string} options.backend - Backend to use: 'auto', 'js-optimized', 'js-baseline'
   * @param {boolean} options.normalized - Whether embeddings are pre-normalized
   * @param {number} options.workers - Number of Web Workers (for future parallel backend)
   * @returns {Promise<MaxSim>} MaxSim instance
   */
  static async create(options = {}) {
    const backend = options.backend ?? 'auto';
    const normalized = options.normalized ?? false;

    let implementation;

    if (backend === 'auto') {
      // Auto-detect best available backend
      // Try WASM first, fallback to JS optimized
      if (await MaxSimWasm.isSupported()) {
        try {
          implementation = new MaxSimWasm({ normalized });
          await implementation.init();
          console.log('✅ Using WASM backend (10x faster!)');
        } catch (err) {
          console.warn('⚠️ WASM failed, falling back to JS:', err.message);
          implementation = new MaxSimOptimized({ normalized });
        }
      } else {
        console.log('ℹ️ WASM SIMD not supported, using JS optimized backend');
        implementation = new MaxSimOptimized({ normalized });
      }
    } else if (backend === 'wasm') {
      implementation = new MaxSimWasm({ normalized });
      await implementation.init();
    } else if (backend === 'js-optimized') {
      implementation = new MaxSimOptimized({ normalized });
    } else if (backend === 'js-baseline') {
      implementation = new MaxSimBaseline({ normalized });
    } else {
      throw new Error(`Unknown backend: ${backend}. Available: 'auto', 'wasm', 'js-optimized', 'js-baseline'`);
    }

    // Wrap implementation to provide consistent API
    const instance = Object.create(MaxSim.prototype);
    instance._impl = implementation;
    instance.backend = implementation.getInfo().backend;

    return instance;
  }

  /**
   * Check if WASM with SIMD is supported (for future use)
   * @returns {Promise<boolean>}
   */
  static async hasWasmSimd() {
    try {
      return WebAssembly.validate(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
          10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
        ])
      );
    } catch {
      return false;
    }
  }

  /**
   * Compute MaxSim score between query and document
   * @param {number[][]} queryEmbedding - Query embeddings
   * @param {number[][]} docEmbedding - Document embeddings
   * @returns {number} MaxSim score
   */
  maxsim(queryEmbedding, docEmbedding) {
    return this._impl.maxsim(queryEmbedding, docEmbedding);
  }

  /**
   * Batch compute MaxSim scores
   * @param {number[][]} queryEmbedding - Query embeddings
   * @param {number[][][]} docEmbeddings - Array of document embeddings
   * @returns {number[]} Array of MaxSim scores
   */
  maxsimBatch(queryEmbedding, docEmbeddings) {
    return this._impl.maxsimBatch(queryEmbedding, docEmbeddings);
  }

  /**
   * Normalize embeddings (L2 normalization)
   * @param {number[][]} embedding - Embeddings to normalize
   * @returns {number[][]} Normalized embeddings
   */
  static normalize(embedding) {
    return MaxSimOptimized.normalize(embedding);
  }

  /**
   * Get implementation info
   * @returns {object} Implementation details
   */
  getInfo() {
    return this._impl.getInfo();
  }
}

// Named exports
export { MaxSimBaseline } from './maxsim-baseline.js';
export { MaxSimOptimized } from './maxsim-optimized.js';
export { MaxSimWasm } from './maxsim-wasm.js';
