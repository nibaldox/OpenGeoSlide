# OpenGeoSlide

Software libre (Apache-2.0) para el análisis de estabilidad de taludes 2D por equilibrio límite
(Bishop simplificado y Spencer). El motor está escrito en Rust y compila a binario nativo y a WebAssembly.

> **Estado: Fase 0, en desarrollo.** El motor, la CLI, la web y los tests de aceptación están implementados.
> Resumen de la verificación de la Fase 0 en [Estado de verificación (Fase 0)](#estado-de-verificación-fase-0).

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
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: 38/38 checks publicados
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa).

Para generar el paquete JS a partir del `.wasm` hace falta `wasm-bindgen-cli` 0.2.130, la misma
versión que fija el crate.

## Estado de verificación (Fase 0)

- **Aceptación:** 38/38 checks publicados cumplen su tolerancia, en 16 casos (`verification/cases/`).
  Test: `cargo test -p ogs-core --test acceptance`.
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce 38/38 de esos mismos checks publicados.
- **Batería diferencial** (ogs frente a cSlope 0.1.0, 10 modelos sintéticos, bishop y spencer):
  - búsqueda: **20/20** OK (`FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos);
  - superficie fija: **20/20** OK (`|Δ| ≤ 0,5 %`). Una de ellas es concordancia: D03 spencer, donde ambos motores
    declaran la superficie sin solución (ogs `not_converged`, cSlope `EngineError`).
- **Bench** (V047a, búsqueda 20 × 20 × 20 con refinamiento, 50 dovelas; mediana de 5 repeticiones):

  | método | nativo, 1 hilo (ms) | Chrome headless, WASM (ms) | Chrome / nativo |
  |---|---:|---:|---:|
  | Bishop simplificado | 42,36 | 44,00 | 1,04 |
  | Spencer | 108,88 | 111,50 | 1,02 |

  Es una medición de spike en una sola máquina: sirve para el orden de magnitud, no para comparar versiones.
  Detalle y gate de FS en [`bench/RESULTS.md`](bench/RESULTS.md).

- **Informes:**
  - [`verification/REPORT.md`](verification/REPORT.md): aceptación y harness frente a cSlope.
  - [`verification/differential/REPORT.md`](verification/differential/REPORT.md): batería diferencial.
  - [`docs/reviews/`](docs/reviews/): revisiones adversariales de la Fase 0.

> **Aviso.** OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Los resultados deben
> validarse por un profesional competente antes de usarlos en un diseño. El criterio profesional y la
> responsabilidad sobre el diseño son del usuario.

## Licencia

Apache-2.0. Véase [LICENSE](LICENSE).
