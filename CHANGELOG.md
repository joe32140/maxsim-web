# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- TypedArray optimization (Float32Array)
- WASM implementation with SIMD
- Web Worker parallelization
- Browser bundle (UMD/ESM)
- npm package publishing

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

[Unreleased]: https://github.com/yourusername/maxsim-cpu/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/maxsim-cpu/releases/tag/v0.1.0
