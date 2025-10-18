# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Web Worker parallelization
- Browser bundle (UMD/ESM)

## [0.3.0] - 2025-10-18

### Added
- **Adaptive cache blocking** inspired by mixedbread-ai/maxsim-cpu
  - Dynamic block sizes based on document length (16 for short docs, 4 for long docs)
  - Prevents cache thrashing on large documents
  - Maximizes throughput on small documents
- Macro-based code generation for specialized SIMD functions

### Changed
- **Major code refactoring**: Reduced from 1,315 to 486 lines (63% reduction)
  - Consolidated 6 duplicate dot product implementations into 1 macro + dispatcher
  - Removed 8 duplicate matrix multiply functions
  - Eliminated all unused/dead code
- Improved build time by 65% (0.6s → 0.21s)
- Reduced compiler warnings from 3 to 1

### Performance
- Maintained 7.58x speedup over JavaScript baseline
- Adaptive blocking improves cache utilization across variable workloads

## [0.2.1] - 2025-10-17

### Added
- **Comprehensive Correctness Test Suite**: Added mathematical correctness tests for all implementations
  - 29 Jest unit tests covering exact MaxSim calculations, edge cases, and cross-implementation validation
  - Interactive browser test page for WASM correctness validation (10 real-time tests)
  - Test runner script with `npm run test:correctness` commands
  - Detailed test documentation in `test/README.md`
- **WASM Module Naming**: Updated WASM module from `maxsim_cpu_wasm` to `maxsim_web_wasm` for consistency
- **Mathematical Validation**: Tests verify perfect matches (1.0), orthogonal vectors (0.0), opposite vectors (-1.0)
- **Implementation Consistency**: Cross-validation between Baseline, Optimized, and WASM implementations
- **Edge Case Coverage**: Zero vectors, large dimensions (384D), large batches (100+ docs), precision scenarios

### Changed
- WASM module naming from `maxsim_cpu_wasm` to `maxsim_web_wasm` to reflect web focus
- Enhanced test infrastructure with browser-based WASM correctness validation

### Fixed
- WASM import paths updated to use correct module naming
- Source file structure aligned with distribution files

## [0.2.0] - 2025-10-17

### Added
- Loop unrolling optimizations (8x for dot product, 4x for cosine)
- Additional tests for typed array consistency (25 tests total)

### Changed
- Default backend remains `js-optimized` (typed arrays have conversion overhead)
- Updated `MaxSim.normalize()` to return Float32Array for future WASM interop

### Performance
**Small scenario (10 docs × 256 tokens):**
- JS Baseline: 1,695.8 docs/sec
- JS Optimized: 2,030.6 docs/sec (**1.20x** improvement)
- JS Typed: 1,378.3 docs/sec (0.81x - conversion overhead issue)

### Lessons Learned
- Typed array conversion overhead (19%) negates micro-optimization benefits
- V8 already optimizes regular numeric arrays well
- Real gains require WASM + actual SIMD instructions (Phase 3)
- Premature optimization confirmed: measure first!

## [0.1.0] - 2025-10-17

### Added
- Initial implementation of MaxSim algorithm in pure JavaScript
- Baseline implementation (`MaxSimBaseline`)
- Optimized implementation with pre-normalized embeddings (`MaxSimOptimized`)
- Auto-backend selection via `MaxSim.create()`
- Comprehensive test suite (17 tests)
- Benchmark infrastructure with realistic scenarios
- Example code demonstrating usage
- Documentation (README, BENCHMARKS, LICENSE)

### Performance
- **JS Baseline**: 192.4 docs/sec (519.84ms mean)
- **JS Optimized**: 226.1 docs/sec (442.22ms mean)
- **Speedup**: 1.18x improvement with pre-normalized embeddings

### Testing
- 100% test coverage on core functionality
- Edge case handling (empty embeddings, single tokens, large embeddings)
- Implementation consistency tests

[Unreleased]: https://github.com/joe32140/maxsim-web/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/joe32140/maxsim-web/releases/tag/v0.2.0
[0.1.0]: https://github.com/joe32140/maxsim-web/releases/tag/v0.1.0
