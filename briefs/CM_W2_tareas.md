# CM-W2 · Lo que encontró la prueba a ciegas de los 5 minutos

Base: `cm-integracion`, con W1 integrada: 279 archivos y 4750 tests, y la regresión con 51 guiones, OK=1302 y FAIL=0.
Las reglas comunes son las de `briefs/CM_W1_tareas.md` (puertas, Chrome, commits, cuándo parar e informe). Los commits
llevan el mensaje `CM-W2: …`.

**La prueba a ciegas** (D4 de `docs/cm/PLAN_CM.md`) la hicieron tres agentes Haiku, cada uno con un navegador limpio y
solo la URL. Los tres resolvieron su tarea sin ayuda externa:

| Tarea | FS | Estimación del agente para una persona |
|---|---:|---|
| T1: abrir V001 | 1,401 | 30-45 s |
| T2: talud simple | 1,570 | 3-5 min |
| T3: importar un DXF | 1,567 | 60-90 s |

Los registros completos están en
`~/.hermes/profiles/open-geoslide/cache/delegation/live/deleg_c2d4ab30/task-{0,1,2}.log`.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **CM-W2** | `opengeoslide-wt/cm-w2` / `cm-w2` | 5185 | `apps/web/src/editor/app/ResultSummary.tsx`, `resultSummary.ts`, `ImportDialogs.tsx`, `importPlan.ts`, `applyImport.ts`, `newModel.ts` y `EditorApp.tsx`, `apps/web/src/onboarding/tour.ts` y `GuidedTour.tsx`, y sus tests y guiones e2e |

No toques `io/**`, `engine/**`, `editor/state/**`, `editor/panels/**`, `report/**`, `App.tsx`, `shellModel.ts`,
`issueNav.ts` ni `helpContent.ts`: otra rama (CM-C1W) los cambió para la búsqueda global y se integra después. Si
necesitas uno de esos archivos, deja el diff en el informe.

## Qué hacer

1. **El resumen dice qué método rige.** Hoy el HUD dice «FS mín. 1,401», y los tres agentes tuvieron que leer otro texto
   para saber de qué método era.
   - El chip y la píldora del HUD pasan a «FS mín. 1,401 · Morgenstern-Price», o con la abreviatura de la tabla de
     resultados si no cabe.
   - Si dos métodos empatan al mostrar tres decimales, se nombran los dos.
   - El nombre accesible de la píldora lleva el método.
   - **Comprobación:** que entre a 320 px de ancho, con el barrido de CM-WB (`$TMPDIR/cm-wb/sweep/`, 0 controles
     cruzados) y `hudFit`. Si no entra, el método va en la línea de abajo del HUD, no en el chip.
   - **Tests:** de `resultSummary`.
2. **Importar sobre el modelo de arranque crea un modelo nuevo.** En T3, el destino «Reemplazar» (CM-WC) cambió las
   regiones, pero dejó del ejemplo ACADS 1(a):
   - el título;
   - un material «Soil» sin uso, con lo que quedaron 4 materiales;
   - el agua, la búsqueda (ventanas de entrada y salida) y el análisis.

   El agente no supo qué modelo había calculado.

   **Regla nueva:** si el documento es el modelo de arranque sin cambios (`docEpoch === 0 && revision === 0`, como en
   CM-WC), importar DXF o CSV de regiones con «Reemplazar» parte de un documento nuevo, el de «Nuevo» (`newDoc`):
   - las regiones y los materiales son los de la importación;
   - el título sale del nombre del archivo, sin la extensión;
   - la búsqueda y el análisis son los de un documento nuevo, con ventanas calculadas para la geometría importada, igual
     que «Nuevo» y la regla de `newModel.ts`. Si hoy no hay una regla de ventanas para una geometría cualquiera, usa la
     que aplica el motor cuando faltan `entry` y `exit` (todo el ancho), y anótalo;
   - el agua queda vacía, salvo que el CSV traiga la piezométrica.

   En un documento con cambios, «Reemplazar» sigue como hoy: cambia solo las regiones. El texto del diálogo lo dice:
   - con el modelo de arranque: «Reemplazar: crea un modelo nuevo con este archivo»;
   - en otro caso: «Reemplazar las regiones actuales (se conservan materiales, agua y análisis)».

   Los guiones que leen el texto actual («Reemplazar las regiones actuales») deben seguir pasando: búscalos con `grep` y
   actualízalos en tu rama si hace falta.

   **Tests:** el documento que resulta de importar `terraplen.dxf` sobre el arranque (título, materiales, sin agua,
   búsqueda nueva) y el de importar sobre un documento con cambios (sin cambio de comportamiento).
3. **La base de una polilínea abierta del DXF se explica.** En T3, el diálogo propuso «Cerrar con base horizontal,
   y = 24» sin decir qué es ese 24, y se creó una región TERRENO de 20 m² sin aviso. Que el diálogo diga de dónde sale
   la cota, por ejemplo «la cota mínima del dibujo», y el área que tendrá la región cerrada, en m² o en las unidades del
   modelo. Cambia solo el texto y la explicación; la regla de cierre no se toca.
4. **«Omitir» en la guía de primera visita.** El agente de T1 dice que pulsar «Omitir» en el paso 2 lo devolvió al paso
   1 y que necesitó un clic extra para cerrarla. Reprodúcelo en Chrome con un contexto limpio, en 1440 × 900 y en
   390 × 844, pulsando «Omitir» en cada paso:
   - si se reproduce, corrígelo y escribe el test;
   - si no, anota el guion con el que lo probaste y si el agente pudo haber pulsado «Anterior» por la posición de los
     botones. Si «Omitir» y «Anterior» quedan muy juntos, sepáralos o cambia su peso visual.
5. **Comprobación:**
   - `docs/cm/exploracion/X35_proto/t1_ejemplo.cjs`, `t2_talud_simple.cjs`, `t3_dxf.cjs` y `OGS_T3=defecto t3_dxf.cjs`,
     con la tabla antes y después. Ninguna tarea puede tener más acciones;
   - los guiones `u3o-e2e`, `u3i-e2e`, `u5s-e2e`, `u4p-e2e/*` y `docs/suite-a/e2e/aceptacion_ua.mjs` (con `OGS_Q`), con
     0 FAIL;
   - capturas del HUD con el método a 1440 × 900, 390 × 844 y 320 × 568, y del diálogo de DXF con la explicación de la
     base.
