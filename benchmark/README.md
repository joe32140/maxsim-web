# MaxSim Benchmarks

Professional benchmarking suite for MaxSim implementations.

## 🚀 Quick Start

### WASM Benchmarking (Recommended)

```bash
# Start the benchmark server
npm run benchmark:wasm

# Open browser to http://localhost:8080/
# Click "Run Benchmark" to see WASM performance!
```

### Node.js Benchmarking (JS Only)

```bash
# Single scenario
npm run benchmark

# All scenarios
npm run benchmark:all
```

## 📊 Benchmark Types

### 1. Browser Benchmarks (WASM + JS)

**Why:** WASM only works in browsers, not Node.js

**How:**
1. Run `npm run benchmark:browser`
2. Open http://localhost:8080/
3. Select scenario and click "Run Benchmark"
4. Export results as JSON

**What you get:**
- ✅ WASM SIMD performance (expected ~10x speedup)
- ✅ All JavaScript implementations
- ✅ Visual progress tracking
- ✅ Interactive charts
- ✅ Export results

### 2. Node.js Benchmarks (JS Only)

**Why:** Quick command-line benchmarking

**How:**
```bash
npm run benchmark small
npm run benchmark realistic
npm run benchmark:all
```

**What you get:**
- ✅ JS Baseline, Optimized, Typed Arrays
- ❌ No WASM (Node.js limitation)
- ✅ Saved to `benchmark/results/`

## 📁 Files

```
benchmark/
├── README.md           # This file
├── index.html          # Browser benchmark UI
├── server.js           # HTTP server for browser benchmarks
├── runner.js           # Node.js benchmark runner
├── fixtures.js         # Test data generation
├── utils.js            # Benchmark utilities
└── results/            # Saved benchmark results
```

## 🎯 Scenarios

| Name | Docs | Tokens | Use Case |
|------|------|--------|----------|
| tiny | 10 | 64 | Quick test |
| small | 10 | 256 | Development |
| medium | 100 | 256 | Integration testing |
| large | 100 | 512 | Large documents |
| realistic | 100 | 2000 | Production-like |
| xl | 1000 | 512 | Stress test |

## 📈 Expected Results

### Browser (with WASM)
```
WASM SIMD:     ~10x faster than baseline ⭐
JS Optimized:  ~1.16x faster than baseline
JS Typed:      ~0.81x (slower due to conversion)
```

### Node.js (JS only)
```
JS Optimized:  ~1.16x faster than baseline
JS Typed:      ~0.81x (slower due to conversion)
```

## 🔧 Configuration

Edit [fixtures.js](./fixtures.js) to customize:
- Query/document token counts
- Embedding dimensions
- Number of documents
- Normalization settings

## 📖 Full Documentation

See [WASM_BENCHMARK_GUIDE.md](../WASM_BENCHMARK_GUIDE.md) for detailed guide including:
- Troubleshooting
- Best practices
- Cross-browser testing
- Production deployment

## 🎨 Browser UI Features

- 📊 Real-time progress tracking
- 📈 Interactive charts
- 📥 Export results as JSON
- 🎯 Run single or all scenarios
- 💻 Mobile-responsive design

## 💡 Tips

1. **For accurate WASM benchmarks**: Use the browser UI
2. **For quick JS tests**: Use `npm run benchmark`
3. **Close other apps** when benchmarking
4. **Run multiple times** to verify consistency
5. **Export results** for comparison over time

---

**Next Steps:**
1. Run `npm run benchmark:wasm`
2. Open http://localhost:8080/
3. See your WASM achieve ~10x speedup! 🚀
