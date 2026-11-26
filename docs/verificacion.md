# Verificación

Detalle de lo que verifica OpenGeoSlide y cómo reproducirlo. El resumen está en el [README](../README.md#verificación).

## Estado de verificación

- **Aceptación:** 51/51 checks publicados cumplen su tolerancia, en 21 casos (`verification/cases/`): 16 casos del
  esquema v0.1 y 5 con sismo o cargas del esquema v0.2 (V102a, V102b, V081a, V081b, V097a).
  Test: `cargo test -p ogs-core --test acceptance`.
- **Paridad entre el editor y el motor** (E12j): el editor web y `ogs-core` aceptan y rechazan los mismos documentos.
  La prueba `apps/web/src/editor/state/parity.test.ts` ejecuta 51 pruebas (25 contra el binario `ogs` real, con `OGS_BIN`;
  sin él se omiten) y corre en CI sin casos omitidos.
- **Ida y vuelta de la web** (E12g): para 113 modelos (51 checks de los 21 casos, 56 de la batería diferencial y 6 de
  frontera), `openOgsJson` + `saveOgsJson` y luego `ogs analyze` dan el mismo código de salida y la misma salida, bit a bit,
  que el modelo original. Test: `verification/tools/test_web_roundtrip.py` (necesita Node 22 y el binario compilado).
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce 51/51 de esos mismos checks publicados.
- **Batería diferencial** (ogs frente a cSlope 0.1.0, 14 modelos sintéticos, bishop y spencer; D11-D14 con sismo y cargas):
  - búsqueda (`FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos): **28/28** OK. D13 (carga lineal) fija
    `min_width = 5 m`: sin él, cSlope encuentra un círculo de 0,67 m bajo la carga (FS 0,614) que ogs descarta por
    `min_m_alpha`;
  - superficie fija (`|Δ| ≤ 0,5 %`): **28/28** OK. D03 spencer es una concordancia (ambos motores declaran la superficie
    sin solución);
  - resultados y diagnóstico de D13 en [`verification/differential/REPORT.md`](../verification/differential/REPORT.md) y
    [`verification/differential/README.md`](../verification/differential/README.md).
- **Bench** (V047a, búsqueda 20 × 20 × 20 con refinamiento, 50 dovelas; mediana de 5 repeticiones):

  | método | nativo, 1 hilo (ms) | Chrome headless, WASM (ms) | Chrome / nativo |
  |---|---:|---:|---:|
  | Bishop simplificado | 50,16 | 55,90 | 1,11 |
  | Spencer | 217,21 | 231,50 | 1,07 |

  Es una medición de spike en una sola máquina: sirve para el orden de magnitud, no para comparar versiones.
  Detalle y gate de FS en [`bench/RESULTS.md`](../bench/RESULTS.md).

- **Informes:**
  - [`verification/REPORT.md`](../verification/REPORT.md): aceptación y harness frente a cSlope.
  - [`verification/differential/REPORT.md`](../verification/differential/REPORT.md): batería diferencial.
  - [`docs/reviews/`](reviews/): revisiones adversariales de la Fase 0.

