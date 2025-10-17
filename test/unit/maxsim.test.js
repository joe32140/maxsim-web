/**
 * Unit Tests for MaxSim implementations
 */

import { MaxSimBaseline } from '../../src/js/maxsim-baseline.js';
import { MaxSimOptimized } from '../../src/js/maxsim-optimized.js';
import { MaxSimTyped } from '../../src/js/maxsim-typed.js';

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
    { name: 'Optimized', Class: MaxSimOptimized },
    { name: 'Typed', Class: MaxSimTyped }
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

    test('typed arrays should produce same results as baseline', () => {
      const baseline = new MaxSimBaseline({ normalized: true });
      const typed = new MaxSimTyped({ normalized: true });

      const score1 = baseline.maxsim(queryEmbedding, docEmbedding);
      const score2 = typed.maxsim(queryEmbedding, docEmbedding);

      expect(score1).toBeCloseTo(score2, 5);
    });

    test('typed arrays should work with Float32Array inputs', () => {
      const typed = new MaxSimTyped({ normalized: true });

      // Convert to typed arrays
      const queryTyped = MaxSimTyped.toTypedArray(queryEmbedding);
      const docTyped = MaxSimTyped.toTypedArray(docEmbedding);

      const score = typed.maxsim(queryTyped, docTyped);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
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
});
