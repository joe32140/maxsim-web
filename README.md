# maxsim-web

⚡ **High-performance JavaScript/WASM MaxSim for ColBERT and late-interaction retrieval**

WASM+SIMD implementation with adaptive batching for variable-length documents. 5x faster than pure JavaScript.

[**🚀 Live Demo**](https://joe32140.github.io/maxsim-web/benchmark/) • [API Guide](docs/API_GUIDE.md) • [Examples](examples/)

## Installation

```bash
npm install maxsim-web
```

## Quick Start

### Standard API (2D Arrays)

```javascript
import { MaxSim } from 'maxsim-web';

const maxsim = await MaxSim.create(); // Auto-selects best backend

// Single document
const score = maxsim.maxsim(queryEmbedding, docEmbedding);

// Batch processing
const scores = maxsim.maxsimBatch(queryEmbedding, [doc1, doc2, doc3]);
```

### Flat API (High Performance) 🚀

**For large batches (100+ docs) or when embeddings are already flat:**

```javascript
import { MaxSimWasm } from 'maxsim-web/wasm';

const maxsim = new MaxSimWasm();
await maxsim.init();

// Zero-copy batch processing - up to 16x faster!
const scores = maxsim.maxsimBatchFlat(
    queryFlat,                      // Float32Array
    queryTokens,                    // number
    docsFlat,                       // Float32Array (all docs concatenated)
    new Uint32Array(docTokenCounts), // tokens per doc
    embeddingDim                    // number
);
```

**Why use Flat API?**
- ✅ Eliminates conversion overhead (~260ms for 1000 docs)
- ✅ Direct WASM calls - no intermediate allocations
- ✅ Perfect for embeddings from transformers.js, ONNX, etc.

📖 **[Complete API Guide](docs/API_GUIDE.md)** | 💡 **[Performance Comparison](examples/api-comparison.js)**

## Performance

**Benchmark:** 100 docs, 128-256 tokens (variable length)

| Implementation | Time | Speedup vs Baseline |
|----------------|------|---------------------|
| **WASM+SIMD** | **11.8ms** | **5.2x faster** ⚡ |
| JS Baseline | 61.0ms | 1.0x (baseline) |
| JS Optimized | 61.8ms | ~1.0x (no improvement in browsers*) |

*JS Optimized shows 1.25x speedup in Node.js but not in browsers

### Why Flat API Matters

When processing **1000 documents**:
- **2D Array API:** ~320ms (61ms WASM + 260ms conversion overhead)
- **Flat API:** ~61ms (zero conversion)
- **Savings:** ~260ms (4.2x faster by avoiding conversions)

## API Reference

### Core Methods

```javascript
// Standard (2D arrays)
maxsim.maxsim(query, doc)                    // Single doc
maxsim.maxsimBatch(query, docs)              // Batch
maxsim.maxsim_normalized(query, doc)         // Normalized scores

// Flat API (Float32Array - faster)
maxsim.maxsimFlat(queryFlat, qTokens, docFlat, dTokens, dim)
maxsim.maxsimBatchFlat(queryFlat, qTokens, docsFlat, tokenCounts, dim)
maxsim.maxsimFlat_normalized(...)            // Normalized variant
```

### When to Use Each

| Your Data | API | Why |
|-----------|-----|-----|
| From transformers.js | **Flat API** | Already flat - zero overhead |
| 100+ documents | **Flat API** | Eliminates conversion time |
| 2D arrays | Standard API | Convenient |
| Small batches (<100) | Either | Similar performance |

## Key Features

- ⚡ **Adaptive batching** - Optimizes for variable-length documents
- 🎯 **Zero dependencies** - Lightweight installation
- 🌐 **Universal** - Browser + Node.js
- 📦 **Progressive** - Auto-selects fastest backend
- 🔧 **TypeScript** - Full type definitions

## Use Cases

- 🌐 **Browser search** - Client-side semantic retrieval
- 🔌 **Extensions** - Real-time document similarity
- ⚡ **Node.js APIs** - Fast similarity endpoints
- 📱 **PWAs** - Offline-capable search

## Important Notes

**⚠️ Normalized embeddings required:** All methods expect L2-normalized embeddings. Modern models (ColBERT, BGE, E5) output normalized embeddings by default.

**Two scoring variants:**
- `maxsim()` - Official ColBERT (raw sum) - for ranking within single query
- `maxsim_normalized()` - Averaged scores - for cross-query comparison

Both produce identical rankings within a query, only absolute values differ.

## Documentation

- 📖 **[Complete API Guide](docs/API_GUIDE.md)** - Detailed usage, migration guide
- 💡 **[API Comparison Example](examples/api-comparison.js)** - Performance demo
- 📊 **[Benchmark Results](BENCHMARKS.md)** - Detailed performance measurements
- 🎯 **[Performance Analysis](PERFORMANCE_ISSUE.md)** - Optimization deep-dive
- 🧪 **[Interactive Benchmarks](benchmark/)** - Run benchmarks in your browser

## Related

- [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu) - Original C++/Python implementation
- [ColBERT](https://github.com/stanford-futuredata/ColBERT) - Late interaction retrieval
- [sentence-transformers](https://github.com/UKPLab/sentence-transformers) - Embedding models

## License

MIT

---

**Quick tip:** Use Flat API to avoid conversion overhead (4x faster for large batches) and WASM+SIMD for computation (5x faster than JS). Combined effect for 1000 docs: ~5x total speedup!
