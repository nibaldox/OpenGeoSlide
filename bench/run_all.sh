#!/usr/bin/env bash
# Suite de rendimiento de OpenGeoSlide (spike): nativo (1 hilo y paralelo), Node (WASM),
# Chrome headless (WASM) y bench/RESULTS.md. Caso: verification/cases/V047a.json.
# Uso: bench/run_all.sh   (desde cualquier directorio). Sale con 1 si los FS no coinciden.
set -euo pipefail

bench_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$bench_dir/.." && pwd)"
case_file="$repo_root/verification/cases/V047a.json"
results="$bench_dir/results"
wasm_release="$repo_root/target/wasm32-unknown-unknown/release/ogs_wasm.wasm"

cd "$repo_root"
mkdir -p "$results"

echo "[1/7] ogs bench nativo (1 hilo, release)"
cargo build --release -p ogs-cli
./target/release/ogs bench "$case_file" --reps 5 --method all > "$results/native.json"

echo "[2/7] ogs bench nativo paralelo (--features parallel, target-dir aparte)"
cargo build --release -p ogs-cli --features parallel --target-dir "$repo_root/target/native-parallel"
"$repo_root/target/native-parallel/release/ogs" bench "$case_file" --reps 5 --method all \
  > "$results/native-parallel.json"

echo "[3/7] wasm para la web (apps/web/src/wasm)"
"$repo_root/apps/web/scripts/build-wasm.sh"

echo "[4/7] wasm para Node (bench/node/pkg)"
rm -rf "$bench_dir/node/pkg"
wasm-bindgen --target nodejs --out-dir "$bench_dir/node/pkg" "$wasm_release"
node "$bench_dir/node/bench.mjs" "$case_file" > "$results/node-wasm.json"

echo "[5/7] build de la web (dist/) y dependencias de bench/chrome"
(cd "$repo_root/apps/web" && pnpm install --frozen-lockfile && pnpm build)
(cd "$bench_dir/chrome" && pnpm install --frozen-lockfile)

echo "[6/7] Chrome headless (puerto 5181)"
node "$bench_dir/chrome/run.mjs" "$results/chrome-wasm.json"

echo "[7/7] bench/RESULTS.md y gate de FS"
status=0
node "$bench_dir/report.mjs" || status=$?
exit "$status"
