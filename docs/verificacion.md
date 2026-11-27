# Verificación

Detalle de lo que verifica OpenGeoSlide y cómo reproducirlo. El resumen está en el [README](../README.md#verificación).
Las cifras de esta página se leen de los informes generados (`verification/REPORT.md`,
`verification/differential/REPORT.md`, `bench/RESULTS.md`) y de los índices de `verification/`; donde un número sale de
un recuento propio de una tabla de esos informes, se dice.

## Estado de verificación

| Se compara con | Resultado | Informe |
|---|---|---|
| Valores publicados (151 casos, 327 checks) | **327/327** | [`verification/REPORT.md`](../verification/REPORT.md) |
| cSlope 0.1.0, búsqueda (14 modelos, Bishop y Spencer) | **28/28** | [`verification/differential/REPORT.md`](../verification/differential/REPORT.md) |
| cSlope 0.1.0, superficie fija (los mismos) | **28/28** | ídem |
| cSlope 0.1.0, Fase 3a (D01-D23: M-P, Janbu, no drenado, polilínea) | **71/71** (D03 con M-P cuenta como concordancia: ningún motor encuentra solución) tras E13l-2 y E13l-5; véase [abajo](#batería-diferencial-frente-a-cslope) | ídem |
| cSlope 0.1.0, refuerzos v0.4 (D24-D27) | **12/12** | ídem |
| cSlope 0.1.0, grieta, agua embalsada y pilotes de Ito-Matsui v0.5 (D28-D42) | **58/60** (2 explicados por E15f y E15j-7, ninguna falla abierta; D30 fija se corrigió con E15j-8; véase [abajo](#grieta-de-tracción-agua-embalsada-y-pilotes-de-ito-matsui-v05-d28-a-d42)) | ídem |
| cSlope 0.1.0 como segundo oráculo de los 327 checks | **326/327** (V027: cSlope no converge) | [`verification/REPORT.md`](../verification/REPORT.md) |
| Web y `ogs` (ida y vuelta, 389 modelos) | **389/389** | `verification/tools/test_web_roundtrip.py` |

## Aceptación: casos publicados

- **327 de 327 checks** publicados cumplen su tolerancia, en **151 casos** (`verification/cases/`). El informe
  [`verification/REPORT.md`](../verification/REPORT.md) da ogs 327 OK, 0 fallas, 0 sin dato, 0 no convergidos.
  Test: `cargo test -p ogs-core --test acceptance`. Todo aviso que no sea informativo hace fallar un check (E5).
- **Por versión del formato** (de [`verification/cases/INDEX.md`](../verification/cases/INDEX.md)):

  | Versión | Casos | Checks |
  |---|---:|---:|
  | v0.1 | 49 | 99 |
  | v0.2 (sismo o cargas) | 5 | 13 |
  | v0.3 (no drenado, polilínea, M-P, Janbu) | 53 | 139 |
  | v0.4 (refuerzos, lotes R1 a R4) | 23 | 30 |
  | v0.5 (grieta de tracción, lote F3G; pilotes de Ito-Matsui, lote F3I) | 21 | 46 |
  | **Total** | **151** | **327** |

  El lote F3G (31 casos, 80 checks) usa la versión mínima de los campos de cada caso: los 17 casos con grieta van en
  v0.5; los 14 con solo agua embalsada, en v0.1 (8 casos, 21 checks) o v0.3 (6 casos, 17 checks). Por eso v0.1 y v0.3
  incluyen casos del lote F3G. Los 4 casos del lote F3I (V013b a V013e, un check cada uno) llevan `lateral_pressure` y
  son v0.5: con los 17 de grieta (42 checks) suman los 21 casos y 46 checks de la fila v0.5.

- **Por método** (suma de la columna «checks» del índice; coincide con el recuento de la tabla de `REPORT.md`):

  | Método | Checks |
  |---|---:|
  | Bishop simplificado | 136 |
  | Spencer | 113 |
  | Morgenstern-Price | 43 |
  | Janbu simplificado | 10 |
  | Janbu corregido | 25 |
  | **Total** | **327** |

  Por tipo de superficie, según el recuento de las filas de `REPORT.md`: 155 de búsqueda y 172 de superficie fija.
- De los **53 casos v0.3**, 47 vienen de los lotes 1 y 2 de la importación desde cSlope (`undrained` y `s-f-datum`; polilíneas
  fijas, M-P y Janbu), promovidos desde `verification/pending/F3/` cuando el motor reproduce sus checks. El lote 0
  (todo lo convertible con v0.1 o v0.2) no tiene tope ni selección. El índice declara 122 checks para esos 47 casos, de
  ellos 32 del lote 0, 39 del lote 1 y 51 del lote 2
  ([`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md)); los otros 6 son del lote F3G.
- **Los 23 casos v0.4** (30 checks) son los lotes R1 a R4 de los refuerzos (`verification/cases/INDEX.md`, sección «Casos
  con refuerzos»); el informe agrega la comparación de las fuerzas cruce por cruce con el oráculo (161 cruces
  emparejados en los 30 checks, 0 sin explicar; con los 3 retenidos eran 165 en 33 checks). **V016b no prueba los refuerzos:** sus tres elementos quedan dentro del círculo, sin
  cruce, y ni ogs ni el oráculo aplican fuerza.
- **El lote F3I** (pilotes de Ito-Matsui, 4 casos y 4 checks, de Bishop con búsqueda; sección «Pilotes de Ito-Matsui» de
  `verification/cases/INDEX.md`) se promovió desde `verification/pending/F3I/` con el motor de E15i: ogs da entre +0,07 %
  y +0,52 % del valor publicado (V013b 1,5412, V013c 1,4374, V013d 1,3317 y V013e 1,2530 frente a 1,54, 1,43, 1,33 y
  1,25), y cSlope entre +0,05 % y +0,49 %. El conversor escribe `diameter` y quita `force`, convierte
  `location: slip_surface` en `slip-surface` y pasa `capacity` a `shearCapacity` y `momentCapacity`; la fuente no trae
  `direction` ni `location`, y se escriben los valores de cSlope (`angle` 0 y `centroid`).
- **El lote F3G** (grieta de tracción y agua embalsada, 31 casos y 80 checks; sección «Grieta de tracción y agua
  embalsada» de `verification/cases/INDEX.md`) se promovió desde `verification/pending/F3G/`. La tolerancia del corpus
  es **relativa**, `|Δ|/publicado ≤ tolerancia`, la misma de los demás casos (E15j-5): X18 la había leído como absoluta y
  había dado por fuera V009b, V087 y V092; con la convención del repositorio V087 y V092 se reproducen y se promueven.
  No se relajó ninguna tolerancia ni se tocó ningún dato.
- **Retenidos:** el motor no reproduce **15 checks en 9 casos**, que no cuentan en los 327 y se documentan con su
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
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce **326 de 327** de esos checks; el restante es V027, donde cSlope
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
- **Ida y vuelta de la web** (E12g): para **389 modelos** (327 checks de los 151 casos, 56 de la batería diferencial y 6
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

## Grieta de tracción, agua embalsada y pilotes de Ito-Matsui (v0.5, D28 a D42)

Quince modelos sintéticos en `verification/differential/cases_f3g/`, cada uno en búsqueda y en su círculo fijo, con
Bishop y Spencer y los criterios de E9b: 60 checks.

- **D28 a D39 (12 modelos, 48 checks):** embalse al pie y en el talud, cara vertical, presa; grieta seca, llena y
  automática; combinados, con sismo y con arcilla no drenada.
- **D40 a D42 (3 modelos, 12 checks):** pilotes de Ito-Matsui sobre el talud de Cai y Ugai: φ = 0 (D40), c-φ con la
  fuerza en el cruce y tope de corte (D41) y bajo el agua (D42).

Antes de correr, una sonda comprueba que el motor tiene el agua embalsada, la grieta (V047a, Bishop a 0,1 %) y
`lateral_pressure` (X22-V013c, a 0,1 %); el check que necesita una capacidad ausente queda pendiente y no falla.
Resultado, medido con `verification/differential/run.py --ogs target/release/ogs --require-f3r --require-f3g` y el
binario de release de este árbol (`cargo build --release`): **58 OK de 60**, 2 explicados, 0 fallas, 0 sin dato, 0 pendientes (D30 fija pasó de falla
a OK con E15j-8; D40 a D42 estaban pendientes mientras el motor no tenía E15i).

- **Búsqueda:** 30/30 OK. **Superficie fija:** 28/30 OK (la mayor diferencia entre los OK es +0,13 %, en D30), 2 explicados y 0 fallas.
- **D40 a D42, pilotes de Ito-Matsui:** los 12 checks coinciden con cSlope a `|Δ| ≤ 0,07 %` (D40 de +0,06 % a +0,07 %,
  D41 de −0,01 % a +0,01 % y D42 de +0,02 %).
- **D39 fija, Bishop y Spencer: explicado (E15f, E15j-7).** El círculo de cSlope pasa 9,2e-7 bajo el fondo del modelo
  (el límite de su búsqueda es 1e-6) y ogs lo rechaza con `NoValidSurface: el arco de deslizamiento sale del modelo`.
  El informe lo marca «explicado (E15f, E15j-7)», con su causa: no cuenta como OK ni como falla, y **no se relaja la
  tolerancia**, porque aceptarlo admitiría superficies que salen del modelo. En la búsqueda, ogs encuentra su propio
  círculo válido y D39 coincide con cSlope a +0,05 %.
- **D30 fija, Bishop y Spencer: OK tras E15j-8 (contacto de aire capilar).** El círculo crítico de cSlope pasa 3,6e-7 m
  sobre el pie de un corte vertical; ogs lo partía en dos masas y descartaba 23,5 kN/m de suelo y 117,9 kN/m de
  cohesión (−15,4 % y −15,3 %). Un tramo de aire interior de ancho ≤ 1e-6·ancho del modelo y a ≤ 10·tol sobre el
  terreno ahora cuenta como contacto. Con el binario de esta rama, D30 fija da 1,5163 (Bishop, +0,13 % frente a 1,5143) y
  1,5146 (Spencer, +0,12 % frente a 1,5128); en seco D30 pasa de −13,2 % a +0,07 %. El umbral sigue siendo discontinuo:
  un arco entre unos 7e-7 y 3e-6 sobre un vértice todavía puede diferir de cSlope. En D30, la búsqueda de ogs halla
  círculos más críticos que la de cSlope (0,8248 frente a 1,5143), coherentes con la altura crítica del corte (E15j-9).

### Qué casos ejercitan de verdad el agua embalsada (E15l-10, R12A-11)

Que la piezométrica de un modelo pase sobre el terreno **no** quiere decir que la superficie de un check reciba el peso o
el empuje del agua embalsada: un círculo que no toca la parte inundada no los recibe, y un caso así no verifica nada sobre
el agua embalsada. De los 151 casos de `verification/cases/`, **14** tienen la piezométrica sobre el terreno (la misma
prueba que usa `verification/tools/identity_vs_baseline.py` para separar los modelos con agua embalsada). La tabla mide,
para cada uno, qué reciben las dovelas de la superficie **de sus checks**, con el binario de release de este árbol y con
`docs/fase3/r12/p-medir_agua_embalsada.py`:

1. Corre cada check como `acceptance.rs` (un método, `fixed` o `search`, con `options.slices`) y toma la superficie
   final. En una búsqueda es la superficie crítica de **ese** método.
2. Repite la corrida con esa superficie fija, **sin** `loads`, sin sismo, sin refuerzos y con `water_fill = 0` en la
   grieta (la grieta sigue truncando la masa). Lo que queda de `weight_extra` y de `h_force` es solo agua embalsada.
3. Suma `Σ|weight_extra|` (el peso del agua) y `Σ|h_force|` (su empuje, con el de una cara de presa) sobre las dovelas.
   Con la superficie de cada check, la corrida de control coincide con la corrida normal en los 14 casos (ninguno tiene
   cargas ni sismo), así que las dos sumas son las que mide la revisión.

Ejercita el agua embalsada si, solo con ella, `Σ|weight_extra|` o `Σ|h_force|` llegan al 0,1 % del peso del suelo de la
superficie (`marginal` si son no nulos pero menores):

| Caso | Checks (método, tipo) | Σ\|weight_extra\| | Σ\|h_force\| | Σ\|weight_extra\| / Σ peso | Ejercita el agua embalsada |
|---|---|---:|---:|---:|---|
| V023 | spencer fixed | 7296 | 6529 | 6.52e-01 | sí |
| V024 | bishop fixed, spencer fixed | 0.05138 | 0.002857 | 2.75e-06 | marginal |
| V038 | bishop search, spencer search | 0 | 0 | 0.00e+00 | no |
| V038b | spencer search | 0 | 0 | 0.00e+00 | no |
| V041a | bishop search, spencer search | 3283 a 3286 | 1230 | 2.01e+00 | sí |
| V041b | bishop search, spencer search | 5540 a 5547 | 2050 | 3.39e+00 | sí |
| V042 | bishop fixed, spencer fixed | 0 | 0 | 0.00e+00 | no |
| V058 | spencer search | 0 | 0 | 0.00e+00 | no |
| V061 | morgenstern_price fixed, spencer fixed | 0 | 0 | 0.00e+00 | no |
| V070 | bishop search, spencer search | 110.7 | 36.89 | 1.40e-02 | sí |
| V087 | janbu_corrected fixed | 256.2 | 61.88 | 5.05e-02 | sí |
| V089 | bishop fixed, janbu_corrected fixed, morgenstern_price fixed, spencer fixed | 361.5 | 87.93 | 3.90e-02 | sí |
| V091 | bishop fixed, janbu_corrected fixed, morgenstern_price fixed, spencer fixed | 192 | 29.16 | 8.53e-02 | sí |
| V092 | bishop fixed, janbu_corrected fixed, morgenstern_price fixed, spencer fixed | 629.5 | 226.2 | 1.35e-02 | sí |

- **Ejercitan el agua embalsada: 8 casos** (V023, V041a, V041b, V070, V087, V089, V091 y V092), con cifras de entre 1,4 % y
  339 % del peso del suelo. En V041a y V041b el peso del agua supera el del suelo de la masa.
- **No lo ejercitan: 5 casos** (V038, V038b, V042, V058 y V061): `Σ|weight_extra| = 0` y `Σ|h_force| = 0`, de modo que su
  check es idéntico al que daría sin la parte de agua sobre el terreno. V042 lo confirma con la identidad: su salida es
  idéntica byte a byte a la de la v0.3.0 (`identity_vs_baseline.py`); en V038, V038b y V058 (búsqueda) y V061 (superficie
  fija) el FS, la superficie y los avisos de cada check son idénticos a los de la v0.3.0, y solo cambia el contador
  `search.valid` (otros candidatos de la búsqueda sí reciben el agua embalsada y pasan a ser válidos). Son casos válidos de verificación del resto del modelo
  (la piezométrica por debajo del terreno, los materiales), pero **no** prueban el agua embalsada.
- **Marginal: V024**, con 0,05 kN/m de peso extra y 0,003 de empuje, 3e-6 del peso del suelo: el agua apenas toca la
  superficie y el check no distingue el cálculo con y sin ella.
- **En `crates/ogs-core/tests/f3g_rows.rs`**, las filas `X21-CP-V042` y `X21-CP-V061` se quedan con el comentario «sin
  términos embalsados en la superficie», y las filas nuevas con términos de agua embalsada no nulos sobre la superficie
  analizada, con su valor del oráculo, son las de M-A (E15l-10): `X21-R12-V042-up`, `X21-R12-V042-up-kh` y `X21-R12-V061-der`, en
  `crates/ogs-core/tests/data/f3g/r12/`. Sobre su superficie, `Σ|weight_extra|` vale 10345,59 y 10345,59 kN/m y 364,45 kN/m, y
  `Σ|h_force|`, 3762,03, 4086,80 y 8,04 kN/m. Contra cSlope 0.1.0, la peor diferencia de sus 14 cifras es de 0,081 % (Janbu
  simplificado de `X21-R12-V042-up`), con tolerancia de 0,1 %.
- Los casos con **agua solo en la grieta** (sin piezométrica sobre el terreno) no están en la tabla: la fuerza `Pw` de la
  grieta no es agua embalsada, y se mide con `tension_crack.water_force` (véase
  [Limitaciones](limitaciones.md#la-grieta-solo-vertical-una-por-superficie-f52-f54)).
- La batería diferencial D28 a D39 (cSlope, véase arriba) sí ejercita el agua embalsada: cada modelo con embalse está
  construido para que la superficie la reciba.

Reproducción:

```sh
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME python3 docs/fase3/r12/p-medir_agua_embalsada.py target/release/ogs
```

## Refuerzos (v0.4): qué se verifica y con qué

- **Identidad sin refuerzos** (gate de cada ola): `verification/tools/identity_vs_baseline.py --base <binario v0.2.0>
  --new target/release/ogs` compara byte a byte los modelos sin refuerzos del corpus con el binario de la v0.2.0, en
  cinco variantes (`own`, `search`, `fixed`, `search@0.4`, `fixed@0.4`). Resultado de R11 (lente A): **0 diferencias en 121
  modelos** (29 con refuerzos se saltan: la v0.2.0 rechaza el campo). **Una sola excepción declarada:** V065 sin
  refuerzos, que la v0.2.0 rechazaba por redondeo y ahora se analiza
  ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065)).
  Con la v0.3.0 como base (bloque F3G), la herramienta lee las **excepciones declaradas** de
  `verification/tools/identity_exceptions.json`: V019 en `search` y `search@0.4` (E15j-8), donde solo cambian los
  contadores `search.evaluated` y `search.valid`. Se informan aparte («EXCEPCIÓN V019 [search]: E15j-8») y no cuentan; el
  resultado es **0 diferencias, 2 excepciones y 18 modelos con agua sobre el terreno** listados
  ([Limitaciones](limitaciones.md#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8)).
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
- **`ogs-py` v0.5:** `crates/ogs-py/tests/test_v05.py` cubre la grieta de tracción, el agua embalsada y los pilotes de
  Ito-Matsui a través del wheel: los cuatro ejemplos de [`formato-ogs-json.md`](formato-ogs-json.md) (grieta seca, embalse al
  pie, Ito-Matsui y grieta con UDL y profundidad automática) con sus fragmentos; las filas contra el oráculo a 0,1 %
  (55 de X21, 3 de R12 con agua embalsada activa, 28 de X22 y la de `ru` con piezométrica); la neutralidad entre v0.3 y
  v0.5, el espejo, la monotonía con `water_fill`, la compuerta de versión, los rechazos con su ruta y la salida siempre
  finita; y las reproducciones de las revisiones R12 y R13: E15l-1, -2, -5, -6, -7 y -11 sin marcas, y E15m-1, -2, -6 y
  -7 con `xfail(strict=False)` mientras el motor de la rama no traiga la corrección (quitar las marcas al integrar). Son
  170 pruebas en `test_v05.py` y 261 en `crates/ogs-py/tests` con las 2 omitidas de pánico; hasta la integración, 8 de
  ellas son `xfail`. <!-- R13: medir al integrar -->
- **`ogs`**: `verification/tools/test_cli_usage.py` fija que el mensaje de uso lista los cinco métodos de `ogs bench`, y
  `crates/ogs-cli` prueba que `ogs bench` no baja la versión de un modelo 0.4 y que el uso lista `tension_crack`,
  `lateral_pressure`, `capacity` y `soil_force` (E15l-25).
- **Esquema:** `verification/tools/test_schema.py` compara el esquema con el binario en una tabla de documentos; con
  E13l-8 incluye la polilínea sin `methods` (el esquema y el motor la rechazan), y con el bloque de refuerzos compara
  también [`schema/ogs-0.4.schema.json`](../schema/ogs-0.4.schema.json) (que acepta 0.1 a 0.4 y rechaza lo mismo que el
  motor). Con la v0.5 compara [`schema/ogs-0.5.schema.json`](../schema/ogs-0.5.schema.json) (que acepta 0.1 a 0.5, agrega
  `analysis.tension_crack`, `lateral_pressure` y `capacity`, y rechaza lo mismo que el motor). Con `test_cli_usage.py`, 489 pruebas (medido con `OGS_BIN=$PWD/target/release/ogs pytest verification/tools/test_schema.py verification/tools/test_cli_usage.py`).

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
  Fase 3a, los modelos D18 a D23 de R10 y el bloque v0.5 (D28 a D42).
- [`verification/cases/INDEX.md`](../verification/cases/INDEX.md): los 151 casos, con sus checks por método y versión.
- [`verification/pending/`](../verification/pending/INDEX.md): checks retenidos y problemas que el importador no
  convierte, con el motivo de cada uno.
- [`bench/RESULTS.md`](../bench/RESULTS.md): rendimiento.
- [`docs/fase3/d1/DIAGNOSTICO.md`](fase3/d1/DIAGNOSTICO.md): diagnóstico de las soluciones inadmisibles de Spencer en
  polilíneas en V.
- [`docs/reviews/`](reviews/): revisiones adversariales.
