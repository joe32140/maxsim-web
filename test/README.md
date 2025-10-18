# MaxSim Test Suite

This directory contains comprehensive tests for the MaxSim implementations, focusing on both performance and correctness.

## Test Structure

```
test/
├── unit/
│   └── maxsim.test.js          # Jest unit tests for all implementations
├── integration/                # Integration tests (if any)
├── browser-correctness.html    # Browser-based WASM correctness tests
├── setup.js                   # Jest test setup
└── README.md                  # This file
```

## Running Tests

### Node.js Tests (Jest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run correctness tests specifically
npm run test:correctness node
```

### Browser Tests (WASM Correctness)

```bash
# Start browser test server
npm run test:correctness:browser

# Or specify a custom port
npm run test:correctness browser 3000
```

Then open `http://localhost:8080/test` in your browser.

### All Tests

```bash
# Run Node.js tests then start browser server
npm run test:correctness all
```

## Test Categories

### 1. Correctness Tests

These tests verify that the MaxSim calculations are mathematically correct:

#### Known Vector Tests
- **Perfect Match**: Identical normalized vectors should return similarity = 1.0
- **Orthogonal Vectors**: Perpendicular vectors should return similarity = 0.0  
- **Opposite Vectors**: Anti-parallel vectors should return similarity = -1.0

#### Mathematical Accuracy Tests
- **Exact MaxSim Calculation**: Tests with known expected results
- **Partial Matches**: Multi-token queries with mixed similarity scores
- **Mixed Similarities**: Documents with tokens of varying similarity to query
- **Multi-token Queries**: Averaging behavior across multiple query tokens

#### Implementation Consistency Tests
- **Baseline vs Optimized**: JavaScript implementations should match exactly
- **WASM vs JavaScript**: WASM results should match JavaScript within tolerance
- **Normalized vs Unnormalized**: Both modes should produce correct results

### 2. Edge Case Tests

- **Single Token**: Queries/documents with only one token
- **Empty Embeddings**: Handling of empty input arrays
- **Large Embeddings**: Performance with high-dimensional vectors (128, 256, 384 dims)
- **Large Batches**: Batch processing with many documents
- **Zero Vectors**: Handling of zero-magnitude vectors
- **Precision**: Very small differences to test numerical precision

### 3. WASM-Specific Tests

The browser test page includes additional WASM-specific correctness tests:

- **SIMD Support Detection**: Checks if WASM SIMD is available
- **Memory Layout**: Tests different embedding dimensions and batch sizes
- **Precision Comparison**: Compares WASM floating-point precision with JavaScript
- **Initialization**: Tests WASM module loading and initialization

## Test Data

### Standard Test Vectors

The tests use carefully constructed test vectors with known mathematical properties:

```javascript
// Perfect match case
query: [[1.0, 0.0], [0.0, 1.0]]
doc:   [[1.0, 0.0], [0.0, 1.0]]
expected: 1.0

// Orthogonal case  
query: [[1.0, 0.0]]
doc:   [[0.0, 1.0]]
expected: 0.0

// Mixed similarity case
query: [[1.0, 0.0, 0.0]]
doc:   [[1.0, 0.0, 0.0],    // Perfect match: 1.0
        [0.0, 1.0, 0.0],    // Orthogonal: 0.0  
        [0.5, 0.5, 0.0]]    // Partial: ~0.707
expected: 1.0 (max similarity)
```

### Normalization

All test vectors are L2-normalized unless specifically testing unnormalized behavior:

```javascript
// Normalize a vector
const normalize = (vec) => {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return mag === 0 ? vec : vec.map(v => v / mag);
};
```

## Browser Test Features

The browser correctness test page (`browser-correctness.html`) provides:

### Interactive Testing
- **Run All Tests**: Execute the complete test suite
- **Run Basic Tests**: Core correctness tests only
- **Run Advanced Tests**: Edge cases and precision tests

### Real-time Results
- ✅ **Pass**: Test completed successfully
- ❌ **Fail**: Test failed with error details
- ⚠️ **Skip**: Test skipped (e.g., WASM not supported)

### Test Categories
- **Basic**: Essential correctness tests
- **Advanced**: Edge cases, precision, and performance tests

### Detailed Reporting
- Execution time for each test
- Error messages and stack traces
- Summary statistics (passed/failed/skipped)

## Adding New Tests

### Node.js Tests (Jest)

Add new tests to `test/unit/maxsim.test.js`:

```javascript
test('should handle my new test case', () => {
  const maxsim = new MaxSimOptimized({ normalized: true });
  
  const query = [[/* your test vectors */]];
  const doc = [[/* your test vectors */]];
  
  const score = maxsim.maxsim(query, doc);
  expect(score).toBeCloseTo(expectedValue, precision);
});
```

### Browser Tests

Add new tests to `browser-correctness.html`:

```javascript
runner.addTest('My New Test', async () => {
  const query = [[/* your test vectors */]];
  const doc = [[/* your test vectors */]];
  
  const wasmScore = runner.wasmImpl.maxsim(query, doc);
  const baselineScore = runner.baselineImpl.maxsim(query, doc);
  
  runner.assertEqual(wasmScore, expectedValue, tolerance);
  runner.assertEqual(wasmScore, baselineScore, tolerance);
}, 'basic'); // or 'advanced'
```

## Troubleshooting

### WASM Tests Failing
- Ensure WASM module is built: `npm run build:wasm`
- Check browser SIMD support: Chrome 91+, Firefox 89+, Safari 16.4+
- Verify dist/wasm/ directory contains the WASM files

### Precision Issues
- Use appropriate tolerance values for floating-point comparisons
- WASM may have slightly different precision than JavaScript
- Consider using `toBeCloseTo()` with suitable precision parameter

### Performance Tests Timing Out
- Large embedding tests may take time on slower machines
- Consider reducing test size or increasing timeout
- Use `jest.setTimeout()` for longer-running tests

## Test Philosophy

These tests prioritize **correctness over performance**. While the benchmark suite focuses on speed, these tests ensure that:

1. **Mathematical accuracy** is maintained across all implementations
2. **Implementation consistency** is verified between different backends
3. **Edge cases** are handled gracefully
4. **WASM correctness** matches JavaScript reference implementations

The goal is to provide confidence that optimizations don't compromise the mathematical correctness of the MaxSim algorithm.