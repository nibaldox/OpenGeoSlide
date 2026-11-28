# CM-W1 · Web del MVP (borradores, pantallas bajas, HUD, primera visita) y xslope

Base: `cm-integracion` en `ae243cc`, con el código de la v0.5.1. Puertas de la base, medidas por el coordinador:
- typecheck en verde;
- vitest con `OGS_BIN` (v0.5.1): **273 archivos y 4653 tests pasados**;
- regresión e2e completa: 50 guiones, **OK=1226 y FAIL=2** (`u3o_onboarding` 6 y `u6d_drafts` R9-11a). Además,
  **`w1e_polilinea` y `r2i2_tablestaca_inclinada` salen con `exit=1` por un `TimeoutError`** de Playwright
  (`w1e_polilinea.mjs:62` y `r2i2_tablestaca_inclinada.mjs:42`). Se reproduce al correrlos solos, así que los pasos
  que siguen nunca corren. Los registros están en `~/.hermes/profiles/open-geoslide/cache/scratch/cm-coord/e2e-base/`.

Léase con `docs/cm/PLAN_CM.md` (D1 y D4) y con la exploración `docs/cm/exploracion/X34.md` (web) y `X35.md` (primera
visita), o `X36.md` para CM-V. Las causas en `archivo:línea` de esos documentos son el punto de partida. **Verifícalas
antes de cambiar nada**: si el código dice otra cosa, manda el código, y lo anotas.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **CM-WA** borradores y editor | `opengeoslide-wt/cm-wa` / `cm-wa` | 5183 | `apps/web/src/editor/panels/**`, `apps/web/src/editor/EditorApp.tsx`, `apps/web/src/editor/app/shortcuts.ts` (con sus tests), un componente nuevo `apps/web/src/editor/app/ExamplePicker.tsx` (con su test), y los guiones `docs/fase2/ux/u6d-e2e/u6d_drafts.mjs`, `docs/fase3/w1e/e2e/w1e_polilinea.mjs` y `docs/fase3/r2i2/e2e/r2i2_tablestaca_inclinada.mjs` |
| **CM-WB** armazón: pantallas bajas y HUD | `opengeoslide-wt/cm-wb` / `cm-wb` | 5184 | `apps/web/src/editor/app/shell/**` (incluido `shell.css`), `apps/web/src/App.css` y `apps/web/src/styles/**` (solo las reglas de la cabecera y de los avisos), y el corredor `docs/fase3/iw/e2e/run_regression.sh` |
| **CM-WC** primera visita | `opengeoslide-wt/cm-wc` / `cm-wc` | 5185 | `apps/web/src/editor/app/ImportDialogs.tsx`, `importPlan.ts`, `applyImport.ts` y `engineCheck.ts` (con sus tests), `apps/web/src/onboarding/**`, `apps/web/src/App.tsx` (solo el bloque de la guía, hoy en las líneas 450-470), `apps/web/public/examples/**` (nuevo), y el guion `docs/fase2/ux/u3o-e2e/u3o_onboarding.mjs` |
| **CM-V** xslope | `opengeoslide-wt/cm-v` / `cm-v` | — | `verification/harness/to_xslope.py` (nuevo), `verification/xslope/**` (nuevo) |

## Reglas comunes

- **Nada de archivos ajenos.** Si necesitas cambiar un archivo de otro escritor, deja el diff en tu informe, con el
  archivo, la línea y la razón. El coordinador lo aplica al integrar. `CHANGELOG.md`, `README.md`, `docs/**` (salvo tus
  guiones) y `briefs/**` son del coordinador: propón tus líneas en el informe.
- **Puertas de los escritores web**, desde `apps/web/` de tu worktree:

  ```bash
  pnpm install --frozen-lockfile --prefer-offline
  pnpm typecheck && OGS_BIN=$PWD/../../target/release/ogs pnpm test && pnpm build
  ```

  - `src/wasm/`, `node_modules` y `target/release/ogs` (v0.5.1) ya están en tu worktree. Si falta `src/wasm`, corre
    `CARGO_TARGET_DIR=$TMPDIR/cm-<tú>/target bash scripts/build-wasm.sh`.
  - Ningún test existente se borra ni se salta. Si un test viejo fija el comportamiento que este brief cambia,
    actualízalo y explícalo en el informe.
