#!/usr/bin/env bash
# Regresión completa de I-W: todos los guiones de docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s,u6d,u6g,u6k}-e2e/ y docs/fase3/{w1e,w1f}/e2e/
# (sin lib.mjs, *explore* ni dbg) contra `vite preview` (5186; w1f_canvas, en 5187 con el gancho de build_hook.sh) más los de docs/fase3/iw/e2e/
# y, desde R2-I2, los recorridos de refuerzos v0.4 de docs/fase3/r2i2/e2e/ (tablestaca anclada, muro TEM, clavos, ida y vuelta 0.4)
# y, desde F3G (I-W), el panel de la grieta y su axe (docs/fase3/g1w1/e2e/g1w1_*.mjs) y el lienzo con el motor real, sin datos simulados
# (docs/fase3/g1w2/e2e/g1w2_*.mjs; necesita OGS_BIN y axe-core en $TMPDIR/x8-ux o w2-e2e)
# y, desde F3G (I-G), la tarjeta del pilote de Ito-Matsui con su axe en claro y oscuro (docs/fase3/g3w/e2e/g3w_*.mjs)
# y, desde R12 (I-G2), el recorrido del pilote de Ito-Matsui en el lienzo (docs/fase3/r12/e2e/r12_*.mjs);
# desde R13, γw por defecto en imperial y «Sin grieta» en Casos y, desde R13 (I-G3), el rótulo del corte de la masa sin grieta de tracción (E15m-15) en el
# lienzo, Casos y el PDF (docs/fase3/r13/e2e/r13_*.mjs);
# (docs/fase2/ux/u2c-e2e/ queda fuera desde CM: sus guiones son anteriores al menú Archivo y fallan igual en la v0.5.1; los cubren
# sus sucesores u3i_u2c_keyboard y u3i_u2c_touch)
# y la aceptación del bloque UA, 17 comprobaciones (docs/suite-a/e2e/aceptacion_ua.mjs; necesita playwright-core y axe-core en OGS_Q, por defecto
# $TMPDIR/ua1/Q, y deja su json y sus capturas en <registros>/aceptacion_ua.out/).
# Los puertos son 5186 y 5187 salvo que se fijen OGS_PORT_PREVIEW y OGS_PORT_HOOK (para correrla en otro lado sin pisar la regresión del coordinador).
# Los guiones salen con código 0 aunque fallen: se cuentan las líneas ^FAIL de cada registro y se marcan los que no tienen ^OK.
# Uso: TMPDIR=<scratch> OGS_REPO=<repo> bash docs/fase3/iw/e2e/run_regression.sh <carpeta de registros>
set -u
repo="${OGS_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
logs="${1:?carpeta de registros}"
mkdir -p "$logs"
cd "$repo"
port_preview="${OGS_PORT_PREVIEW:-5186}"
port_hook="${OGS_PORT_HOOK:-5187}"
export OGS_URL="http://127.0.0.1:$port_preview/" OGS_REPO="$repo" OGS_BIN="$repo/target/release/ogs" OGS_FX="$TMPDIR/u6g-fx" OGS_Q="${OGS_Q:-$TMPDIR/ua1/Q}"
# Los dos servidores los lanza quien corre esto (no hay que usar `pnpm exec` en los dos: chocan). 5186: `vite preview` de apps/web/dist;
# 5187: `bash docs/fase3/w1f/e2e/build_hook.sh` y luego `vite preview --outDir $TMPDIR/f3iw-hook-dist --port 5187` (ambos con node_modules/.bin/vite).
for port in "$port_preview" "$port_hook"; do
  curl -fsS -o /dev/null "http://127.0.0.1:$port/" || { echo "FALTA el servidor en el puerto $port (ver el comentario de arriba)" >&2; exit 2; }
done
env -u PYTHONPATH -u PYTHONHOME python3 docs/fase2/ux/u6g-e2e/make_fixtures.py "$OGS_FX" > /dev/null
{
for f in docs/fase2/ux/{u3i,u3m,u3o,u4m,u4p,u5e,u5s,u6d,u6g,u6k}-e2e/*.mjs docs/fase3/w1e/e2e/w1e_*.mjs docs/fase3/w1f/e2e/w1f_canvas.mjs docs/fase3/iw/e2e/iw_*.mjs docs/fase3/r2i2/e2e/r2i2_*.mjs docs/fase3/g1w1/e2e/g1w1_*.mjs docs/fase3/g1w2/e2e/g1w2_*.mjs docs/fase3/g3w/e2e/g3w_*.mjs docs/fase3/r12/e2e/r12_*.mjs docs/fase3/r13/e2e/r13_*.mjs docs/suite-a/e2e/aceptacion_ua.mjs docs/cm/e2e/cm_*.mjs; do
  case "$f" in */lib.mjs|*explore*|*dbg*) continue;; esac
  n=$(basename "$f" .mjs)
  url=$OGS_URL; [ "$n" = w1f_canvas ] && url="http://127.0.0.1:$port_hook/"
  extra=(); [ "$n" = aceptacion_ua ] && extra=(OUT="$logs/aceptacion_ua.out" OGS_LABEL=regresion)
  env ${extra[@]+"${extra[@]}"} OGS_URL="$url" timeout 600 node "$f" > "$logs/$n.log" 2>&1; rc=$?
  ok=$(grep -c "^OK" "$logs/$n.log"); fail=$(grep -c "^FAIL" "$logs/$n.log")
  echo "$n exit=$rc OK=$ok FAIL=$fail"
done
echo ALLDONE
} | tee "$logs/_resumen.txt"
