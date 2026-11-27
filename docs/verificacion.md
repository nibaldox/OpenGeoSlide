# Verificación

Detalle de lo que verifica OpenGeoSlide y cómo reproducirlo. El resumen está en el [README](../README.md#verificación).
Las cifras de esta página se leen de los informes generados (`verification/REPORT.md`,
`verification/differential/REPORT.md`, `bench/RESULTS.md`) y de los índices de `verification/`; donde un número sale de
un recuento propio de una tabla de esos informes, se dice.

## Estado de verificación

| Se compara con | Resultado | Informe |
|---|---|---|
| Valores publicados (167 casos, 347 checks; 20 de ellos promovidos de F3B) | **347/347** | [`verification/REPORT.md`](../verification/REPORT.md) |
| Valores publicados de F3B (v0.6), de `verification/pending/F3B/` (22 checks en 18 casos) | **20/22** promovidos; V002 (E16u) y V009c (E13k) retenidos, y V105a (`aboveWater`, sin archivo de caso) también en `HOLD.json`; véase [abajo](#casos-promovidos-de-verificationpendingf3b) | ídem |
| cSlope 0.1.0, búsqueda (14 modelos, Bishop y Spencer) | **28/28** | [`verification/differential/REPORT.md`](../verification/differential/REPORT.md) |
| cSlope 0.1.0, superficie fija (los mismos) | **28/28** | ídem |
| cSlope 0.1.0, Fase 3a (D01-D23: M-P, Janbu, no drenado, polilínea) | **71/71** (D03 con M-P cuenta como concordancia: ningún motor encuentra solución) tras E13l-2 y E13l-5; véase [abajo](#batería-diferencial-frente-a-cslope) | ídem |
| cSlope 0.1.0, refuerzos v0.4 (D24-D27) | **12/12** | ídem |
| cSlope 0.1.0, grieta, agua embalsada y pilotes de Ito-Matsui v0.5 (D28-D42) | **58/60** (2 explicados por E15f y E15j-7, ninguna falla abierta; D30 fija se corrigió con E15j-8; véase [abajo](#grieta-de-tracción-agua-embalsada-y-pilotes-de-ito-matsui-v05-d28-a-d42)) | ídem |
| cSlope 0.1.0, Hoek-Brown, SHANSEP y búsqueda no circular v0.6 (F3B-HB-01 a F3B-NC-V034a) | **41/42** (1 explicado por E16t, ninguna falla; véase [abajo](#batería-diferencial-f3b)) | ídem |
| cSlope 0.1.0 como segundo oráculo de los 347 checks | **346/347** (V027: cSlope no converge) | [`verification/REPORT.md`](../verification/REPORT.md) |
| Identidad con la 0.4.0 (salida byte a byte, versión normalizada) | **0 diferencias en 180 modelos** (17 modelos v0.6 de `pending/F3B`, aparte) | `verification/tools/identity_vs_baseline.py` |
| Web y `ogs` (ida y vuelta; 409 modelos: 347 checks, 56 diferenciales y 6 de frontera) | **409/409**; el test calcula el número a partir del índice de casos | `verification/tools/test_web_roundtrip.py` |
| Pruebas automáticas (medidas con el binario `248c9efe…` de `22c8977`; véase «Reproducir» abajo) | `ogs-core` **778** pasan y 2 ignoradas, igual con la característica `parallel`; `ogs-cli` **8**; `pytest verification` **1549** pasan y 1 omitida; wheel `ogs-py` **370** pasan y 2 omitidas; web **4043 de 4043** con el motor real (`OGS_BIN`) y **3723** pasan con 320 omitidas sin él (4043 en total; cifras del coordinador sobre `f3b-integracion@434e874`, con W-R15c) | ídem |

## Aceptación: casos publicados

- **347 de 347 checks** publicados cumplen su tolerancia, en **167 casos** (`verification/cases/`): los 327 checks de los
  151 casos anteriores a F3B y los 20 checks de los 16 casos v0.6 promovidos de F3B
  ([abajo](#casos-promovidos-de-verificationpendingf3b)). El informe
  [`verification/REPORT.md`](../verification/REPORT.md) da ogs 347 OK, 0 fallas, 0 sin dato, 0 no convergidos.
  Test: `cargo test -p ogs-core --test acceptance`. Todo aviso que no sea informativo hace fallar un check (E5).
- **Por versión del formato** (de [`verification/cases/INDEX.md`](../verification/cases/INDEX.md)):

  | Versión | Casos | Checks |
  |---|---:|---:|
  | v0.1 | 49 | 99 |
  | v0.2 (sismo o cargas) | 5 | 13 |
  | v0.3 (no drenado, polilínea, M-P, Janbu) | 53 | 139 |
  | v0.4 (refuerzos, lotes R1 a R4) | 23 | 30 |
  | v0.5 (grieta de tracción, lote F3G; pilotes de Ito-Matsui, lote F3I) | 21 | 46 |
  | v0.6 (Hoek-Brown y búsqueda no circular, lote F3B) | 16 | 20 |
  | **Total** | **167** | **347** |

  El lote F3G (31 casos, 80 checks) usa la versión mínima de los campos de cada caso: los 17 casos con grieta van en
  v0.5; los 14 con solo agua embalsada, en v0.1 (8 casos, 21 checks) o v0.3 (6 casos, 17 checks). Por eso v0.1 y v0.3
  incluyen casos del lote F3G. Los 4 casos del lote F3I (V013b a V013e, un check cada uno) llevan `lateral_pressure` y
  son v0.5: con los 17 de grieta (42 checks) suman los 21 casos y 46 checks de la fila v0.5.

- **Por método** (suma de la columna «checks» del índice; coincide con el recuento de la tabla de `REPORT.md`):

  | Método | Checks |
  |---|---:|
  | Bishop simplificado | 137 |
  | Spencer | 130 |
  | Morgenstern-Price | 44 |
  | Janbu simplificado | 11 |
  | Janbu corregido | 25 |
  | **Total** | **347** |

  Por tipo de superficie, según el recuento de las filas de `REPORT.md`: 173 de búsqueda y 174 de superficie fija. Los
  20 checks de F3B son 18 de búsqueda no circular y los 2 de HAM1, con círculo fijo.
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
- **Retenidos:** el motor no reproduce **18 checks en 12 casos**, que no cuentan en los 347 y se documentan con su
  diagnóstico (sin relajar ninguna tolerancia). El recuento sale de las 18 entradas de los cinco `HOLD.json` de
  `verification/pending/` (lote 0: 5, F3: 1, F3R: 3, F3G: 6 y F3B: 3) y de sus 12 casos distintos (V027, V028, V032a, V068,
  V035b, V083, V009a, V009b, V085, V002-nc, V009c y V105a):
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
  - **los 3 de F3B** (`pending/F3B/HOLD.json`, [`pending/F3B/INDEX.md`](../verification/pending/F3B/INDEX.md), 1 check cada
    uno; el detalle está [abajo](#casos-promovidos-de-verificationpendingf3b)):
    - **V002-nc** (Spencer, 0,3864 frente a 0,414): la selección de raíz E12e en una rama con tracción (E16u);
    - **V009c** (Spencer, 1,8669 frente a 1,868): dentro de la tolerancia, pero con `interslice_shear_exceeds_strength`
      (E13k), la misma causa de V009a y V009b;
    - **V105a** (Bishop, 1,2524 frente a 1,285): usa `aboveWater`, fuera del formato v0.6. No tiene archivo de caso en
      `pending/F3B/`, porque el importador no lo escribe.

  Detalle en [`docs/limitaciones.md`](limitaciones.md#checks-retenidos-y-casos-especiales),
  [`pending/lote0/INDEX.md`](../verification/pending/lote0/INDEX.md) y
  [`pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md).
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce **346 de 347** de esos checks; el restante es V027, donde cSlope
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
- **Ida y vuelta de la web** (E12g): para **409 modelos** (347 checks de los 167 casos, 56 de la batería diferencial y 6
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
el agua embalsada. De los 167 casos de `verification/cases/`, **14** tienen la piezométrica sobre el terreno (ninguno de los 16 casos v0.6 la tiene; la misma
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

## Hoek-Brown, SHANSEP y búsqueda no circular (v0.6)

El bloque F3B (formato v0.6, que saldrá con la 0.5.0) se verifica por módulo contra un prototipo independiente en Python y
contra cSlope 0.1.0, con las mismas reglas de siempre: **no se relajó ninguna tolerancia** y un check que el motor no
reproduce queda retenido con su causa. Las cifras son las **finales tras la revisión R15** (enmiendas E16v a E16z):
salen del binario de release de `22c8977` (`cargo build --release -p ogs-cli`, sha256 `248c9efe…`, el mismo de las
compuertas de R15), de los informes regenerados con él y de los comandos de «Reproducir F3B».

| Módulo | Filas de aceptación | Diferencia medida | Prueba |
|---|---|---|---|
| **M-HB**, Hoek-Brown (F6.8), producto contra el prototipo de la envolvente completa | 20 (4 modelos × 5 métodos), círculo fijo | **≤ 0,0011 %** (la mayor, SB con Bishop, +0,001024 %) | `f3b_hoek_brown.rs` |
| **M-HB**, lazo con la regla de compatibilidad de cSlope (solo en tests) contra el oráculo | 33 con gate, de 35 | **de 0,0018 % a 0,0716 %** | `strength_loop::tests::compatibility_against_oracle` |
| **M-SH**, SHANSEP (F6.9) contra cSlope | 13 escenarios × 5 métodos, círculo fijo | **≤ 0,0224 %** | `f3b_shansep.rs` |
| **M-NC**, búsqueda no circular (F6.10) contra cSlope | 10 búsquedas + 10 evaluadores | de +0,010 % a +0,398 % (V002: −5,976 %, E16u); evaluador ≤ 0,0616 % | `f3b_noncircular.rs` |

Las pruebas de F3B de `ogs-core` pasan: `f3b_format` 12, `f3b_hoek_brown` 6, `f3b_shansep` 14 y `f3b_noncircular` 8
(`cargo test -p ogs-core --release --test f3b_format --test f3b_hoek_brown --test f3b_shansep --test f3b_noncircular`), las
de R15 `f3b_r15_contact` 2 y `f3b_r15_faces` 3, y las 71 de la biblioteca, con 1 ignorada
(`cargo test -p ogs-core --release --lib`). El total de `ogs-core` es de **778 que pasan y 2 ignoradas**, igual con la
característica `parallel` (compuertas de R15 del coordinador).

### Hoek-Brown (M-HB)

- **Producto contra el prototipo.** Los modelos X25 (0 a 1 dovelas en bajo confinamiento), HAM1 (3 a 4), SA (2 a 4) y SB (10 a
  12), con Bishop, Spencer, Morgenstern-Price y los dos Janbu, a **0,0011 % o menos** del prototipo de la envolvente completa
  de X28 (`X28_proto/hb.py`, regla `cut`, convergencia total de 1e-8), una implementación independiente en Python.
- **Lazo contra el oráculo.** Con la regla de bajo confinamiento de cSlope, activable solo en las compilaciones de test
  (`#[cfg(test)]`, E16t), el lazo reproduce a cSlope en 33 de 35 filas, a **0,0018 % a 0,0716 %**: los cuatro modelos y las
  filas con agua y con `ru` (`X28-W-SB-LINEA16`, `X28-R-SB-RU03`, `X28-R-X25-RU03`). Las 2 filas sin gate son Spencer y
  Morgenstern-Price en SB, que con la regla de cSlope no tienen raíz de λ.
- **El producto frente a cSlope** (círculo fijo, los 20 valores de X28; la regla completa nunca da más resistencia):

  | Modelo | Bishop | Spencer y M-P | Janbu simplificado | Janbu corregido |
  |---|---:|---:|---:|---:|
  | X25 | −0,005 % | −0,002 % | +0,005 % | +0,003 % |
  | HAM1 | −0,138 % | −0,084 % | −0,260 % | −0,262 % |
  | SA | −0,103 % | −0,054 % | −0,147 % | −0,148 % |
  | SB | −1,112 % | −0,628 % | −2,878 % | −2,880 % |

- **Identidades** (F6.11, `f3b_hoek_brown.rs` y `hoek_brown::tests`): el criterio original de Hoek y Brown (1980) con GSI 100
  y D 0, el espejo (mismo FS), la monotonía (sube con GSI y con σci, baja con D), el equilibrio global con los (c, tan φ)
  finales, un perfil con Mohr-Coulomb y Hoek-Brown a la vez, y el corte por tracción. La no convergencia en 50 pasadas se
  prueba con `strength_loop::tests::pass_limit_reports_nonconvergence`.
- **HAM1 (Hammah et al., 2005, ejemplo 1, ARMA 05-810).** Bishop **1,1502** frente a **1,153** publicado (−0,24 %) y Spencer
  **1,1521** frente a **1,152** (+0,005 %), con una **tolerancia de 0,5 %**. La **geometría está reconstruida** (X23 §3.2: del
  tutorial de XSLOPE, con la cimentación de 5 m y γ = 25 kN/m³ como supuestos escritos en el caso), así que no se compara con
  la última cifra publicada y la fila es un check de fidelidad del criterio, no una prueba de la geometría. El publicado es
  el resultado de una búsqueda de la fuente, no del círculo fijo del caso.
- **El lazo con arranque no negativo y `X28-R-SB-RU03` (E16w, R15A-03).** El arranque de F6.8 pasó a
  `σ′n₀ = max(0, (W/b)·cos²α − u)`: con el anterior, 11 dovelas empinadas del rajo SB con `ru` 0,3 partían en (0, 0) y los
  cinco métodos fallaban en la primera pasada. Ahora el círculo fijo converge en los cinco métodos, en 16 o 17 pasadas
  (`ogs analyze crates/ogs-core/tests/data/f3b/r15/hb/hb_sb_ru03.json`):

  | Método | FS del motor | cSlope (su regla de bajo confinamiento) | Diferencia |
  |---|---:|---:|---:|
  | Bishop | 0,886886 | 0,961808 | −7,8 % |
  | Spencer y Morgenstern-Price | 0,943003 | 1,010265 | −6,7 % |
  | Janbu simplificado | 0,727964 | 0,873700 | −16,7 % |
  | Janbu corregido | 0,761333 | 0,913764 | −16,7 % |

  Todos quedan **bajo cSlope**, como manda la envolvente completa con muchas dovelas sin resistencia. Con la regla de cSlope
  (solo en los tests), la misma fila coincide a +0,0716 % en Bishop. Donde el arranque anterior convergía, el FS no cambia:
  la fila SB con Bishop del producto, que ya estaba en +0,001024 % frente al prototipo desde M-HB, sigue en ese valor, y las
  20 filas del producto y las 33 de compatibilidad quedan igual que antes (el gate es «sin cambio», no «≤ 0,001 %»).
  Sin convergencia en 50 pasadas, el resultado es `not_converged` con `hoek_brown_not_converged` y **`fos` `null`**; la nota
  `hoek_brown_low_confinement` se conserva.
- **Costo.** La búsqueda Bishop con Hoek-Brown tarda hoy unas 12 a 14 veces la de Mohr-Coulomb, y no las 50 de M-HB: el
  Newton salvaguardado de `hoek_brown::point` (E16w) y el precálculo de `sn(0)` y σt la bajaron. Medido con
  `ogs analyze` del binario de esta rama (mejor de 5 corridas, un hilo, solo Bishop, búsqueda por defecto): F3B-HB-01 (SA,
  18 688 candidatos evaluados) **1,78 s** y F3B-HB-02 (SB) **1,18 s**, frente a 0,130 s y 0,097 s del mismo modelo con un
  Mohr-Coulomb de c 50 kPa y φ 35° (13,7 y 12,1 veces; el cociente cambia con el modelo y con la malla). Antes de E16w,
  R15-M2 midió 8,16 s y 5,33 s en serie y 0,52 s y 0,35 s con `parallel`; después, 1,79 s y 1,18 s en serie y 0,13 s y
  0,09 s con `parallel`. El FS cambia 6,2e-14 relativo como máximo. En el navegador (Chrome con WASM monohilo), la búsqueda
  de F3B-HB-01 con 4 métodos tarda **unos 20 s** (20,0 s de cálculo y 20,4 s de reloj; medición de W-R15c, `tmp_hb_4m.ogs.json`),
  frente a 36 s antes de E16w.

### SHANSEP (M-SH)

13 escenarios × 5 métodos, en círculo fijo, a **0,0224 % o menos** de cSlope (medido; el criterio es 0,1 %). Son los de X30 sobre V047a
(S 0,25, m 0,8):

| Escenario | Filas | Diferencia máxima con cSlope |
|---|---:|---:|
| V047a seco con OCR 1, OCR 1,5, POP 10 kPa y OCR por cota | 4 × 5 | 0,0027 % a 0,0051 % |
| V047a húmedo (piezométrica sobre el terreno), los mismos cuatro | 4 × 5 | 0,0190 % a 0,0224 % |
| carga `udl` y carga `line` | 2 × 5 | 0,0060 % y 0,0035 % |
| sismo `kh` 0,1 y `kv` 0,1 | 2 × 5 | 0,0036 % y 0,0032 % |
| círculo muy ancho y poco profundo (r ≈ 257 m, OCR 1) | 1 × 5 | 0,0008 % |

- **Identidades** (`f3b_shansep.rs`): con OCR 1, Su = ratio·σ′v; las cargas entran en σ′v; **el sismo no cambia Su**; POP 0 es
  igual a OCR 1; con exponente 0, el OCR no importa; el espejo; el FS sube con `ratio` y con el OCR; una capa de Mohr-Coulomb y
  una de SHANSEP; la nota `shansep_nonpositive_stress` una vez por método y solo con σ′v ≤ 0; y el equilibrio global con las
  resistencias finales.
- **V105a retenido.** Sin `aboveWater` (fuera del formato v0.6), el motor da Bishop 1,2524 frente a 1,285 publicado (−2,54 %),
  fuera de la tolerancia del caso; cSlope con `aboveWater` da 1,2851. Está en `verification/pending/F3B/HOLD.json`.

### Búsqueda no circular (M-NC)

Las 10 búsquedas de X29 (Morgenstern-Price de f constante, que es igual a Spencer) y los 10 evaluadores (la polilínea
final de cSlope como superficie fija en el motor), con las cifras del motor de esta rama. Las diferencias con cSlope son de un solo lado
(A2: `FS_ogs ≤ 1,01·FS_cSlope`; un FS menor se acepta porque es una búsqueda de mínimo); el publicado se compara con su
tolerancia **relativa** (A3, E16u):

| Caso | ogs | círculo (semilla) | cSlope | Δ cSlope | publicado | Δ publicado | tolerancia | evaluador Δ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V001 | 1,3839 | 1,4021 | 1,3837 | +0,011 % | 1,386 | −0,15 % | 2,04 % | −0,0012 % |
| V002 | 0,3864 | 0,4020 | 0,4110 | −5,976 % | 0,414 | −6,66 % | 2,12 % | +0,0043 % |
| V026 | 1,1731 | 1,1965 | 1,1702 | +0,254 % | 1,190 | −1,42 % | 2,42 % | +0,0023 % |
| V033 | 1,5236 | 1,5336 | 1,5221 | +0,099 % | 1,534 | −0,67 % | 2,03 % | +0,0024 % |
| V034a | 1,2650 | 1,2768 | 1,2600 | +0,398 % | 1,262 | +0,24 % | 2,04 % | +0,0126 % |
| V034b | 1,1705 | 1,3286 | 1,1686 | +0,169 % | 1,182 | −0,97 % | 2,04 % | +0,0616 % |
| V036a | 0,7366 | 0,7564 | 0,7360 | +0,080 % | 0,740 | −0,46 % | 2,68 % | +0,0182 % |
| V093 | 1,3253 | 1,3413 | 1,3224 | +0,217 % | 1,325 | +0,02 % | 2,04 % | +0,0013 % |
| V102a | 0,9980 | 1,0010 | 0,9978 | +0,025 % | 0,999 | −0,10 % | 2,05 % | +0,0060 % |
| V102b | 0,9966 | 1,0007 | 0,9965 | +0,010 % | 0,997 | −0,04 % | 2,05 % | −0,0031 % |

- **A1:** el FS reportado nunca supera el del círculo de la búsqueda circular (la columna «círculo»), por construcción: el
  resultado es el mínimo entre ese círculo y la polilínea.
- **A2:** de **+0,010 % a +0,398 %** frente a cSlope en 9 filas, dentro de 1 %; V002 queda 5,976 % por debajo (abajo).
- **A3:** el publicado, dentro de su tolerancia, en 9 filas. **V002** queda a −6,66 % frente a una tolerancia de 2,12 %.
- **V002 y E16u.** El motor da 0,3864 con las notas `negative_lambda` y `negative_effective_normal_major`. Su círculo (0,4020,
  λ = −0,499) ya cae bajo la banda [0,40522; 0,42278]. En las **mismas** superficies, cSlope da 0,4322 (el círculo del
  motor) y **0,4152 (la polilínea del motor)**: la polilínea del motor, evaluada por cSlope, cae dentro de la banda publicada y
  a +1,03 % de la óptima de cSlope (0,4110). La diferencia de 7 % es la selección de raíz E12e, la limitación conocida de
  R5-05, no el algoritmo no circular; se mantiene E12e por conservadora. En V002 el criterio A3 es de un solo lado
  (`FS ≤ publicado·(1 + tol)`) y el test exige la nota `negative_effective_normal_major`. El caso queda retenido.
- **Evaluador:** las 10 filas, a **0,0616 % o menos** (el criterio es 0,1 %).
- **A4, A6:** los vértices no superan `max_vertices` (33) y el resultado es el mismo en dos corridas y con o sin `parallel`
  (`deterministic_and_janbu`).
- **Costo.** Las evaluaciones de la etapa no circular son 4500 (3 semillas × 1500) en nueve de las diez filas y 3614 en V002
  (medido con `ogs analyze` del binario de esta rama). Con los extremos de E16x, el costo es **de 2,3 a 3,1 veces** el de la
  búsqueda circular (V001 2,3, V034a 2,4 y V036a 3,1, R15-M3); en esta máquina, V001, V034a y V036a dan 2,32, 2,52 y 3,14
  veces (mejor de 5 corridas de `ogs analyze`, sin y con `non_circular`, un solo método), y el rango de las diez
  búsquedas va de 1,75 (V002) a 3,14 veces. La meta de A7 (≤ 4 veces) no es un gate.
- **Los 16 taludes homogéneos y el banco con capa débil (E16x, R15A-02).** Los extremos de la conversión salen ahora del
  tramo que analiza el slicer, no de los cruces extremos del círculo, que incluían el lente que se descarta bajo el pie.
  Antes, en 14 de 16 taludes homogéneos de 10 m y 45° el resultado era el círculo con `evaluated` = 0, sin aviso. Con E16x
  **los 16 refinan** (`evaluated` de 3000 a 4500 y FS no circular ≤ el del círculo en los 16; medido con
  `crates/ogs-core/tests/data/f3b/r15/nc/diag_u_*.json`, que el test `r15_sixteen_homogeneous_slopes_refine` recorre). En el
  banco de capa débil (`steep_bench.json`, Spencer), el círculo da 1,9177 y la polilínea, **1,9093**, con 3001 evaluaciones;
  cSlope da 1,8560, así que el motor queda **+2,87 %** sobre él. Esa fila **no es un A2**: la referencia de cSlope viene de
  un círculo crítico con `converged: false` (brecha 0,0084), el motor no tiene raíz de λ en esa superficie y, en la
  polilínea del motor, los dos evaluadores coinciden a 1e-8 (1,90928617 frente a 1,90928616, R15-M3).
- **La holgura de las ventanas y la nota `non_circular_not_refined` (E16x).** Las ventanas de salida se aceptan con
  `max(tol, 1e-6·ancho)`, porque un círculo que sale rozando el pie cruza el terreno casi tangente y su cruce tiene un
  error del orden de la raíz de la tolerancia (9,5e-6 en `berm_window`). Con ella, `berm_window` refina (1500
  evaluaciones, 1,0924 → 1,0877). Si aun así `evaluated` = 0, el motor emite la nota informativa `non_circular_not_refined`
  una vez por método: es el caso de `berm_exit_below_bench.json`, con la salida bajo el banco (Spencer 1,1195, el
  círculo). Las tolerancias de la búsqueda no circular tienen escala (`g − pm.tol()` y `span.max(pm.tol())`): un modelo
  escalado por 1e-3, 1e-5 o 1e5 da las mismas semillas y el mismo FS (`r15_scale_invariance`).

### Batería diferencial F3B

Doce modelos v0.6 en `verification/differential/cases_f3b/`, con **42 checks**: búsqueda (Bishop y Spencer; solo Spencer en
los dos no circulares) y círculo fijo en los diez que lo tienen. Resultado con el motor integrado:
**41 OK, 1 explicado, 0 fallas, 0 sin dato** (22 de búsqueda y 20 de superficie fija). Seis de los 41 OK son «OK (F6.8:
envolvente completa)»: cSlope difiere más de 0,5 % por su regla de bajo confinamiento y ogs coincide con el prototipo de la
envolvente completa a ≤ 0,001 %.

| Modelo | Qué es | Checks | OK | Explicados | Búsqueda: Δ con cSlope | Fija: Δ con cSlope |
|---|---|---:|---:|---:|---|---|
| F3B-HB-01 | SA, σci 12000, GSI 25, mi 8, D 0,7, seco | 4 | 4 | 0 | −0,001 % a +0,001 % | −0,103 % a −0,054 % |
| F3B-HB-02 | SB, σci 15000, GSI 40, mi 10, D 0,5, con piezométrica | 4 | 3 | 1 | −0,405 % a −0,148 % | −1,111 % a −0,627 % |
| F3B-HB-03 | SA, σci 8000, GSI 20, mi 6, D 1, seco | 4 | 4 | 0 | −0,002 % a +0,015 % | −0,020 % a −0,013 % |
| F3B-HB-04 | SA, σci 20000, GSI 35, mi 10, D 0, con agua | 4 | 4 | 0 | −0,238 % a −0,207 % | −2,569 % a −1,806 % |
| F3B-HB-05 | SA, σci 18000, GSI 30, mi 9, D 0,3, seco | 4 | 4 | 0 | −0,039 % a −0,033 % | −0,745 % a −0,395 % |
| F3B-HB-06 | SB, σci 10000, GSI 30, mi 8, D 0,8, con agua | 4 | 4 | 0 | −1,811 % a −0,665 % | −0,275 % a −0,195 % |
| F3B-HB-07 | SB, σci 18000, GSI 38, mi 10, D 0, seco | 4 | 4 | 0 | −0,464 % a −0,330 % | −0,459 % a −0,317 % |
| F3B-HB-08 | SB, σci 25000, GSI 45, mi 10, D 1, con agua | 4 | 4 | 0 | −1,086 % a −0,712 % | −0,775 % a −0,585 % |
| F3B-SH-OCR1 | V047a, SHANSEP S 0,25, m 0,8, OCR 1 | 4 | 4 | 0 | −0,004 % a −0,003 % | −0,003 % |
| F3B-SH-POP | V047a, SHANSEP S 0,25, m 0,8, POP 10 kPa | 4 | 4 | 0 | +0,001 % | +0,001 % |
| F3B-NC-V001 | V001, no circular | 1 | 1 | 0 | +0,011 % | — |
| F3B-NC-V034a | V034a, no circular | 1 | 1 | 0 | +0,005 % | — |

- **El explicado**, que no cuenta como OK ni como falla y **no relaja la tolerancia**:
  - **F3B-HB-02, Spencer, círculo fijo (E16t):** con la regla de cSlope no hay raíz de λ (`not_converged`, minFOS 2,1079 que
    no es una raíz), así que cSlope no es referencia. El motor da 2,094659 y el prototipo de la envolvente completa, 2,094657
    (+0,000 %, sin gate).
- **F3B-HB-06, Bishop, búsqueda: de «explicado» a OK (E16w, R15).** Hasta R15 era «explicado (§4.2: m_α)»: el motor daba
  0,5373 frente a 0,5279 de cSlope (+1,78 %, sobre `1,01·cSlope`), y se atribuía a que el círculo crítico de cSlope (centro
  −9,277; 10,717; r 14,175) entra a 87° por el banco de 70° y el motor lo declara inválido por `m_alpha` (`min_m_alpha` 0,2),
  que cSlope acepta con `steep-entry-tension`. Con el arranque `max(0, ·)` del lazo (E16w), la búsqueda de ogs da **0,5244
  frente a 0,5279** (−0,66 %, **OK**): la causa del 0,5373 era el arranque del lazo, no solo el `m_α` del círculo de cSlope.
  La regla de §4.2 sigue vigente para otros casos: el veredicto «explicado (§4.2: m_α)» solo vale si, además,
  `FS_ogs ≤ 1,05·FS_cSlope` (cota de E16z); por encima de esa cota es `FALLA`. Se calcula cuando se dan las dos señales
  (`m_alpha` en el círculo de cSlope y `steep-entry-tension`), en `verification/differential/run.py`.
- **El bloque no corre por defecto**: se activa con `--include-f3b` (o `OGS_DIFFERENTIAL_F3B=1`), y `--require-f3b` sale con
  código 6 si algún check no pasa. Los criterios están en
  [`verification/differential/README.md`](../verification/differential/README.md).
- **Sin F3B** (la batería anterior, sobre el mismo binario): D01-D14, 28/28 en búsqueda y 28/28 en superficie fija; la Fase 3a,
  71/71; v0.4, 12/12 y v0.5, 58 OK y 2 explicados de 60.

### Identidad con la 0.4.0

Un modelo sin campos v0.6 da la misma salida, byte a byte, que la 0.4.0 con la versión del motor normalizada
(`verification/tools/identity_vs_baseline.py --normalize-version --include-reinforced` contra el binario de la 0.4.0):
**0 diferencias en 180 modelos** sin agua sobre el terreno, **sin agregar ninguna entrada** a
`verification/tools/identity_exceptions.json` (el archivo no cambia desde la 0.4.0). Con `--include-reinforced` y
`--include-v05` se comparan también los modelos con refuerzos, grieta y Ito-Matsui (0 saltados); lo único que se salta son
**17 modelos con campos v0.6**, porque el binario base no lee esa versión. Los 23 modelos con agua sobre el terreno se
comparan aparte (idénticos). La identidad del informe y del CSV de la web: **la carga, los avisos, el informe, los CSV y el PDF de seis modelos v0.5 o
anteriores son idénticos byte a byte** frente al tag `v0.4.0` (extraído con `git archive`), con el reloj y el azar fijos
(`apps/web/src/report/identity.f3b.mjs`).

### Casos promovidos de `verification/pending/F3B/`

`verification/pending/F3B/` trae **18 casos con 22 checks** de la búsqueda no circular (los 16 casos de X23 más V036a) y HAM1
(F6.12). Contra el motor de R15, **21 de los 22 checks** quedan dentro de su tolerancia en el FS (la aceptación de los 20
promovidos, 347 checks sin fallas, y V009c, con 1,8669 frente a 1,868 medido con el binario de esta rama) y el de V002 queda
fuera (0,3864 frente a 0,414). V009c cumple el valor, pero no la aceptación, por su aviso.

- **Promovidos:** 20 checks de 16 casos, a `verification/cases/` (versión v0.6), con `import_cslope.py --promote-f3b`:
  HAM1 (Bishop y Spencer), V001-nc, V026-nc, V033-nc, V034a-nc, V034b-nc, V036a-nc, V093-nc (Spencer y Janbu
  simplificado), V102a-nc, V102b-nc, V050b, V059a, V059b, V059c, V094 (Spencer y Morgenstern-Price) y V103 (2 checks).
  El sufijo `-nc` distingue los casos que ya existían con su búsqueda circular, que no cambian. Se promueve solo lo que
  cumple la aceptación, que rechaza todo aviso no informativo (E5).
- **Retenidos, en `HOLD.json` (3 checks, 1 por caso), con su causa:**
  - **V002** (Spencer, 0,3864 frente a 0,414): la selección de raíz E12e en una rama con tracción, con las notas
    `negative_lambda` y `negative_effective_normal_major` (E16u, arriba). No se relaja la tolerancia.
  - **V009c** (Spencer, 1,8669 frente a 1,868): queda dentro de su tolerancia, pero emite
    `interslice_shear_exceeds_strength` (E13k), que la aceptación no admite; es la misma causa que retiene V009a y V009b.
  - **V105a** (Bishop, 1,2524 frente a 1,285): `aboveWater`, fuera de v0.6. No se escribe como caso, así que su entrada de
    `HOLD.json` no tiene archivo en `pending/F3B/` (por eso el índice generado cuenta 2 retenidos y `HOLD.json`, 3).

### Revisión R15 (E16v a E16z)

La revisión adversarial R15 (tres lentes, sobre `92fa882`) corrigió el motor con las enmiendas E16v a E16z de
`briefs/05_CONTRATOS_FASE3B.md`. Estas son las filas que la verifican, con su cifra medida en esta rama (`ogs analyze` del
binario de `22c8977`) y la prueba que las recorre:

| Enmienda | Qué se mide | Antes de R15 | Con R15 | Prueba |
|---|---|---|---|---|
| E16v, contacto | Spencer, polilínea por el contacto horizontal, MC débil sobre HB fuerte: encima / sobre / debajo | 1,2342 / **18,036** / 18,0761 | 1,2342 / **1,2342** / 18,0761 | `f3b_r15_contact.rs` |
| E16v | MC débil sobre SHANSEP fuerte | 1,2342 / **8,3083** / 8,3101 | 1,2342 / **1,2342** / 8,3101 | ídem |
| E16v | SHANSEP fuerte sobre MC débil | 13,4299 / **13,4306** / 6,3357 | 13,4299 / **6,3363** / 6,3357 | ídem |
| E16v | HB fuerte sobre MC débil y sobre HB débil, Janbu simplificado, sobre el contacto y debajo (Spencer no halla raíz de λ en esas dos: `no_lambda_root`) | — | 8,8021 y 8,8009 (+0,014 %); 8,4064 y 8,4046 (+0,022 %) | ídem |
| E16w, lazo | `X28-R-SB-RU03`, Bishop y Spencer | `invalid` (fos 0,018855) y `not_converged` | 0,886886 y 0,943003 | `f3b_hoek_brown.rs` (`r15_ru03_converges_with_full_envelope`) |
| E16w, costo | F3B-HB-01 / F3B-HB-02, Bishop, búsqueda en serie | 8,16 s / 5,33 s | 1,79 s / 1,18 s (0,13 s / 0,09 s con `parallel`) | R15-M2 y la medición de arriba |
| E16x, no circular | taludes homogéneos de 10 m y 45° que refinan | 2 de 16 | **16 de 16** | `f3b_noncircular.rs` (`r15_sixteen_homogeneous_slopes_refine`) |
| E16x | banco con capa débil, Spencer: círculo → polilínea (cSlope 1,8560) | `evaluated` = 0, 1,9177 | 1,9177 → 1,9093 (+2,87 % sobre cSlope, explicado arriba) | `r15_steep_bench_is_refined` |
| E16y, caras | capa SHANSEP seca y sumergida, capacidad de cara por cara (Arquímedes) | — | coincide a 5,6e-16 con SHANSEP y 5,1e-16 con Hoek-Brown, en 51 caras (la prueba exige 1e-9) | `shansep::tests::archimedes_face_by_face_shansep_and_hoek_brown` |
| E16y | el mismo caso, FS de Spencer: seco / sumergido | — | 1,281109 / 1,282972 (+0,15 %) | `sh2_arch_dry.json` y `sh2_arch_sub.json` |
| E16y, finitud | `ocr` = 1e308 con superficie fija, y `pop` = 1e308 con `exponent` 1 en búsqueda | código 0, 240 `cohesion` `null` | código 2, `InvalidModel` | `f3b_r15_faces.rs` |
| E16z | lista de notas informativas, esquema y veredicto m_α | `run.py` y `acceptance.rs` desincronizados (tres códigos de F6.7 contados como no informativos) | una sola fuente, comparada por un test; `null` en `seeds` y `max_vertices`; cota 1,05 | `verification/differential/test_f3b.py` y `verification/tools/test_schema.py` |

- **Arquímedes y el aviso sumergido (E16y).** La prueba de Arquímedes se hace sobre la **capacidad de cara**, no sobre el
  FS: una capa seca con γ′ y la misma capa sumergida con γ, γw y el embalse dan la misma capacidad de cara (`∫ τ dz`) a
  6e-16 relativo, cara por cara. El FS de equilibrio límite **no es invariante** (+0,15 %): la formulación en tensiones
  totales reparte distinto las fuerzas entre dovelas. Con un material Mohr-Coulomb no drenado (c = 15 kPa, φ = 0) el
  coordinador midió el mismo +0,15 %: seco 1,765726 y sumergido 1,768293 con Spencer. Por la misma razón, el aviso
  `interslice_shear_exceeds_strength` puede seguir saliendo en el caso sumergido: en la cara 1, el cortante entre dovelas
  X = λ·f·E, con E total, pasa de 0,276 en seco a 1,882 sumergido, frente a una capacidad de 0,1686 en los dos (el aviso
  sale en las caras 1 a 7 del caso sumergido).
- **Las enmiendas no cambian la identidad.** Con 0 diferencias en 180 modelos (17 modelos v0.6 aparte, 23 con agua sobre el
  terreno idénticos), y `identity.f3b.mjs` da todo IGUAL contra el tag `v0.4.0`.

### Reproducir F3B

```sh
export TMPDIR="$(mktemp -d)"; export CARGO_TARGET_DIR="$TMPDIR/target"
cargo build --release -p ogs-cli

# Pruebas de F3B del motor
cargo test -p ogs-core --release --test f3b_format --test f3b_hoek_brown --test f3b_shansep --test f3b_noncircular
cargo test -p ogs-core --release --lib

# Los tests de R15 y de la verificación de F3B
cargo test -p ogs-core --release --test f3b_r15_contact --test f3b_r15_faces
cargo test -p ogs-core --release --lib archimedes -- --nocapture

# Batería diferencial con el bloque F3B (42 checks)
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely python \
  verification/differential/run.py --ogs $CARGO_TARGET_DIR/release/ogs --out $TMPDIR/f3b-diff --require-f3b

# Identidad con la 0.4.0 (el binario base se compila desde el tag v0.4.0)
env -u PYTHONPATH -u PYTHONHOME python3 verification/tools/identity_vs_baseline.py --base $BASE_V040/ogs \
  --new $CARGO_TARGET_DIR/release/ogs --normalize-version --include-reinforced --include-v05

# Identidad del informe y del CSV de la web contra el tag v0.4.0 (lo extrae con git archive; BASE_REF cambia la referencia)
cd apps/web && OGS_BIN=$CARGO_TARGET_DIR/release/ogs node src/report/identity.f3b.mjs

# Ejemplos de docs/formato-ogs-json.md contra el esquema 0.6 (14 ejemplos y 103 fragmentos)
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema \
  python docs/tools/validar_ejemplos.py --ogs $CARGO_TARGET_DIR/release/ogs

# Wheel de ogs-py (370 pasan y 2 omitidas) y pruebas de verificación (1549 pasan y 1 omitida)
(cd crates/ogs-py && env -u PYTHONPATH -u PYTHONHOME uv run --python 3.13 --no-project --with maturin maturin build --release --out "$TMPDIR/ogs-py-dist")
# ... instalar el wheel en un entorno virtual con pytest, como en crates/ogs-py/README.md, y:
$TMPDIR/ogs-py-venv/bin/python -m pytest crates/ogs-py/tests -q
OGS_BIN=$CARGO_TARGET_DIR/release/ogs env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project \
  --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
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
  La tercera excepción (γw por defecto de un archivo imperial con agua y sin `water.unit_weight`, E15l-6 y E15m-6) no
  aparece en la compuerta porque ningún modelo imperial del corpus usa agua
  ([Limitaciones](limitaciones.md#tercera-excepción-a-la-identidad-con-la-v030-γw-por-defecto-en-imperial-e15l-6-e15m-6)).
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
  finita; y las reproducciones de las revisiones R12 y R13: E15l-1, -5, -6, -7 y -11, y E15m-1, -2, -6, -7 y -15 sin marcas
  (E15m-15 revisa E15l-2 y fija la grieta sobre una discontinuidad contra cSlope, con `face_height`). Son 173 pruebas en
  `test_v05.py` y 264 en `crates/ogs-py/tests`: con el wheel de producción pasan 262 y se omiten las 2 de pánico, y con el
  wheel de `--features test-hooks` pasan las 264; no hay ninguna `xfail`.
- **`ogs-py` v0.6** (R15B-06): `crates/ogs-py/tests/test_v06.py` (108 pruebas) prueba la v0.6 a través del wheel, en lugar del
  test del stub de antes: Hoek-Brown y SHANSEP en círculo fijo con las filas de X28 y X30 (el producto contra el prototipo
  de la envolvente completa a 0,1 %, y contra cSlope solo como cota), la búsqueda no circular con V001-nc, V050b, V093-nc y
  V103 y con el modelo `berm_exit_below_bench.json` de R15-M3 (la nota `non_circular_not_refined`; V103 ya refina desde
  E16x, así que no sirve para esa nota), las combinaciones de F6.5 y los campos `strength` y `search.non_circular` del
  informe. La docstring del paquete y `crates/ogs-py/README.md` documentan la v0.6. Con el wheel de producción pasan los
  370 y se omiten 2 (las de pánico, que necesitan `--features test-hooks`); medido con
  `pytest crates/ogs-py/tests -q` sobre el wheel de esta rama (372 pruebas en total).
- **`ogs`**: `verification/tools/test_cli_usage.py` fija que el mensaje de uso lista los cinco métodos de `ogs bench`, y
  `crates/ogs-cli` (8 pruebas) prueba que `ogs bench` no baja la versión de un modelo 0.4 y que el uso lista
  `tension_crack`, `lateral_pressure`, `capacity` y `soil_force` (E15l-25). Con R15B-13, `ogs bench --method all` (el valor
  por defecto) **omite Bishop** si el modelo trae `analysis.search.non_circular`, lo avisa por stderr y mide los otros cuatro
  métodos; un `--method bishop` explícito sigue dando el error del motor. El uso (`ogs` sin argumentos) documenta además
  `strength` y `search.non_circular` del informe.
- **Esquema:** `verification/tools/test_schema.py` compara el esquema con el binario en una tabla de documentos; con
  E13l-8 incluye la polilínea sin `methods` (el esquema y el motor la rechazan), y con el bloque de refuerzos compara
  también [`schema/ogs-0.4.schema.json`](../schema/ogs-0.4.schema.json) (que acepta 0.1 a 0.4 y rechaza lo mismo que el
  motor). Con la v0.5 compara [`schema/ogs-0.5.schema.json`](../schema/ogs-0.5.schema.json) (que acepta 0.1 a 0.5, agrega
  `analysis.tension_crack`, `lateral_pressure` y `capacity`, y rechaza lo mismo que el motor). Con la v0.6 compara [`schema/ogs-0.6.schema.json`](../schema/ogs-0.6.schema.json) (que acepta 0.1 a 0.6, agrega los materiales
`hoek_brown` y `shansep` y `analysis.search.non_circular`, y rechaza lo mismo que el motor salvo lo que JSON Schema no puede
expresar, E16n: el orden de `ocr_by_elevation` y las reglas de F6.5 que relacionan dos partes del documento). Con `test_cli_usage.py`,
594 pruebas (medido con `OGS_BIN=$PWD/target/release/ogs pytest verification/tools/test_schema.py verification/tools/test_cli_usage.py`). Con E16z, el esquema 0.6 admite `null` en `non_circular.seeds` y `non_circular.max_vertices`, como los demás campos opcionales.

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

# Ejemplos de docs/formato-ogs-json.md (contra schema/ogs-0.6.schema.json)
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema python docs/tools/validar_ejemplos.py

# Bloque F3B (batería con --require-f3b, identidad con la 0.4.0 y pruebas de F3B): véase
# «Reproducir F3B», en la sección «Hoek-Brown, SHANSEP y búsqueda no circular (v0.6)»
```

## Informes

- [`verification/REPORT.md`](../verification/REPORT.md): aceptación y harness frente a cSlope.
- [`verification/differential/REPORT.md`](../verification/differential/REPORT.md): batería diferencial, incluida la
  Fase 3a, los modelos D18 a D23 de R10, el bloque v0.5 (D28 a D42) y el bloque F3B (F3B-HB-01 a F3B-NC-V034a), regenerado
  con el motor de R15.
- [`verification/cases/INDEX.md`](../verification/cases/INDEX.md): los casos, con sus checks por método y versión (los 151 casos anteriores a
  F3B y los 16 promovidos de la v0.6).
- [`verification/pending/`](../verification/pending/INDEX.md): checks retenidos y problemas que el importador no
  convierte, con el motivo de cada uno.
- [`bench/RESULTS.md`](../bench/RESULTS.md): rendimiento.
- [`docs/fase3/d1/DIAGNOSTICO.md`](fase3/d1/DIAGNOSTICO.md): diagnóstico de las soluciones inadmisibles de Spencer en
  polilíneas en V.
- [`docs/reviews/`](reviews/): revisiones adversariales.
