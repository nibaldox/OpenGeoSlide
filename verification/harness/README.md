# Harness de verificación cruzada (W1e)

Compara, para cada check de cada caso de `verification/cases/*.json`, tres valores:
el **publicado**, el FS del **binario ogs** (`ogs analyze`) y el FS del **oráculo cSlope 0.1.0**.

- `to_cslope.py`: conversor ogs (`.ogs.json` v0.1, v0.2, v0.3 y v0.4) → documento de análisis de cSlope. Desde v0.4 convierte `reinforcements`: `anchor`, `nail` y `geosynthetic` a `definition.reinforcements`; `pile` y `sheet_pile` a `definition.piles` (`location: "slip-surface"`, `direction` y `application` explícitos; la tablestaca con `spacing` 1, `force` por metro y `wall: true`).
- **Pilotes de Ito-Matsui (v0.5, E15i-10).** `pile` con `lateral_pressure {model: "ito_matsui", diameter, location}` (sin `force`) va a `definition.piles[]` con `diameter` y **sin** `force`, que es como cSlope lo lee; `location` `centroid` → `"centroid"` y `slip_surface` → `"slip-surface"`; `capacity.shear` → `shearCapacity` y `capacity.moment` → `momentCapacity` (por pilote). Valida como el motor: exactamente uno de `force` y `lateral_pressure`, `diameter` finito y > 0, `location` obligatorio, `capacity` solo con `lateral_pressure` y no vacío (cada valor > 0), pilote vertical (`|x2 − x1| ≤ 1e-6`), `spacing` > `diameter` y versión `"0.5"` (`lateral_pressure requiere version "0.5"`). `direction` y `angle` siguen con la grafía plana de v0.4. Sin `lateral_pressure` el documento de cSlope no cambia en nada (los 728 documentos del corpus y de la batería dan la misma huella antes y después). Las 28 filas de `docs/fase3/exploracion/X22_filas/` reproducen las cifras del oráculo de `resultados.json` con el conversor solo (`test_oracle_rows_of_x22_through_the_converter`, |Δ| ≤ 5e-7: las cifras tienen 6 decimales).
- `run.py`: ejecuta ogs y cSlope por check y escribe `REPORT.md` y `report.json`.
- `test_to_cslope.py`: tests del conversor (pytest).
- `--oracle-only` (en `run.py`): no ejecuta ogs; compara solo el publicado con cSlope. Es el modo de `verification/pending/F3/`,
  cuyos casos (formato v0.3) esperan al motor. Lo mismo vale para `verification/pending/F3R/` (formato v0.4, refuerzos): `python verification/harness/run.py --cases verification/pending/F3R --oracle-only --out verification/pending/F3R` y después `import_cslope.py`, que arma `INDEX.md` con la tabla de publicado frente a cSlope y la columna de las fuerzas que el oráculo aplica (`cslope.reinforcement_forces` en `report.json`). `report.json` y `HOLD.json` de un directorio de casos no se leen como casos.
- `fixtures/V047a.json`: caso propio (ACADS 1(a), contratos §1), usado si no hay casos.
- `sample/`: un informe de ejemplo generado con los 21 casos de `verification/cases` y el binario `target/release/ogs`
  (rutas relativas a la raíz del repositorio). Se regenera con la orden de «Ejecución» más abajo.

## Ejecución

Desde la raíz del worktree:

```
export TMPDIR="$(mktemp -d)"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out verification/harness/sample
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest \
  python -m pytest verification/harness/test_to_cslope.py
```

- Sin binario ogs (o si falla), el check queda con `ogs = null` («sin dato») y el error resumido; el run continúa.
- Si `--cases` no existe, no tiene `*.json` o un caso es inválido, el run termina con código 1 sin escribir informe.
- cSlope que no reproduce el publicado dentro de tolerancia se marca «revisar conversión» en el estado.

## Esquema v0.3 (F3.8)

