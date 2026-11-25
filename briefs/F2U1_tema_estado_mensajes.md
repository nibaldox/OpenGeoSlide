# Brief F2-U1: tema oscuro, estado y mensajes (3 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee primero `docs/fase2/ux/PLAN_UX.md`: el contrato de tokens es
**normativo**. Lee también tus hallazgos en `docs/reviews/R7_agy.md` y `docs/fase2/ux/X8_auditoria_practica.md`, y las
guías en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/mwg/` (`dark-mode.md`, `dark-mode-toggle.md`,
`color.md`, `accessibility.md`, `component-specific-light-dark-theme.md`).

## Reglas comunes
- **Worktree propio:** cada escritor trabaja en `/home/xodla/archivos/opengeoslide-wt/u1{t,a,m}`, en la rama
  `u1{t,a,m}-…`, creada desde `main`.
- **Propiedad de archivos estricta:** tocar un archivo de otro escritor es un error. Si lo necesitas, detente y
  repórtalo.
- **Tests:** cada hallazgo que se pueda probar empieza con un test que falla con el código actual. En el resumen, el
  test y su resultado antes y después.
- **Sin colores literales nuevos** fuera de `styles/tokens.css` y `report/palette.ts`. Solo T los define.
- **Gates:**
  - `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`.
  - Paridad: `cargo build --release -p ogs-cli && OGS_BIN=<worktree>/target/release/ogs pnpm --dir apps/web exec vitest run src/editor/state/parity.test.ts`,
    sin casos omitidos.
  - Ida y vuelta: `env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with pytest python -m pytest -q verification/tools/test_web_roundtrip.py`.
- **Cierre:** commits pequeños con rutas explícitas y **sin push**.
  - `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Puertos:** T usa el 5183 y A el 5184. M no necesita servidor. Nunca uses el 5180 ni el 5181.
- **Playwright:** `playwright-core` en `$TMPDIR/f1c-e2e`, con `executablePath /usr/bin/google-chrome-stable` y
  `--no-sandbox`. axe-core en `$TMPDIR/x8-ux/node_modules/axe-core/axe.min.js`.

---

## U1-T: Tema y color (worktree `u1t`, rama `u1t-tema`)

**Archivos tuyos:**
- `apps/web/index.html`, `public/manifest.webmanifest`, `src/styles/tokens.css` (nuevo), `src/App.css` y
  `src/editor/panels/panels.css`;
- `src/theme/**` (nuevo) y `src/ui/ThemeSelect.tsx` (nuevo);
- en `src/App.tsx`, **solo** la cabecera, para montar `ThemeSelect`;
- `src/editor/canvas/EditorCanvas.tsx`, **solo** las constantes y atributos de color, sin tocar la lógica;
- `src/render/{scene.ts,drawSection.ts,SectionCanvas.tsx}`, `src/ui/Legend.tsx` y `src/pwa/updatePrompt.ts`;
- `src/report/palette.ts` (nuevo), y de `src/report/{content.ts,pdf.ts}` solo los colores.

**Tareas:**
1. **`tokens.css`:** con todos los tokens del contrato y valores para claro y oscuro. Usa `light-dark()` con el
   respaldo `@media (prefers-color-scheme: dark)` que exige la guía. Agrega `accent-color` y `scrollbar-color`.
2. **Mecanismo sin destello del tema equivocado:**
   - en `index.html`, `<meta name="color-scheme" content="light dark">` y, justo después, un script en línea mínimo,
     sin `type=module`, que lee `ogs.theme.v1` dentro de un `try/catch`;
   - `theme-color` para claro y oscuro con `media`.
   - En `manifest.webmanifest`, `background_color` y `theme-color` neutros.
   - **Comprueba la CSP:** el service worker y `pages.yml` no deben bloquear el script en línea. Si hay CSP, agrega su
     hash.
3. **`theme/theme.ts` y `ThemeSelect.tsx`:**
   - un selector de 3 estados, Sistema / Claro / Oscuro, accesible (`<select>` o `fieldset` de radios, objetivo de
     24 px o más). «Sistema» muestra el tema resuelto, por ejemplo «Sistema (oscuro)»;
   - sincroniza `<meta name="color-scheme">` y el `theme-color`, y escucha el evento `storage` para seguir a otras
     pestañas y `matchMedia('(prefers-color-scheme: dark)')` con su evento `change`;
   - **no borres** el valor guardado cuando el sistema llega a coincidir con él.
   - **Tests unitarios** del modelo de 3 estados.
