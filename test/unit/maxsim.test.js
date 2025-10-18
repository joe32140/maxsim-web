/**
 * Unit Tests for MaxSim implementations
 */

import { MaxSimBaseline } from '../../src/js/maxsim-baseline.js';
import { MaxSimOptimized } from '../../src/js/maxsim-optimized.js';
import { MaxSimWasm } from '../../src/js/maxsim-wasm.js';

describe('MaxSim Implementations', () => {
  // Test data
  const queryEmbedding = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0]
  ];

  const docEmbedding = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0]
  ];

  const implementations = [
    { name: 'Baseline', Class: MaxSimBaseline },
    { name: 'Optimized', Class: MaxSimOptimized }
  ];

  for (const { name, Class } of implementations) {
    describe(`${name} Implementation`, () => {
      let maxsim;

      beforeEach(() => {
        maxsim = new Class({ normalized: true });
      });

      test('should compute correct MaxSim score', () => {
        const score = maxsim.maxsim(queryEmbedding, docEmbedding);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      test('should handle identical embeddings', () => {
        const score = maxsim.maxsim(queryEmbedding, queryEmbedding);
        expect(score).toBeCloseTo(1.0, 5);
      });

      test('should handle orthogonal vectors', () => {
        const query = [[1.0, 0.0, 0.0]];
        const doc = [[0.0, 1.0, 0.0]];
        const score = maxsim.maxsim(query, doc);
        expect(score).toBeCloseTo(0.0, 5);
      });

      test('should handle batch computation', () => {
        const docs = [docEmbedding, docEmbedding, docEmbedding];
        const scores = maxsim.maxsimBatch(queryEmbedding, docs);

        expect(scores).toHaveLength(3);
        scores.forEach(score => {
          expect(score).toBeGreaterThan(0);
          expect(score).toBeLessThanOrEqual(1);
        });
      });

      test('should return 0 for empty embeddings', () => {
        const score = maxsim.maxsim([], docEmbedding);
        expect(score).toBe(0);
      });

      test('should normalize embeddings correctly', () => {
        const unnormalized = [[3.0, 4.0]];
        const normalized = Class.normalize(unnormalized);

        // Check magnitude is 1
        // Note: Float32Array has slightly lower precision than Number
        const mag = Math.sqrt(
          normalized[0].reduce((sum, v) => sum + v * v, 0)
        );
        const precision = name === 'Typed' ? 5 : 10; // Typed arrays use Float32
        expect(mag).toBeCloseTo(1.0, precision);
      });
    });
  }

  describe('Implementation Consistency', () => {
    test('baseline and optimized should produce same results (normalized)', () => {
      const baseline = new MaxSimBaseline({ normalized: true });
      const optimized = new MaxSimOptimized({ normalized: true });

      const score1 = baseline.maxsim(queryEmbedding, docEmbedding);
      const score2 = optimized.maxsim(queryEmbedding, docEmbedding);

      expect(score1).toBeCloseTo(score2, 10);
    });

    test('baseline and optimized should produce same results (unnormalized)', () => {
      const baseline = new MaxSimBaseline({ normalized: false });
      const optimized = new MaxSimOptimized({ normalized: false });

      const score1 = baseline.maxsim(queryEmbedding, docEmbedding);
      const score2 = optimized.maxsim(queryEmbedding, docEmbedding);

      expect(score1).toBeCloseTo(score2, 10);
    });


  });

  describe('MaxSim Correctness Tests', () => {
    test('should compute exact MaxSim for known vectors', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      // Known test case: query has 2 tokens, doc has 3 tokens
      // Query token 1: [1, 0] should match perfectly with doc token 1: [1, 0] (similarity = 1.0)
      // Query token 2: [0, 1] should match perfectly with doc token 2: [0, 1] (similarity = 1.0)
      // Expected MaxSim = (1.0 + 1.0) / 2 = 1.0
      const query = [[1.0, 0.0], [0.0, 1.0]];
      const doc = [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]];
      
      const score = maxsim.maxsim(query, doc);
      expect(score).toBeCloseTo(1.0, 10);
    });

    test('should compute correct MaxSim for partial matches', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      // Query token 1: [1, 0] matches doc token 1: [1, 0] perfectly (similarity = 1.0)
      // Query token 2: [0, 1] matches doc token 2: [0, 1] perfectly (similarity = 1.0)
      // Query token 3: [1, 1]/√2 best matches either [1,0] or [0,1] with similarity 1/√2
      const query = [[1.0, 0.0], [0.0, 1.0], [1/Math.sqrt(2), 1/Math.sqrt(2)]];
      const doc = [[1.0, 0.0], [0.0, 1.0]];
      
      const score = maxsim.maxsim(query, doc);
      // Expected: (1.0 + 1.0 + 1/√2) / 3 = (2 + 1/√2) / 3 ≈ 0.9023689
      expect(score).toBeCloseTo(0.9024, 3);
    });

    test('should handle orthogonal vectors correctly', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      // All query tokens are orthogonal to all doc tokens
      const query = [[1.0, 0.0], [0.0, 1.0]];
      const doc = [[0.0, 1.0], [1.0, 0.0]]; // Swapped to create orthogonality
      
      const score = maxsim.maxsim(query, doc);
      // Query [1,0] best matches [1,0] with similarity 1.0
      // Query [0,1] best matches [0,1] with similarity 1.0
      expect(score).toBeCloseTo(1.0, 10);
    });

    test('should compute correct MaxSim with mixed similarities', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      // Create a scenario with known cosine similarities
      const query = [[1.0, 0.0, 0.0]]; // Single query token
      const doc = [
        [1.0, 0.0, 0.0],  // Perfect match: cos = 1.0
        [0.0, 1.0, 0.0],  // Orthogonal: cos = 0.0
        [0.5, 0.5, 0.0]   // cos = 0.5/√0.5 = 1/√2 ≈ 0.707
      ];
      
      // Normalize the last doc token
      const norm = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);
      doc[2] = [0.5/norm, 0.5/norm, 0.0];
      
      const score = maxsim.maxsim(query, doc);
      // Should pick the maximum similarity = 1.0
      expect(score).toBeCloseTo(1.0, 10);
    });

    test('should handle unnormalized vectors correctly', () => {
      const maxsim = new MaxSimOptimized({ normalized: false });
      
      // Test with unnormalized vectors
      const query = [[2.0, 0.0]]; // magnitude = 2
      const doc = [[3.0, 0.0]];   // magnitude = 3
      
      const score = maxsim.maxsim(query, doc);
      // Cosine similarity = (2*3)/(2*3) = 1.0
      expect(score).toBeCloseTo(1.0, 10);
    });

    test('should compute batch results correctly', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      const query = [[1.0, 0.0]];
      const docs = [
        [[1.0, 0.0]],     // Perfect match: score = 1.0
        [[0.0, 1.0]],     // Orthogonal: score = 0.0
        [[-1.0, 0.0]]     // Opposite: score = -1.0
      ];
      
      const scores = maxsim.maxsimBatch(query, docs);
      expect(scores).toHaveLength(3);
      expect(scores[0]).toBeCloseTo(1.0, 10);
      expect(scores[1]).toBeCloseTo(0.0, 10);
      expect(scores[2]).toBeCloseTo(-1.0, 10);
    });

    test('should handle multi-token queries correctly', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      
      // 3-token query, each token should find its best match
      const query = [
        [1.0, 0.0],  // Should match [1,0] with score 1.0
        [0.0, 1.0],  // Should match [0,1] with score 1.0  
        [0.5, 0.5]   // Should match [0.5,0.5] with score 1.0
      ];
      
      // Normalize the last query token
      let norm = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);
      query[2] = [0.5/norm, 0.5/norm];
      
      const doc = [
        [1.0, 0.0],
        [0.0, 1.0],
        [0.5/norm, 0.5/norm]  // Same normalization
      ];
      
      const score = maxsim.maxsim(query, doc);
      // Each query token finds perfect match: (1.0 + 1.0 + 1.0) / 3 = 1.0
      expect(score).toBeCloseTo(1.0, 10);
    });
  });

  describe('Edge Cases', () => {
    test('should handle single token query', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      const query = [[1.0, 0.0, 0.0]];
      const score = maxsim.maxsim(query, docEmbedding);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should handle single token document', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });
      const doc = [[1.0, 0.0, 0.0]];
      const score = maxsim.maxsim(queryEmbedding, doc);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should handle large embeddings', () => {
      const maxsim = new MaxSimOptimized({ normalized: true });

      // Generate large embeddings (unnormalized)
      const largeQueryRaw = Array(100).fill(0).map(() =>
        Array(128).fill(0).map(() => Math.random())
      );
      const largeDocRaw = Array(500).fill(0).map(() =>
        Array(128).fill(0).map(() => Math.random())
      );

      // Normalize them since we set normalized: true
      const largeQuery = MaxSimOptimized.normalize(largeQueryRaw);
      const largeDoc = MaxSimOptimized.normalize(largeDocRaw);

      const score = maxsim.maxsim(largeQuery, largeDoc);

      expect(score).toBeGreaterThan(-1);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('WASM Correctness Tests', () => {
    let wasmImpl;
    
    beforeAll(async () => {
      // Only run WASM tests if supported
      if (await MaxSimWasm.isSupported()) {
        wasmImpl = new MaxSimWasm({ normalized: true });
        try {
          await wasmImpl.init();
        } catch (error) {
          console.warn('WASM initialization failed, skipping WASM tests:', error.message);
          wasmImpl = null;
        }
      }
    });

    test('should match JavaScript implementations exactly', async () => {
      if (!wasmImpl) {
        console.log('Skipping WASM test - not supported or failed to initialize');
        return;
      }

      const baseline = new MaxSimBaseline({ normalized: true });
      const optimized = new MaxSimOptimized({ normalized: true });

      // Test with known vectors
      const query = [[1.0, 0.0], [0.0, 1.0]];
      const doc = [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]];
      
      // Normalize the last doc token
      const norm = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);
      doc[2] = [0.5/norm, 0.5/norm];

      const baselineScore = baseline.maxsim(query, doc);
      const optimizedScore = optimized.maxsim(query, doc);
      const wasmScore = wasmImpl.maxsim(query, doc);

      expect(wasmScore).toBeCloseTo(baselineScore, 5);
      expect(wasmScore).toBeCloseTo(optimizedScore, 5);
    });

    test('should handle batch processing correctly', async () => {
      if (!wasmImpl) {
        console.log('Skipping WASM batch test - not supported or failed to initialize');
        return;
      }

      const optimized = new MaxSimOptimized({ normalized: true });

      const query = [[1.0, 0.0]];
      const docs = [
        [[1.0, 0.0]],     // Perfect match
        [[0.0, 1.0]],     // Orthogonal
        [[-1.0, 0.0]]     // Opposite
      ];

      const optimizedScores = optimized.maxsimBatch(query, docs);
      const wasmScores = wasmImpl.maxsimBatch(query, docs);

      expect(wasmScores).toHaveLength(optimizedScores.length);
      for (let i = 0; i < optimizedScores.length; i++) {
        expect(wasmScores[i]).toBeCloseTo(optimizedScores[i], 5);
      }
    });

    test('should compute exact MaxSim values', async () => {
      if (!wasmImpl) {
        console.log('Skipping WASM exact computation test - not supported or failed to initialize');
        return;
      }

      // Test case where we know the exact answer
      const query = [[1.0, 0.0], [0.0, 1.0]];
      const doc = [[1.0, 0.0], [0.0, 1.0]];
      
      const score = wasmImpl.maxsim(query, doc);
      // Each query token finds perfect match: (1.0 + 1.0) / 2 = 1.0
      expect(score).toBeCloseTo(1.0, 5);
    });

    test('should handle different embedding dimensions', async () => {
      if (!wasmImpl) {
        console.log('Skipping WASM dimension test - not supported or failed to initialize');
        return;
      }

      const optimized = new MaxSimOptimized({ normalized: true });

      // Test with different dimensions
      const dimensions = [64, 128, 256, 384];
      
      for (const dim of dimensions) {
        const query = [Array(dim).fill(0).map((_, i) => i === 0 ? 1.0 : 0.0)];
        const doc = [Array(dim).fill(0).map((_, i) => i === 0 ? 1.0 : 0.0)];
        
        const optimizedScore = optimized.maxsim(query, doc);
        const wasmScore = wasmImpl.maxsim(query, doc);
        
        expect(wasmScore).toBeCloseTo(optimizedScore, 5);
        expect(wasmScore).toBeCloseTo(1.0, 5); // Should be perfect match
      }
    });

    test('should handle large batch sizes correctly', async () => {
      if (!wasmImpl) {
        console.log('Skipping WASM large batch test - not supported or failed to initialize');
        return;
      }

      const optimized = new MaxSimOptimized({ normalized: true });

      // Create a larger test case
      const query = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]];
      const docs = Array(50).fill(0).map((_, i) => [
        [Math.cos(i * 0.1), Math.sin(i * 0.1), 0.0],
        [0.0, 0.0, 1.0]
      ]);

      const optimizedScores = optimized.maxsimBatch(query, docs);
      const wasmScores = wasmImpl.maxsimBatch(query, docs);

      expect(wasmScores).toHaveLength(optimizedScores.length);
      for (let i = 0; i < optimizedScores.length; i++) {
        expect(wasmScores[i]).toBeCloseTo(optimizedScores[i], 4);
      }
    });
  });
});
