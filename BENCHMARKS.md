# MaxSim CPU Benchmark Results

## Phase 1: Baseline & Pre-Normalization Optimization

**Date:** 2025-10-17
**Platform:** Node.js v22.16.0 on Linux (WSL2)
**Scenario:** Realistic (100 docs × 2000 tokens × 128 dims, 32 query tokens)

### Results Summary

| Implementation | Mean (ms) | Median (ms) | P95 (ms) | Throughput (docs/s) | Speedup |
|---------------|-----------|-------------|----------|---------------------|---------|
| JS Baseline | 519.84 | 519.73 | 530.98 | 192.4 | 1.00x |
| JS Optimized (normalized) | 442.22 | 441.72 | 454.51 | 226.1 | **1.18x** |

### Key Insights

1. **Pre-Normalization Optimization**: By using pre-normalized embeddings and replacing cosine similarity with dot product, we achieved a **1.18x speedup** (~18% improvement).

2. **Expected vs Actual**: We expected ~2x speedup from this optimization, but got 1.18x. This is because:
   - V8's JIT compiler already optimizes the magnitude calculations
   - The dominant cost is the nested loop structure, not the similarity computation
   - We need SIMD and typed arrays for bigger gains

3. **Throughput**: 226 docs/sec means processing 100 documents takes ~442ms on realistic workloads (2000 tokens per doc).

### Total Operations

- **Per Query-Doc Pair**: 32 query tokens × 2000 doc tokens × 128 dims = 8,192,000 operations
- **Per Batch (100 docs)**: 819,200,000 operations
- **Operations/sec (Optimized)**: ~1.85 billion operations/sec

### Next Optimizations

1. **Typed Arrays (Float32Array)**: Expected +30% improvement
   - Replace regular arrays with Float32Arrays
   - Manual loop unrolling for V8 optimization
   - Target: ~295 docs/sec

2. **WASM + SIMD**: Expected +10x improvement
   - Rust implementation with WebAssembly SIMD
   - Platform-specific optimizations
   - Target: ~2,000+ docs/sec

3. **Web Workers**: Expected +3-4x improvement (on top of WASM)
   - Parallel processing across CPU cores
   - Target: ~8,000+ docs/sec

### Benchmark Details

```
Scenario: realistic (32 query tokens × 2000 doc tokens × 100 docs, dim=128)
Warmup iterations: 10
Benchmark iterations: 100
```

**JS Baseline Stats:**
- Min: 506.42 ms
- Max: 537.21 ms
- StdDev: 6.12 ms

**JS Optimized Stats:**
- Min: 431.18 ms
- Max: 467.93 ms
- StdDev: 5.84 ms

### Code Changes

**Optimization**: Pre-normalized embeddings
- Changed: `cosineSimilarity()` → `dotProduct()` when `normalized: true`
- LOC: ~15 lines added
- Test coverage: 100% (17/17 tests passing)

### Usage Recommendation

For ColBERT and late-interaction models:
- **Always pre-normalize embeddings** during generation
- Use `MaxSim.normalize()` utility if embeddings aren't pre-normalized
- Set `normalized: true` when creating the MaxSim instance

```javascript
// Generate and normalize embeddings once
const queryEmbedding = MaxSim.normalize(rawQueryEmbedding);
const docEmbedding = MaxSim.normalize(rawDocEmbedding);

// Use optimized instance
const maxsim = await MaxSim.create({ normalized: true });
const score = maxsim.maxsim(queryEmbedding, docEmbedding);
```

---

## Comparison to Other Implementations

### vs mixedbread-ai/maxsim-cpu (Rust + Python bindings)

Our current JS implementation is a baseline for pure JavaScript/browser environments.

**mixedbread-ai benchmarks** (from their README):
- 5x speedup on Linux CPUs (with SIMD)
- 2-3x speedup on ARM Macs (Apple Accelerate)

**Our roadmap targets**:
- Phase 2 (Typed Arrays): 1.5x vs baseline
- Phase 3 (WASM + SIMD): 10x vs baseline (~50% of their performance)
- Phase 4 (Web Workers): 30-40x vs baseline (**competitive**)

The key advantage of our approach:
- **Zero native dependencies** (pure JS/WASM)
- **Works in browsers** (Chrome Extension, Web Apps)
- **Cross-platform** (Node.js, Deno, browsers)

---

## Test Coverage

All 17 tests passing:
- ✅ Baseline implementation (6 tests)
- ✅ Optimized implementation (6 tests)
- ✅ Implementation consistency (2 tests)
- ✅ Edge cases (3 tests)
