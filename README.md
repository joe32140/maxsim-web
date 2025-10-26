# maxsim-web

⚡ High-performance MaxSim scoring with WebAssembly and SIMD for ColBERT-style retrieval

[![npm version](https://badge.fury.io/js/maxsim-web.svg)](https://www.npmjs.com/package/maxsim-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**🚀 Live Demo**](https://joe32140.github.io/maxsim-web/benchmark/) • [📊 Performance Report](docs/PERFORMANCE_IMPROVEMENT_v0.6.0.md) • [📚 API Guide](docs/API_GUIDE.md)

---

## Features

🚀 **3-5x faster than JavaScript** - WASM+SIMD optimized implementation
📦 **45KB gzipped** - Tiny bundle size, 12% smaller than v0.5.0
⚡ **Preloading API** - Load documents once, search thousands of times
🎯 **Zero dependencies** - Pure WASM implementation
🔧 **Simple API** - Works with any L2-normalized embeddings

---

## Performance (v0.6.0)

**Latest benchmarks:**

| Scenario | Documents | Query Tokens | Performance | vs JavaScript |
|----------|-----------|--------------|-------------|---------------|
| Variable Large | 1000 docs | 32 tokens | **265ms** | **3.55x faster** 🔥 |
| Variable Medium | 1000 docs | 13 tokens | **134ms** | **3.34x faster** 🔥 |

**With preloading:**
- Load documents once: ~230ms (one-time cost)
- Each search: **~265ms** (vs 479ms non-preloaded)
- **1.81x faster per search** + zero conversion overhead
- **Break-even after 2 searches**

See [Performance Report](./docs/PERFORMANCE_IMPROVEMENT_v0.6.0.md) for detailed benchmarks and analysis.

---

## What's New in v0.6.0

🚀 **Major performance improvement:** 2.8-5.2x faster!

- Removed cosine similarity, use dot product exclusively (3-5x faster per operation)
- Binary size: 51KB → **45KB** (12% smaller)
- WASM now **3-5x faster than JavaScript** (was 1.0-1.2x)
- **No breaking changes** - all APIs work the same

See [Release Notes](./RELEASE_v0.6.0.md) for details.

---

## Installation

```bash
npm install maxsim-web
```

---

## Quick Start

### Basic Usage

```javascript
import { createMaxSim } from 'maxsim-web';

// Initialize (auto-detects best: WASM+SIMD, WASM, or JS fallback)
const maxsim = await createMaxSim();

// Prepare embeddings (must be L2-normalized!)
const queryEmbedding = [[0.1, 0.2, ...], ...];  // [query_tokens, embedding_dim]
const docEmbeddings = [
  [[0.3, 0.4, ...], ...],  // Doc 1
  [[0.5, 0.6, ...], ...],  // Doc 2
];

// Compute MaxSim scores
const scores = maxsim.maxsimBatch(queryEmbedding, docEmbeddings);
console.log(scores);  // Float32Array of scores (one per document)
```

### Preloading API (Recommended for Production)

**Use case:** Search the same document set repeatedly with different queries

```javascript
import { createMaxSim } from 'maxsim-web';

const maxsim = await createMaxSim();

// Step 1: Prepare documents as flat arrays (one-time conversion)
const embeddingDim = 256;
const docTokenCounts = new Uint32Array([doc1.length, doc2.length, ...]);

// Flatten all document embeddings into single Float32Array
const allEmbeddings = new Float32Array(totalTokens * embeddingDim);
// ... copy embeddings into allEmbeddings ...

// Step 2: Load documents (one-time, ~230ms for 1000 docs)
await maxsim.loadDocuments(allEmbeddings, docTokenCounts, embeddingDim);

// Step 3: Search repeatedly (fast! ~265ms per search)
const queryFlat = new Float32Array(queryTokens * embeddingDim);
// ... copy query into queryFlat ...

const scores1 = maxsim.wasmInstance.search_preloaded(queryFlat, queryTokens);
const scores2 = maxsim.wasmInstance.search_preloaded(queryFlat2, queryTokens2);
// ... search 1000s of times with zero conversion overhead!
```

**Performance benefit:**
- First search: 230ms (load) + 265ms (search) = 495ms
- Subsequent searches: **265ms each** (vs 479ms non-preloaded)
- **Recommended for 10+ searches on same document set**

---

## API Reference

### Main Methods

#### `maxsimBatch(queryEmbedding, docEmbeddings)`

Compute MaxSim scores for multiple documents (raw sum).

**Parameters:**
- `queryEmbedding`: Array of query token embeddings `[query_tokens][embedding_dim]`
- `docEmbeddings`: Array of document embeddings `[num_docs][doc_tokens][embedding_dim]`

**Returns:** `Float32Array` of scores (one per document)

**Use case:** Ranking documents for a single query

**Example:**
```javascript
const query = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];  // 2 tokens
const docs = [
  [[0.7, 0.8, 0.9]],           // Doc 1: 1 token
  [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]  // Doc 2: 2 tokens
];
const scores = maxsim.maxsimBatch(query, docs);
// scores = Float32Array [score1, score2]
```

---

#### `maxsimBatch_normalized(queryEmbedding, docEmbeddings)`

Same as `maxsimBatch` but returns averaged scores (score / query_tokens).

**Use case:** Comparing scores across queries with different lengths

**Example:**
```javascript
// Query A: 10 tokens, score = 25.0 → normalized = 2.5
// Query B: 20 tokens, score = 40.0 → normalized = 2.0
// Query B ranks higher when normalized
```

---

#### `loadDocuments(embeddingsFlat, docTokenCounts, embeddingDim)`

Load documents for repeated searching (preloading API).

**Parameters:**
- `embeddingsFlat`: `Float32Array` - all embeddings concatenated
- `docTokenCounts`: `Uint32Array` - token count per document
- `embeddingDim`: `number` - embedding dimension

**Returns:** `Promise<void>`

**Use case:** Search the same documents with 10+ different queries

**Example:**
```javascript
const dim = 256;
const docs = [
  new Float32Array(10 * dim),  // Doc 1: 10 tokens
  new Float32Array(20 * dim),  // Doc 2: 20 tokens
];

const allEmbeddings = new Float32Array(30 * dim);
allEmbeddings.set(docs[0], 0);
allEmbeddings.set(docs[1], 10 * dim);

const docTokenCounts = new Uint32Array([10, 20]);

await maxsim.loadDocuments(allEmbeddings, docTokenCounts, dim);
```

---

#### `search_preloaded(queryFlat, queryTokens)`

Search preloaded documents (fast!).

**Parameters:**
- `queryFlat`: `Float32Array` - query embeddings (flattened)
- `queryTokens`: `number` - number of query tokens

**Returns:** `Float32Array` of scores

**Use case:** After calling `loadDocuments()`, search repeatedly with zero overhead

**Example:**
```javascript
const queryFlat = new Float32Array(5 * 256);  // 5 tokens × 256 dims
// ... fill queryFlat with embeddings ...

const scores = maxsim.wasmInstance.search_preloaded(queryFlat, 5);
```

---

### Utility Methods

#### `numDocumentsLoaded()`

Get number of preloaded documents.

**Returns:** `number`

**Example:**
```javascript
console.log(`Loaded ${maxsim.numDocumentsLoaded()} documents`);
```

---

#### `getInfo()`

Get implementation details (SIMD support, version, etc.).

**Returns:** `string`

**Example:**
```javascript
console.log(maxsim.getInfo());
// "MaxSim WASM v0.6.0 (SIMD: true, adaptive_batching: true, ...)"
```

---

## Requirements

⚠️ **Important:** maxsim-web requires **L2-normalized embeddings**

Modern embedding models (ColBERT, BGE, E5, Jina, etc.) output normalized embeddings by default.

**Why this matters:**

For L2-normalized embeddings (unit vectors):
```javascript
dot_product(a, b) === cosine_similarity(a, b)
```

This allows maxsim-web to use efficient dot product operations (3-5x faster than cosine similarity).

**Verify your embeddings are normalized:**
```javascript
function isNormalized(embedding) {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  return Math.abs(magnitude - 1.0) < 0.01;  // Within 1%
}

console.log(isNormalized(embedding));  // Should be true
```

---

## Browser Compatibility

| Browser | WASM+SIMD | WASM | JavaScript |
|---------|-----------|------|------------|
| Chrome 91+ | ✅ **3-5x faster** | ✅ 2-3x faster | ✅ Baseline |
| Edge 91+ | ✅ **3-5x faster** | ✅ 2-3x faster | ✅ Baseline |
| Firefox 89+ | ✅ **3-5x faster** | ✅ 2-3x faster | ✅ Baseline |
| Safari 16.4+ | ✅ **3-5x faster** | ✅ 2-3x faster | ✅ Baseline |
| Node.js 16+ | ✅ **3-5x faster** | ✅ 2-3x faster | ✅ Baseline |

maxsim-web automatically detects and uses the best available implementation.

---

## Use Cases

### 1. Dense Retrieval (ColBERT-style)

```javascript
import { createMaxSim } from 'maxsim-web';

const maxsim = await createMaxSim();

// Embed query and documents
const queryEmb = await embedModel.encode(query);
const docEmbs = await Promise.all(docs.map(doc => embedModel.encode(doc)));

// Rank by MaxSim similarity
const scores = maxsim.maxsimBatch(queryEmb, docEmbs);
const topK = scores
  .map((score, idx) => ({ score, idx }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

console.log('Top 10 documents:', topK);
```

### 2. Re-ranking Search Results

```javascript
import { createMaxSim } from 'maxsim-web';

const maxsim = await createMaxSim();

// Load candidate documents from first-stage retrieval
const candidates = await firstStageSearch(query, { topK: 100 });
const candidateEmbs = candidates.map(doc => doc.embedding);

// Flatten and load
await maxsim.loadDocuments(flattenEmbeddings(candidateEmbs), docTokens, dim);

// Re-rank for each user query variation
const queries = [originalQuery, expandedQuery1, expandedQuery2];
const allScores = queries.map(q =>
  maxsim.wasmInstance.search_preloaded(flattenQuery(q), q.length)
);

// Combine scores (e.g., max, average, weighted)
const finalScores = combineScores(allScores);
```

### 3. Semantic Search at Scale

```javascript
import express from 'express';
import { createMaxSim } from 'maxsim-web';

const app = express();
const maxsim = await createMaxSim();

// Preload document collection (once at startup)
const docs = await loadDocuments();  // e.g., 100K documents
await maxsim.loadDocuments(docs.embeddings, docs.tokenCounts, 256);

// Handle search requests (fast!)
app.get('/search', async (req, res) => {
  const queryEmb = await embedModel.encode(req.query.q);
  const scores = maxsim.wasmInstance.search_preloaded(
    flattenQuery(queryEmb),
    queryEmb.length
  );

  const topK = getTopK(scores, 10);
  res.json({ results: topK.map(idx => docs[idx]) });
});

app.listen(3000);  // ~265ms per search for 1000 docs!
```

### 4. Batch Processing Pipeline

```javascript
import { createMaxSim } from 'maxsim-web';

async function processQueries(queries, documents) {
  const maxsim = await createMaxSim();

  // Load documents once
  await maxsim.loadDocuments(documents.embeddings, documents.tokenCounts, 256);

  // Process all queries (fast!)
  const results = queries.map(query => {
    const scores = maxsim.wasmInstance.search_preloaded(
      query.embedding,
      query.tokens
    );
    return getTopK(scores, 10);
  });

  return results;
}

// Process 1000 queries in ~4.4 minutes (vs 12.4 minutes with v0.5.0)
const results = await processQueries(queries, documents);
```

---

## Performance Tips

1. **Use preloading for 10+ searches** on the same document set
   - Break-even after 2 searches
   - Maximum benefit at 100+ searches

2. **Pre-flatten embeddings** to Float32Array
   - Avoid 2D array conversion overhead
   - Direct WASM memory access

3. **Use WASM+SIMD browsers** for best performance
   - Chrome/Edge 91+, Firefox 89+, Safari 16.4+
   - 3-5x faster than JavaScript fallback

4. **Batch documents together**
   - Process multiple documents per call
   - Amortize function call overhead

5. **Profile your specific use case**
   - Use browser DevTools Performance tab
   - Measure actual query/document sizes

---

## Examples

See [examples/](./examples/) directory for complete working examples:

- **basic-usage.js** - Simple MaxSim scoring
- **preloading-api.js** - Preloading for repeated searches
- **colbert-integration.js** - Integration with ColBERT models
- **batch-processing.js** - Large-scale batch processing
- **nodejs-server.js** - Express server with MaxSim

---

## Benchmarks

Run benchmarks yourself:

```bash
git clone https://github.com/joe32140/maxsim-web
cd maxsim-web
npm install
npm run benchmark
# Open http://localhost:8080/benchmark/
```

Or view online: [MaxSim Web Benchmarks](https://joe32140.github.io/maxsim-web/benchmark/)

---

## Development

### Build from Source

```bash
# Install Rust and wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Clone repository
git clone https://github.com/joe32140/maxsim-web
cd maxsim-web

# Install dependencies
npm install

# Build WASM
cd src/rust
RUSTFLAGS="-C target-feature=+simd128" wasm-pack build --target web --out-dir ../../dist/wasm

# Run benchmarks
cd ../..
npm run benchmark
```

### Project Structure

```
maxsim-web/
├── src/
│   ├── rust/           # Rust WASM implementation
│   │   ├── src/lib.rs  # Core MaxSim algorithm
│   │   └── Cargo.toml
│   └── js/             # JavaScript wrappers
│       ├── maxsim-wasm.js
│       ├── maxsim-baseline.js
│       └── maxsim-optimized.js
├── dist/               # Built artifacts
│   └── wasm/           # WASM binaries
├── docs/               # Documentation
├── benchmark/          # Browser benchmarks
└── examples/           # Usage examples
```

---

## Contributing

Contributions welcome! Please:

1. **Add tests** for new features
2. **Run benchmarks** to verify performance
3. **Update documentation**
4. **Follow code style** (rustfmt, prettier)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## License

MIT - see [LICENSE](./LICENSE) file

---

## Citation

If you use maxsim-web in your research, please cite:

```bibtex
@software{maxsim_web,
  title = {maxsim-web: High-performance MaxSim scoring with WebAssembly},
  author = {Hsu, Joe},
  year = {2025},
  email = {joe32140@gmail.com},
  url = {https://github.com/joe32140/maxsim-web},
  version = {0.6.0}
}
```

---

## Related Projects

- **[fast-plaid](https://github.com/mixedbread-ai/fast-plaid)** - ColBERT search with IVF indexing
- **[ColBERT](https://github.com/stanford-futuredata/ColBERT)** - Original ColBERT implementation
- **[pylate](https://github.com/mixedbread-ai/pylate)** - Python ColBERT training framework
- **[Vespa ColBERT](https://docs.vespa.ai/en/nearest-neighbor-search-colbert.html)** - Production ColBERT at scale

---

## Acknowledgments

- Inspired by **ColBERT's MaxSim scoring** algorithm (Khattab & Zaharia, 2020)
- Built with **Rust** and **wasm-bindgen**
- SIMD optimizations based on **modern browser capabilities**
- Performance testing inspired by **fast-plaid** benchmarks

---

## Support

- 📧 **Email**: joe32140@gmail.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/joe32140/maxsim-web/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/joe32140/maxsim-web/discussions)

---

Made with ⚡ by [Joe Hsu](mailto:joe32140@gmail.com) (2025)
