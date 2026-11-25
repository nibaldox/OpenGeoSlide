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
  | Bishop simplificado | 51,08 | 52,70 | 1,03 |
  | Spencer | 177,75 | 185,40 | 1,04 |

  Es una medición de spike en una sola máquina: sirve para el orden de magnitud, no para comparar versiones.
  Detalle y gate de FS en [`bench/RESULTS.md`](bench/RESULTS.md).

- **Informes:**
  - [`verification/REPORT.md`](verification/REPORT.md): aceptación y harness frente a cSlope.
  - [`verification/differential/REPORT.md`](verification/differential/REPORT.md): batería diferencial.
  - [`docs/reviews/`](docs/reviews/): revisiones adversariales de la Fase 0.

> **Aviso.** OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Los resultados deben
> validarse por un profesional competente antes de usarlos en un diseño. El criterio profesional y la
> responsabilidad sobre el diseño son del usuario.

## Limitaciones conocidas (Fase 0)

Limitaciones que la revisión adversarial R4 ([`docs/reviews/R4_agy.md`](docs/reviews/R4_agy.md)) dejó abiertas para la
Fase 1. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (38/38) ni la batería
diferencial (20/20 + 20/20).

- **R4-01, selección de la raíz de λ en Spencer:** entre dos raíces admisibles, se elige la de menor |λ|, aunque sea
  negativa. En taludes bicapa con un estrato superior cohesivo (φ = 0) puede dar un FS de −7,08 % a +3,47 % frente a
  cSlope (47 de 1008 casos bicapa difieren más de 1 %). Aviso: `negative_lambda` (nota) y `negative_effective_normal_major`.
- **R4-02, paso fijo de 0,05 en el barrido de λ:** dos raíces admisibles dentro del mismo paso no se detectan y el
  resultado es `no_lambda_root`, aunque cSlope converge (p. ej., c_top = 74,05: cSlope 1,914138 y ogs sin FS).
  Aviso: `no_lambda_root`, con estado `not_converged` y sin FS.
- **R4-03a, avisos de búsqueda:** `truncated_driving_mass` solo se evalúa en la superficie final. Si el círculo crítico
  ganador no está truncado, el aviso de un bloque descartado motriz de un candidato truncado se pierde.
  Aviso: ninguno en ese caso.
- **Frontera de `min_width` (E11d′):** la búsqueda no alcanza la frontera ancho = `min_width`. En el botadero de
  dos bancos con `min_width = 10`, ogs da 0,855 frente a 1,142 de cSlope (conservador). Aviso:
  `effective_width_below_min` y `truncated_mass`.
- **Bloques descartados que salen por una pared lateral (E11e′):** no se pueden clasificar, así que solo reciben la
  nota `truncated_mass`, aunque sean motrices. Aviso: `truncated_mass`.
- **`unit_weight_sat` sin cobertura:** ningún caso de aceptación usa `unit_weight_sat` (0 de 16 casos de verificación).
  La ruta de peso saturado bajo la piezométrica no está verificada frente a cSlope. Aviso: ninguno.

## Licencia

Apache-2.0. Véase [LICENSE](LICENSE).
