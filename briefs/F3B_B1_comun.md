# Brief F3B-B1: reglas comunes de los seis escritores

Responde en **español neutro, sin voseo**. Este archivo lo leen los seis escritores de B1. Cada uno tiene además su
brief propio, `briefs/F3B_B1_<tarea>.md`.

## Contexto

- **Bloque F3B** de OpenGeoSlide: Hoek-Brown, SHANSEP y búsqueda no circular, formato v0.6.
- **Contrato normativo:** `briefs/05_CONTRATOS_FASE3B.md`. Léelo completo, con las enmiendas de F6.14 (E16n a E16q).
  F6.8, F6.9 y F6.10 ya están cerradas.
- **B0 está integrado** en `f3b-integracion`:
  - el motor tiene los tipos, la validación, el esquema 0.6, los ganchos de `lib.rs` y los stubs
    `todo!("F3B-M-HB")`, `todo!("F3B-M-SH")` y `todo!("F3B-M-NC")`;
  - la web tiene los tipos, la tabla «campo → versión», la ida y vuelta sin pérdida, los cuatro avisos y el motor
    simulado.
- **Prototipos con las cifras de referencia:**
  - `docs/fase3/exploracion/X28.md`, `X28_proto/` y `X28_filas/` para Hoek-Brown. Las cifras del producto (regla de la
    envolvente completa) están en `X28_filas/reglas_coordinador.json` y en la tabla de F6.8;
  - `X29.md`, `X29_proto/` y `X29_filas/` para la búsqueda no circular;
  - `X30.md`, `X30_proto/` y `X30_filas/` para SHANSEP.
- **Mapa del motor y de la web:** `docs/fase3/exploracion/X27.md`, con `archivo:línea` de `0b9c984`; verifica antes de
  usar.
- **Dueños de archivo:** la tabla de abajo. Un archivo que no es tuyo no se edita. Si necesitas un cambio ahí, detente
  y pídelo en el informe, con el diff que propones.

| Escritor | Agente | Archivos propios |
|---|---|---|
| **M-HB** | Terra | `crates/ogs-core/src/hoek_brown.rs`, `strength_loop.rs`; en `crates/ogs-core/src/methods/` solo funciones **nuevas** que devuelven el N′ por dovela de una solución, sin cambiar las existentes; `crates/ogs-core/tests/f3b_hoek_brown.rs` y `tests/data/f3b/hb/` (nuevos) |
| **M-SH** | Antigravity | `crates/ogs-core/src/shansep.rs`; `crates/ogs-core/tests/f3b_shansep.rs` y `tests/data/f3b/sh/` (nuevos) |
| **M-NC** | Terra | `crates/ogs-core/src/noncircular.rs`; `search.rs`, solo para llenar `SearchResult.seeds` (F6.10, punto 1); `surface.rs`, solo funciones **nuevas** (conversión del círculo y admisibilidad de la búsqueda); `crates/ogs-core/tests/f3b_noncircular.rs` y `tests/data/f3b/nc/` (nuevos) |
| **V** | Antigravity | `verification/tools/import_cslope.py` y su test, `verification/harness/to_cslope.py` y su test, `verification/differential/` (bloque F3B), `verification/pending/F3B/` (nuevo), `crates/ogs-py/tests/test_v06.py` (nuevo) |
| **W1** | Terra | `apps/web/src/editor/panels/MaterialsPanel.tsx`, `forms.ts`, `SearchPanel.tsx`, `AnalysisPanel.tsx`, `Fields.tsx`; `apps/web/src/editor/state/validateLocal.ts`, `reducer.ts`, `units.ts`, `geotech.ts`, `localIssues.ts`, `hoekBrown.ts` (nuevo); tests nuevos `*.f3b.test.ts` junto a esos archivos |
| **W2** | Antigravity | `apps/web/src/render/**`, `apps/web/src/editor/canvas/**`, `apps/web/src/report/**`, `apps/web/src/io/csv.ts`, `apps/web/src/onboarding/helpContent.ts`, `apps/web/src/ui/HelpDialog.tsx`, `apps/web/src/editor/panels/DiagnosticsPanel.tsx`, los **textos** de `apps/web/src/engine/warnings.ts` (no los códigos); tests nuevos `*.f3b.test.ts` junto a esos archivos |