| ogs v0.3 | cSlope 0.1.0 |
|---|---|
| `model: "undrained"` (`undrained_strength`, `strength_datum`, `strength_gradient`, `strength_limit`) | `kind: "undrained"` (`undrainedShearStrength`, `suRefDepth`, `suRateOfChange`, `suMax`). `suRefDepth` es una **cota**, no una profundidad. `s-f-datum` es la misma ley con otros nombres |
| `analysis.surface` `polyline` | `definition.customSurfaces = [{points}]` + `customPlanesOnly` (sin eje) |
| `spencer` | `Morgenstern-Price` con `intersliceFunction: "constant"` |
| `morgenstern_price` + `analysis.interslice` (por defecto `half_sine`) | `Morgenstern-Price` con `intersliceFunction`: `half-sine`, `clipped-sine`, `trapezoidal`, `constant` o `data-point-specified` (+ `intersliceDataPoints`) |
| `janbu_simplified` / `janbu_corrected` | `Janbu` con `janbuCorrection: false` / `true` |
| `bishop` con polilínea | **no se convierte** (F3.6): el oráculo lo acepta con el aviso `bishop-non-circular`, pero su FS depende del eje de momentos |

Una versión menor que `"0.3"` con cualquiera de estos campos se rechaza con `<campo> requiere version "0.3"`, como el motor.
Los valores de F3.8 (círculo y polilínea de V047a, no drenado) se reproducen a 1e-9 en `test_to_cslope.py`.

## API de cslope 0.1.0 (investigada)

Fuentes: el paquete instalado (`cslope/__init__.py`, `__init__.pyi`, `model.py`), los JSON Schema de
`ref/cslope/packages/engine/schema/` y el crate `cslope-py`. Los nombres son los de cSlope (camelCase).

- **Entrada**: `cslope.analyse(doc)` (alias `analyze`) acepta un *analysis document*
  `{"format": "cslope-analysis", "formatVersion": 1, "definition": {...}, "options": {...}}`
  o una definición desnuda con `options` aparte. Devuelve `minFOS`, `criticalSurface`
  (`cx`, `cy`, `radius`, `fos`, `entryPoint`, `exitPoint`, `converged`), `criticalSlices`,
  `allSurfaces`, `warnings`.
- **Validación**: `cslope.validate(doc)` → `[{path, code, message, severity}]`. El harness aborta el check
  solo ante `severity == "error"`.
- **Defaults que cambian resultados**: `analyse` usa los defaults públicos de la app
  (Morgenstern-Price, 30 dovelas, 1000 + 500 superficies, `compositeSurfaces: true`). El conversor fija
  todas las opciones que importan.
- **Método**: `method` ∈ {`Bishop`, `Janbu`, `Morgenstern-Price`}. **Spencer** = `Morgenstern-Price` con
  `intersliceFunction: "constant"`.
- **Dovelas**: `slices` ∈ [10, 500].
- **Búsqueda circular**: `searchMethod: "circular"`, `iterations` (≥ 500), `refinedIterations`,
  `compositeSurfaces`, `compositeBase`, `nonCircularOptimization`, `minFailureDist` (distancia entrada–salida).
  Rangos en `definition.analysisLimits`: `entryLeftX`, `entryRightX`, `exitLeftX`, `exitRightX`.
- **Superficie fija**: `definition.customSearchPlanes = [{cx, cy, radius}]` + `customPlanesOnly: true`.
- **Geometría**: `coordinates` (contorno exterior), `materialBoundaries = [{coordinates}]` (fronteras
  interiores), `regionAssignments = [{point, materialName}]` (un punto por región).
- **Materiales**: `materials[] = {name, model}`; `model = {kind: "mohr-coulomb", unitWeight, cohesion,
  frictionAngle, unitWeightSat, ru}`. Sin `unitWeightSat`, el peso bajo la freática es γ.
- **Agua**: `waterTable = {mode: "custom", value: [[x, y], ...], freeWater: true, followBoundary: false}`. Con
  `freeWater: true` y `followBoundary: false` cSlope carga el **agua embalsada** (peso, empuje horizontal y presión
  de poros) donde la línea pasa sobre el terreno, como ogs en todas las versiones (F5.3, decisión D1); `freeWater` tiene
  precedencia sobre `followBoundary`, y `freeWater: false` con `followBoundary: false` es un error
  (`conflicting-free-water`). Antes de F3G el conversor escribía `freeWater: false`, que recorta la línea al terreno.
  Donde la línea no pasa sobre el terreno el resultado no cambia (ver «Identidad» abajo). Varias líneas:
  `waterTables = [{id, coordinates, freeWater}]` y `materials[].waterTableId`.
