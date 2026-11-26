# Desarrollo

Guía para compilar, probar y orientarse en el repositorio. Para contribuir al código, lea también
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Para usar OpenGeoSlide sin compilar nada, vaya al [README](../README.md).

## Estructura del repositorio

- `crates/ogs-core/`: motor (modelo, geometría, dovelas, métodos, búsqueda, informe).
- `crates/ogs-cli/`: binario `ogs`.
- `crates/ogs-wasm/`: wrapper WebAssembly (`wasm-bindgen`).
- `schema/ogs-0.1.schema.json`: JSON Schema del formato `.ogs.json` v0.1.
- `schema/ogs-0.2.schema.json`: JSON Schema del formato `.ogs.json` v0.2 (agrega `loads` y `analysis.seismic`; acepta también v0.1).
- `apps/web/`: aplicación web (React y Vite): editor gráfico, importación DXF/CSV, informe PDF y PWA; ver [`apps/web/README.md`](../apps/web/README.md).
- `verification/`: casos publicados, harness y batería diferencial frente a cSlope, y pruebas en Python.
- `examples/acads1a.ogs.json`: caso ACADS 1(a), talud homogéneo seco.

## Compilar y probar

```sh
cargo build --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p ogs-core --lib                                # tests unitarios (modelo)
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: 51/51 checks publicados
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa).

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