4. **Migración de colores:**
   - `App.css` y `panels.css` pasan a usar los tokens;
   - en `EditorCanvas.tsx`, las constantes `COLOR_*` y los atributos `fill` y `stroke` pasan a `var(--canvas-*)`, y los
     materiales a `var(--canvas-mat-i)` desde `scene.ts`;
   - en `drawSection.ts` y `SectionCanvas.tsx` (Canvas 2D), una `SectionPalette` se resuelve con `getComputedStyle` y
     se redibuja al cambiar el tema. En Node se usa la paleta clara por defecto;
   - `Legend.tsx`;
   - `updatePrompt.ts` usa una clase CSS con tokens en lugar de estilos en línea, y agrega un botón **«Más tarde»** que
     cierra el aviso sin recargar.
5. **Contraste** (R7-15 y UX-06):
   - en claro, `--ui-ink-muted` de 4,5:1 o más sobre `--ui-bg` y sobre `--ui-surface`, y `--ui-control-border` de 3:1
     o más;
   - el anillo de foco con 3:1 o más en ambos temas;
   - halo con `paint-order: stroke` y `stroke: var(--canvas-halo)` en la superficie crítica, las etiquetas de los ejes
     y las cargas;
   - etiquetas de los ejes de 12 px o más (UX-20).
6. **PDF** (UX-15 y R7-27): `report/palette.ts` con constantes RGB. Los materiales coinciden en tono con la paleta
   clara del lienzo. `content.ts` y `pdf.ts` lo usan. El PDF **sigue siendo claro** aunque la app esté en oscuro.
7. **Tests nuevos:**
   - **(a)** `tokens.contrast.test.ts` lee `tokens.css`, calcula el contraste WCAG de cada par declarado en una tabla
     de pares (texto sobre superficie, borde sobre superficie, trazo del lienzo sobre `--canvas-bg` y sobre cada
     `--canvas-mat-i`) en claro y en oscuro, y falla si un texto queda bajo 4,5 o un elemento de interfaz bajo 3;
   - **(b)** `no-hardcoded-colors.test.ts` falla si aparece `#hex`, `rgb(` u `hsl(` en `src/**/*.{ts,tsx,css}` fuera de
     `styles/tokens.css`, `report/palette.ts`, los tests y las fixtures;
   - **(c)** el PDF no depende del tema.
8. **Verificación en Chrome** (puerto 5183, `pnpm preview`):
   - capturas en claro y en oscuro con `colorScheme` de Playwright y con el selector: editor con resultado, Casos,
     diálogo DXF y aviso PWA si se puede simular;
   - axe con `color-contrast` en 0 en ambos temas;
   - **sin destello:** con `ogs.theme.v1=dark` y el sistema en claro, el primer frame ya es oscuro. Compruébalo con una
     captura inmediata tras `goto`, `waitUntil: 'commit'`;
   - guarda las capturas en `$TMPDIR/u1t-shots/` y revísalas con visión.

---

## U1-A: Estado y correctitud (worktree `u1a`, rama `u1a-estado`)

**Archivos tuyos:**
- `src/editor/EditorApp.tsx`, `src/editor/app/{useEngineCheck.ts,ImportDialogs.tsx,importPlan.ts,useDraftAutosave.ts,reportInput.ts}`;
- `src/editor/state/{reducer.ts,history.ts,store.ts}`;
- `src/engine/client.ts`;
- en `src/App.tsx`, **solo** `CasesView` y la prop que pasa a `EditorApp`;
- `src/ui/{ResultsTable.tsx,CheckTable.tsx}`, `src/io/csv.ts` (validación de la importación), y un CSS nuevo
  `src/editor/app/editor-app.css` que **solo** consume tokens.

**Tareas** (los detalles y los archivos con línea están en R7 y X8):
1. **R7-01:**
   - si el método mostrado no convergió, el rótulo dice «Superficie evaluada (sin convergencia)»;
   - `ResultsTable` muestra λ solo si el método convergió;
   - `EditorCanvas` recibe una prop `surfaceConverged`, pero su estilo discontinuo lo implementa U2-B. Tú solo pasas la
     prop; si `EditorCanvas` no la acepta todavía, deja la prop preparada en `EditorApp` detrás de un comentario `TODO(U2-B)`
     y **no toques** `EditorCanvas`.
2. **R7-05:** agrega `reset()` en `useEngineCheck` y llámalo en `replaceDoc` y `recoverDraft`. Un **token de solicitud**
   descarta las respuestas obsoletas. El mensaje de errores locales se limpia cuando desaparecen esos errores.
