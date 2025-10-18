/**
 * MaxSim WASM Implementation - Node.js Loader
 *
 * Node.js-specific WASM loader using fs.readFileSync instead of fetch()
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MaxSimWasm {
  constructor(options = {}) {
    this.normalized = options.normalized ?? false;
    this.wasmInstance = null;
    this.isInitialized = false;
  }

  /**
   * Initialize WASM module for Node.js
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Import the Node.js-targeted WASM module
      const wasmModule = await import('../../dist/wasm-node/maxsim_web_wasm.js');

      // Create instance (Node.js target doesn't need manual init)
      this.wasmInstance = new wasmModule.MaxSimWasm(this.normalized);
      this.isInitialized = true;

      console.log('✅ WASM MaxSim initialized (Node.js):', this.wasmInstance.get_info());
    } catch (error) {
      console.error('❌ Failed to initialize WASM MaxSim:', error);
      throw new Error(`WASM initialization failed: ${error.message}`);
    }
  }

  /**
   * Compute MaxSim score between query and document
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
   * Batch compute MaxSim scores
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

    // Flatten all documents
    const docTokenCounts = [];
    const allDocTokens = [];

    for (const doc of docEmbeddings) {
      docTokenCounts.push(doc.length);
      for (const token of doc) {
        if (token instanceof Float32Array || token instanceof Array) {
          allDocTokens.push(...token);
        } else {
          allDocTokens.push(...Array.from(token));
        }
      }
    }

    const docFlat = new Float32Array(allDocTokens);
    const docTokens = new Uint32Array(docTokenCounts);

    // Call WASM
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
   */
  getInfo() {
    return {
      name: 'MaxSim WASM (Node.js)',
      version: '0.3.0',
      backend: 'wasm-simd',
      features: ['simd', 'normalized-mode', 'batch-processing'],
      normalized: this.normalized,
      initialized: this.isInitialized,
      wasmInfo: this.isInitialized ? this.wasmInstance.get_info() : 'Not initialized'
    };
  }

  /**
   * Check if WASM SIMD is supported
   */
  static async isSupported() {
    try {
      if (typeof WebAssembly !== 'object') {
        return false;
      }

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
