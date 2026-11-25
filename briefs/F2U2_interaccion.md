# Brief F2-U2: interacción, distribución y accesibilidad del editor (2 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Antes de empezar, lee:
- `docs/fase2/ux/PLAN_UX.md`. El contrato de tokens es normativo: **solo** se consumen `var(--ui-*)` y `var(--canvas-*)`.
- Tus hallazgos con `archivo:línea` en `docs/reviews/R7_agy.md` y en `docs/fase2/ux/X8_auditoria_practica.md`.
- `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/mwg/accessibility.md`.

**Base:** `main` en `db76190`, con U1 integrado: tema oscuro, estado y mensajes.

## Reglas comunes
- **Worktree propio:** `/home/xodla/archivos/opengeoslide-wt/u2{l,c}`, rama `u2{l,c}-…`. **Propiedad de archivos estricta.**
- **Tests:** cada hallazgo que se pueda probar empieza con un test que falla. Pon la lógica en módulos puros que se
  puedan probar en Node; lo visual se comprueba en Chrome.
- **Sin colores literales:** el test `no-hardcoded-colors` debe seguir en verde. El de contraste de tokens también.
- **Nombres accesibles estables** (el recorrido e2e los usa):
  - deben seguir existiendo, como `button` y con el mismo nombre, «Comprobar», «Informe PDF», «Exportar resultados
    (CSV)», «Exportar superficie (CSV)», «Nuevo», «Abrir», «Guardar», «Importar DXF» e «Importar CSV»;
  - pueden vivir dentro de un menú desplegable, siempre que el recorrido pueda abrirlo. Si los mueves a un menú,
    **actualiza** `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1c-e2e/walk_coord.mjs` (cambia el puerto a
    tu preview en una copia `walk_u2x.mjs`) y demuestra 17/17.
- **Gates:**
  - `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`.
  - Paridad: `OGS_BIN=<worktree>/target/release/ogs pnpm --dir apps/web exec vitest run src/editor/state/parity.test.ts`,
    sin casos omitidos. Antes, compila con `cargo build --release -p ogs-cli` y `bash apps/web/scripts/build-wasm.sh`.
  - Ida y vuelta: `env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with pytest python -m pytest -q verification/tools/test_web_roundtrip.py`.
  - axe (`$TMPDIR/x8-ux/node_modules/axe-core/axe.min.js`) en claro y en oscuro, sobre las vistas que tocaste, con
    **0 violaciones serious o critical**.
- **Capturas:** 1440×900, 1024×768 y 390×844, en claro y en oscuro. Guárdalas en `$TMPDIR/u2x-shots/` y revísalas con
  visión.
