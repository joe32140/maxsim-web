# MaxSim Web - GitHub Pages

This directory contains the GitHub Pages deployment for the MaxSim Web benchmark.

## Structure

- `index.html` - Landing page
- `benchmark/` - Interactive benchmark suite
- `src/` - Source code (for imports)
- `dist/` - Built files including WASM

## Local Development

To run the benchmark locally:

```bash
npm install
npm run build:wasm
npm run build
npm run benchmark:browser
```

Then visit http://localhost:3000