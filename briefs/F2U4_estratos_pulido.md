# Brief F2-U4: estratos y pulido final (2 escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**. Lee primero:
- `docs/fase2/ux/X9_verificacion.md`, con los hallazgos UX9-01 a UX9-08 y el estado de cierre de X8;
- `docs/fase2/ux/PLAN_UX.md`, cuyo contrato de tokens es normativo;
- las notas de las olas anteriores, `docs/fase2/ux/U*_*.md`, sobre todo `U3M_modelado.md` y `U3I_integracion.md`.

**Base:** `main` en `0d3b893`.

## Reglas comunes
Son las de `briefs/F2U3_modelado_onboarding.md`:
- worktree propio y propiedad de archivos estricta;
- un test que falla antes del cambio;
- sin colores literales;
- nombres accesibles estables;
- gates: `pnpm test`, `pnpm build`, paridad con `OGS_BIN` sin omitidos, ida y vuelta, y axe en claro y oscuro con 0
  violaciones serious o critical;
- commits con rutas explícitas y **sin push**.

**Recorridos de regresión** (en `docs/fase2/ux/u3i-e2e/`, `u3m-e2e/` y `u3o-e2e/`): copia los que correspondan, cambia
el puerto por el tuyo y deben seguir pasando. La guía se marca como vista con `localStorage` `ogs.onboarding.v1`.

- **Puertos:** M usa el 5186 y P el 5187. Mata tu servidor por PID.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.

---

## U4-M: estratos (worktree `u4m`, rama `u4m-estratos`)

**Archivos tuyos:**
- `src/editor/EditorApp.tsx`, `src/editor/state/**`, `src/editor/types.ts` y `src/editor/canvas/**`;
- `src/editor/panels/GeometryPanel.tsx` y `src/editor/app/{newModel.ts,NewSlopeDialog.tsx}`, con sus tests.

**Tareas:**
1. **UX9-01, espacio para dibujar:**
   - El encuadre por defecto, «Encuadrar», deja un margen de al menos 25 % del alto del modelo **bajo la base** y a los
     lados, y un margen razonable arriba.
   - Mientras «Dibujar región» está activa, se puede colocar un punto en cualquier lugar del lienzo, incluso fuera de
     la extensión del modelo.
   - Al acercar el cursor (o el cursor de teclado) a 24 px del borde, la vista se desplaza sola.
   - Intro cierra la región aunque el último punto esté fuera de la extensión anterior.
   - El **ajuste a aristas** permite apoyar un vértice sobre una arista existente, insertando el vértice compartido en
     la región vecina, para que dos estratos compartan su límite sin hueco ni solape.
   - **Test:** dibujar bajo un talud existente un estrato que comparta la base, y que `validateLocal` y el motor lo
     acepten.
2. **Herramienta «Dividir región»** (atajo `D`), que es como se modela en Slide:
   - se traza una polilínea que **entra y sale** del borde de una región;
   - al cerrar con Intro o con un clic en el borde, la región se divide en dos con vértices compartidos y en **un solo
     paso deshacible**;
   - la región nueva recibe el material seleccionado o un material nuevo, y se anuncia el resultado;
   - **validación:** la línea debe cruzar la región, no puede autointersecarse y ambas partes deben tener área no nula.
     Si no se cumple, se muestra un mensaje accionable;
   - funciona con ratón, teclado (el mismo cursor que «Dibujar región») y toque;
   - **tests** con lógica pura (`splitRegion`) sobre casos: horizontal, inclinada, que pasa por un vértice, inválida,
     y región cóncava.
3. **«Talud simple…» con dos estratos:**
   - opción «Estrato inferior», con material 2 y la cota del contacto (horizontal), o la profundidad bajo el pie;
   - genera dos regiones con el contacto compartido y valida que el contacto quede dentro del modelo;
   - **test con el motor:** H=15, pendiente 1,5H:1V, arcilla (c=25, φ=20, γ=18) sobre roca (c=200, φ=40, γ=24), con
     el contacto 5 m bajo el pie y la piezométrica en el pie. Debe calcular con FS finito en Bishop y Spencer, y la
     superficie crítica no debe entrar en la roca de forma absurda: anota en el resumen la profundidad mínima de la
     superficie.
