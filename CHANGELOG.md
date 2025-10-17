# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- WASM implementation with SIMD (expected 10x improvement)
- Web Worker parallelization
- Browser bundle (UMD/ESM)
- npm package publishing

## [0.2.0] - 2025-10-17

### Added
- Typed arrays implementation (`MaxSimTyped`) with Float32Array
- Loop unrolling optimizations (8x for dot product, 4x for cosine)
- Comprehensive Phase 2 findings document ([PHASE2_FINDINGS.md](PHASE2_FINDINGS.md))
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

[Unreleased]: https://github.com/yourusername/maxsim-cpu/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yourusername/maxsim-cpu/releases/tag/v0.2.0
[0.1.0]: https://github.com/yourusername/maxsim-cpu/releases/tag/v0.1.0
