# maxsim-web

⚡ **JavaScript/WASM MaxSim implementation for ColBERT and late-interaction retrieval**

High-performance MaxSim computation optimized for JavaScript environments with progressive enhancement from pure JS to WASM+SIMD. The JavaScript counterpart to [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu).

## Installation

```bash
npm install maxsim-web
```

## Quick Start

```javascript
import { MaxSim } from 'maxsim-web';

// Auto-selects best backend (WASM → JS optimized → baseline)
const maxsim = await MaxSim.create();

// IMPORTANT: All methods expect L2-normalized embeddings
// Most modern models (ColBERT, BGE, E5) output normalized embeddings by default

// Official MaxSim (raw sum) - matches ColBERT, pylate-rs, mixedbread-ai
const score = maxsim.maxsim(queryEmbedding, docEmbedding);

// Normalized MaxSim (averaged) - for cross-query comparison
const normalizedScore = maxsim.maxsim_normalized(queryEmbedding, docEmbedding);

// Batch scoring (optimized)
const scores = maxsim.maxsimBatch(queryEmbedding, [doc1, doc2, doc3]);
const normalizedScores = maxsim.maxsimBatch_normalized(queryEmbedding, [doc1, doc2, doc3]);
```

## Use Cases

**Perfect for:**
- 🌐 **Browser-based search** - Client-side semantic search
- 🔌 **Chrome extensions** - Real-time document similarity
- ⚡ **Node.js APIs** - Fast similarity scoring endpoints  
- 📱 **Progressive web apps** - Offline-capable search
- 🎯 **Prototyping** - Quick ColBERT integration testing

## 🚀 Live Demo

