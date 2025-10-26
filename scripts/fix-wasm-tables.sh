#!/bin/bash

# Fix WASM table sizes to prevent "invalid address in table" errors
# This script increases both funcref and externref table sizes

set -e

WASM_FILE="${1:-dist/wasm/maxsim_web_wasm_bg.wasm}"

if [ ! -f "$WASM_FILE" ]; then
    echo "❌ WASM file not found: $WASM_FILE"
    exit 1
fi

echo "🔧 Fixing WASM table sizes in $WASM_FILE..."

# Convert WASM to WAT
wasm2wat "$WASM_FILE" > temp.wat

# Increase funcref table: 29 → 256 (growable to 4096)
sed -i 's/(table (;0;) 29 29 funcref)/(table (;0;) 256 4096 funcref)/' temp.wat

# Increase externref table: 128 → 1024 (growable to 4096)
sed -i 's/(table (;1;) 128 externref)/(table (;1;) 1024 4096 externref)/' temp.wat

# Convert WAT back to WASM
wat2wasm temp.wat -o "$WASM_FILE"

# Cleanup
rm temp.wat

echo "✅ Fixed WASM tables (growable):"
echo "   - funcref:   29 → 256 (max 4096)"
echo "   - externref: 128 → 1024 (max 4096)"
