# MaxSim Web API Guide

## 📚 Overview

MaxSim Web provides **two API styles** for different use cases:

1. **2D Array API** (Convenience) - For users with embeddings already in `number[][]` format
2. **Flat Array API** (Performance) - For users with flat `Float32Array` embeddings (common from ML libraries)

## 🎯 Which API Should You Use?

### Use the **Flat API** when:
- ✅ Your embeddings come from ML libraries (transformers.js, ONNX, TensorFlow.js)
- ✅ Processing **100+ documents**
- ✅ Performance is critical
- ✅ You want to avoid unnecessary allocations

**Expected benefit:** Up to **260ms saved** for 1000 docs by eliminating conversions (4.2x faster)

### Use the **2D Array API** when:
- ✅ Your embeddings are already in 2D format
- ✅ Convenience is more important than max performance
- ✅ Processing **< 100 documents**
- ✅ You prefer simpler API calls

---

## 🚀 Flat API (Recommended for Performance)

### Single Document

```javascript
import { MaxSimWasm } from 'maxsim-web';

const maxsim = new MaxSimWasm();
await maxsim.init();

// Embeddings from ML library (already flat)
const queryFlat = new Float32Array(13 * 48);  // 13 tokens × 48 dims
const docFlat = new Float32Array(270 * 48);   // 270 tokens × 48 dims

// Direct call - NO conversion overhead
const score = maxsim.maxsimFlat(
    queryFlat,   // Float32Array
    13,          // query tokens
    docFlat,     // Float32Array
    270,         // doc tokens
    48           // embedding dimension
);

console.log('MaxSim score:', score);
```

### Batch Processing (Best Performance)

```javascript
// Real-world example: 1000 documents with variable lengths
const queryFlat = new Float32Array(13 * 48);  // 13 tokens × 48 dims

// Concatenate all document embeddings
const docTokenCounts = [256, 270, 245, 312, ...]; // 1000 docs (variable length)
const totalTokens = docTokenCounts.reduce((sum, count) => sum + count, 0);
const docsFlat = new Float32Array(totalTokens * 48);

// Fill docsFlat with concatenated embeddings...
// (from your ML library output)

// Zero-copy batch processing
const scores = maxsim.maxsimBatchFlat(
    queryFlat,                          // Float32Array (13 × 48)
    13,                                 // query tokens
    docsFlat,                           // Float32Array (all docs concatenated)
    new Uint32Array(docTokenCounts),   // tokens per doc
    48                                  // embedding dimension
);

console.log('Scores:', scores); // Float32Array of 1000 scores
```

### Normalized Scores (for cross-query comparison)

```javascript
const normalizedScores = maxsim.maxsimBatchFlat_normalized(
    queryFlat,
    13,
    docsFlat,
    new Uint32Array(docTokenCounts),
    48
);

// Normalized scores are averaged (divided by query token count)
// Useful for comparing queries with different lengths
```

---

## 🧩 2D Array API (Convenience)

### Single Document

```javascript
import { MaxSimWasm } from 'maxsim-web';

const maxsim = new MaxSimWasm();
await maxsim.init();

// 2D array format
const query = [
    [0.1, 0.2, 0.3, ...], // token 1
    [0.4, 0.5, 0.6, ...], // token 2
    // ... 13 tokens total
];

const doc = [
    [0.7, 0.8, 0.9, ...], // token 1
    [0.2, 0.3, 0.4, ...], // token 2
    // ... 270 tokens total
];

const score = maxsim.maxsim(query, doc);
console.log('MaxSim score:', score);
```

### Batch Processing

```javascript
const query = [[...]]; // 2D array

const docs = [
    [[...], [...], [...]],  // doc 1
    [[...], [...], [...]],  // doc 2
    // ... 1000 docs
];

const scores = maxsim.maxsimBatch(query, docs);
console.log('Scores:', scores);
```

---

## 📊 Performance Comparison

### Test Case: 1000 documents, variable length (128-256 tokens), 48 dimensions

| API Method | Time | Breakdown |
|------------|------|-----------|
| **Flat API** | **~61ms** | 61ms WASM computation only ✅ |
| 2D Array API | **~320ms** | 61ms WASM + ~260ms conversions ⚠️ |

**Speedup:** **4.2x faster** with Flat API by avoiding conversions!

### Why 2D Array API is Slower

When using the 2D Array API with 1000 documents:

1. **User converts flat → 2D** (~130ms)
   - Create 1000+ intermediate arrays
   - Slice operations for each token

2. **Library converts 2D → flat** (~130ms)
   - Pack data for WASM
   - More intermediate allocations

3. **WASM computation** (61ms)
   - Actual MaxSim calculation

**Total:** ~320ms (260ms wasted on conversions!)

**Flat API skips steps 1-2** and goes straight to WASM → **61ms total**

---

## 💡 Best Practices

### 1. **Keep data flat from the start**

```javascript
// ❌ BAD: Converting to 2D unnecessarily
const embeddings2D = [];
for (let i = 0; i < tokens; i++) {
    embeddings2D.push(flatArray.slice(i * dim, (i + 1) * dim));
}

// ✅ GOOD: Keep flat, use Flat API
const scores = maxsim.maxsimBatchFlat(queryFlat, tokens, docsFlat, counts, dim);
```