- **Recorrido en Chrome:**
  1. Copia `apps/web/dist` a `$TMPDIR/cm-<tú>/dist` y sírvelo con
     `python3 -m http.server <tu puerto> --bind 127.0.0.1 -d $TMPDIR/cm-<tú>/dist` en segundo plano.
  2. Usa `playwright-core` de `$TMPDIR/f1c-e2e/node_modules` (enlázalo en `$TMPDIR/cm-<tú>/` y en `docs/node_modules` de
     tu worktree, y agrega `docs/node_modules` a `$(git rev-parse --git-path info/exclude)`). Para axe, usa
     `$TMPDIR/x8-ux/node_modules`. El Chrome es `/usr/bin/google-chrome-stable`.
  3. Corre los guiones e2e que nombra tu parte con `OGS_URL=http://127.0.0.1:<tu puerto>/`, `OGS_REPO=<tu worktree>`
     y `OGS_BIN=<tu worktree>/target/release/ogs`. Los guiones salen con 0 aunque fallen: cuenta las líneas `^FAIL`.
  4. Al terminar, mata el servidor por el PID que da `ss -ltnp | grep <tu puerto>`.
  5. **No levantes 5186 ni 5187**: la regresión completa la corre el coordinador.
- `TMPDIR=~/.hermes/profiles/open-geoslide/cache/scratch`, y tu instrumentación va en `$TMPDIR/cm-<tú>/`. Python
  siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Commits:**
  - uno por parte, con mensaje `CM-W<A|B|C>: …` o `CM-V: …`, en tu rama;
  - sin push y sin merge;
  - `git add` con rutas explícitas, nunca `git add .`.
- **Cuándo parar:** para y reporta con cifras si un criterio no se puede cumplir, si falla un test que no es tuyo, o si
  la corrección exige un archivo ajeno. Lo que ya tiene precedente en el repo no es motivo para parar: síguelo y
  anótalo en «decisiones».
- **Informe final:**
  - commits (hash y mensaje);
  - archivos tocados;
  - las cifras de las puertas (archivos de test y tests, pasados o saltados, y el build);
  - el resultado de cada guion e2e que corriste (`OK` y `FAIL`);
  - las rutas absolutas de las capturas;
  - decisiones;
  - diffs propuestos para archivos ajenos;
  - las líneas propuestas para el CHANGELOG;
  - pendientes, en orden de prioridad.

## CM-WA · Borradores y editor

1. **Los cuatro defectos de borradores** (Known issues de la 0.5.0; `X34.md` §1, del 1a al 1d):
   - **1a.** Tras «Nuevo» o «Abrir», todo borrador se reinicia desde el documento nuevo, aunque el valor del documento
     sea `null` antes y después. Hazlo en un solo lugar: que `useDraft` (`panels/useStoreSelector.ts`) dependa también
     de `docEpoch`. No lo repitas panel por panel. Comprueba Sismo, Búsqueda y Análisis, y todo panel con un `useDraft`
     sobre un valor que puede ser nulo.
   - **1b.** En una fila de vértice, confirmar `x` no toca el borrador de `y` y viceversa: un borrador por eje.
   - **1c.** «Agregar punto», «Quitar» y «Quitar piezométrica» de la piezométrica, y cualquier botón de tabla de
     puntos que reemplace las filas, quedan **deshabilitados** mientras haya una fila con borrador pendiente. Muestran
     el motivo de forma accesible, igual que el «Agregar» de la polilínea (`SurfacePanel.tsx`). Busca el mismo patrón
     en todas las tablas de puntos (geometría, polilínea, piezométrica, `ocr_by_elevation` y otras) y aplícalo.
   - **1d.** Ctrl+Intro (y Cmd+Intro) calcula aunque el foco esté en un campo de texto:
     - primero confirma el campo enfocado, como hace `save`;
     - si el campo es inválido, el cálculo se rechaza con el mensaje de siempre, no con uno nuevo;
     - Intro sin modificadores sigue igual que antes.
   - **Tests:** un test unitario por defecto, que falle en la base y pase con la corrección.
2. **Selector de ejemplos** (`X35.md` §3, punto 4). Hoy es un `<select>` de 168 opciones, en `EditorApp.tsx:816`.
   Pásalo a `ExamplePicker.tsx`:
   - un grupo **«Ejemplos destacados»** primero, con 6 a 8 casos representativos (un talud homogéneo, con agua, con
     capa débil, con refuerzo, con Hoek-Brown y uno no circular). Elígelos de `verification/cases` y documenta por qué;
   - debajo, todos los casos, agrupados por tipo;
   - **un campo de filtro** por id o por título, accesible: con etiqueta, el conteo de resultados en una región viva y
     manejo por teclado;
   - conserva el `aria-label` «Abrir un caso publicado como modelo» en el control que elige el caso, porque lo usan
     varios guiones e2e (`grep -rn 'Abrir un caso publicado' docs apps`). Si cambias el tipo de control, actualiza esos
     guiones en tu rama o deja el diff de cada uno.
