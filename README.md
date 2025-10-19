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

| Backend | Speed | Compatibility |
|---------|-------|---------------|
| WASM+SIMD | ~11x faster* | Modern browsers |
| JS Optimized | ~1.4x faster | All environments |
| JS Baseline | 1x | Universal |

*Actual performance: 21,218 docs/s vs 1,871 docs/s baseline (11.3x speedup)

## API

### `MaxSim.create(options)`
Creates a MaxSim instance with automatic backend selection.

- `backend`: `'auto'` \| `'wasm'` \| `'js-optimized'` \| `'js-baseline'` (default: `'auto'`)

### Two MaxSim Variants

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

**Returns:** Raw sum of maximum similarities (can be > 1)

#### `maxsim.maxsim_normalized(query, doc)` - Normalized MaxSim
**Formula:** `Σ max(qi · dj) / |query_tokens|` (averaged)

Normalized variant for practical applications.

**Use when:**
- Comparing scores across different queries
- Using pre-normalized embeddings (e.g., from BGE, ColBERT models)
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
L2 normalize embeddings (required for `maxsim_normalized` with unnormalized embeddings).

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
- **TypeScript support** - Full type definitions included
- **Web-optimized** - Built specifically for JavaScript environments

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

| Implementation | Mean (ms) | Median (ms) | P95 (ms) | Throughput (docs/s) | Speedup |
|----------------|-----------|-------------|----------|---------------------|---------|
| JS Baseline    | 209.67    | 209.35      | 214.60   | 477                 | 1.00x   |
| JS Optimized   | 154.90    | 154.50      | 158.70   | 646                 | 1.35x   |
| **WASM+SIMD**  | **16.08** | **15.65**   | **21.10**| **6,220**           | **13.04x** |

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