### 2. **Batch processing for large datasets**

```javascript
// ❌ BAD: Individual calls
for (const doc of docs) {
    const score = maxsim.maxsim(query, doc); // Slow!
}

// ✅ GOOD: Single batch call
const scores = maxsim.maxsimBatchFlat(queryFlat, qt, docsFlat, counts, dim);
```

### 3. **Reuse MaxSimWasm instance**

```javascript
// ❌ BAD: Creating new instance every time
async function search(query, docs) {
    const maxsim = new MaxSimWasm();
    await maxsim.init(); // Expensive initialization!
    return maxsim.maxsimBatch(query, docs);
}

// ✅ GOOD: Reuse instance
const maxsim = new MaxSimWasm();
await maxsim.init(); // Once

async function search(query, docs) {
    return maxsim.maxsimBatchFlat(...); // Instant!
}
```

---

## 🔧 Common Use Cases

### Use Case 1: ColBERT-style retrieval with transformers.js

```javascript
import { MaxSimWasm } from 'maxsim-web';
import { pipeline } from '@xenova/transformers';

// Initialize
const maxsim = new MaxSimWasm();
await maxsim.init();

const model = await pipeline('feature-extraction', 'colbert-ir/colbertv2.0');

// Get flat embeddings from model
const queryEmbeddings = await model('search query');  // Float32Array
const docEmbeddings = await model('document text');   // Float32Array

// Direct processing - no conversion needed
const score = maxsim.maxsimFlat(
    queryEmbeddings.data,
    queryEmbeddings.dims[0],  // tokens
    docEmbeddings.data,
    docEmbeddings.dims[0],
    queryEmbeddings.dims[1]   // embedding dim
);
```

### Use Case 2: Ranking 1000+ documents

```javascript
// Pre-computed flat embeddings from vector database
const queryFlat = await vectorDB.getQueryEmbedding(queryId);
const { docsFlat, tokenCounts } = await vectorDB.getDocuments(docIds);

// Fast batch scoring
const scores = maxsim.maxsimBatchFlat(
    queryFlat,
    queryTokens,
    docsFlat,
    tokenCounts,
    embeddingDim
);

// Rank documents
const ranked = docIds
    .map((id, i) => ({ id, score: scores[i] }))
    .sort((a, b) => b.score - a.score);
```

---

## 🎓 Migration Guide

### If you're currently using the 2D Array API:

**Before (slow):**
```javascript
const query2D = convertToNested(queryFlat);
const docs2D = docsList.map(convertToNested);
const scores = maxsim.maxsimBatch(query2D, docs2D);
```

**After (fast):**
```javascript
const scores = maxsim.maxsimBatchFlat(
    queryFlat,
    queryTokens,
    docsFlat,
    docTokenCounts,
    embeddingDim
);
```

**Steps:**
1. Keep embeddings in flat format (don't convert to 2D)
2. Track token counts for each document
3. Concatenate all documents into single Float32Array
4. Use `maxsimBatchFlat()` instead of `maxsimBatch()`

---

## 📖 API Reference

### Flat API Methods

#### `maxsimFlat(queryFlat, queryTokens, docFlat, docTokens, embeddingDim)`
- **Returns:** `number` - MaxSim score
- **Use:** Single document scoring

#### `maxsimBatchFlat(queryFlat, queryTokens, docsFlat, docTokenCounts, embeddingDim)`
- **Returns:** `Float32Array` - Array of MaxSim scores
- **Use:** Batch processing (FASTEST)

#### `maxsimFlat_normalized(...)` / `maxsimBatchFlat_normalized(...)`
- **Returns:** Normalized (averaged) scores
- **Use:** Cross-query comparison

### 2D Array API Methods

#### `maxsim(queryEmbedding, docEmbedding)`
- **Returns:** `number` - MaxSim score
- **Use:** Single document (2D arrays)

#### `maxsimBatch(queryEmbedding, docEmbeddings)`
- **Returns:** `Float32Array` - Array of scores
- **Use:** Batch processing (2D arrays)

#### `maxsim_normalized(...)` / `maxsimBatch_normalized(...)`
- **Returns:** Normalized scores
- **Use:** Cross-query comparison (2D arrays)

---

## ❓ FAQ

**Q: Which API is faster?**
A: The Flat API is up to 16x faster for large batches due to zero conversion overhead.

**Q: Do I need to change my existing code?**
A: No! The 2D Array API remains fully supported for backward compatibility.

**Q: What if my data is already 2D?**
A: Use the 2D Array API for convenience. Only use Flat API if you can easily access the underlying flat data.

**Q: Can I mix both APIs?**
A: Yes! Use whichever is most convenient for each operation.

**Q: What about normalized vs unnormalized?**
A: Use `maxsim()` for official ColBERT-style scoring (raw sum). Use `maxsim_normalized()` for comparing queries with different lengths.

---

## 🔗 Additional Resources

- [PERFORMANCE_ISSUE.md](../PERFORMANCE_ISSUE.md) - Deep dive into optimization details
- [benchmark/](../benchmark/) - Performance benchmarks
- [examples/](../examples/) - Complete usage examples

---

**Recommendation:** Use the **Flat API** for production applications with large document collections for best performance!
