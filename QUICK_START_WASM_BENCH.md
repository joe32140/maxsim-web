# 🚀 WASM Benchmark - Quick Start

## One Command to Rule Them All

```bash
npm run benchmark:wasm
```

Then open: **http://localhost:8080/**

## That's It! 🎉

Click "Run Benchmark" and watch WASM achieve ~10x speedup!

---

## Full Command Reference

```bash
# Browser benchmarks (WASM + JS)
npm run benchmark:wasm       # Start server, then open http://localhost:8080/
npm run benchmark:browser    # Same as above

# Node.js benchmarks (JS only - no WASM)
npm run benchmark            # Single scenario
npm run benchmark:all        # All scenarios
```

## Troubleshooting One-Liners

```bash
# WASM files missing?
npm run build:wasm

# Port 8080 in use?
PORT=3000 npm run benchmark:wasm

# Check WASM files exist
ls -lh dist/wasm/
```

## Expected Results

| Implementation | Speedup |
|----------------|---------|
| WASM SIMD      | ~10x ⭐ |
| JS Optimized   | ~1.16x  |
| JS Typed       | ~0.81x  |

---

**Need more help?** See:
- [WASM_BENCHMARK_SETUP.md](WASM_BENCHMARK_SETUP.md) - Setup overview
- [WASM_BENCHMARK_GUIDE.md](WASM_BENCHMARK_GUIDE.md) - Full guide
- [benchmark/README.md](benchmark/README.md) - Quick reference