- **Grieta de tracción**: `options.tensionCrackDepth` (m, > 0), `options.tensionCrackAuto` (profundidad automática
  de Rankine) y `options.tensionCrackWater` (**fracción** 0 a 1 de la grieta llena). cSlope corta la superficie donde su
  profundidad iguala la de la grieta y pone `½·γw·hw²` en la primera dovela (X18 §2).
- **Dirección**: `definition.orientation` ∈ {`ltr`, `rtl`}; `rtl` = la masa se mueve hacia −x. Los rangos
  y las superficies fijas van en coordenadas del modelo, también con `rtl`.
- **Peso del agua**: la opción `waterUnitWeight` existe en el código fuente, pero **el motor instalado
  0.1.0 la ignora** (comprobado: el mismo FS con 9.807, 10 y 12 kN/m³). Usa 9.807 fijo.
- **`ru`** (cSlope): la presión en la base es `ru·σv` **sumada** a la de su línea de agua. Ver mapeo.

## Correspondencias ogs → cSlope

| ogs (contrato §1–§2) | cSlope 0.1.0 |
|---|---|
| `regions` (unión) | `coordinates` = exterior de `unary_union(regiones)` |
| aristas compartidas entre regiones | `materialBoundaries` (`shared boundary` de cada par) |
| región | `regionAssignments` con `representative_point()` |
| `materials[].id` | `materials[].name` |
| `unit_weight`, `cohesion`, `friction_angle` | `model.unitWeight`, `cohesion`, `frictionAngle` |
| `unit_weight_sat` | `model.unitWeightSat` (mismo criterio: bajo la freática) |
| `ru` sin `piezometric_line` | `model.ru` (exacto si σv coincide, ver abajo) |
| `ru` con `piezometric_line` | `model.ru` + material con `waterTableId` a una línea seca (`ogs-ru-no-water`) |
| `ru` + piezométrica + `unit_weight_sat` | **no mapeable**: se rechaza (`UnsupportedModel`) |
| `water.piezometric_line` | `waterTable {mode: custom, freeWater: true, followBoundary: false}` (puntos ordenados por x) |
| `analysis.tension_crack {depth, water_fill}` (v0.5) | `options.tensionCrackDepth` ó `tensionCrackAuto: true` (si `depth` es `"auto"`), y `tensionCrackWater = water_fill` (siempre escrita); con `water_fill > 0` rige el mismo γw de cSlope (9.807) que con la piezométrica |
| superficie fija (círculo) | `customSearchPlanes` + `customPlanesOnly` |
| `search.entry`, `search.exit` | `analysisLimits` (si se omiten: rango total del terreno) |
| `slope.direction` | `orientation` (`left_to_right`→`ltr`, `right_to_left`→`rtl`; `auto` según el contrato) |
| `methods` / `method` | `Bishop` ó `Morgenstern-Price` + `intersliceFunction: constant` (Spencer) |
| `slices`, `tolerance`, `max_iterations` | `slices`, `tolerance`, `maxIterations` |
| `search.n_entry·n_exit·n_radius` | `iterations` (clamp 500..100000) |
| `search.refine` | `refinedIterations` 1500 / 0 |
| `search.min_width` (o 1 % del ancho) | `minFailureDist` (aproximado) |

### Identidad del conversor sin agua sobre el terreno (F3G)

Pasar la línea a `freeWater: true` / `followBoundary: false` **no cambia ningún FS** cuando la piezométrica no pasa sobre el
terreno. Medido con el oráculo (cslope 0.1.0), antes y después del cambio del conversor:

- **informe de aceptación** (`run.py --oracle-only` sobre `verification/cases`): 243 checks, cSlope reproduce **242 de 243**
  antes y después, con el mismo resumen; 213 FS idénticos bit a bit y 30 (casos V021a a V021g, V033, V045, V046b, V054,
  V096e y V097a, con piezométrica) con una diferencia relativa ≤ 2,0e-12 (ruido de redondeo);
- **batería diferencial**: 139 FS de cSlope comparados (56 de la base, 71 de la Fase 3a y 12 de refuerzos): 131 idénticos y
  el resto con diferencia ≤ 2,7e-15; búsqueda 28/28, superficie fija 28/28, Fase 3a 71/71 y refuerzos 12/12 como antes;