3. **Rótulo del modelo de arranque** (`X35.md` §3, punto 8). En la cabecera del lienzo (`.ua-main-head`,
   `EditorApp.tsx:906`) se ve el nombre del documento abierto. En la primera visita dice que es un ejemplo, por ejemplo
   «Ejemplo ACADS 1(a), sin cambios». Reutiliza `docTitle.ts` y `fileStatusText` si sirven. Sin alto nuevo a 320 px:
   CM-WB está compactando esa cabecera, así que entra en una línea con elipsis.
4. **Guiones e2e:**
   - `u6d_drafts` R9-11a: actualiza el texto esperado a «archivo sin cambios» (`X34.md` §4); la intención del paso se
     mantiene;
   - `w1e_polilinea` (`:62`) y `r2i2_tablestaca_inclinada` (`:42`): encuentra por qué se cortan. Para cada uno, di si
     es un guion desactualizado (selector o texto del armazón UA) o un defecto del producto. Corrige el guion o, si es
     del producto y cae en tus archivos, el producto. Al final deben correr completos, con `exit=0` y 0 FAIL. Si el
     defecto cae en un archivo ajeno, para y repórtalo.
5. **Comprobación:**
   - los guiones de `X34.md` §1 (`$TMPDIR/cm-x34/repro_1.mjs` y `repro_1a.mjs`), copiados a `$TMPDIR/cm-wa/`, con los
     cuatro defectos corregidos;
   - `docs/fase2/ux/u6d-e2e/*.mjs`, `u4m-e2e/*.mjs`, `docs/fase3/w1e/e2e/*.mjs` (sin `explore`),
     `docs/fase3/r2i2/e2e/*.mjs` (sin `lib.mjs`) y `docs/suite-a/e2e/aceptacion_ua.mjs` (con `OGS_Q=$TMPDIR/ua1/Q`), con
     0 FAIL;
   - capturas del selector de ejemplos a 1440 × 900 y 390 × 844, en claro y en oscuro.

## CM-WB · Armazón: pantallas bajas y HUD

1. **Pantallas de 640 px de alto o menos** (`X34.md` §2):
   - el invariante de UA-E6 se cumple **sin excepción**: a scroll 0, ningún control interactivo queda
     **parcialmente** bajo el pie fijo, en los 8 viewports de UA5-M (320 × 568, 320 × 640, 320 × 844, 360 × 740,
     390 × 664, 390 × 844, 412 × 915 y 760 × 1024) y en los cinco estados:
     - vacío, tras «Nuevo»;
     - archivo abierto con aviso (`$TMPDIR/u6k-axe-short.ogs.json`);
     - ejemplo calculado;
     - ejemplo calculado con avisos;
     - «calcular y editar», con el pie de 129 px.
   - Cuando el alto disponible cae bajo `CANVAS_MIN_PX`, la paleta queda **entera** bajo el borde del pie y se alcanza
     con scroll: nunca a medias.
   - **Compacta la cabecera de la app (`.ua-header`) y la del lienzo (`.ua-main-head`) a 360 px de ancho o menos,**
     para que a 320 × 568, sin avisos, el lienzo llegue a su mínimo con la paleta completa sobre el pie. Hazlo solo con
     CSS. Si hace falta tocar el markup, propón el diff a CM-WA (`EditorApp.tsx`) o al coordinador (`App.tsx`).
   - Los avisos (`.ua-notices`) caben en una línea con elipsis a 360 px de ancho o menos. El texto completo queda
     accesible (nombre accesible, `title` o expansión).
   - **Tests:** `canvasHeight.test.ts`, con las cifras reales de 320 × 568, y una prueba de CSS al estilo de
     `ua4f.css.test.ts`.
   - **Entrega:** la tabla del barrido, con viewport, estado, alto disponible, solapes y si la paleta queda entera bajo
     el pie, junto con el guion que la mide, en `$TMPDIR/cm-wb/sweep/`.
