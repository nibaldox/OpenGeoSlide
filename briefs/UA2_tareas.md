# UA2 · Corrección e integración e2e (léase con `briefs/UA_CONTRATO.md`, enmiendas UA-E1 y UA-E2 incluidas)

Base: `ua-integracion` con UA1 integrada (5 ramas). Puertas de la base: typecheck en verde; vitest con 250 test files
pasados más 9 saltados, y 4139 tests pasados más 320 saltados; build en verde. Aceptación del coordinador: **15/17**
(`docs/suite-a/e2e/aceptacion_ua.mjs`), con A12 y A14 en FAIL.

Dos escritores en paralelo, con archivos disjuntos:

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **UA2-F** correcciones del producto | `opengeoslide-wt/ua2-f` / `ua2-f` | 5183 | `apps/web/src/**` y `apps/web/index.html` (todo el producto), salvo `docs/` |
| **UA2-E** migración de los guiones e2e | `opengeoslide-wt/ua2-e` / `ua2-e` | 5186 y 5187 (los del runner) | `docs/**/e2e/**`, `docs/fase3/iw/e2e/run_regression.sh` |

Las reglas de commits, de parada y de informe son las del contrato §7.

## UA2-F · Correcciones del producto

**Invariante:** lo que la interfaz dibuja encima del lienzo no tapa el modelo después de encuadrar, y todo control
cumple su objetivo de clic y su nombre accesible, en los dos temas. Los hallazgos siguientes son instancias de esa
regla. Si encuentras otra instancia de la misma regla, corrígela en su propio commit, con su test, y márcala en el
informe como «descartable».

En orden de prioridad:

1. **F1 · El HUD tapa el modelo.**
   - **Hallazgo:** a 1440 × 900, con V049 abierto y calculado, el HUD de 330 × 254 tapa la parte izquierda del modelo
     y los rótulos 50, 40 y 30 del eje y. A16 solo mide la paleta y la leyenda.
   - **Corrección:** con el HUD desplegado y una ventana de 761 px o más, el armazón mide la caja del HUD relativa a la
     tarjeta (`ResizeObserver`) y calcula dos candidatos de `fitInsets`:
     - A = los márgenes fijos de §4.2 con `top: hudBottom + 12`;
     - B = los márgenes fijos con `left: hudRight + 12`.

     Se queda con el que da la mayor escala para los límites del documento, con la misma cuenta que `fitToDocInsets`.
   - **HUD plegado:** el margen superior deja libre la píldora.
   - **Cuándo reencuadrar:** cuando cambian los márgenes (el HUD aparece tras «Comprobar», se pliega o se despliega,
     cambia el tamaño de la tarjeta), el lienzo se reencuadra solo si el viewport actual es el último encuadre
     automático, es decir, si el usuario no hizo zoom ni movió la vista desde entonces. Si lo movió, no se toca.
   - **Lógica pura** en `editor/app/shell/` (elección del candidato y regla de «último encuadre automático»), con
     tests.
   - **Comprobación:** a 1440 × 900 y a 1280 × 800, con V049 y con ACADS 1(a), ningún vértice de región cae dentro de
     la caja del HUD, ni de la paleta, ni de la leyenda tras «Comprobar». Lo mismo a 1024 × 768.
2. **F2 · A12.** En `ui/DropdownMenu.tsx`, el «▾» de los disparadores pasa a `<IconChevronDown size={14} />`. Adapta
   `dropdownMenu.test.ts` si fija el glifo. Busca y reemplaza cualquier otro dingbat visible en botones, pestañas o
   encabezados (⚠ ✓ ✕ ↵ ▶ y similares) por su ícono de `ui/icons.tsx`.
3. **F3 · A14, objetivos < 24 px a 1440.**
   - Los `input` radio y checkbox de los paneles Superficie, Búsqueda y Análisis miden 16 px de alto. El objetivo es
     el `label` que los envuelve: debe medir ≥ 24 de alto (`min-height` y `align-items: center`), sin agrandar el
     control nativo.
   - El `select` «Ejemplos» del menú Archivo (`.dd-field select`) mide 20 de alto y debe medir ≥ 24.
   - Busca el resto de controles de los diez pasos con el mismo método que A14 del guion.