**Nadie edita en B1:**
- `crates/ogs-core/src/{lib,model,loads,strength,report,slicer}.rs`, `schema/**`, `apps/web/src/engine/types.ts`,
  `apps/web/src/io/ogsJson.ts`, `briefs/**`, `docs/**` y `CHANGELOG.md`;
- `Cargo.toml`, `Cargo.lock`, `apps/web/package.json` y `pnpm-lock.yaml`: no se agregan dependencias;
- `verification/tools/identity_vs_baseline.py` e `identity_exceptions.json`.

Cada escritor de motor borra **solo su** test de stub de `crates/ogs-core/tests/f3b_format.rs` (el
`#[should_panic(expected = "F3B-M-HB")]`, el de `F3B-M-SH` o el de `F3B-M-NC`) y nada más de ese archivo.

## Reglas

- **Rama y aislamiento:**
  - Terra trabaja en el worktree `~/archivos/opengeoslide-wt/f3b1-<tarea>`;
  - Antigravity, en el clon `~/archivos/opengeoslide-agy/f3b1-<tarea>`, con el push deshabilitado;
  - las dos ramas se crean desde `f3b-integracion`.
- **Commits** en tu rama, con rutas explícitas (`git add <rutas>`) y la identidad del repo. **Sin push, sin tags.**
- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `export CARGO_TARGET_DIR=$TMPDIR/f3b1-<tarea>-target`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`;
  - el binario base de la v0.4.0 está en `$TMPDIR/f3b-base/ogs`: **no lo reemplaces**.
- **Puertos** para `vite preview`: W1 usa el 5182 y W2 el 5186. Nunca el 5180 ni el 5181.
- **La física de otro escritor no existe en tu rama.** Los tres stubs siguen con `todo!()` hasta la integración.
  - Un test de motor tuyo no puede usar los materiales o la búsqueda de otro escritor.
  - Los escritores de la web prueban con informes simulados (JSON escritos a mano con la forma de F6.6) y no mandan
    modelos v0.6 al motor real: el WASM y el binario de tu rama siguen con los stubs.
- **No se relaja ninguna tolerancia ni se cambia una fila de referencia.** Si un criterio no se cumple, detente y
  repórtalo con las cifras. Ante una cuestión de forma que tenga precedente en el repo, sigue el precedente y
  anótala en las decisiones del informe.
- No edites `CHANGELOG.md`: propón tus líneas en el informe.

## Gates

**Motor** (M-HB, M-SH, M-NC) y **V**, desde tu rama:

```bash
cargo fmt --all --check
cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings
cargo test -p ogs-core --release --no-fail-fast
cargo test -p ogs-core --release --no-fail-fast --features parallel
cargo test -p ogs-core --release --test acceptance -- --nocapture | grep checks   # «327 checks, 0 failures» o más
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME OGS_BIN=$CARGO_TARGET_DIR/release/ogs uv run -q --python 3.13 --no-project \
  --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project python verification/tools/identity_vs_baseline.py \
  --normalize-version --include-reinforced --include-v05 --with-v06 \
  --base $TMPDIR/f3b-base/ogs --new $CARGO_TARGET_DIR/release/ogs --out $TMPDIR/f3b1-<tarea>-identity
```

La identidad tiene que dar **0 diferencias**. Un gate que no imprime nada es una falla: revisa el código de salida.

**Web** (W1, W2), desde tu rama:

```bash
cargo build --release -p ogs-cli && apps/web/scripts/build-wasm.sh
cd apps/web && pnpm install --frozen-lockfile --prefer-offline
pnpm test && OGS_BIN=$CARGO_TARGET_DIR/release/ogs pnpm test
pnpm exec tsc --noEmit && pnpm build
```

Anota las cifras de `f3b-integracion` antes de empezar y las de tu rama al terminar.

## Informe final

- commits (hash y mensaje) y archivos tocados, que tienen que estar todos en tu lista;
- la salida resumida de cada gate, con las cifras;
- la tabla de tus filas de aceptación: referencia, cifra del motor, diferencia y si pasa;
- las decisiones que tomaste donde el contrato dejaba margen;
- lo que pides a otro dueño, con el diff propuesto;
- las líneas propuestas para el CHANGELOG.
