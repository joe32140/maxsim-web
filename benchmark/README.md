# Benchmarks

Performance testing for maxsim-web implementations.

## Quick Start

### Browser (WASM + JS)
```bash
npm run benchmark:browser
# Open http://localhost:8080/
```
**Note:** WASM only works in browsers, not Node.js

### Node.js (JS only)
```bash
npm run benchmark small
```

## Results

**Browser with WASM:**
- WASM SIMD: ~11x faster (21,218 docs/s)
- JS Optimized: ~1.1-1.5x faster (JIT-optimized with loop unrolling + warmup)
- JS Baseline: 1x (1,871 docs/s)

**Node.js (JS only):**
- JS Optimized: ~1.1-1.5x faster (JIT-optimized with loop unrolling + warmup)
- JS Baseline: 1x

## JIT Optimizations

The JS Optimized implementation now includes:
- **4-factor loop unrolling**: Process 4 multiplications per iteration
- **JIT compiler warmup**: Pre-optimize hot paths during initialization
- **Type consistency**: Optimized for Float32Array inputs
- **Pattern matching**: Follows fast-dotproduct optimization patterns

**Note**: Performance gains vary by JavaScript engine and workload. Modern engines like V8 are already highly optimized, so improvements are typically in the 10-50% range rather than dramatic speedups.

## Files

- `index.html` - Browser benchmark UI
- `server.js` - HTTP server  
- `runner.js` - Node.js benchmarks
- `realistic-embeddings.js` - Realistic test data
- `results/` - Saved results