3. **R7-07:** prop `active` en `EditorApp`. Los atajos globales solo actúan en modo Editar.
4. **R7-08:** acción `doc/load`, que reinicia el historial, para «Nuevo», «Abrir», «Ejemplos» y «Recuperar».
   `doc/replace` queda solo para la importación.
5. **R7-09:** en `CasesView`, el selector y la carga de archivos se deshabilitan mientras está ocupado, y un `runIdRef`
   descarta las respuestas viejas.
6. **R7-14:**
   - `EngineClient` escucha `error` y `messageerror` y rechaza las promesas pendientes;
   - botón «Cancelar» que termina y recrea el Worker;
   - «Comprobar» se deshabilita mientras el motor no está listo, con un estado visible.
7. **R7-03:** `Modal` de `ImportDialogs` pasa a un `<dialog>` nativo con `showModal()`. El foco vuelve al disparador, y
   Esc cierra gracias al navegador. Los estilos van en `editor-app.css` con tokens.
8. **R7-06:** `baseText` se recalcula al cambiar la unidad mientras el usuario no lo haya editado. Las notas del plan
   se deduplican.
9. **UX-07:** un CSV con x no creciente **no** se puede importar: el botón queda deshabilitado y el error es visible.
10. **R7-17:** el motivo de las exportaciones bloqueadas aparece **en pantalla** («Pulse «Comprobar» para habilitar las
    exportaciones del modelo actual»), no solo en `title`.
11. **R7-18 (borrador):** `beforeunload` cuando hay cambios sucios y el borrador no se pudo guardar.
12. **R7-28:** `confirmDiscard` va antes de los avisos del archivo. `try/catch` en `file.text()`. Guarda contra doble
    clic en `onSave`.
13. **UX-11:** se muestra el título real del modelo o del ejemplo, por ejemplo «Ejemplo: ACADS 1(a)».
14. **R7-21:** en `CheckTable`, «Cumple / No cumple». Los estados de `ResultsTable` usan los mismos términos que el
    PDF, y el tiempo total aparece una sola vez.
15. **UX-14:** `<caption>` en las tablas de resultados.

**Verificación en Chrome** (puerto 5184): reproduce R7-05, R7-07 y UX-07 **antes y después**, con el mismo script, y
guarda la salida.

---

## U1-M: Mensajes y unidades (worktree `u1m`, rama `u1m-mensajes`)

**Archivos tuyos:**
- `src/editor/state/{validateLocal.ts,localIssues.ts}`;
- `src/editor/panels/forms.ts`, `src/engine/warnings.ts` y `src/editor/canvas/layout.ts` (solo las etiquetas);
- los mensajes de `src/io/ogsJson.ts` y `src/io/dxf/*.ts`;
- `src/ui/PerformancePanel.tsx` (solo los textos);
- los `*.test.ts` de esos archivos.

**Tareas:**
1. **R7-19 y UX-13:** redacta los mensajes con las etiquetas de la interfaz y la acción a tomar. Por ejemplo, en lugar de
   «kh debe estar en [0, 1)», escribe: «Coeficiente sísmico horizontal kh: use un valor entre 0 y 0,99 (ej. 0,15)».
   - Sin nombres internos: `min_m_alpha`, `n_entry`, `deny_unknown_fields`, `performance.now`, `1e-12·escala²`, etc.
   - En DXF y JSON, indica la línea o el campo en términos de usuario.
   - El código o puntero técnico se conserva en un campo aparte (`detail`) para mostrarlo colapsado. Mostrarlo es tarea
     de U2-B.
2. **R7-20:** `water_above_ground` ya no dice «v0.1». Los avisos `m_alpha`, `pole`, `no_driving`, `no_admissible_root`
   y `non_finite` sugieren qué revisar. Unifica la puntuación.
3. **R7-22:** las etiquetas accesibles de `layout.ts` usan las unidades del modelo. `newMaterialForm` usa valores por
   defecto imperiales cuando corresponde. Revisa qué asume el motor para γw en imperial: lee
   `crates/ogs-core/src/model.rs` y el schema, solo lectura.
4. **Códigos estables:** los códigos de aviso no cambian, porque los contratos E6 y E12 son normativos. Solo cambia el
   texto. `warnings.test.ts` y la regex de `00_CONTRATOS.md` deben seguir pasando.
5. Actualiza los tests que afirmen los textos antiguos. Cada mensaje nuevo debe tener al menos un test.