- `test_to_cslope.py::test_oracle_is_unchanged_without_ponded_water`: tres piezométricas bajo el terreno o sobre él sin
  superar (una de ellas apoyada en la banqueta), tres métodos, documento viejo contra nuevo, `rel ≤ 1e-9`;
- `test_to_cslope.py::test_oracle_rows_of_x21_through_the_converter`: las 55 filas migradas de X21
  (`crates/ogs-core/tests/data/f3g`) pasan por el conversor y reproducen sus cifras del oráculo a 1e-6.

### Sismo y cargas (esquema v0.2, F1.1)

Solo con `version: "0.2"`. El conversor traduce; no calcula.

| ogs (contrato F1.1) | cSlope 0.1.0 | notas |
|---|---|---|
| `analysis.seismic.kh` | `options.seismicHorizontal` | actúa en el sentido del deslizamiento, con `ltr` y `rtl`; con 0 se omite (cSlope toma kh en (0, 1]) |
| `analysis.seismic.kv` | `options.seismicVertical` | `kv > 0` hacia abajo, igual que ogs; con 0 se omite |
| `loads[]` con `type: "udl"` (`x1`, `x2`, `q`) | `definition.udls[] {magnitude: q, x1, x2, direction: "vertical"}` | una carga con `q = 0` se omite (cSlope exige magnitud > 0) y se anota |
| `loads[]` con `type: "line"` (`x`, `p`, `angle`) | `definition.lineLoads[] {x, magnitude: p, angle}` | el ángulo pasa **sin cambio**, también con `rtl`: se mide desde la vertical hacia abajo y el positivo inclina la carga hacia +x del modelo; cSlope espeja la geometría `rtl` y el signo internamente. Con `p = 0` se omite |
| `loads[].id` | no se envía | cSlope 0.1.0 marca `id` como `unknown-key` (error); los ids repetidos se rechazan en el conversor |
| `kh`, `kv` y las cargas | — | `kh` y `kv` multiplican solo el peso del suelo, nunca las cargas (ogs y cSlope) |

El ángulo se comprobó contra el oráculo sobre el círculo fijo de V047a (docstring de `to_cslope.py`): con `ltr`, +10° da
0,9753 y −10° da 0,9921; la imagen especular `rtl` con el signo invertido reproduce el valor a 1e-13 relativo.
`oracle_seismic_v047a.py` reproduce los escenarios de sismo y cargas sobre ese círculo.

### cSlope sin convergencia

`cslope.analyse` puede devolver `minFOS` con `criticalSurface.converged: false`: es el par Fm/Ff más cercano, no una raíz
(R3-01b: 0,0830 no convergido frente a la raíz real 0,2685). El harness lo marca «no convergido», nunca «OK»; la batería
diferencial lo trata como oráculo sin solución (igual que `EngineError`).

## Diferencias conocidas (no son errores del harness)

- **γw**: ogs usa 9.81 por defecto; cSlope 0.1.0 fija 9.807 (la opción `waterUnitWeight` se ignora). Efecto
  esperado en el FS: del orden de 0.1 %. Con `piezometric_line`, el conversor acepta |γw − 9.807| ≤ 0.01 y
  anota la diferencia en la unidad del modelo (kN/m³ o pcf); cualquier otro valor lanza `UnsupportedModel`
  (R2-05: un valor distinto daría presiones de poros erróneas sin aviso).
- **Búsqueda**: la búsqueda de cSlope no es la grilla de ogs (entrada×salida×radio + refinado). Se
  iguala el presupuesto de evaluaciones, no el algoritmo. La tolerancia de búsqueda debe reflejar eso.
- **`min_m_alpha`**: sin equivalente en cSlope (usa su propia regla de validez de Bishop).
- **`min_width`**: en ogs es |Δx| entre entrada y salida; en cSlope, la distancia euclídea. Se usa como aproximación.
- **Dovelas**: ogs usa `n` dovelas uniformes más quiebres; cSlope tiene su propia subdivisión. Ambas son
  de `slices` nominal.
- **`ru`**: cSlope toma σv como el peso de la columna sobre la base; no verificado frente a ogs
  (ogs usa la columna en el punto medio de la base). Esta diferencia no se ha medido.
