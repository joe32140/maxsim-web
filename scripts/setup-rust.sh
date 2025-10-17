#!/bin/bash

# Quick setup script for Rust + WASM development

set -e

echo "🚀 Setting up Rust for WASM development..."
echo ""

# Check if Rust is installed
if command -v rustc &> /dev/null; then
    echo "✅ Rust already installed: $(rustc --version)"
else
    echo "📦 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    echo "✅ Rust installed: $(rustc --version)"
fi

# Add WASM target
echo ""
echo "📦 Adding wasm32 target..."
rustup target add wasm32-unknown-unknown
echo "✅ WASM target added"

# Install wasm-pack
echo ""
if command -v wasm-pack &> /dev/null; then
    echo "✅ wasm-pack already installed: $(wasm-pack --version)"
else
    echo "📦 Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    echo "✅ wasm-pack installed: $(wasm-pack --version)"
fi

# Summary
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Installed:"
echo "  - Rust: $(rustc --version)"
echo "  - Cargo: $(cargo --version)"
echo "  - wasm-pack: $(wasm-pack --version 2>/dev/null || echo 'not found')"
echo ""
echo "Next steps:"
echo "  1. Reload your shell: source ~/.bashrc (or ~/.zshrc)"
echo "  2. Build WASM: npm run build:wasm"
echo "  3. Run benchmarks: npm run benchmark"
echo ""