- **Cierre:** commits pequeños con rutas explícitas y **sin push**. `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Puertos:** L usa el 5186 y C el 5187.

## Contrato entre los dos escritores: props nuevas de `EditorCanvas`
C las implementa y L las pasa desde `EditorApp`:
```ts
surfaceConverged?: boolean   // default true; false → superficie con trazo discontinuo y color --canvas-surface-unconverged
units?: 'SI' | 'imperial'    // default 'SI'; etiquetas accesibles y ejes con m/ft
onAnnounce?: (msg: string) => void  // C llama al mover/agregar/eliminar vértices; L lo conecta a la región aria-live
```
Las tres props son opcionales, así que cada rama compila sola.

---

## U2-L: distribución, navegación y paneles (worktree `u2l`, rama `u2l-layout`)

**Archivos tuyos:**
- `src/App.tsx`, `src/App.css`, `src/editor/EditorApp.tsx` y `src/editor/app/**`;
- `src/editor/panels/**`;
- `src/ui/**`, salvo lo que use el lienzo;
- un hook nuevo `src/ui/useRovingTabIndex.ts`.

**Tareas:**
1. **UX-03, resultados visibles sin desplazarse** a 1440×900 y a 1280×800.
   - Rediseña la distribución: el lienzo ocupa el centro, a la izquierda o a la derecha van las propiedades, y los
     resultados (FS por método, estado y avisos clave) aparecen en un **resumen compacto siempre visible**, por ejemplo
     una franja con FS grande sobre el lienzo o en la barra lateral. La tabla completa y el diagnóstico pueden quedar
     debajo o en pestañas.
   - **Criterio medible:** tras «Comprobar» a 1440×900, el FS de cada método queda dentro del viewport (y < 900) sin
     desplazarse. Demuéstralo con Playwright.
2. **R7-26 y UX-18, barra agrupada:**
   - menús «Archivo ▾» (Nuevo, Abrir, Guardar, Ejemplos) y «Exportar ▾» (resultados CSV, superficie CSV); «Importar ▾»
     opcional;
   - quedan visibles Deshacer, Rehacer, las herramientas del lienzo y la acción primaria «Comprobar» con «Informe PDF»;
   - menú accesible: `button` con `aria-expanded`, navegación con flechas, Esc y cierre al hacer clic fuera. Puedes usar
     `popover` según la guía, si es Baseline;
   - quita el «Comprobar» duplicado del diagnóstico o haz que comparta el estado del principal;
   - unifica el verbo entre el editor y Casos: «Calcular» en ambos, o deja «Comprobar» y documenta por qué.
3. **Banner del motor (UX-03):** «Motor: ogs-core …» deja de ocupar una fila completa. Pasa a un indicador compacto en
   el pie o la cabecera, que sigue mostrando los errores de carga del motor de forma visible.
4. **UX-08, R7-16 y UX-16:**
   - un único `<main>` que contenga los paneles de modo;
   - `useRovingTabIndex` para los dos `tablist` y el `toolbar`, con flechas, Inicio y Fin.
5. **R7-12, UX-09 y UX-10:**
   - región `aria-live="polite"` persistente con el resumen del cálculo («Cálculo completado: Bishop FS 0,985;
     Spencer FS 0,984; 2 notas») y otra `role="alert"` persistente para los errores;
   - los avisos de información se cierran solos a los 6 s, o se pueden cerrar, y no se acumulan;
   - conecta `onAnnounce` del lienzo a la región `polite`.
6. **R7-11:** al hacer clic en una incidencia de Diagnósticos, se abre la pestaña del panel correspondiente y el foco va
   al campo. Usa `warningPath(code)` de `engine/warnings.ts` en `diagnostics.ts`. Solo se muestra un `<button>` si
   existe un destino real. `Issue.detail` se muestra colapsado en un `<details>` (pendiente de U1-M).
7. **R7-13 y UX-04, sin desborde horizontal entre 320 y 1440 px:**
   - Materiales y Cargas pasan a tarjetas o filas apiladas dentro del lateral, con etiquetas visibles;
   - `CheckTable` y la tabla de capas del DXF llevan un contenedor con `overflow-x: auto` y nombre accesible;
   - el selector de Ejemplos y la barra no se cortan a 390 px;
   - **Criterio:** `document.documentElement.scrollWidth <= innerWidth` en 320, 390, 768, 1024 y 1440. Demuéstralo.
8. **R7-23:** en `Fields.tsx`, el `hint` se enlaza siempre con `aria-describedby`, y `role="alert"` solo aparece al
   salir del campo o al pulsar Intro, no en cada tecla. El `id` de material es de solo lectura y se ve como texto.
9. **U1-M pendiente:** `MaterialsPanel` usa `newMaterialForm(ids, units)` y `WaterPanel` usa
   `defaultWaterUnitWeight(units)` y `waterUnitWeightHint(units)`.
10. **R7-24:** leyenda compacta bajo el lienzo del editor (materiales, superficie, dovelas, bandas de entrada y salida,
    cargas). Reutiliza `ui/Legend.tsx`. Pasa `surfaceConverged` (hoy en un `TODO(U2-B)`) y `units` a `EditorCanvas`.
11. **Móvil:** a 390 px, el lienzo es visible en la primera pantalla, debajo de una barra compacta, y los paneles
    quedan debajo.
12. **Limpieza:** elimina de `App.css` los estilos `.ea-backdrop` y `.ea-modal` que quedaron sin uso tras el `<dialog>`
    de U1-A, si ya no se usan.

---

## U2-C: lienzo del editor (worktree `u2c`, rama `u2c-lienzo`)

**Archivos tuyos:** `src/editor/canvas/**` y `src/render/drawSection.ts`, solo los ejes.

**Tareas:**
1. **R7-04 y UX-02, teclado:**
   - **tabindex itinerante:** el lienzo es una sola parada de tabulación, y los tiradores se recorren con
     `Tab`/`Mayús+Tab` dentro del lienzo, o con `[` y `]`, documentado;
   - instrucciones con `aria-describedby`;
   - agregar un vértice con el teclado: con un vértice seleccionado, `Insert` o `+` inserta uno en el punto medio de la
     arista siguiente;
   - `Supr` mueve el foco al vértice vecino;
   - el tirador `circle_radius` cambia el radio con las flechas, y `circle_center` mueve el centro;
   - atajos `+`, `-` y `0` para zoom y encuadre;
   - llama a `onAnnounce` con mensajes como «Vértice 3 de la región 1: x 31,4 m, y 26,4 m».
2. **R7-10 y UX-05, objetivos:** el radio de acierto es de 16 px o más, y 22 px con `pointerType === 'touch'`. Los
   tiradores visibles miden al menos 12 px y tienen anillo de contraste.
3. **Zoom y encuadre** (parte de R7-02): botones sobre el lienzo (Acercar, Alejar, Encuadrar) accesibles y operables
   con teclado. Rueda y pellizco (`pointer events` con dos punteros) para el zoom.
4. **Móvil:** altura del lienzo `clamp(320px, 55dvh, 640px)`. `touch-action` solo bloquea el desplazamiento de la
   página mientras se arrastra un tirador o en la herramienta «Mover vista». Fuera de eso, la página se desplaza.
5. **Props del contrato:**
   - `surfaceConverged=false` dibuja la superficie con trazo discontinuo y color `--canvas-surface-unconverged`;
   - `units` se aplica a las etiquetas accesibles (`vertexLabel`, `piezoLabel`, `circleCenterLabel`,
     `circleRadiusLabel` y `rangeLabel`, que ya aceptan `units`) y a los ejes;
   - `onAnnounce`.
6. **Ejes de `drawSection.ts`:** usan la unidad del modelo (`x (ft)` en imperial).
7. **Tests:** teclado, con lógica pura en `keys.ts`, `edits.ts` y `hitTest.ts`; inserción de vértices; radio con
   flechas; foco tras eliminar; zoom y encuadre en `viewportOps`; acierto táctil; y las props.
8. **Chrome** (puerto 5187): edita un modelo **solo con teclado** (agregar, mover y eliminar vértices, mover el círculo
   y cambiar su radio, hacer zoom y encuadrar) y demuéstralo con un script.