4. **Panel Geometría:** botón «Dividir región…» que activa la herramienta. En la lista, cada región muestra su
   material con su muestra de color.
5. **Chrome:**
   - repite **T2 de X9** de punta a punta: talud de 15 m a 1,5H:1V con arcilla sobre roca y piezométrica, calcular y leer
     el FS. Hazlo una vez con «Talud simple…» con estrato inferior y otra con «Dividir región»;
   - dibuja un estrato bajo la base con «Dibujar región» y el ajuste a aristas;
   - axe en claro y oscuro.

---

## U4-P: pulido (worktree `u4p`, rama `u4p-pulido`)

**Archivos tuyos:**
- `src/io/ogsJson.ts` (solo la posición del error JSON) y `src/editor/panels/{MaterialsPanel.tsx,LoadsPanel.tsx,forms.ts}`;
- `src/editor/app/{ResultSummary.tsx,resultSummary.ts,notices.ts}` y el componente de avisos, si vive en
  `src/editor/app/`;
- `src/ui/**`, salvo `ConfirmDialog`;
- `src/styles/tokens.css`, **solo** los tokens de dovelas en la leyenda;
- `src/App.tsx`, solo el listado de ejemplos y sus títulos;
- `src/pwa/**`, solo los tests de instalación;
- los tests de todo lo anterior.

**Tareas:**
1. **UX-13, posición del error JSON:**
   - V8 ya no incluye «position N». Para Node 22, compruébalo con
     `node -e 'try{JSON.parse("{\n\"a\": x}")}catch(e){console.log(e.message)}'`;
   - calcula la línea y la columna con un escáner propio del punto de fallo, por ejemplo una pasada que valida la
     sintaxis JSON y devuelve el desplazamiento del primer token inválido. Usa el mensaje del motor de JS solo como
     `detail`;
   - **tests** con coma final, comilla faltante, token inválido, llave sin cerrar y archivo vacío. Cada uno lleva la
     línea y la columna correctas.
2. **UX9-02, formulario de material nuevo:** queda dentro de un `fieldset` con la leyenda «Nuevo material». Los nombres
   accesibles son únicos («Nuevo material: nombre», …), y el foco va al primer campo al pulsar «Nuevo material…».
   **Test:** no hay dos controles con el mismo nombre accesible en el panel.
3. **UX9-03, cargas:**
   - el formulario muestra el **rango x de la corona y de la superficie del terreno**, calculado de la geometría;
   - un botón «Usar la corona» rellena x1 y x2;
   - la validación avisa si la carga queda fuera del terreno.
4. **UX9-04, títulos de los ejemplos:** son nombres en español para mostrar, por ejemplo «ACADS 1(a): talud homogéneo
   seco», definidos en una tabla `exampleTitles` con el id del caso y, entre paréntesis, la fuente. **Sin cambiar** los
   archivos de los casos ni sus ids.
5. **UX9-05:** `ResultSummary` lleva el botón «Ver tabla de resultados», que desplaza y enfoca la tabla completa. Se
   muestra el FS **siempre con 3 decimales**: el resumen mostraba «1,2» para Spencer; corrígelo y agrega un test.
6. **UX9-06:**
   - los errores repetidos se deduplican y se muestra un contador;
   - botón «Cerrar todos»;
   - los errores no se cierran solos, pero el conjunto tiene un máximo visible con «ver más».
7. **UX9-07:** mide en oscuro el contraste de la muestra «Dovelas» de la leyenda y del trazo de dovelas. Si queda bajo
   3:1, ajusta su token y agrega el par a `tokens.contrast.test.ts`.
8. **UX9-08:** identifica los dos controles de 13 px (por ejemplo, con un script de Playwright que liste los elementos
   interactivos de menos de 24 px) y súbelos a 24 px o más. Si están en el lienzo, que es de U4-M, repórtalo sin tocarlo.
9. **UX-19:** test de «Instalar app» con un `beforeinstallprompt` simulado (`dispatchEvent` de un `Event` con
   `prompt()` y `userChoice` falsos) en Chrome: el botón aparece, `prompt()` se llama y el botón se oculta.
