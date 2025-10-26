#!/bin/bash
# Copy built files to fast-plaid demo

echo "🔄 Copying maxsim-web build to fast-plaid demo..."

# Copy high-level wrapper
cp /home/joe/maxsim-web/dist/maxsim-wasm.js /home/joe/fast-plaid/docs/
echo "✓ Copied maxsim-wasm.js"

# Copy WASM bindings
cp /home/joe/maxsim-web/dist/wasm/* /home/joe/fast-plaid/docs/maxsim-wasm/
echo "✓ Copied WASM files to maxsim-wasm/"

# Verify
echo ""
echo "📊 Verification:"
ls -lh /home/joe/fast-plaid/docs/maxsim-wasm.js
ls -lh /home/joe/fast-plaid/docs/maxsim-wasm/maxsim_web_wasm_bg.wasm
echo ""
echo "✅ Copy complete!"
