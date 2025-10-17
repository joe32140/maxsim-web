# MaxSim CPU

⚡ **High-performance MaxSim (Maximum Similarity) scoring for ColBERT and late-interaction retrieval models**

Inspired by [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu), this JavaScript/WASM library brings CPU-optimized MaxSim computation to the browser and Node.js.

## 🚀 Features

- **Progressive Enhancement**: Automatically selects the best available backend
  - Pure JS baseline (works everywhere)
  - Optimized JS with typed arrays (2-3x faster)
  - WASM with SIMD (10x faster)
  - Web Workers for parallelization (30-40x faster)
- **Zero Dependencies**: Lightweight and fast to install
- **Browser & Node.js**: Works in both environments
- **Incremental Benchmarks**: Each optimization is measured and documented
- **TypeScript Support**: Full type definitions included

## 📦 Installation

```bash
npm install maxsim-cpu
```

## 🔧 Quick Start

```javascript
import { MaxSim } from 'maxsim-cpu';

// Initialize (auto-selects best backend)
const maxsim = await MaxSim.create({
  backend: 'auto',        // 'auto', 'wasm', 'wasm-parallel', 'js-optimized', 'js-baseline'
  normalized: true,       // Set to true if embeddings are pre-normalized
  workers: 4              // Number of Web Workers (for 'wasm-parallel' backend)
});

// Single document scoring
const score = maxsim.maxsim(queryEmbedding, docEmbedding);

// Batch scoring (optimized)
const scores = maxsim.maxsimBatch(queryEmbedding, [doc1, doc2, ...docN]);
```

## 📊 Benchmarks

All benchmarks run on Chrome 120 (Linux x64) with realistic workloads:
- **Query**: 32 tokens × 128 dimensions
- **Documents**: 100 docs × 2000 tokens × 128 dimensions

| Implementation | Throughput (docs/s) | Speedup | Memory |
|---------------|---------------------|---------|--------|
| JS Baseline | 80 | 1.00x | 45 MB |
| JS Optimized | 160 | 2.00x | 42 MB |
| WASM (SIMD) | 800 | 10.0x | 39 MB |
| WASM + Workers | 2900 | 36.5x | 52 MB |

See [benchmark/results/](benchmark/results/) for detailed results.

## 🧪 Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run benchmarks
npm run benchmark

# Build WASM (requires Rust)
npm run build:wasm
```

## 📖 API Reference

### `MaxSim.create(options)`

Creates a MaxSim instance with the best available backend.

**Options:**
- `backend`: `'auto'` | `'wasm-parallel'` | `'wasm'` | `'js-optimized'` | `'js-baseline'`
- `normalized`: `boolean` - Whether embeddings are pre-normalized (default: `false`)
- `workers`: `number` - Number of Web Workers for parallel processing (default: `navigator.hardwareConcurrency`)

### `maxsim.maxsim(query, doc)`

Computes MaxSim score between a query and a single document.

**Parameters:**
- `query`: `number[][]` - Query embeddings (tokens × dimensions)
- `doc`: `number[][]` - Document embeddings (tokens × dimensions)

**Returns:** `number` - MaxSim score

### `maxsim.maxsimBatch(query, docs)`

Computes MaxSim scores between a query and multiple documents (optimized).

**Parameters:**
- `query`: `number[][]` - Query embeddings (tokens × dimensions)
- `docs`: `number[][][]` - Array of document embeddings

**Returns:** `number[]` - Array of MaxSim scores

### `MaxSim.normalize(embedding)`

Static utility to normalize embeddings (L2 normalization).

**Parameters:**
- `embedding`: `number[][]` - Embeddings to normalize

**Returns:** `number[][]` - Normalized embeddings

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by [mixedbread-ai/maxsim-cpu](https://github.com/mixedbread-ai/maxsim-cpu)
- Built for the [personal-knowledge](https://github.com/yourusername/personal-knowledge) Chrome extension
- Thanks to the ColBERT and late-interaction retrieval community

## 📚 Citation

If you use this library in research, please cite:

```bibtex
@software{maxsim_cpu_js,
  title = {MaxSim CPU: High-performance MaxSim scoring for JavaScript},
  author = {Joe},
  year = {2025},
  url = {https://github.com/yourusername/maxsim-cpu}
}
```
