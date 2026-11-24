# OpenGeoSlide

Software libre (Apache-2.0) para el análisis de estabilidad de taludes 2D por equilibrio límite
(Bishop simplificado y Spencer). El motor está escrito en Rust y compila a binario nativo y a WebAssembly.

> **Estado: Fase 0 / spike.** Este commit es el esqueleto del workspace: tipos y firmas congeladas
> (contrato v0.1), orquestación de `analyze` y CLI/wasm mínimos. Los cálculos (dovelas, métodos, búsqueda)
> son `todo!()` pendientes de W1a, W1b y W1c. El test de aceptación está en rojo a propósito.

## Estructura

- `crates/ogs-core/`: motor (modelo, geometría, dovelas, métodos, búsqueda, informe).
- `crates/ogs-cli/`: binario `ogs`.
- `crates/ogs-wasm/`: wrapper WebAssembly (`wasm-bindgen`).
- `schema/ogs-0.1.schema.json`: JSON Schema del formato `.ogs.json` v0.1.
- `examples/acads1a.ogs.json`: caso ACADS 1(a), talud homogéneo seco.

## Compilar y probar

```sh
cargo build --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p ogs-core --lib                                # tests unitarios (modelo)
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: en rojo en Fase 0
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa).

Para generar el paquete JS a partir del `.wasm` hace falta `wasm-bindgen-cli` 0.2.130, la misma
versión que fija el crate.

## Licencia

Apache-2.0. Véase [LICENSE](LICENSE).
