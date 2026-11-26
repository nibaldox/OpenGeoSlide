# Verificación

Detalle de lo que verifica OpenGeoSlide y cómo reproducirlo. El resumen está en el [README](../README.md#verificación).
Las cifras de esta página se leen de los informes generados (`verification/REPORT.md`,
`verification/differential/REPORT.md`, `bench/RESULTS.md`) y de los índices de `verification/`; donde un número sale de
un recuento propio de una tabla de esos informes, se dice.

## Estado de verificación

| Se compara con | Resultado | Informe |
|---|---|---|
| Valores publicados (93 casos, 213 checks) | **213/213** | [`verification/REPORT.md`](../verification/REPORT.md) |
| cSlope 0.1.0, búsqueda (14 modelos, Bishop y Spencer) | **28/28** | [`verification/differential/REPORT.md`](../verification/differential/REPORT.md) |
| cSlope 0.1.0, superficie fija (los mismos) | **28/28** | ídem |
| cSlope 0.1.0, Fase 3a (D01-D23: M-P, Janbu, no drenado, polilínea) | **61/71** sobre la base `420baf0`; los 10 que fallan son de D21 a D23 y dependen de E13l-2 y E13l-5 (véase [abajo](#batería-diferencial-frente-a-cslope)) | ídem |
| Web y `ogs` (ida y vuelta, 275 modelos) | **275/275** | `verification/tools/test_web_roundtrip.py` |

## Aceptación: casos publicados

- **213 de 213 checks** publicados cumplen su tolerancia, en **93 casos** (`verification/cases/`). El informe
  [`verification/REPORT.md`](../verification/REPORT.md) da ogs 213 OK, 0 fallas, 0 sin dato, 0 no convergidos.
  Test: `cargo test -p ogs-core --test acceptance`. Todo aviso que no sea informativo hace fallar un check (E5).
- **Por versión del formato** (de [`verification/cases/INDEX.md`](../verification/cases/INDEX.md)):

  | Versión | Casos | Checks |
  |---|---:|---:|
  | v0.1 | 41 | 78 |
  | v0.2 (sismo o cargas) | 5 | 13 |
  | v0.3 (no drenado, polilínea, M-P, Janbu) | 47 | 122 |
  | **Total** | **93** | **213** |

- **Por método** (suma de la columna «checks» del índice; coincide con el recuento de la tabla de `REPORT.md`):

  | Método | Checks |
  |---|---:|
  | Bishop simplificado | 95 |
  | Spencer | 76 |
  | Morgenstern-Price | 27 |
  | Janbu simplificado | 7 |
  | Janbu corregido | 8 |
  | **Total** | **213** |

  Por tipo de superficie, según el recuento de las filas de `REPORT.md`: 112 de búsqueda y 101 de superficie fija.
- Los **47 casos v0.3** vienen de los lotes 1 y 2 de la importación desde cSlope (`undrained` y `s-f-datum`; polilíneas
  fijas, M-P y Janbu), promovidos desde `verification/pending/F3/` cuando el motor reproduce sus checks. El lote 0
  (todo lo convertible con v0.1 o v0.2) no tiene tope ni selección. El índice declara 122 checks para esos 47 casos, de
  ellos 32 del lote 0, 39 del lote 1 y 51 del lote 2
  ([`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md)).
- **Retenidos:** el motor no reproduce **6 checks en 4 casos**, que no cuentan en los 213 y se documentan con su
  diagnóstico (sin relajar ninguna tolerancia):
  - V027 y V028 (Bishop, 1 check cada uno) y V068 (Bishop, 1 check): el FS cae dentro de la tolerancia, pero el motor
    emite `negative_effective_normal_major` y la aceptación rechaza ese aviso;
  - V032a (3 checks): la búsqueda halla un mínimo real, más conservador (FS 1,1706 frente a 1,209 a 1,23 publicados),
    que sale de los rangos efectivos.

  Detalle en [`docs/limitaciones.md`](limitaciones.md#checks-retenidos-y-casos-especiales),
  [`pending/lote0/INDEX.md`](../verification/pending/lote0/INDEX.md) y
  [`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md).
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce **212 de 213** de esos checks; el restante es V027, donde cSlope
  no converge (`REPORT.md`).

## Criterios de la Fase 3a (F3.8)

Cada capacidad nueva tiene su prueba en `crates/ogs-core/tests/`:

| Criterio | Qué comprueba | Prueba |
|---|---|---|
| Neutralidad | un modelo sin campos nuevos da la misma salida en 0.1, 0.2 y 0.3; `undrained` sin gradiente es Mohr-Coulomb con φ = 0, bit a bit; M-P `constant` reproduce a Spencer en los casos y en la batería | `v03_format.rs`, `v03_undrained.rs`, `f3_methods.rs`, `f3_oracle.rs` |
| Equilibrio global | M-P y Spencer: residuo de momento independiente respecto de dos puntos distintos; Janbu: residuo de fuerza horizontal; en un círculo y en una polilínea | `f3_methods.rs`, `f3_polyline.rs` |
| Oráculo | valores de cSlope en V047a (M-P `constant` y `half_sine`, Janbu simplificado y corregido, no drenado con Su constante y con gradiente, polilínea fija) con `|Δ| ≤ 0,1 %` | `f3_oracle.rs` |
| Espejo | x → −x con la dirección invertida da el mismo FS (con f simétrica en M-P) | `f3_oracle.rs`, `f3_polyline.rs`, `v03_undrained.rs` |
| Monotonía | el FS crece con `undrained_strength` y con `strength_gradient > 0` | `v03_undrained.rs` |
| Convergencia geométrica | una polilínea inscrita de N cuerdas tiende al círculo, con orden O(1/N²) | `f3_oracle.rs`, `f3_polyline.rs` |
| Raíz de Janbu y dominio de ξ | menor raíz admisible de F₀; ξ medido sobre el bloque de suelo (D09) | `janbu_root_selection.rs`, `mp_xi_domain.rs` |
| Solución inadmisible | los tres casos de D-1 (polilíneas en V): cierre, momento global, una sola raíz y `r_v` | `d1_spencer_absurd_fs.rs` |

Los valores de referencia del oráculo para V047a están en `briefs/02_CONTRATOS_FASE3.md` (F3.8).

## Paridad entre el editor y el motor, e ida y vuelta de la web

- **Paridad** (E12j): el editor web y `ogs-core` aceptan y rechazan los mismos documentos. La prueba
  `apps/web/src/editor/state/parity.test.ts` ejecuta 51 pruebas (25 contra el binario `ogs` real, con `OGS_BIN`; sin él
  se omiten) y corre en CI sin casos omitidos.
- **Ida y vuelta de la web** (E12g): para **275 modelos** (213 checks de los 93 casos, 56 de la batería diferencial y 6
  de frontera), `openOgsJson` + `saveOgsJson` y luego `ogs analyze` dan el mismo código de salida y la misma salida, bit
  a bit, que el modelo original. Test: `verification/tools/test_web_roundtrip.py` (necesita Node 22 y el binario
  compilado). El número de modelos lo calcula el test a partir del índice de casos.

## Batería diferencial frente a cSlope

Compara ogs con cSlope 0.1.0 en 14 modelos sintéticos de tipo minero y civil (D01-D10 en v0.1; D11-D14 con sismo y
cargas en v0.2), y desde la Fase 3a en nueve modelos v0.3 (D15-D23: D15 a D17 de la Fase 3a y D18 a D23 de la
revisión R10).
Informe: [`verification/differential/REPORT.md`](../verification/differential/REPORT.md); detalle y criterios en
[`verification/differential/README.md`](../verification/differential/README.md).

- **Bishop y Spencer** (14 modelos, 56 checks):
  - búsqueda (`FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos): **28/28** OK. D13 (carga lineal) fija
    `min_width = 5 m`: sin él, cSlope encuentra un círculo de 0,67 m bajo la carga (FS 0,614) que ogs descarta por
    `min_m_alpha`;
  - superficie fija (`|Δ| ≤ 0,5 %`): **28/28** OK. D03 con Spencer es una concordancia (ambos motores declaran la
    superficie sin solución);
  - checks de ogs con avisos no informativos: 7 de 56.
- **Fase 3a** (F3.8): sobre el círculo fijo de cada uno de los 14 modelos, Morgenstern-Price con `half_sine` y Janbu
  corregido, con el criterio de 0,5 %; y tres modelos v0.3 nuevos (D15 a D17; los de R10, D18 a D23, van más abajo):

  | Modelo | Qué prueba | Métodos |
  |---|---|---|
  | D15 | terraplén de 6 m sobre 12 m de arcilla blanda con Su lineal | Bishop y Spencer (búsqueda y fija), M-P y Janbu corregido (fija) |
  | D16 | depósito de relaves de 15 m con Su constante de 25 kPa | ídem |
  | D17 | bloque deslizante sobre una capa débil, **polilínea fija** | Spencer, M-P y Janbu corregido (sin Bishop) |

  Resultado de D01 a D17: **43/43 OK**, 0 fallas, 0 sin dato, 0 pendientes; uno de los OK es una concordancia (D03 con
  M-P: ambos motores sin solución). Por método, según el recuento de la tabla del informe: 17 de M-P, 17 de Janbu
  corregido, 5 de Spencer y 4 de Bishop. La mayor diferencia en superficie fija es −0,21 % (D13, M-P), y en D17
  (polilínea) las tres diferencias son de 0,00 % al redondear.
- **Modelos de la revisión R10 (D18 a D23, E13l):** cubren lo que ningún caso ni modelo cubría (R10A-11, 4):

  | Modelo | Qué prueba | Métodos |
  |---|---|---|
  | D18 | corte de 10 m en arcilla con Su = 70 kPa en la cota 10, gradiente de −2 kPa/m y **piso de 25 kPa**; el círculo baja de la cota −12,5, donde empieza el piso | Bishop y Spencer (búsqueda y fija), M-P y Janbu corregido (fija) |
  | D19 y D20 | talud de 20 m de relleno sobre arcilla, dos capas; **M-P con `clipped_sine`** (D19) y **con `trapezoidal`** (D20) | ídem |
  | D21 | polilínea cuyo tramo central corre **sobre el contacto** de un estrato fuerte con uno débil (E13l-5) | Spencer, M-P, Janbu simplificado y corregido (fija) |
  | D22 | polilínea en **terreno horizontal con `kh = 0,3`** (E13l-2) | ídem |
  | D23 | la misma polilínea con una **carga lineal horizontal** de 200 kN/m en lugar del sismo (E13l-2) | solo Janbu: con una fuerza horizontal pura, cSlope no converge en Spencer y su M-P da cuatro veces el de D22 |

  Resultado sobre la base `420baf0` (antes de las correcciones de E13l-2 y E13l-5), 71 checks en la Fase 3a: **61 OK,
  10 FALLA, 0 sin dato, 0 pendientes**. D18, D19 y D20 coinciden con cSlope (|Δ| ≤ 0,16 % en superficie fija; la
  búsqueda de D18 da +0,56 %, dentro del 1 % de E9b). **D21 a D23 fallan hasta que entren E13l-2 y E13l-5:**

  | Check | ogs (base `420baf0`) | cSlope | Δ |
  |---|---:|---:|---:|
  | D21 Spencer | 5,5886 | 2,1522 | +159,67 % |
  | D21 M-P | 4,3839 | 1,8424 | +137,95 % |
  | D21 Janbu simplificado | 2,7825 | 1,4990 | +85,63 % |
  | D21 Janbu corregido | 3,0276 | 1,6313 | +85,60 % |
  | D22 Spencer, M-P, Janbu simplificado y corregido | `invalid` (`no_driving`) | 3,9855 · 3,9306 · 3,3333 · 3,7071 | — |
  | D23 Janbu simplificado y corregido | `invalid` (`no_driving`) | 7,5000 · 8,3409 | — |

  En D21 ogs toma el material de arriba en el tramo que corre sobre el contacto (E13l-5); como control, la misma
  polilínea más abajo, dentro del estrato débil (base de 8 a 10 m), coincide con cSlope (M-P −0,02 %, Janbu simplificado +0,00 % y corregido −0,04 %; Spencer queda sin referencia porque cSlope rechaza el escarpe de 80°). En D22 y D23
  `no_driving` es el hallazgo R10A-02 (E13l-2). El informe `verification/differential/REPORT.md` se generó sobre esa
  base y se regenera al integrar las correcciones.
- Un resultado de cSlope con `converged: false` es un oráculo sin solución, nunca un valor de referencia.

## Bindings y CLI

- **`ogs-py`** (`crates/ogs-py/tests/`): además de los tests de humo, `test_v03.py` (22 pruebas) cubre el formato v0.3 a
  través del wheel: polilínea (con los valores de cSlope de V047a para Spencer, M-P y Janbu corregido, el ajuste al
  terreno y los dos estados `invalid`), no drenado (constante, con gradiente y con gradiente negativo y piso, D18),
  M-P con sus funciones, Janbu con `correction_factor` y el aviso `interslice_shear_exceeds_strength` sobre la
  polilínea A de D-1. Necesita el wheel construido con `maturin` (véase [`crates/ogs-py/README.md`](../crates/ogs-py/README.md)).
- **`ogs`**: `verification/tools/test_cli_usage.py` fija que el mensaje de uso lista los cinco métodos de `ogs bench`.
- **Esquema:** `verification/tools/test_schema.py` compara el esquema 0.3 con el binario en una tabla de documentos; con
  E13l-8 incluye la polilínea sin `methods` (el esquema y el motor la rechazan).

## Rendimiento (bench)

Medición de spike, en una sola máquina (AMD Ryzen 9 9900X, 24 hilos), sobre V047a con búsqueda 20 × 20 × 20 con
refinamiento y 50 dovelas; mediana de 5 repeticiones
([`bench/RESULTS.md`](../bench/RESULTS.md), generado el 2026-11-25):

| método | nativo, 1 hilo (ms) | Chrome headless, WASM (ms) | Chrome / nativo |
|---|---:|---:|---:|
| Bishop simplificado | 50,16 | 55,90 | 1,11 |
| Spencer | 217,21 | 231,50 | 1,07 |

Sirve para el orden de magnitud, no para comparar versiones. Gate de FS: nativo, nativo paralelo, `node-wasm` y
Chrome dan el mismo FS (error relativo ≤ 2,25e-16). **Esta tabla es anterior a los métodos de la Fase 3a: no mide
Morgenstern-Price ni Janbu.** `ogs bench --method` los admite.

## Reproducir

```sh
# Aceptación y pruebas del motor
cargo test -p ogs-core --release --no-fail-fast
cargo test -p ogs-core --test acceptance -- --nocapture

# Harness frente a cSlope (escribe REPORT.md y report.json en --out; el informe publicado es verification/REPORT.md)
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out "$TMPDIR/verif"

# Batería diferencial (informe verification/differential/REPORT.md)
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs target/release/ogs

# Pruebas en Python del importador, el esquema y la ida y vuelta
uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest \
  python -m pytest -q verification

# Tests de Python del binding (wheel de crates/ogs-py, véase su README)
$TMPDIR/ogs-py-venv/bin/python -m pytest crates/ogs-py/tests -v

# Ejemplos de docs/formato-ogs-json.md
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema python docs/tools/validar_ejemplos.py
```

## Informes

- [`verification/REPORT.md`](../verification/REPORT.md): aceptación y harness frente a cSlope.
- [`verification/differential/REPORT.md`](../verification/differential/REPORT.md): batería diferencial, incluida la
  Fase 3a y los modelos D18 a D23 de R10.
- [`verification/cases/INDEX.md`](../verification/cases/INDEX.md): los 93 casos, con sus checks por método y versión.
- [`verification/pending/`](../verification/pending/INDEX.md): checks retenidos y problemas que el importador no
  convierte, con el motivo de cada uno.
- [`bench/RESULTS.md`](../bench/RESULTS.md): rendimiento.
- [`docs/fase3/d1/DIAGNOSTICO.md`](fase3/d1/DIAGNOSTICO.md): diagnóstico de las soluciones inadmisibles de Spencer en
  polilíneas en V.
- [`docs/reviews/`](reviews/): revisiones adversariales.