2. **HUD a unos 800 × 600** (`X34.md` §3):
   - cuando la caja del modelo cambia por una edición confirmada (vértices, regiones o importaciones), el lienzo se
     reencuadra con la regla de UA-E6: **solo si la vista sigue en el último encuadre automático**. Durante un arrastre
     no se reencuadra; al soltar, sí;
   - si el usuario hizo zoom o desplazó la vista, no se toca.
   - **Criterio:** a 800 × 600 y 1024 × 640, con la cresta del ejemplo subida 20 m y 30 m (la medición de
     `$TMPDIR/cm-x34/measure_s3*.mjs`), el área del polígono que tapa el HUD es 0 px² tras la edición, y sin bucles de
     reencuadre (mídelo contando los encuadres en una edición).
   - **Tests:** `hudFit.test.ts` y un test del hook con la caja del modelo como entrada.
3. **El corredor de la regresión** (`run_regression.sh`). Agrega `docs/fase2/ux/u2c-e2e/*.mjs` y
   `docs/suite-a/e2e/aceptacion_ua.mjs` (`X34.md` §5):
   - revisa qué puerto usa cada guion: `u2c` usa 5187 según `U2C_lienzo_teclado.md`, y `aceptacion_ua` necesita
     `OGS_Q`. Escribe los nombres de los registros con el mismo patrón que hoy;
   - corre una vez cada guion agregado contra tu build, en tu puerto o con el gancho de `build_hook.sh` si lo necesita,
     y anota sus cifras.
4. **Comprobación:**
   - `docs/fase2/ux/u6k-e2e/u6k_axe.mjs`, `u3m-e2e/u3m_axe.mjs`, `u4p-e2e/u4p_targets.mjs`, `u5e-e2e/*.mjs`, los
     `u2c-e2e/*.mjs` y `aceptacion_ua.mjs`, con 0 FAIL;
   - capturas a 320 × 568, 390 × 664 y 800 × 600, en oscuro y en claro, con el ejemplo calculado.

## CM-WC · Primera visita

Objetivo: cerrar los puntos de fricción 1, 2, 5 y 6 de `X35.md` §3 sin alargar la ruta mínima de T1, T2 y T3.
1. **Destino de la importación (DXF y CSV):**
   - si el documento actual es el modelo de arranque sin cambios, o un documento vacío, el destino por defecto es
     **«Reemplazar»**; si no, sigue siendo «Agregar»;
   - el diálogo dice a qué modelo se agrega, por ejemplo «Agregar a las 2 regiones de ACADS 1(a)».
   - Decide cómo sabe el diálogo que el documento es el de arranque sin cambios. Si ya hay un dato en el store (sucio,
     `docEpoch`, nombre), úsalo. Si hay que pasar una prop desde `EditorApp.tsx`, deja el diff para CM-WA.
   - Las importaciones de DXF y CSV usan la misma regla.
   - **Test:** con el modelo de arranque intacto, importar `terraplen.dxf` deja «Listo para calcular» y un FS. Es la
     variante `OGS_T3=defecto` de `X35_proto/t3_dxf.cjs`, que hoy queda bloqueada.
2. **Guía de primera visita** (`onboarding/`):
   - sigue abriéndose sola la primera vez, y sin modal;
   - el paso 1 parte del modelo que ya está abierto. Dice algo como «Este es el ejemplo ACADS 1(a). Pulse
     Comprobar para obtener su factor de seguridad» y señala «Comprobar». Los pasos siguientes cubren editar, abrir
     otro ejemplo, importar y la Ayuda;
   - «Omitir» y «Siguiente» son alcanzables con el teclado.
   - Que la guía no tape «Comprobar» en ningún viewport de UA5-M: compruébalo con una captura a 320 × 568 y a 1440 × 900.
   - **Test:** el de `tour.ts`, con el texto nuevo, y la persistencia sin cambios.
3. **El aviso de bloqueo nombra el error.** Hoy dice «El modelo tiene errores: corríjalos (ver Diagnósticos) antes de
   calcular» (`engineCheck.ts:18`). Pasa a nombrar el primer error, con su texto y su lugar, y el conteo si hay más. Por
   ejemplo: «No se puede calcular: Región 3, vértice 2: la coordenada y debe ser un número (y 1 error más; ver
   Diagnósticos)».
   - El texto sale de los diagnósticos que ya existen, sin crear otro canal.
   - Si el aviso se pinta en un archivo ajeno (el pie o el HUD), cambia solo la función que arma el texto. Si hace
     falta un enlace a la fila, deja el diff.
   - **Tests:** de `engineCheck.test.ts`, con uno, dos y diez errores.
