# Desarrollo

Guía para compilar, probar y orientarse en el repositorio. Para contribuir al código, lea también
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Para usar OpenGeoSlide sin compilar nada, vaya al [README](../README.md).

## Estructura del repositorio

- `crates/ogs-core/`: motor (modelo, geometría, dovelas, métodos, búsqueda, informe). Los métodos están en
  `src/methods/` (`bishop`, `spencer`, `morgenstern_price`, `janbu`); `src/surface.rs` representa la superficie (círculo
  o polilínea) y `src/strength.rs` resuelve la resistencia por dovela (Mohr-Coulomb y no drenado).
- `crates/ogs-cli/`: binario `ogs`.
- `crates/ogs-wasm/`: wrapper WebAssembly (`wasm-bindgen`).
- `schema/ogs-0.1.schema.json`: JSON Schema del formato `.ogs.json` v0.1.
- `schema/ogs-0.2.schema.json`: JSON Schema del formato `.ogs.json` v0.2 (agrega `loads` y `analysis.seismic`; acepta también v0.1).
- `schema/ogs-0.3.schema.json`: JSON Schema del formato `.ogs.json` v0.3 (agrega material no drenado, superficie polilínea,
  Morgenstern-Price, Janbu y `analysis.interslice`; acepta también v0.1 y v0.2). Es el que valida `docs/tools/`.
- `apps/web/`: aplicación web (React y Vite): editor gráfico, importación DXF/CSV, informe PDF y PWA; ver [`apps/web/README.md`](../apps/web/README.md).
- `verification/`: casos publicados (`cases/`), checks retenidos (`pending/`), harness y batería diferencial frente a
  cSlope, importador (`tools/import_cslope.py`) y pruebas en Python.
- `docs/tools/validar_ejemplos.py`: valida los ejemplos de [`formato-ogs-json.md`](formato-ogs-json.md) contra el
  esquema 0.3 y contra `ogs analyze`.
- `bench/`: medición de rendimiento (`bench/RESULTS.md`).
- `briefs/`: contratos normativos de cada fase (`00_CONTRATOS.md`, `01_CONTRATOS_FASE1.md`, `02_CONTRATOS_FASE3.md`).
- `examples/acads1a.ogs.json`: caso ACADS 1(a), talud homogéneo seco.

## Compilar y probar

```sh
cargo build --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p ogs-core --lib                                # tests unitarios (modelo)
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: 213/213 checks publicados (93 casos)
cargo test -p ogs-core --release --no-fail-fast             # todas las pruebas del motor
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa). Las pruebas deben pasar también con `--features parallel`
(`cargo test -p ogs-core --release --no-fail-fast --features parallel`): el resultado es idéntico bit a bit.

## Probar un modelo y validar la documentación

```sh
cargo build --release -p ogs-cli
target/release/ogs analyze examples/acads1a.ogs.json        # informe JSON; sale con código 2 si el modelo es inválido

# Ejemplos de docs/formato-ogs-json.md contra schema/ogs-0.3.schema.json y contra ogs analyze
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema python docs/tools/validar_ejemplos.py

# Pruebas en Python (importador de cSlope, esquemas, ida y vuelta de la web con Node 22)
uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest \
  python -m pytest -q verification
```

Los comandos para regenerar los informes de verificación están en [`verificacion.md`](verificacion.md#reproducir).

Para generar el paquete JS a partir del `.wasm` hace falta `wasm-bindgen-cli` 0.2.130, la misma
versión que fija el crate.

## Compilar la web en local

Para compilarla en local (Node 22, pnpm 11 y, para el motor real, el target `wasm32-unknown-unknown` y
`wasm-bindgen-cli` 0.2.130):

```sh
apps/web/scripts/build-wasm.sh          # genera el motor WASM en apps/web/src/wasm/
cd apps/web
pnpm install --frozen-lockfile
pnpm test
VITE_BASE=/OpenGeoSlide/ pnpm build     # genera apps/web/dist/ (sin VITE_BASE, la base es «/»)
pnpm preview
```

Sin el paso del WASM, la web usa un motor simulado que no es válido para ingeniería (véase
[`apps/web/README.md`](../apps/web/README.md)).

## Compilar el wheel de Python desde el código fuente

Para compilarlo desde el código fuente (necesita Rust y [maturin](https://www.maturin.rs)):

```sh
git clone https://github.com/nibaldox/OpenGeoSlide.git
cd opengeoslide/crates/ogs-py
scripts/prepare-license-files.sh                 # copia LICENSE y NOTICE junto a pyproject.toml
pip install maturin
maturin build --release --out dist
pip install dist/opengeoslide-*.whl
```

Más detalle del paquete en [`crates/ogs-py/README.md`](../crates/ogs-py/README.md).
