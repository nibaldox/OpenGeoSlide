# Brief W0b: casos de verificación desde cSlope (MIT)

**Lee primero:** `briefs/00_CONTRATOS.md` (§1 modelo, §2 caso). Responde en español.

## Objetivo
Escribir un conversor reproducible que tome problemas de verificación publicados del proyecto cSlope (licencia MIT) y
genere entre **12 y 20 casos** en nuestro formato `verification/cases/<id>.json`, con su atribución.

## Directorio de trabajo
- Worktree `/home/xodla/archivos/opengeoslide-wt/w0b` (rama `w0b-casos`). Trabaja **solo** ahí.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Fuente (clon local, solo lectura) en `$TMPDIR/ref/cslope`:
  - `packages/engine-rs/golden/verification.json`: claves `cases[]` con `id`, `title`, `surface` (`search` | `fixed`),
    `definition` y `checks[]` (cada check trae `method`, `label`, `published`, `publishedBy`, `tolerance` y `options`);
  - `packages/engine/src/verification/problems.ts`: por `id` trae `reference`, `units` (`"SI"` | `"imperial"`),
    `description` y `notes[]`. El objeto `definition` y cada check están en JSON de una línea; extrae con regex por id.

## Archivos que te pertenecen (crear)
- `verification/tools/import_cslope.py`: script ejecutable con
  `uv run --no-project --with shapely --with jsonschema python verification/tools/import_cslope.py --src $TMPDIR/ref/cslope`.
  Es idempotente y escribe los casos y el índice.
- `verification/cases/*.json` (salida del script, versionada).
- `verification/cases/INDEX.md`: tabla `id | título | referencia | unidades | checks (bishop/spencer) | tipo`.
- `NOTICE`: atribución. "This product includes verification problem data adapted from cSlope (MIT License,
  Copyright (c) Ibirico / Zilan Ciftci), https://github.com/ZilanCiftci/cslope" + nota de que los valores publicados
  pertenecen a las referencias bibliográficas citadas en cada caso. Si encuentras el texto de copyright exacto en
  `$TMPDIR/ref/cslope/LICENSE`, cópialo literal.

**No toques nada fuera de** `verification/tools/`, `verification/cases/` y `NOTICE`.

## Reglas de conversión
- **Geometría:** `definition.coordinates` es el contorno exterior; `materialBoundaries` son polilíneas internas;
  `regionAssignments` asigna `{point, materialName}`.
  - Con shapely: `polygonize(unary_union([contorno] + boundaries))` para obtener las caras.
  - A cada cara se le asigna el material del punto que contiene.
  - Si una cara queda sin asignar, o dos puntos asignan materiales distintos a la misma cara, el caso se **omite**.
  - Salida: `regions[{material, polygon}]`, sin repetir el primer vértice y redondeando a 1e-9.
- **Materiales:**
  - solo se aceptan `kind == "mohr-coulomb"` (`unitWeight`, `cohesion`, `frictionAngle` → `unit_weight`, `cohesion`, `friction_angle`);
  - si el material trae `ru`, se copia a `ru`;
  - un saturado tipo `saturatedUnitWeight` (si existe con ese u otro nombre evidente) pasa a `unit_weight_sat`;
  - `id` = nombre en snake_case;
  - cualquier otro `kind` o propiedad desconocida que afecte la resistencia → el caso se **omite**.
- **Agua:**
  - `waterTable.mode == "custom"` → `water.piezometric_line = value`;
  - `water.unit_weight`: 9.807 si `units` es SI y 62.4 si es imperial (la constante de cSlope es 9.807 kN/m³);
  - `waterTables` múltiples, `waternet` o cualquier otro modo → **omitir**;
  - si la piezométrica queda **sobre el terreno** en algún punto del dominio (agua embalsada) → **omitir**.
- **Dirección:** `orientation: "rtl"` → `right_to_left`, `"ltr"` → `left_to_right`, ausente → `auto`.
- **Superficie fija:** `customSearchPlanes: [{cx, cy, radius}]` con `customPlanesOnly: true` y un solo círculo
  → `analysis.surface = {type: circle, xc, yc, r}`. Más de un círculo, o `customSurfaces` (no circulares) → **omitir**.
- **Búsqueda:**
  - `surface == "search"` → `analysis.search` con `type: circular_entry_exit` y los defaults del contrato;
  - si hay `analysisLimits`: `entry = [entryLeftX, entryRightX]` y `exit = [exitLeftX, exitRightX]`;
  - si no hay, se omiten `entry` y `exit`.
- **Se omite el caso** si `definition` trae cualquier otra clave que cambie el problema: `udls`, `lineLoads`, `reinforcements`,
  `piles`, `earlierStage`, `waternet`, `waterTables`, `customSurfaces`, sismo o grietas (incluidas opciones de grieta
  en los checks). Registra el motivo de cada omisión.
- **Checks:**
  - `method == "Bishop"` → `bishop`;
  - `method == "Morgenstern-Price"` con `options.intersliceFunction == "constant"` → `spencer`;
  - el resto (Janbu, M-P half-sine) se descarta;
  - se copian `published`, `publishedBy` → `published_by`, `tolerance` (la que ya calculó cSlope con sus reglas) y
    `options.slices` → `options.slices`;
  - `kind = surface` del caso;
  - si un caso queda sin checks válidos → se omite.
- `source`: `reference` (problems.ts), `derived_from` ("cSlope verification problem <id> (MIT License), https://github.com/ZilanCiftci/cslope")
  y `notes` (las notas de problems.ts).
- `model.analysis.methods` = métodos presentes en los checks; `slices` = 50, salvo que todos los checks indiquen otro valor.

## Selección
Prioriza, si son convertibles: V044, V044b, V045, V047a, V049, V001, V002, V003, V025, V019, V033, V093, V101, V063, V030.
Completa entre 12 y 20 casos con al menos **8 checks Spencer** y al menos **4 casos `fixed`**.

## Gates (ejecútalos y reporta salida real)
1. El script corre dos veces seguidas y produce un `git diff` vacío la segunda vez (idempotencia).
2. Cada caso se valida con un JSON Schema mínimo que escribas **dentro del script**, siguiendo §1 y §2.
   No uses `schema/` porque otro agente lo está creando en paralelo.
3. Chequeo geométrico por caso con shapely:
   - regiones válidas (`is_valid`) y sin solape (área de intersección < 1e-9);
   - la unión de las regiones tiene la misma área que el contorno (tolerancia relativa 1e-9).
4. Imprime un resumen: casos convertidos, casos omitidos con su motivo, checks por método.

## Cierre
- Haz commit en tu rama `w0b-casos` con rutas explícitas y el mensaje `test: casos de verificación v0.1 desde cSlope (MIT)`.
  **No hagas push**.
- **Resumen final:** lista de casos con sus checks, omisiones con motivo, salida de los gates y hash del commit.
- **Presupuesto:** ~40 iteraciones.
