# Plan Fase 0: spike técnico de OpenGeoSlide

**Objetivo:** demostrar que un motor LEM propio en Rust, compilado a nativo y a WASM, reproduce valores publicados
(error ≤ tolerancia del caso, ~1 % en superficie fija y ~2 % en búsqueda) y medir su rendimiento en navegador frente a nativo.

**Modo de trabajo:**
- Delegación estricta: el coordinador (Hermes) escribe el plan, los contratos, los briefs y los criterios de aceptación,
  y verifica de forma independiente.
- Los subagentes escriben el código, los tests y los fixtures.
- La revisión adversarial la hace **Antigravity (`agy`)** en modo solo lectura sobre el artefacto congelado.

**Contratos:** `briefs/00_CONTRATOS.md` (congelados).

## Olas

| Ola | Tarea | Dueño de archivos | Depende de |
|---|---|---|---|
| 0 | **W0a** esqueleto: workspace, `ogs-core` (model/report/lib + stubs), `ogs-cli`, `ogs-wasm`, schema, LICENSE, README, test de aceptación en RED | todo, salvo `verification/cases`, `verification/tools`, `NOTICE` | contratos |
| 0 | **W0b** casos: conversión de ≥ 12 problemas de cSlope (MIT) a `verification/cases/*.json` + `NOTICE` | `verification/cases/**`, `verification/tools/**`, `NOTICE` | contratos |
| 1 | **W1a** `geometry.rs` + `slicer.rs` (PreparedModel, Ground, slice_circle) | esos 2 archivos + tests unitarios | W0a |
| 1 | **W1b** `methods/` (Bishop, Spencer) + identidades §5 con dovelas sintéticas | `methods/**` | W0a |
| 1 | **W1c** `search.rs` con Ground y evaluador falsos | `search.rs` | W0a |
| 1 | **W1d** `apps/web` (Vite + React + TS + Worker) contra un mock de la API wasm | `apps/web/**` | contratos |
| 1 | **W1e** harness Python `verification/harness` (ogs-cli + oráculo cSlope) | `verification/harness/**` | W0b |
| 2 | **W2a** integración y gate de aceptación (correcciones dentro de core si el gate falla) | según hallazgos | W1a-c |
| 2 | **W2b** web con el wasm real + página de benchmark; **W2c** benchmarks nativo/Node/Chrome | `apps/web`, `bench/` | W2a |
| R | Revisión adversarial con `agy` (core numérico + contratos) → arbitraje → ola correctiva | — | W2a |

## Compuertas de salida de la Fase 0
1. `cargo test --workspace` en verde; `acceptance.rs` con todos los checks dentro de su tolerancia.
2. Informe `verification/REPORT.md`: publicado vs. ogs vs. cSlope, por check.
3. Benchmark: búsqueda de ~10.000 círculos con Spencer, tiempos en nativo, Node (WASM) y Chrome (WASM).
4. Demo web funcionando en una URL local.
5. Veredicto de `agy` arbitrado y hallazgos CRITICAL/HIGH corregidos.
