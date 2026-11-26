# Verificación

Detalle de lo que verifica OpenGeoSlide y cómo reproducirlo. El resumen está en el [README](../README.md#verificación).
Las cifras de esta página se leen de los informes generados (`verification/REPORT.md`,
`verification/differential/REPORT.md`, `bench/RESULTS.md`) y de los índices de `verification/`; donde un número sale de
un recuento propio de una tabla de esos informes, se dice.

## Estado de verificación

| Se compara con | Resultado | Informe |
|---|---|---|
| Valores publicados (147 casos, 323 checks) | **323/323** | [`verification/REPORT.md`](../verification/REPORT.md) |
| cSlope 0.1.0, búsqueda (14 modelos, Bishop y Spencer) | **28/28** | [`verification/differential/REPORT.md`](../verification/differential/REPORT.md) |
| cSlope 0.1.0, superficie fija (los mismos) | **28/28** | ídem |
| cSlope 0.1.0, Fase 3a (D01-D23: M-P, Janbu, no drenado, polilínea) | **71/71** (D03 con M-P cuenta como concordancia: ningún motor encuentra solución) tras E13l-2 y E13l-5; véase [abajo](#batería-diferencial-frente-a-cslope) | ídem |
| cSlope 0.1.0, refuerzos v0.4 (D24-D27) | **12/12** | ídem |
| cSlope 0.1.0, grieta y agua embalsada v0.5 (D28-D39) | **44/48** (2 explicados por E15f y E15j-7, 2 fallas abiertas en D30 fija; véase [abajo](#grieta-de-tracción-y-agua-embalsada-v05-d28-a-d39)) | ídem |
| cSlope 0.1.0 como segundo oráculo de los 323 checks | **322/323** (V027: cSlope no converge) | [`verification/REPORT.md`](../verification/REPORT.md) |
| Web y `ogs` (ida y vuelta, 385 modelos) | **385/385** | `verification/tools/test_web_roundtrip.py` |

## Aceptación: casos publicados

- **323 de 323 checks** publicados cumplen su tolerancia, en **147 casos** (`verification/cases/`). El informe
  [`verification/REPORT.md`](../verification/REPORT.md) da ogs 323 OK, 0 fallas, 0 sin dato, 0 no convergidos.
  Test: `cargo test -p ogs-core --test acceptance`. Todo aviso que no sea informativo hace fallar un check (E5).
- **Por versión del formato** (de [`verification/cases/INDEX.md`](../verification/cases/INDEX.md)):

  | Versión | Casos | Checks |
  |---|---:|---:|
  | v0.1 | 49 | 99 |
  | v0.2 (sismo o cargas) | 5 | 13 |
  | v0.3 (no drenado, polilínea, M-P, Janbu) | 53 | 139 |
  | v0.4 (refuerzos, lotes R1 a R4) | 23 | 30 |
  | v0.5 (grieta de tracción, lote F3G) | 17 | 42 |
  | **Total** | **147** | **323** |

  El lote F3G (31 casos, 80 checks) usa la versión mínima de los campos de cada caso: los 17 casos con grieta van en
  v0.5; los 14 con solo agua embalsada, en v0.1 (8 casos, 21 checks) o v0.3 (6 casos, 17 checks). Por eso v0.1 y v0.3
  incluyen casos del lote F3G.

- **Por método** (suma de la columna «checks» del índice; coincide con el recuento de la tabla de `REPORT.md`):

  | Método | Checks |
  |---|---:|
  | Bishop simplificado | 132 |
  | Spencer | 113 |
  | Morgenstern-Price | 43 |
  | Janbu simplificado | 10 |
  | Janbu corregido | 25 |
  | **Total** | **323** |

  Por tipo de superficie, según el recuento de las filas de `REPORT.md`: 151 de búsqueda y 172 de superficie fija.
- De los **53 casos v0.3**, 47 vienen de los lotes 1 y 2 de la importación desde cSlope (`undrained` y `s-f-datum`; polilíneas
  fijas, M-P y Janbu), promovidos desde `verification/pending/F3/` cuando el motor reproduce sus checks. El lote 0
  (todo lo convertible con v0.1 o v0.2) no tiene tope ni selección. El índice declara 122 checks para esos 47 casos, de
  ellos 32 del lote 0, 39 del lote 1 y 51 del lote 2
  ([`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md)); los otros 6 son del lote F3G.
- **Los 23 casos v0.4** (30 checks) son los lotes R1 a R4 de los refuerzos (`verification/cases/INDEX.md`, sección «Casos
  con refuerzos»); el informe agrega la comparación de las fuerzas cruce por cruce con el oráculo (161 cruces
  emparejados en los 30 checks, 0 sin explicar; con los 3 retenidos eran 165 en 33 checks). **V016b no prueba los refuerzos:** sus tres elementos quedan dentro del círculo, sin
  cruce, y ni ogs ni el oráculo aplican fuerza.
- **El lote F3G** (grieta de tracción y agua embalsada, 31 casos y 80 checks; sección «Grieta de tracción y agua
  embalsada» de `verification/cases/INDEX.md`) se promovió desde `verification/pending/F3G/`. La tolerancia del corpus
  es **relativa**, `|Δ|/publicado ≤ tolerancia`, la misma de los demás casos (E15j-5): X18 la había leído como absoluta y
  había dado por fuera V009b, V087 y V092; con la convención del repositorio V087 y V092 se reproducen y se promueven.
  No se relajó ninguna tolerancia ni se tocó ningún dato.
- **Retenidos:** el motor no reproduce **15 checks en 9 casos**, que no cuentan en los 323 y se documentan con su
  diagnóstico (sin relajar ninguna tolerancia):
  - V027 y V028 (Bishop, 1 check cada uno) y V068 (Bishop, 1 check): el FS cae dentro de la tolerancia, pero el motor
    emite `negative_effective_normal_major` y la aceptación rechaza ese aviso;
  - V032a (3 checks): la búsqueda halla un mínimo real, más conservador (FS 1,1706 frente a 1,209 a 1,23 publicados),
    que sale de los rangos efectivos;
  - V035b (Bishop, 2 checks) y V083 (Janbu corregido, 1 check): el FS cae dentro de la tolerancia y el motor emite
    `negative_effective_normal_major`. Es una tracción real del modelo, presente también sin refuerzos (FS sin refuerzos
    0,929 y 0,834): en V035b son 4 dovelas normales de 0,133 m con N′ de −2,1 a −30,6 kN y en V083, 12 de 0,126 m. La
    enmienda E14n-1 (sumar las dovelas finas de cruce con sus vecinas, adoptada) no los toca; queda en
    `pending/F3R/HOLD.json` ([`pending/F3R/INDEX.md`](../verification/pending/F3R/INDEX.md),
    [`docs/fase3/r2i1/NOTAS.md`](fase3/r2i1/NOTAS.md) §5). V014 (Janbu corregido, 2 checks) sí era el artefacto de 8
    dovelas finas de cruce y volvió a `verification/cases`;
  - **los 6 de F3G** (E15j-6, `pending/F3G/HOLD.json`, [`pending/F3G/INDEX.md`](../verification/pending/F3G/INDEX.md)):
    - **V085 ×4** (Bishop, Spencer, Janbu simplificado y Janbu corregido): la búsqueda de ogs halla un círculo más crítico
      que el del oráculo (Bishop 1,2947 frente a 1,762 publicado). cSlope evalúa ese mismo círculo en 1,29465 (0,002 %),
      de modo que con superficie fija los dos motores coinciden; la diferencia es de la búsqueda de cSlope, que es
      estocástica y da 1,7591 con 8000 iteraciones y 1,716 con 40 000. La grieta no interviene;
    - **V009a y V009b** (Spencer): el FS cae dentro de la tolerancia (+0,09 % y −1,47 % frente a 1,03 % y 2,26 %), pero
      el motor emite `interslice_shear_exceeds_strength` (E13k) con `r_v` de 3,12 y 5,57, sobre el umbral de 3, y la
      aceptación rechaza todo aviso que no es informativo (E5). No se amplía la lista de avisos informativos.

  Detalle en [`docs/limitaciones.md`](limitaciones.md#checks-retenidos-y-casos-especiales),
  [`pending/lote0/INDEX.md`](../verification/pending/lote0/INDEX.md) y
  [`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md).
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce **322 de 323** de esos checks; el restante es V027, donde cSlope
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
- **Ida y vuelta de la web** (E12g): para **385 modelos** (323 checks de los 147 casos, 56 de la batería diferencial y 6
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

  Resultado con E13l-2 y E13l-5 integrados, 71 checks en la Fase 3a: **71 OK, 0 FALLA, 0 sin dato, 0 pendientes**
  (D03 con M-P es concordancia: ninguno de los dos motores encuentra solución). D18, D19 y D20 coinciden con cSlope
  (|Δ| ≤ 0,16 % en superficie fija; la búsqueda de D18 da +0,56 %, dentro del 1 % de E9b). D21 a D23 coinciden a
  ≤ 0,02 %. Antes de E13l-5, D21 daba Spencer +159,67 %, M-P +137,95 % y Janbu +85,6 % sobre cSlope (no
  conservador), y D22 y D23 eran `invalid (no_driving)`. Cifras en
  [`verification/differential/REPORT.md`](../verification/differential/REPORT.md).

  Como control de D21, la misma polilínea más abajo, dentro del estrato débil (base de 8 a 10 m), da el mismo FS que
  sobre el contacto, porque E13l-5 toma el material más débil.
- Un resultado de cSlope con `converged: false` es un oráculo sin solución, nunca un valor de referencia.

## Grieta de tracción y agua embalsada (v0.5, D28 a D39)

Doce modelos sintéticos en `verification/differential/cases_f3g/` (embalse al pie y en el talud, cara vertical, presa;
grieta seca, llena y automática; combinados, con sismo y con arcilla no drenada), cada uno en búsqueda y en su círculo
fijo, con Bishop y Spencer y los criterios de E9b: 48 checks. Antes de correr, una sonda comprueba que el motor tiene
el agua embalsada y la grieta (V047a, Bishop a 0,1 %); el check que necesita una capacidad ausente queda pendiente y no
falla. Resultado, de [`verification/differential/REPORT.md`](../verification/differential/REPORT.md):
**44 OK de 48**, 2 explicados, 2 fallas, 0 sin dato, 0 pendientes.

- **Búsqueda:** 24/24 OK. **Superficie fija:** 20/24 OK (la mayor diferencia entre los OK es 0,05 %), 2 explicados y 2 fallas.
- **D39 fija, Bishop y Spencer: explicado (E15f, E15j-7).** El círculo de cSlope pasa 9,2e-7 bajo el fondo del modelo
  (el límite de su búsqueda es 1e-6) y ogs lo rechaza con `NoValidSurface: el arco de deslizamiento sale del modelo`.
  El informe lo marca «explicado (E15f, E15j-7)», con su causa: no cuenta como OK ni como falla, y **no se relaja la
  tolerancia**, porque aceptarlo admitiría superficies que salen del modelo. En la búsqueda, ogs encuentra su propio
  círculo válido y D39 coincide con cSlope a +0,05 %.
- **D30 fija, Bishop y Spencer: FALLA abierta** (cara vertical con embalse de 8 m al pie: ogs 1,2807 y 1,2809 frente a
  1,5143 y 1,5128, −15,4 % y −15,3 %). Está en investigación y no se ha explicado ni relajado.

## Refuerzos (v0.4): qué se verifica y con qué

- **Identidad sin refuerzos** (gate de cada ola): `verification/tools/identity_vs_baseline.py --base <binario v0.2.0>
  --new target/release/ogs` compara byte a byte los modelos sin refuerzos del corpus con el binario de la v0.2.0, en
  cinco variantes (`own`, `search`, `fixed`, `search@0.4`, `fixed@0.4`). Resultado de R11 (lente A): **0 diferencias en 121
  modelos** (29 con refuerzos se saltan: la v0.2.0 rechaza el campo). **Una sola excepción declarada:** V065 sin
  refuerzos, que la v0.2.0 rechazaba por redondeo y ahora se analiza
  ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065)).
- **Oráculo** (`crates/ogs-core/tests/f3r_oracle.rs`): las siete filas de F4.13, 16 de dirección inclinada y nueve de
  capacidad de X17 contra cSlope 0.1.0, con 0,1 % (0,25 % en las dos de `interface` donde gobierna la integral). Con
  E14o-9, las filas pasivas `inc_up30_pas` e `inc_up45_pas` pasan a ser elementos **embebidos** que cruzan la masa con
  `along ≥ cos 88°` (estado `compression_ignored`, nota emitida y FS del oráculo), y se agregan filas de `bond` e
  `interface` cuya capacidad no está acotada por `tensile_capacity`. Antes, R11A-09 midió que esas filas cruzaban en el
  aire o no cruzaban: no probaban la regla de compresión.
- **Los 23 casos v0.4 y D24 a D27:** véanse arriba. La revisión R11 (lente A) midió los 30 checks de los casos v0.4 contra
  cSlope: coinciden a `|Δ| ≤ 0,192 %` (el peor, V065).
- **Conversor al oráculo** (`verification/harness/to_cslope.py`, `test_to_cslope.py`): desde E14o-11 **valida los
  rangos** como lo hace `ogs` (`force` y capacidades ≥ 0, `spacing` > 0, longitud > 0, `bonded_length` en (0, L],
  `friction_angle` en [0, 90), `coverage` en (0, 1], `length1` y `length2` ≥ 0, `angle` en (−90, 90) y tablestaca con
  `x1 = x2`). Antes aceptaba cinco documentos que `ogs` rechazaba con código 2 (`force < 0`, longitud 0, tablestaca
  inclinada, `bonded_length` mayor que `L` y `angle = 90`), con el riesgo de comparar un modelo inválido. Los 30 checks
  de los casos v0.4 se siguen convirtiendo sin rechazos.
- **`ogs bench`** (E14o-15): usa la mayor versión entre la que declara el modelo y la que el método necesita (0.3 para
  Morgenstern-Price y Janbu), y **no baja** un modelo 0.4. Antes, con `--method morgenstern_price`, `janbu_simplified`,
  `janbu_corrected` o `all` (el valor por defecto), el motor rechazaba V037 con `InvalidModel: reinforcements requiere
  version "0.4"` (R11B-04). Test: `cargo test -p ogs-cli`.

## Bindings y CLI

- **`ogs-py`** (`crates/ogs-py/tests/`): además de los tests de humo, `test_v03.py` (22 pruebas) cubre el formato v0.3 a
  través del wheel: polilínea (con los valores de cSlope de V047a para Spencer, M-P y Janbu corregido, el ajuste al
  terreno y los dos estados `invalid`), no drenado (constante, con gradiente y con gradiente negativo y piso, D18),
  M-P con sus funciones, Janbu con `correction_factor` y el aviso `interslice_shear_exceeds_strength` sobre la
  polilínea A de D-1. Necesita el wheel construido con `maturin` (véase [`crates/ogs-py/README.md`](../crates/ogs-py/README.md)).
- **`ogs-py` v0.4:** `crates/ogs-py/tests/test_v04.py` cubre los refuerzos a través del wheel: las 32 filas de X17
  contra el oráculo, los cinco tipos, los tres modelos de `pullout`, los estados de `reinforcement_forces`, las notas de
  refuerzos, las identidades de la tablestaca, la compuerta de versión y los rechazos con su ruta JSON.
- **`ogs`**: `verification/tools/test_cli_usage.py` fija que el mensaje de uso lista los cinco métodos de `ogs bench`, y
  `crates/ogs-cli` prueba que `ogs bench` no baja la versión de un modelo 0.4.
- **Esquema:** `verification/tools/test_schema.py` compara el esquema con el binario en una tabla de documentos; con
  E13l-8 incluye la polilínea sin `methods` (el esquema y el motor la rechazan), y con el bloque de refuerzos compara
  también [`schema/ogs-0.4.schema.json`](../schema/ogs-0.4.schema.json) (que acepta 0.1 a 0.4 y rechaza lo mismo que el
  motor). Con `test_cli_usage.py`, 384 pruebas pasan.

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
  Fase 3a, los modelos D18 a D23 de R10 y el bloque v0.5 (D28 a D39).
- [`verification/cases/INDEX.md`](../verification/cases/INDEX.md): los 147 casos, con sus checks por método y versión.
- [`verification/pending/`](../verification/pending/INDEX.md): checks retenidos y problemas que el importador no
  convierte, con el motivo de cada uno.
- [`bench/RESULTS.md`](../bench/RESULTS.md): rendimiento.
- [`docs/fase3/d1/DIAGNOSTICO.md`](fase3/d1/DIAGNOSTICO.md): diagnóstico de las soluciones inadmisibles de Spencer en
  polilíneas en V.
- [`docs/reviews/`](reviews/): revisiones adversariales.
