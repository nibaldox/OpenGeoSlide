# Brief W1e: harness de verificación cruzada (ogs vs. cSlope vs. publicado)

**Lee primero:** `briefs/00_CONTRATOS.md` (§1 y §2). Responde en español.

## Objetivo
Crear `verification/harness/run.py`. Para cada caso de verificación y cada check, calcula el FS con:
- nuestro motor, mediante el binario CLI `ogs analyze <modelo.json>`, y
- el oráculo **cSlope** (paquete PyPI `cslope==0.1.0`, motor Rust, licencia MIT).

Con eso genera `verification/REPORT.md` y `verification/report.json`.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w1e` (rama `w1e-harness`). **Solo** `verification/harness/**`.
Los casos se pasan por argumento (`--cases DIR`). El otro agente los está generando en
`/home/xodla/archivos/opengeoslide-wt/w0b/verification/cases`; si aún no existen, crea un caso de prueba propio en
`verification/harness/fixtures/` (ACADS 1(a) de §1, con check bishop publicado 0.987 y tolerancia 0.025).

## Ejecución
```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out verification
```
`TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Ya existe un venv con cslope y xslope en
`$TMPDIR/oracle-venv` (Python 3.13), útil para explorar la API rápido.

## Requisitos
1. **Investiga la API de Python de `cslope`**: `help()`, docstrings, `dir()` y el código fuente en
   `$TMPDIR/ref/cslope/packages/engine-rs/crates/cslope-py`.
   - Encuentra cómo analizar una *definition* (formato del proyecto cSlope: `coordinates`, `materials`,
     `materialBoundaries`, `regionAssignments`, `waterTable`, `analysisLimits`, `customSearchPlanes`, `customPlanesOnly`,
     `orientation`).
   - Encuentra cómo fijar el método (Bishop; Morgenstern-Price con `intersliceFunction: "constant"` = Spencer) y el
     número de dovelas.
   - Documenta lo encontrado en `verification/harness/README.md`.
2. **Conversor ogs → cSlope** (`to_cslope.py`), general y no limitado a los casos existentes:
   - contorno exterior = exterior de `unary_union(regiones)`;
   - `materialBoundaries` = aristas compartidas entre regiones, como polilíneas (líneas de frontera que no están en el contorno);
   - `regionAssignments` = `representative_point()` de cada región;
   - piezométrica → `waterTable {mode: custom, value}`;
   - superficie fija → `customSearchPlanes` + `customPlanesOnly`;
   - rangos de búsqueda → `analysisLimits`;
   - dirección → `orientation`;
   - `ru` y `unit_weight_sat` → los campos equivalentes de cSlope, si existen (investígalo).
3. **Ejecución ogs:**
   - por check, arma el modelo como lo hace el test de aceptación (`methods = [check.method]`; con `fixed` quita
     `search`; aplica `options.slices`);
   - lo escribe a un temporal y ejecuta el binario con timeout;
   - parsea el JSON y toma `results[0].fos` y `status`.
   Si el binario falta o falla (hoy el motor está en stubs), registra `"ogs": null` con el error resumido; **no** abortes.
4. **Salida:**
   - `REPORT.md`, en español, con la tabla `caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado`
     y un resumen con totales (OK / FALLA / sin dato) por motor;
   - `report.json` con los mismos datos, más las versiones de los motores y la fecha.
5. **Validación del conversor:** si cSlope **no** reproduce el valor publicado dentro de la tolerancia en un check, márcalo
   en el reporte como "revisar conversión". Esto valida los fixtures. No ajustes valores para que calcen.

## Tests
`verification/harness/test_to_cslope.py` (pytest vía `uv run ... --with pytest`):
- dos regiones apiladas → un contorno, una frontera y dos asignaciones correctas;
- ida y vuelta de la piezométrica y del círculo fijo.

## Gates
- Los tests en verde.
- `run.py` sobre los casos disponibles termina con código 0 y genera ambos archivos. Reporta cuántos checks reproduce cSlope.

## Cierre
- Commit en tu rama con rutas explícitas y el mensaje `test(verification): harness cruzado ogs/cSlope`. Sin push.
  Incluye `REPORT.md` y `report.json` solo como ejemplo en `verification/harness/sample/`, no en `verification/`.
- **Resumen:** API de cslope encontrada, checks reproducidos por cSlope (n/N), gates y hash.
- **Presupuesto:** ~50 iteraciones.
