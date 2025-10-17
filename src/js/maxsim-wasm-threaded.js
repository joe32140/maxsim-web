/**
 * MaxSim WASM with Web Worker Threading
 * 
 * Uses Web Workers to potentially achieve better CPU utilization
 * by running WASM computation off the main thread
 */

export class MaxSimWasmThreaded {
  constructor(options = {}) {
    this.normalized = options.normalized ?? false;
    this.worker = null;
    this.isInitialized = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  async init() {
    if (this.isInitialized) {
      return;
    }

    // Create worker
    this.worker = new Worker(new URL('./maxsim-wasm-worker.js', import.meta.url), {
      type: 'module'
    });

    // Set up message handling
    this.worker.onmessage = (e) => {
      const { id, success, error, ...data } = e.data;
      const { resolve, reject } = this.pendingMessages.get(id) || {};
      
      if (resolve) {
        this.pendingMessages.delete(id);
        if (success) {
          resolve(data);
        } else {
          reject(new Error(error));
        }
      }
    };

    // Initialize WASM in worker
    await this.sendMessage('init', { normalized: this.normalized });
    this.isInitialized = true;
    
    console.log('✅ WASM MaxSim initialized in Web Worker');
  }

  async sendMessage(type, data) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingMessages.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, data });
    });
  }

  async maxsimBatch(queryEmbedding, docEmbeddings) {
    if (!this.isInitialized) {
      throw new Error('WASM not initialized. Call init() first.');
    }

    const result = await this.sendMessage('maxsim_batch', {
      query: queryEmbedding,
      documents: docEmbeddings
    });

    return new Float32Array(result.scores);
  }

  // Alias for compatibility
  maxsimBatchZeroAlloc(queryEmbedding, docEmbeddings) {
    return this.maxsimBatch(queryEmbedding, docEmbeddings);
  }

  getInfo() {
    return {
      name: 'MaxSim WASM Threaded',
      version: '0.3.0',
      backend: 'wasm-simd-worker',
      features: ['simd', 'normalized-mode', 'batch-processing', 'web-workers'],
      normalized: this.normalized,
      initialized: this.isInitialized
    };
  }

  static async isSupported() {
    try {
      // Check for Web Worker support
      if (typeof Worker === 'undefined') {
        return false;
      }
      
      // Check for WASM SIMD support
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