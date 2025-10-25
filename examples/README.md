# MaxSim Web Examples

This directory contains practical examples demonstrating how to use MaxSim Web effectively.

## 📁 Examples

### `api-comparison.js`

**Performance comparison between 2D Array API and Flat Array API**

Demonstrates:
- How to use both API styles
- Real-world performance difference (up to 16x speedup!)
- When to use each API
- How to convert between formats

**Run:**
```bash
node examples/api-comparison.js
```

**Expected output:**
```
🔬 MaxSim Web - API Comparison

📊 PERFORMANCE COMPARISON

  2D Array API:    320.45 ms
  Flat Array API:  20.12 ms
  Speedup:         15.92x faster! 🚀

  Time saved:      300.33 ms
```

---

## 🎓 Usage Patterns

### Pattern 1: Using Flat API (Recommended for Performance)

```javascript
import { MaxSimWasm } from 'maxsim-web';

const maxsim = new MaxSimWasm();
await maxsim.init();

// Data already in flat format (from ML library)
const queryFlat = new Float32Array(13 * 48);
const docsFlat = new Float32Array(270000);
const docTokenCounts = new Uint32Array([256, 270, 245, ...]);

// Direct call - zero overhead
const scores = maxsim.maxsimBatchFlat(
    queryFlat,
    13,                           // query tokens
    docsFlat,
    docTokenCounts,
    48                            // embedding dim
);
```

### Pattern 2: Using 2D Array API (Convenience)

```javascript
import { MaxSimWasm } from 'maxsim-web';

const maxsim = new MaxSimWasm();
await maxsim.init();

// Data in 2D format
const query = [[...], [...], ...];  // 13 tokens
const docs = [
    [[...], [...], ...],  // doc 1
    [[...], [...], ...],  // doc 2
    // ...
];

// Simple call
const scores = maxsim.maxsimBatch(query, docs);
```

---

## 📖 More Resources

- **[API_GUIDE.md](../docs/API_GUIDE.md)** - Complete API documentation
- **[PERFORMANCE_ISSUE.md](../PERFORMANCE_ISSUE.md)** - Performance optimization details
- **[benchmark/](../benchmark/)** - Interactive benchmarks

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build WASM:**
   ```bash
   npm run build:wasm
   ```

3. **Run examples:**
   ```bash
   node examples/api-comparison.js
   ```

---

## 💡 Performance Tips

1. **Use Flat API for large batches** (100+ documents)
2. **Keep embeddings in flat format** - don't convert unnecessarily
3. **Batch process when possible** - use `maxsimBatchFlat()` instead of loops
4. **Reuse MaxSimWasm instance** - initialization is expensive
5. **Pre-allocate buffers** - the Flat API does this automatically

---

## 🤔 Which API Should I Use?

| Scenario | Recommended API | Why |
|----------|----------------|-----|
| ML library output (transformers.js) | **Flat API** | Already flat, zero conversion |
| 1000+ documents | **Flat API** | Massive performance gain |
| Production search | **Flat API** | Best performance |
| Quick prototyping | 2D Array API | Simpler to use |
| Small batches (<100 docs) | Either | Performance difference minimal |
| Already have 2D arrays | 2D Array API | No need to convert |

---

**Default recommendation:** Use the **Flat API** for production applications!
