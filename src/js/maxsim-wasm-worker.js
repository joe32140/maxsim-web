/**
 * MaxSim WASM Web Worker
 * 
 * Runs WASM computation in a separate thread to avoid blocking main thread
 * and potentially achieve better CPU utilization
 */

import { MaxSimWasm } from './maxsim-wasm.js';

let wasmInstance = null;

self.onmessage = async function(e) {
  const { id, type, data } = e.data;

  try {
    switch (type) {
      case 'init':
        wasmInstance = new MaxSimWasm({ normalized: data.normalized });
        await wasmInstance.init();
        self.postMessage({ id, type: 'init', success: true });
        break;

      case 'maxsim_batch':
        if (!wasmInstance) {
          throw new Error('WASM not initialized');
        }
        
        const { query, documents } = data;
        const scores = wasmInstance.maxsimBatchZeroAlloc ? 
          wasmInstance.maxsimBatchZeroAlloc(query, documents) :
          wasmInstance.maxsimBatch(query, documents);
        
        self.postMessage({ 
          id, 
          type: 'maxsim_batch', 
          success: true, 
          scores: Array.from(scores) // Convert to regular array for transfer
        });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
      id, 
      type, 
      success: false, 
      error: error.message 
    });
  }
};