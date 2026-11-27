# Brief F3B-R15, ola 3: documentación con cifras finales y pulido de la web

Responde en **español neutro, sin voseo**. Las dos olas de correcciones de R15 están integradas en `f3b-integracion`,
desde el commit `00129e7` en adelante. Esta ola deja la documentación y la web listas para la revisión de cierre y la
release v0.5.0.

**Cifras medidas** por el coordinador en `622c538` más `00129e7`, en
`$TMPDIR/f3b-coord/gates-r15.log` y `$TMPDIR/f3b-coord/r15/arbitraje.md`:

- `ogs-core`: 778 pasan y 2 ignorados, normal y con `parallel`. `ogs-cli`: 8 tests.
- Aceptación: **347 checks, 0 fallas, en 167 casos**. cSlope reproduce 346 de 347; la falla es V027, que no converge.
- `pytest verification`: **1549 pasan, 1 omitido**.
- Wheel `ogs-py`: **370 pasan, 2 omitidos**.
- Web: **3703 pasan y 320 omitidas** sin `OGS_BIN`, y **4023/4023** con él. `identity.f3b.mjs` da todo IGUAL contra
  el tag `v0.4.0`.
- Identidad del motor: **0 diferencias en 180 modelos**, con **17** modelos v0.6 aparte y 23 con agua idénticos.
- Diferencial: 3a 71/71; v0.4 12/12; v0.5 58 OK y 2 explicados; búsqueda y fija 28/28 cada una; **F3B 41 OK, 1
  explicado (E16t) y 0 FALLA de 42**.
  - **HB-06 Bishop en búsqueda** dejó de ser «explicado (§4.2: m_α)» y pasa a OK: 0,5244 frente a 0,5279 de cSlope. La
    causa del 0,5373 anterior era el arranque del lazo (E16w), no solo el m_α del círculo de cSlope.
  - El veredicto m_α sigue en `run.py`, con la cota 1,05 de E16z.
- Ejemplos de la documentación: 14 ejemplos y 102 fragmentos OK.

**Cambios del motor que hay que documentar**, enmiendas **E16v a E16z** de `briefs/05_CONTRATOS_FASE3B.md`:
- **E16v, contacto entre materiales con Hoek-Brown o SHANSEP:** se compara la resistencia real. Antes ganaba siempre
  el material nuevo, aunque fuera el más resistente; por ejemplo, 18,04 frente a 1,234.
- **E16w, lazo de Hoek-Brown:**
  - arranque `max(0, ·)`, así que `X28-R-SB-RU03` ahora converge: Bishop 0,886886, Spencer y M-P 0,943003, Janbu
    simplificado 0,727964 y Janbu corregido 0,761333, todos bajo cSlope;
  - `fos` null con `hoek_brown_not_converged`, y la nota de bajo confinamiento se conserva;
  - Newton salvaguardado: la búsqueda Bishop de F3B-HB-01 baja de 8,16 a 1,79 s en serie y de 0,52 a 0,13 s con
    `parallel`; F3B-HB-02, de 5,33 a 1,18 s;
  - la fila SB/Bishop del producto está en +0,001024 %, así que donde diga «≤ 0,001 %» debe decir «≤ 0,0011 %».
- **E16x, búsqueda no circular:**
  - los extremos de la conversión salen del tramo analizado, así que los 16 taludes homogéneos refinan, contra 2 de 16
    antes;
  - holgura de ventanas `max(tol, 1e-6·ancho)`;
  - tolerancias con escala;
  - nota informativa `non_circular_not_refined`;
  - costo de 2,3 a 3,1 veces el circular (V001 2,3×, V034a 2,4×, V036a 3,1×);
  - el banco con capa débil queda +2,87 % sobre cSlope, explicado porque cSlope no converge.
- **E16y, caras y SHANSEP:**
  - caras HB/SHANSEP con el peso del agua embalsada; la capacidad de cara seca y sumergida coincide a 6e-16;
  - el FS de equilibrio límite no es invariante (+0,15 %, también con Mohr-Coulomb no drenado);
  - el aviso de corte entre dovelas puede seguir en el caso sumergido, por X = λ·f·E con E total;
  - POP sin cociente;
  - `InvalidModel` si Su no es finita.
- **E16z, verificación y esquema:** veredicto m_α con cota 1,05; lista única de notas informativas; `null` en
  `non_circular.seeds` y `max_vertices`.
- **Web (R15B):**
  - borradores de material que bloquean calcular y exportar;
  - Casos sin Bishop con `non_circular`;
  - «Superficie crítica» y resumen no circular en la tabla;
  - avisos combinados de rama con tracción;
  - avisos del PDF por (código, ruta) y en las unidades activas. **Cambio deliberado frente a v0.4:** dos materiales con
    γsat < γ dan dos avisos en el PDF, no uno;
  - nota SHANSEP y sismo en el PDF;
  - cronómetro y «Cancelar» en Casos.
