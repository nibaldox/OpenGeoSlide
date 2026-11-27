#!/usr/bin/env bash
# Compila el crate ogs-wasm y genera los bindings JS que consume la app web.
# Salida: apps/web/src/wasm/ogs_wasm.js (+ .d.ts y .wasm). Si falla, la app usa el motor simulado.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
out_dir="$repo_root/apps/web/src/wasm"

cd "$repo_root"

echo "[1/2] cargo build -p ogs-wasm (wasm32-unknown-unknown, release)"
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release

echo "[2/2] wasm-bindgen --target web -> apps/web/src/wasm"
wasm-bindgen --target web --out-dir "$out_dir" \
  "${CARGO_TARGET_DIR:-target}/wasm32-unknown-unknown/release/ogs_wasm.wasm"

echo "Listo: $out_dir/ogs_wasm.js"