- **Dirección `auto`**: se resuelve con las cuatro reglas de E1/E1b (`to_cslope.resolve_direction`, espejo de
  `ogs-core` `resolve_sliding`): rangos de entrada y salida; coronamiento; círculo fijo (cruce más alto =
  entrada); si ninguna decide, `UnsupportedModel`. Ya no hay un empate que vaya a `rtl`. El caso V063
  mantiene `left_to_right` explícito (ver hallazgo V063). Con una **polilínea fija**, la regla 3 usa los extremos ya
  **ajustados al terreno** (`to_cslope.fitted_polyline_ends`: prolongados o recortados al primer cruce, E13c), como el
  motor; con los extremos tal como se escriben el sentido podía salir al revés (R10A-11).
- **`options.interslice` de un check**: `run.model_for_check` lo aplica a `analysis.interslice` en los checks de
  `morgenstern_price`, igual que `to_cslope.interslice_options`; en los demás métodos se descarta la función (R10A-11).
- **Piezométrica fuera del modelo**: cSlope recorta la línea en el borde (aviso `outside-model`) y la
  extiende horizontalmente; es el mismo criterio que la extrapolación constante de ogs.

## Tests

Ejecución de los tests (desde la raíz del worktree):

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest \
  python -m pytest verification/harness/
uv run --python 3.13 --no-project --with shapely --with jsonschema --with pytest \
  python -m pytest verification/tools
```

Todo el conjunto (harness, importador, esquema v0.2 y batería diferencial; necesita `target/release/ogs`):

```
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  --with jsonschema --with pytest python -m pytest -q verification
```

- `verification/tools/test_schema.py`: `schema/ogs-0.2.schema.json` (los 21 casos y los 14 modelos de la batería validan;
  `version: "0.1"` con `loads` o `analysis.seismic` falla; cargas y coeficientes mal formados fallan; el esquema y el
  binario `ogs` aceptan y rechazan los mismos documentos).

- `test_to_cslope.py`: capas apiladas → un contorno, una frontera y dos asignaciones correctas;
  ida y vuelta de la piezométrica (y de su orden) y del círculo fijo; mapeo del fixture (orientación, rangos,
  agua, Spencer); rechazo de `ru` + piezométrica + γsat; línea seca para `ru` con piezométrica;
  `cslope.validate` sin errores sobre el fixture (Bishop y Spencer). R2-05: las cuatro reglas de E1 con una
  presa simétrica (rangos, empate de puntos medios, coronamiento, círculo fijo y empate), la dirección explícita,
  γw distinto de 9.807 con agua (rechazo), imperial con agua y la nota de unidades.
- `test_run.py`: R2-09 (1), `status` antes que `fos`, con un binario `ogs` falso; cSlope con `converged: false` es «no convergido», nunca un valor de referencia.
- `verification/tools/test_import_cslope.py`: R2-07. Agua sobre escalones (y no solo en los vértices),
  x de la piezométrica estrictamente creciente, `options.tolerance` en las notas, los límites de
  §4.5 en el schema, los rangos de búsqueda y que los casos generados los cumplen.

## Estado actual (tras B2)

Con `--cases verification/cases`: 21 casos, 51 checks (16 casos v0.1 y 5 casos v0.2 con sismo o cargas). ogs reproduce
51/51 y cSlope reproduce 51/51 dentro de la tolerancia de cada check.

## Hallazgos de la primera ejecución (casos de w0b, 16 casos, 38 checks)

- cSlope reproduce el publicado dentro de tolerancia en **36/38** checks; ogs sin binario: 38 «sin dato».
- **V063** (ambos checks): cSlope no encuentra superficie válida. Causa: la regla `auto` del contrato da
  `rtl` (`y_top(0) = y_top(191.4) = 7.3`, empate), y con esa orientación los rangos de búsqueda del caso
  no contienen superficies válidas. Con `orientation: ltr` y los mismos rangos, cSlope da 2.4528 (Bishop
  y Spencer publicados: 2.43 y 2.455). Esto no se ha corregido en el conversor; es un punto a decidir en el
  contrato (regla de empate de `auto`). Con E1 implementada, el empate de la presa ya no decide por
  defecto; sin dirección explícita, V063 quedaría `UnsupportedModel`.
