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
- JS Optimized: ~1.4x faster (2,605 docs/s)  
- JS Baseline: 1x (1,871 docs/s)

**Node.js (JS only):**
- JS Optimized: ~1.2x faster
- JS Baseline: 1x

## Files

- `index.html` - Browser benchmark UI
- `server.js` - HTTP server  
- `runner.js` - Node.js benchmarks
- `realistic-embeddings.js` - Realistic test data
- `results/` - Saved results
