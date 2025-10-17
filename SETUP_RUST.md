# Setting Up Rust for WASM Development

This guide will help you set up Rust and wasm-pack for Phase 3 development.

## 1. Install Rust

```bash
# Install Rust using rustup (official installer)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow the prompts (default options are fine)
# After installation, reload your shell:
source $HOME/.cargo/env

# Verify installation
rustc --version
cargo --version
```

## 2. Add WASM Target

```bash
# Add WebAssembly target to Rust
rustup target add wasm32-unknown-unknown
```

## 3. Install wasm-pack

```bash
# Install wasm-pack (WASM build tool)
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Verify installation
wasm-pack --version
```

## 4. Install wasm-opt (Optional but Recommended)

```bash
# On Ubuntu/Debian
sudo apt-get install binaryen

# On macOS
brew install binaryen

# Verify
wasm-opt --version
```

## 5. Verify Setup

```bash
# Navigate to maxsim-cpu repo
cd /home/joe/maxsim-cpu

# Test build (will create after setup)
npm run build:wasm
```

## Expected Versions

- Rust: 1.70+ (any recent stable version)
- wasm-pack: 0.12+
- wasm-opt: 100+ (optional)

## Quick Install Script

If you want to install everything at once:

```bash
# Run this from maxsim-cpu directory
./scripts/setup-rust.sh
```

## Troubleshooting

### Rust not in PATH
```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.cargo/bin:$PATH"
source ~/.bashrc  # or ~/.zshrc
```

### wasm-pack build fails
```bash
# Make sure wasm32 target is installed
rustup target list --installed | grep wasm32

# If not there, add it
rustup target add wasm32-unknown-unknown
```

### Permission denied
```bash
# Don't use sudo with cargo/rustup
# They install to user directory by default
```

## Next Steps

Once Rust is installed:
1. Run `npm run build:wasm` to test
2. Check `dist/wasm/` for compiled WASM module
3. Run benchmarks to see 10x improvement!

## Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [WASM Book](https://rustwasm.github.io/docs/book/)
- [wasm-pack Docs](https://rustwasm.github.io/wasm-pack/)
- [WASM SIMD](https://v8.dev/features/simd)