- **Python y CLI:** el wheel prueba y documenta la v0.6; `ogs bench --method all` omite Bishop con `non_circular`;
  `--help` documenta `strength` y `search.non_circular`.

## D-R15: documentación (Sonnet)

**Archivos tuyos:**
- `README.md`
- `docs/formato-ogs-json.md`, `docs/limitaciones.md` y `docs/verificacion.md`
- `verification/pending/F3B/INDEX.md`, solo el texto de cabecera y los conteos
- `CHANGELOG.md`: sección «Sin publicar» o «0.5.0 (sin publicar)», con el precedente de las entradas anteriores
- `docs/tools/validar_ejemplos.py`, solo si un ejemplo nuevo lo exige

**Tareas:**
1. **R15B-15:** unifica los conteos.
   - Retenidos: cuenta los checks y casos reales de `verification/pending/**/HOLD.json` y de los índices, incluido
     **V009c**.
   - 167 casos y 17 modelos v0.6 saltados, no 18.
   - Las cifras de pruebas de arriba.
2. **Cambios del motor E16v a E16z:**
   - en `formato-ogs-json.md`: la nota nueva, `null`, el error de finitud con su texto exacto, el contacto y las caras;
   - en `limitaciones.md`:
     - reescribe lo de RU03, que ahora converge, con sus cifras;
     - reescribe HB-06 y §4.2, que ya no se aplica a HB-06; deja la regla general si sigue siendo cierta;
     - el costo nuevo de Hoek-Brown;
     - la búsqueda no circular con sus casos;
     - la curvatura convexa acumulada (R15A-08a, la regla de cSlope por vértice);
     - los (c, φ) reportados, que son los de la última pasada, con un desfase de ~0,1 % frente a la tangente en σ′n
       por el promedio w = 0,5 (R15A-07);
     - el FS que acompaña a Bishop `invalid`, que no es válido;
     - Arquímedes y el aviso sumergido;
   - en `verificacion.md`: las cifras, las filas de R15 y el bloque F3B 41 + 1.
3. **CHANGELOG:** una entrada completa de la 0.5.0 (formato v0.6), con todo lo de F3B: B0 a B2, R15 y los cambios de
   web, Python y CLI. Usa las líneas que propusieron los escritores en `$TMPDIR/f3b-coord/escritores.jsonl` y en los
   informes citados en `arbitraje.md`. Sin fecha de publicación.
4. **Comprobación:**
   - `validar_ejemplos.py --ogs $CARGO_TARGET_DIR/release/ogs` en verde;
   - los tests que leen la documentación: `rg -n "docs/|README|CHANGELOG" verification/tools apps/web/src crates --glob "*test*"`;
   - que no quede ninguna cifra vieja: busca 327, 151, 1542, 3942, «40/42», «40 OK», «18 modelos», «0,86 s» y «36 s».

## W-R15c: pulido de la web (Antigravity)

**Archivos tuyos:**
- `apps/web/src/ui/Legend.tsx`
- `apps/web/src/editor/app/ResultSummary.tsx`
- `apps/web/src/editor/EditorApp.tsx`, solo la cabecera y el estado de borrador
- `apps/web/src/editor/panels/panels.css`
- tests nuevos `*.r15c.test.ts(x)`

**Tareas:**
1. **Leyenda:** la polilínea crítica de una búsqueda no circular se rotula «Superficie crítica (polilínea)», no
   «Superficie fija (polilínea)».
2. **FS desactualizados:** mientras haya un borrador sin aplicar, el resumen marca los FS del cálculo anterior como
   desactualizados, de forma visible y accesible (por ejemplo, atenuados y con el texto «calculado antes de los cambios
   sin aplicar»).
3. **Cabecera:** no debe decir «sin cambios pendientes» al lado de un borrador sin aplicar. Distingue el estado del
   archivo del de los borradores.
4. **Alerta de Ito-Matsui:** ocupa el ancho completo (`.ep-wide`).
5. **Medición:** el tiempo real de una búsqueda Hoek-Brown con 4 métodos en Chrome con WASM, el caso de 36 s de R15-B
   (`$TMPDIR/r15w-a/tmp_hb_4m.ogs.json`), ahora con el Newton de E16w. Cita la cifra en el informe.
6. **Chrome:** `vite preview --port 5190`, en claro y en oscuro.
   - Consola sin errores y red sin respuestas ≥ 400.
   - Capturas en `$TMPDIR/r15w-c/`. Describe lo que ves en cada una.

## Para los dos

- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `export CARGO_TARGET_DIR=$TMPDIR/<r15d|r15w-c>-target`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Gates de la web** (W-R15c): `pnpm test`, `OGS_BIN=… pnpm test`, `tsc --noEmit`, `pnpm build` e `identity.f3b.mjs`.
- **Commits** por partes, con rutas explícitas. Sin push, sin tags y sin merge. **No subas versiones.**
