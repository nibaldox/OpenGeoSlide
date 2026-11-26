#!/usr/bin/env bash
# Regresión completa de I-W: todos los guiones de docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s,u6d,u6g,u6k}-e2e/ y docs/fase3/{w1e,w1f}/e2e/
# (sin lib.mjs, *explore* ni dbg) contra `vite preview` (5186; w1f_canvas, en 5187 con el gancho de build_hook.sh) más los de docs/fase3/iw/e2e/
# y, desde R2-I2, los recorridos de refuerzos v0.4 de docs/fase3/r2i2/e2e/ (tablestaca anclada, muro TEM, clavos, ida y vuelta 0.4)
# y, desde F3G (I-W), el panel de la grieta y su axe (docs/fase3/g1w1/e2e/g1w1_*.mjs) y el lienzo con el motor real, sin datos simulados
# (docs/fase3/g1w2/e2e/g1w2_*.mjs; necesita OGS_BIN y axe-core en $TMPDIR/x8-ux o w2-e2e).
# Los guiones salen con código 0 aunque fallen: se cuentan las líneas ^FAIL de cada registro y se marcan los que no tienen ^OK.
# Uso: TMPDIR=<scratch> OGS_REPO=<repo> bash docs/fase3/iw/e2e/run_regression.sh <carpeta de registros>
set -u
repo="${OGS_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
logs="${1:?carpeta de registros}"
mkdir -p "$logs"
cd "$repo"
export OGS_URL=http://127.0.0.1:5186/ OGS_REPO="$repo" OGS_BIN="$repo/target/release/ogs" OGS_FX="$TMPDIR/u6g-fx"
# Los dos servidores los lanza quien corre esto (no hay que usar `pnpm exec` en los dos: chocan). 5186: `vite preview` de apps/web/dist;
# 5187: `bash docs/fase3/w1f/e2e/build_hook.sh` y luego `vite preview --outDir $TMPDIR/f3iw-hook-dist --port 5187` (ambos con node_modules/.bin/vite).
for port in 5186 5187; do
  curl -fsS -o /dev/null "http://127.0.0.1:$port/" || { echo "FALTA el servidor en el puerto $port (ver el comentario de arriba)" >&2; exit 2; }
done
env -u PYTHONPATH -u PYTHONHOME python3 docs/fase2/ux/u6g-e2e/make_fixtures.py "$OGS_FX" > /dev/null
{
for f in docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s,u6d,u6g,u6k}-e2e/*.mjs docs/fase3/w1e/e2e/w1e_*.mjs docs/fase3/w1f/e2e/w1f_canvas.mjs docs/fase3/iw/e2e/iw_*.mjs docs/fase3/r2i2/e2e/r2i2_*.mjs docs/fase3/g1w1/e2e/g1w1_*.mjs docs/fase3/g1w2/e2e/g1w2_*.mjs; do
  case "$f" in */lib.mjs|*explore*|*dbg*) continue;; esac
  n=$(basename "$f" .mjs)
  url=$OGS_URL; [ "$n" = w1f_canvas ] && url=http://127.0.0.1:5187/
  OGS_URL=$url timeout 600 node "$f" > "$logs/$n.log" 2>&1; rc=$?
  ok=$(grep -c "^OK" "$logs/$n.log"); fail=$(grep -c "^FAIL" "$logs/$n.log")
  echo "$n exit=$rc OK=$ok FAIL=$fail"
done
echo ALLDONE
} | tee "$logs/_resumen.txt"
