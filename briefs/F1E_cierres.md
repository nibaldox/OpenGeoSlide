# Brief F1-E: cierres de la ola B y pulido (Sonnet, un escritor)

Responde en **español neutro, sin voseo**. Toma como base `briefs/01_CONTRATOS_FASE1.md` (§F1.6, E12e) y
`briefs/00_CONTRATOS.md` §4.5.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1e`, rama `f1e-cierres`, desde `main`.

## Tareas
1. **Conteos de neutralidad** en `crates/ogs-core/tests/regions_validation.rs`: los tests
   `the_16_verification_cases_stay_valid` y `the_10_differential_models_stay_valid` fallan porque hoy hay 21 casos
   y 14 modelos.
   - Haz que lean el número esperado de los índices (`verification/cases/INDEX.md` y la lista de la batería) **o**
     que exijan `>= 21` / `>= 14` y validen **todos** los archivos que encuentren. No basta con cambiar el número
     literal.
   - Ajusta los nombres de los tests para que no digan «16» ni «10».
2. **Batería** (`verification/differential/run.py` y su test):
   - agrega `multiple_admissible_roots` a `OGS_INFORMATIVE_WARNINGS`;
   - en **D13** (`verification/differential/cases/D13*`), fija `analysis.search.min_width = 5.0` y documenta el motivo
     en `verification/differential/README.md`.
     - **Hallazgo:** sin `min_width`, cSlope encuentra un círculo de 0,67 m bajo la carga lineal con m_α < 0,2 (FS
       0,614, aviso `low-m-alpha`), que ogs rechaza por E4b.
     - **Práctica:** se exige un ancho mínimo de masa para excluir fallas superficiales locales.
   - **Objetivo:** búsqueda 28/28 y fija 28/28. Regenera `REPORT.md` y `report.json` con el binario de `main`
     (`cargo build --release -p ogs-cli`).
3. **Web, texto de `negative_lambda`** (`apps/web/src/engine/warnings.ts` y `warnings.test.ts`): debe reflejar E12e.
   Texto: «Spencer seleccionó una raíz de equilibrio con λ negativo; revise el resultado».
4. **Web, pulido:**
   - **Favicon:** agrega `<link rel="icon" href="%BASE_URL%icons/icon.svg" type="image/svg+xml">` en
     `apps/web/index.html`, o el equivalente que respete `VITE_BASE`. Verifica que `/favicon.ico` ya no da 404 en
     consola, o que el navegador usa el icono enlazado.
   - **Aviso de Vite:** `import "./build/pwa-plugin"` sin extensión, en `vite.config.ts`. Resuélvelo sin relajar el
     `tsconfig`, por ejemplo convirtiendo el plugin a `.mjs` con JSDoc de tipos o usando la extensión con la opción
     mínima.
   - **Indicador de sismo** en `apps/web/src/editor/canvas/EditorCanvas.tsx` (o en el helper de layout): hoy tapa una
     etiqueta del eje Y. Muévelo a una esquina libre del área de dibujo, con fondo semitransparente.
   - **Encuadre inicial:** el ajuste del viewport deja un margen vacío grande a la derecha. Ajusta el fit para centrar
     el modelo con un margen uniforme, usando los helpers de `canvas/` y sus tests.
5. **README.md, sección «Limitaciones conocidas»:**
   - marca **R4-01 como resuelto** por E12e (raíz admisible de menor F, conservadora). Agrega que, cuando cSlope
     sigue otra raíz, ogs puede quedar por debajo de cSlope (caso R4-01 (2): −7,08 %), con la nota
     `multiple_admissible_roots`;
   - agrega D13 y las **cargas lineales**: las superficies locales bajo una carga puntual con m_α < `min_m_alpha` se
     rechazan, así que conviene usar `min_width` y revisar aparte la capacidad de soporte local;
   - mantén R4-02, R4-03a, la frontera de `min_width` y `unit_weight_sat`. `unit_weight_sat` podría seguir sin
     cobertura: revisa si alguno de los 5 casos nuevos lo usa.
   - En la sección de verificación, actualiza los números: aceptación 51/51 en 21 casos y batería 28/28 + 28/28.

## Archivos que te pertenecen
- `crates/ogs-core/tests/regions_validation.rs`;
- `verification/differential/**`;
- `apps/web/src/engine/warnings.ts` y `warnings.test.ts`, solo para `negative_lambda`;
- `apps/web/index.html` y `apps/web/vite.config.ts`;
- `apps/web/build/**`;
- `apps/web/src/editor/canvas/**`, solo para el indicador y el encuadre, con sus tests;
- `README.md`.

## Gates
- `cargo fmt --all --check` y `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`
- `cargo test -p ogs-core --release --no-fail-fast`, sin fallos, y `--features parallel`
- Aceptación 51/51
- Harness:
  ```
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out <dir>
  ```
  Debe dar 51/51.
- Batería 28/28 + 28/28.
- pytest (con `env -u PYTHONPATH -u PYTHONHOME`):
  ```
  uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`, sin el aviso de Vite.
- **Captura del editor** en Chrome headless (puerto 5186, **nunca** 5180-5185). Puedes seguir la skill
  `ogs-web-chrome-walkthrough` si está disponible. Debe mostrar el indicador de sismo sin solaparse y el encuadre
  centrado.

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** gates con salida real, valores de D13 antes y después, ruta de la captura y hashes.
- **Python:** siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Presupuesto:** unas 60 iteraciones.