4. **F4 · Tooltips (UA-E2 punto 4).** En `editor/canvas/canvas.css` y en `styles/components.css`, el `gs-tip` oculto
   lleva `visibility: hidden` además de `opacity: 0`, con `visibility` en la transición.
5. **F5 · Tabla de resultados.**
   - El botón «Dibujar» del método mostrado lleva un borde rojo que se lee como error. Pásalo a estado seleccionado
     con `aria-pressed` y el acento (`--ui-accent-bg` y `--ui-accent-bright`), si no lo tiene ya.
   - «1293,4 ms» parte la unidad en dos líneas y «Morgenstern-Price» se corta con guion: usa `white-space: nowrap` en
     las celdas numéricas con unidad y en los nombres de método.
6. **F6 · Móvil.** Hasta 760 px (o con `pointer: coarse`), la tecla decorativa «Ctrl Intro» junto a «Comprobar» no se
   muestra.
7. **F7 · Limpieza.**
   - `--ui-info-border` en `tokens.css`, con los valores de la suite (`#7693b7` en oscuro y `#d2cbe6` en claro;
     súbelo si el contraste con el fondo da menos de 3 y anota la cifra);
   - `notices.css` deja el respaldo;
   - se borra `ui/ThemeSelect.tsx` si ya nadie lo importa.
8. **F8 · Guía a 390** (si queda tiempo).
   - El paso 2 resalta toda la barra lateral (unos 1450 px de alto): limita el resaltado a la lista de pasos visible.
   - El paso 4 debe quedar dentro de la pantalla (`scrollIntoView`).

**Puertas:**
- `pnpm typecheck && pnpm test && pnpm build`;
- el guion de aceptación contra tu build, en el 5183:

  ```bash
  OGS_URL=http://127.0.0.1:5183/ OGS_LABEL=ua2f OGS_Q=$TMPDIR/ua1/Q node docs/suite-a/e2e/aceptacion_ua.mjs
  ```

  Debe dar 17/17. Si una comprobación falla por un defecto del guion, no del producto, para y repórtalo con la
  evidencia: el guion no es tuyo.
- Capturas de Lienzo calculado a 1440 × 900 y a 1280 × 800, en oscuro y en claro, con V049, más 1024 × 768 en oscuro.
  Mira tú mismo que el HUD no tape el modelo.

## UA2-E · Migración de los guiones e2e

**Objetivo:** la regresión completa del runner (`docs/fase3/iw/e2e/run_regression.sh`) corre sobre la UI nueva con 0
FAIL, salvo las fallas que ya tenía la línea base `v0.5.0`. Esa lista va en la sección «Línea base» al final de este
archivo.

**Cambios por diseño:** contrato §4.6-§4.8 y UA-E2. Actualiza cada paso afectado con un comentario
`// UA: <motivo>`:
- La pestaña «Editar» se llama «Lienzo» (id `mode-edit`) y está en el tablist «Vistas»; el tablist «Modo de la
  aplicación» ya no existe.
- `[data-testid="results-panel"]` vive en la vista «Resultados» (`#view-results-panel`, pestaña «Resultados»):
  - abre esa vista antes de leer la tabla, y vuelve a «Lienzo» antes de interactuar con el lienzo;
  - el helper `check()` de cada `lib.mjs` espera el resultado en el HUD (`[data-testid="result-summary"][data-state="current"]`)
    en lugar de las filas de la tabla;
  - a los guiones que leen la tabla, agrégales el cambio de vista.
- `[role="toolbar"]`, `.ea-toolbar`, `.ea-layout` y `.ea-canvas` ya no existen:
  - la acción de cálculo está en `.ua-actions`;
  - las herramientas están en la paleta del lienzo, `nav[aria-label="Herramientas del lienzo"]`, con los mismos
    nombres de botón;
  - a 480 px o menos, el menú «Editar» solo trae Deshacer y Rehacer: las herramientas se eligen en la paleta.
