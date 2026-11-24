# Harness de verificación cruzada (W1e)

Compara, para cada check de cada caso de `verification/cases/*.json`, tres valores:
el **publicado**, el FS del **binario ogs** (`ogs analyze`) y el FS del **oráculo cSlope 0.1.0**.

- `to_cslope.py`: conversor ogs (`.ogs.json` v0.1) → documento de análisis de cSlope.
- `run.py`: ejecuta ogs y cSlope por check y escribe `REPORT.md` y `report.json`.
- `test_to_cslope.py`: tests del conversor (pytest).
- `fixtures/V047a.json`: caso propio (ACADS 1(a), contratos §1), usado si no hay casos.
- `sample/`: un informe generado de ejemplo (casos de w0b). No es un artefacto de `verification/`.

## Ejecución

Desde la raíz del worktree:

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest \
  python -m pytest verification/harness/test_to_cslope.py
```

- Sin binario ogs (o si falla), el check queda con `ogs = null` («sin dato») y el error resumido; el run continúa.
- Si `--cases` no existe, no tiene `*.json` o un caso es inválido, el run termina con código 1 sin escribir informe.
- cSlope que no reproduce el publicado dentro de tolerancia se marca «revisar conversión» en el estado.

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
- **Agua**: `waterTable = {mode: "custom", value: [[x, y], ...], freeWater: false}` (`freeWater: false`
  recorta la línea al terreno, como ogs). Varias líneas: `waterTables = [{id, coordinates, freeWater}]` y
  `materials[].waterTableId`.
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
| `water.piezometric_line` | `waterTable {mode: custom, freeWater: false}` (puntos ordenados por x) |
| superficie fija (círculo) | `customSearchPlanes` + `customPlanesOnly` |
| `search.entry`, `search.exit` | `analysisLimits` (si se omiten: rango total del terreno) |
| `slope.direction` | `orientation` (`left_to_right`→`ltr`, `right_to_left`→`rtl`; `auto` según el contrato) |
| `methods` / `method` | `Bishop` ó `Morgenstern-Price` + `intersliceFunction: constant` (Spencer) |
| `slices`, `tolerance`, `max_iterations` | `slices`, `tolerance`, `maxIterations` |
| `search.n_entry·n_exit·n_radius` | `iterations` (clamp 500..100000) |
| `search.refine` | `refinedIterations` 1500 / 0 |
| `search.min_width` (o 1 % del ancho) | `minFailureDist` (aproximado) |

## Diferencias conocidas (no son errores del harness)

- **γw**: ogs usa 9.81 por defecto; cSlope 0.1.0 fija 9.807 (la opción `waterUnitWeight` se ignora). Efecto
  esperado en el FS: del orden de 0.1 %. El conversor lo anota en las notas del caso.
- **Búsqueda**: la búsqueda de cSlope no es la grilla de ogs (entrada×salida×radio + refinado). Se
  iguala el presupuesto de evaluaciones, no el algoritmo. La tolerancia de búsqueda debe reflejar eso.
- **`min_m_alpha`**: sin equivalente en cSlope (usa su propia regla de validez de Bishop).
- **`min_width`**: en ogs es |Δx| entre entrada y salida; en cSlope, la distancia euclídea. Se usa como aproximación.
- **Dovelas**: ogs usa `n` dovelas uniformes más quiebres; cSlope tiene su propia subdivisión. Ambas son
  de `slices` nominal.
- **`ru`**: cSlope toma σv como el peso de la columna sobre la base; no verificado frente a ogs
  (ogs usa la columna en el punto medio de la base). Esta diferencia no se ha medido.
- **Dirección `auto` con empate**: el contrato dice que con `y_top(x_min) == y_top(x_max)` la masa va a
  −x (`rtl`). Ver hallazgo V063.
- **Piezométrica fuera del modelo**: cSlope recorta la línea en el borde (aviso `outside-model`) y la
  extiende horizontalmente; es el mismo criterio que la extrapolación constante de ogs.

## Tests

`test_to_cslope.py` (11 tests): capas apiladas → un contorno, una frontera y dos asignaciones correctas;
ida y vuelta de la piezométrica (y de su orden) y del círculo fijo; mapeo del fixture (orientación, rangos,
agua, Spencer); rechazo de `ru` + piezométrica + γsat; línea seca para `ru` con piezométrica;
`cslope.validate` sin errores sobre el fixture (Bishop y Spencer).

## Hallazgos de la primera ejecución (casos de w0b, 16 casos, 38 checks)

- cSlope reproduce el publicado dentro de tolerancia en **36/38** checks; ogs sin binario: 38 «sin dato».
- **V063** (ambos checks): cSlope no encuentra superficie válida. Causa: la regla `auto` del contrato da
  `rtl` (`y_top(0) = y_top(191.4) = 7.3`, empate), y con esa orientación los rangos de búsqueda del caso
  no contienen superficies válidas. Con `orientation: ltr` y los mismos rangos, cSlope da 2.4528 (Bishop
  y Spencer publicados: 2.43 y 2.455). Esto no se ha corregido en el conversor; es un punto a decidir en el
  contrato (regla de empate de `auto`).
