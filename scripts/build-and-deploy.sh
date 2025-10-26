#!/bin/bash
set -e

echo "🚀 Building and deploying maxsim-web with preloading API..."
echo ""

# Step 1: Build WASM
echo "📦 Step 1: Building WASM with SIMD..."
cd /home/joe/maxsim-web/src/rust
RUSTFLAGS="-C target-feature=+simd128" wasm-pack build --target web --out-dir ../../dist/wasm
echo "✓ WASM built"
echo ""

# Step 2: Copy to fast-plaid demo
echo "📋 Step 2: Copying to fast-plaid demo..."
cp /home/joe/maxsim-web/dist/maxsim-wasm.js /home/joe/fast-plaid/docs/
cp /home/joe/maxsim-web/dist/wasm/* /home/joe/fast-plaid/docs/maxsim-wasm/
echo "✓ Files copied"
echo ""

# Step 3: Verify
echo "✅ Verification:"
echo "WASM size: $(ls -lh /home/joe/fast-plaid/docs/maxsim-wasm/maxsim_web_wasm_bg.wasm | awk '{print $5}')"
echo "Wrapper size: $(ls -lh /home/joe/fast-plaid/docs/maxsim-wasm.js | awk '{print $5}')"
echo ""
echo "Preload exports:"
wasm2wat /home/joe/fast-plaid/docs/maxsim-wasm/maxsim_web_wasm_bg.wasm 2>/dev/null | grep "export.*load_documents\|export.*search_preloaded\|export.*num_documents"
echo ""
echo "✅ Build and deploy complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Open /home/joe/fast-plaid/docs/index.html in a browser"
echo "   2. Check console for: '✅ Preloaded X documents into WASM memory!'"
echo "   3. Verify search is ~4.5x faster"