4. **Un DXF y un CSV de ejemplo descargables:**
   - copia `apps/web/src/io/dxf/fixtures/terraplen.dxf` a `apps/web/public/examples/terraplen.dxf`, y un CSV de
     regiones o de piezométrica (de los fixtures de `io/`) a `apps/web/public/examples/`;
   - un enlace «Descargar un DXF de ejemplo» en el diálogo de importación y en la Ayuda (`onboarding/helpContent.ts`),
     con la ruta relativa a la base de la app (`import.meta.env.BASE_URL`), porque Pages sirve bajo
     `/OpenGeoSlide/`.
   - Si el precache de la PWA (23 archivos hoy) cambia, actualiza el test que lo fija y di cuántos archivos son
     ahora.
5. **Guion `u3o_onboarding`:**
   - el paso 6 lee la cantidad de términos de la Ayuda desde `helpContent.ts`, o la compara con el DOM, en vez de fijar
     24 (`X34.md` §4);
   - agrega los pasos de la guía nueva.
6. **Comprobación:**
   - `X35_proto/t1_ejemplo.cjs`, `t2_talud_simple.cjs`, `t3_dxf.cjs` y `OGS_T3=defecto t3_dxf.cjs`, copiados a
     `$TMPDIR/cm-wc/`, contra tu build. Reporta la tabla de conteos y KLM de `X35.md` §2.1 antes y después; ninguna
     tarea puede tener más acciones que antes;
   - `docs/fase2/ux/u3o-e2e/*.mjs`, `u3i-e2e/*.mjs` y `u5s-e2e/*.mjs`, con 0 FAIL;
   - capturas de la primera visita (guía abierta) a 1440 × 900 y 320 × 568, y del diálogo de DXF con el destino
     por defecto.

## CM-V · xslope como columna informativa

Parte del prototipo de `X36.md` (`$TMPDIR/cm-x36/ogs2xslope.py`, `run_x36.py`, `cross.py`, `cobertura.py`). Léelo, pero
escríbelo de nuevo, limpio y con tests, en el repo.
1. **`verification/harness/to_xslope.py`:** conversor del `model` de un caso al diccionario de entrada de xslope, con
   las reglas de `X36.md` §3.1:
   - convierte `mohr_coulomb`, `undrained` sin gradiente, piezométrica, `ru` y `unit_weight_sat`, y la superficie
     circular fija, la polilínea fija y la búsqueda circular con ventanas;
   - todo lo demás levanta `Unsupported(<rasgo>)`;
   - `undrained` con gradiente solo entra si ninguna base queda sobre el datum; si no, levanta `Unsupported`;
   - el parche del preflight (`surface_supplied`) queda aislado en una función con un comentario que explica por qué
     y en qué versión se comprobó.
2. **`verification/xslope/run.py`:** corre bishop y spencer de **todos** los checks convertibles, sin los
   `Unsupported`.
   - Escribe `verification/xslope/REPORT.md` con la tabla por check: caso, método, tipo, publicado, tolerancia, ogs,
     xslope, error de xslope frente al publicado, diferencia xslope − ogs y veredicto. En superficie fija el veredicto
     es «concordancia» o «discrepancia»; en búsqueda, solo «diagnóstico».
   - El resumen lleva los conteos por clase (los `Unsupported` con su rasgo), la mediana y el máximo de |xs − ogs| en
     fija y en búsqueda, y la versión fijada de xslope.
   - Escribe también un `REPORT.json` con lo mismo.
   - Exige `xslope==1.1.0`. Si la versión instalada es otra, el script sale con un error claro.
   - Lo determinista se comprueba: dos corridas dan el mismo `REPORT.json` salvo la marca de tiempo.
3. **Tests** en `verification/xslope/test_to_xslope.py`: un test por regla de conversión, más uno de `Unsupported` y
   uno de punta a punta con V044 en fija, que debe dar el FS de xslope a ±0,05 % de ogs. Se corren con:

   ```bash
   env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with xslope==1.1.0 --with pytest \
     python -m pytest -q verification/xslope
   ```

   y deben pasar los tests que ya existen en `verification/`.
4. **Criterios:**
   - en superficie fija, |xs − ogs| ≤ 0,5 % en todos los checks convertidos. Cada excepción se diagnostica y se nombra
     en el informe;
   - la búsqueda va como diagnóstico, con el caso de V020 explicado como en `X36.md` §3.3.
5. **Línea de README y de `docs/verificacion.md`:** propón el texto en tu informe; la aplica el coordinador.