- El tema es un botón «Cambiar a tema claro» / «Cambiar a tema oscuro». Ya no existe el combobox «Tema».
- La guía de primera visita tiene destinos nuevos (`onboarding/tour.ts`); `u3o_onboarding.mjs` debe seguirlos.
- Los diez pasos conservan `role="tab"` y su nombre exacto, pero el panel abierto va en línea debajo del paso.
- `file-status`, `engine-banner` (ahora en la barra de estado) y `live-polite` conservan su `data-testid` y sus textos.

**Método:**
1. **Preparación**, en tu worktree:
   - `apps/web`: `pnpm install --frozen-lockfile` (ya hecho) y `pnpm build`;
   - copia `src/wasm` (ya está) y el binario de la CLI v0.5.0: `cp ~/archivos/opengeoslide-wt/ua-base/target/release/ogs
     target/release/ogs` (crea la carpeta);
   - `TMPDIR=~/.hermes/profiles/open-geoslide/cache/scratch`.
2. **Regresión completa:**

   ```bash
   bash ~/.hermes/profiles/open-geoslide/skills/software-development/ogs-e2e-preview-integration/scripts/full_regression.sh <worktree> $TMPDIR/ua2/reg-e-<n>
   ```

   Antes de lanzarla, comprueba con `ss -ltn` que el 5186 y el 5187 están libres. Si los ocupa otra corrida, espera.
   Las corridas son largas (10-15 min): lánzalas en segundo plano y lee el log al terminar. Los guiones salen con 0
   aunque fallen; el total sale de las líneas `^FAIL`.
3. **Primero la base:** cada FAIL de la primera corrida es por diseño (migra el guion), un defecto del producto o una
   falla que ya estaba en la línea base. Los defectos del producto **no los corriges**: anótalos con guion, paso,
   selector y causa, para el coordinador.
4. **Commit** por grupo de guiones (`UA2-E: …`), con `git add` de rutas explícitas bajo `docs/`.
5. **Copias de helpers:** hay cuatro copias de `lib.mjs` y 16 definiciones de `openMenu`. Corrige cada copia que lo
   necesite. No centralices: eso es otra tarea.

**Informe:**
- la tabla de la primera y de la última corrida (`scripts`, `OK`, `FAIL`, `no_ok`);
- la lista de guiones tocados con el motivo;
- los defectos del producto encontrados, con su evidencia;
- las fallas de la línea base que siguen igual.

## Línea base v0.5.0 (la completa el coordinador)

La regresión completa sobre `v0.5.0` (worktree detached `opengeoslide-wt/ua-base`, binario `ogs 0.5.0`) dio
**50 guiones, OK=1223, FAIL=3, no_ok=0**. Logs en `$TMPDIR/ua2/reg-base/`.

Las fallas ya presentes en la base, que no hay que arreglar en este bloque, aunque la migración no debe empeorarlas:
- `u3o_onboarding` FAIL 6: «Ayuda» abre un `<dialog>` modal con índice, glosario, atajos y enlaces.
- `u4p_polish` FAIL 4d: «x1 fuera del terreno», mensaje con el rango (aparece el de tarjeta sin aplicar).
- `u6d_drafts` FAIL R9-11a: «sin trazo y sin cambios, vuelve a sin cambios pendientes».
- Terminan con `exit=1` por esperar una descarga, `page.waitForEvent('download')` con timeout de 30 s:
  - `w1e_polilinea`, en la línea 62, tras OK=9;
  - `r2i2_tablestaca_inclinada`, en la línea 42, tras OK=8.

Meta de UA2-E:
- con la UI nueva, OK ≥ 1223 menos los pasos que se eliminen por diseño, cada uno justificado;
- FAIL ≤ 3, y solo los mismos de arriba;
- las mismas dos salidas con `exit=1` o menos.

Si una de las fallas de la base desaparece o cambia, repórtalo.