**[Try the interactive benchmark →](https://joe32140.github.io/maxsim-web/benchmark/)**

Test all implementations in your browser with real-time performance comparison, multiple scenarios, and realistic embedding generation.

## Performance

Progressive enhancement automatically selects the fastest available backend:

| Backend | Speed | Compatibility | JIT Optimizations |
|---------|-------|---------------|-------------------|
| WASM+SIMD | ~11x faster* | Modern browsers | Native SIMD |
| JS Optimized | ~1.25x faster** | All environments | Loop unrolling, JIT warmup |
| JS Baseline | 1x | Universal | None |

*Actual performance: 21,218 docs/s vs 1,871 docs/s baseline (11.3x speedup)
**Performance varies by environment: 1.25x speedup in Node.js, minimal improvement in browsers due to different JIT strategies

## API

### `MaxSim.create(options)`
Creates a MaxSim instance with automatic backend selection.

- `backend`: `'auto'` \| `'wasm'` \| `'js-optimized'` \| `'js-baseline'` (default: `'auto'`)

### Two MaxSim Variants

**⚠️ IMPORTANT**: Both methods expect **L2-normalized embeddings** as input. Modern embedding models (ColBERT, BGE, E5, etc.) output normalized embeddings by default. For normalized embeddings, dot product equals cosine similarity.

#### `maxsim.maxsim(query, doc)` - Official MaxSim
**Formula:** `Σ max(qi · dj)` (raw sum)

Matches the standard implementation used in:
- ColBERT paper (2020)
- pylate-rs (LightOn AI)
- maxsim-cpu (mixedbread-ai)

**Use when:**
- You want to match the official ColBERT implementation
- Ranking documents within a single query
- Comparing to academic baselines

**Returns:** Raw sum of maximum dot products (can be > 1)

#### `maxsim.maxsim_normalized(query, doc)` - Normalized MaxSim
**Formula:** `Σ max(qi · dj) / |query_tokens|` (averaged)

Normalized variant for practical applications.

**Use when:**
- Comparing scores across different queries
- Need bounded scores for threshold-based filtering
- Cross-query result comparison

**Returns:** Averaged score (typically between -1 and 1)

**Note:** Both variants produce identical rankings within a single query. Normalization only affects the absolute score values.

### Batch Processing

#### `maxsim.maxsimBatch(query, docs)` - Official batch
Batch compute official MaxSim scores (optimized for multiple documents).

#### `maxsim.maxsimBatch_normalized(query, docs)` - Normalized batch
Batch compute normalized MaxSim scores.

### Utility Methods

#### `MaxSim.normalize(embedding)`
L2 normalize embeddings. Most modern embedding models output normalized embeddings by default, so you typically don't need this. Use only if your embeddings are not already normalized.

## Why maxsim-web?

**JavaScript/WASM-optimized** implementation of MaxSim computation, complementing the original [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu):

| Feature | maxsim-cpu (Original) | maxsim-web (This) |
|---------|----------------------|---------------------|
| **Target** | General CPU (C++/Python) | JavaScript/WASM |
| **Environment** | Server-side | Browser + Node.js |
| **Performance** | Native CPU optimization | WASM+SIMD (11x faster) |
| **Use Case** | Production backends | Web apps, extensions |
| **Dependencies** | System libraries | Zero dependencies |

## Features

- **Zero dependencies** - Lightweight and fast to install
- **Universal compatibility** - Browser and Node.js
- **Progressive enhancement** - Automatically uses fastest available backend
- **JIT-optimized JavaScript** - 4-factor loop unrolling + compiler warmup
- **TypeScript support** - Full type definitions included
- **Web-optimized** - Built specifically for JavaScript environments

## JIT Optimizations

The JS Optimized backend includes several performance enhancements:

- **4-factor loop unrolling**: Process 4 multiplications per iteration instead of 1
- **JIT compiler warmup**: Pre-optimize hot code paths during initialization  
- **Type consistency**: Optimized for Float32Array inputs
- **Pattern matching**: Follows proven fast-dotproduct optimization techniques
- **Reduced overhead**: 75% fewer loop iterations in dot product computation

These optimizations are inspired by the [fast-dotproduct](https://github.com/kyr0/fast-dotproduct) library and deliver **25% performance improvements in Node.js**, though results vary significantly between JavaScript runtimes.

**Performance by Environment:**
- **Node.js**: 1.25x speedup (25% improvement) - JIT optimizations work well
- **Browsers**: Minimal improvement (~1.0x) - Browser JIT strategies differ from Node.js
- **Best performance**: Use WASM+SIMD in browsers for maximum speed gains

**When JIT optimizations are most effective:**
- Node.js environments (server-side processing)
- Large embedding dimensions (256+ dimensions)  
- High-frequency operations (batch processing)
- Longer-running applications (JIT warmup benefits)

## When to Use

**Use maxsim-web when:**
- Building web applications or browser extensions
- Need client-side MaxSim computation
- Want zero-dependency JavaScript solution
- Targeting Node.js environments
- Building real-time search interfaces

**Use [maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu) when:**
- Building production backends
- Need maximum CPU performance
- Have access to native libraries
- Running on dedicated servers

## Related Projects

- **[mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu)** - Original high-performance CPU implementation
- **[ColBERT](https://github.com/stanford-futuredata/ColBERT)** - Late interaction retrieval model
- **[sentence-transformers](https://github.com/UKPLab/sentence-transformers)** - Sentence embedding models

## Benchmark Results

### Test Environment
- **CPU:** Intel Core i9-13900K (16 cores, 32 threads)
- **Architecture:** x86_64 with AVX2, SIMD support
- **Browser:** Modern browser with WASM+SIMD support

### Performance Summary

**Large Scenario** - 100 docs × 512 tokens each (419,430,400 total operations)

| Implementation | Mean (ms) | Median (ms) | P95 (ms) | Throughput (docs/s) | Speedup | Optimizations |
|----------------|-----------|-------------|----------|---------------------|---------|---------------|
| JS Baseline    | 209.67    | 209.35      | 214.60   | 477                 | 1.00x   | None |
| JS Optimized (JIT) | ~180-190* | ~180-185* | ~195*    | ~520-550*          | **1.1-1.5x*** | Loop unrolling + JIT warmup |
| **WASM+SIMD**  | **16.08** | **15.65**   | **21.10**| **6,220**           | **13.04x** | Native SIMD |

*Realistic performance estimates with JIT optimizations - run `npm run benchmark` for actual results on your system

### Key Insights

- **WASM+SIMD delivers 13x speedup** over baseline JavaScript
- **6,220 docs/s throughput** - suitable for real-time applications
- **Consistent performance** with low P95 latency (21ms)
- **Progressive enhancement** automatically selects fastest backend

### Running Benchmarks

#### Interactive Browser Benchmark
```bash
npm run benchmark:browser
# Open http://localhost:8080/
```
Test all implementations with real-time performance comparison and multiple scenarios.

#### Node.js Benchmark
```bash
npm run benchmark small
```
**Note:** WASM only works in browsers. Node.js benchmarks test JavaScript implementations only.

See [benchmark/README.md](benchmark/README.md) for detailed methodology and additional scenarios.

## License

MIT - Inspired by [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu)
