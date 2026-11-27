# Brief F3B-R15, segunda ola: web, informe, Python y CLI tras la lente B

Responde en **español neutro, sin voseo**. La lente B de R15 revisó cómo se propagan Hoek-Brown, SHANSEP y la búsqueda
no circular (formato v0.6) a la web, el PDF, el CSV, Python y la CLI. Su veredicto fue **no apto**, con 16 hallazgos.

El coordinador reprodujo los principales. La lista está en
`/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/r15-B/R15_B.md`; los scripts y las sondas de B están en
`$TMPDIR/r15-B/` (`e2e_r15b.py`, `probe_web.mjs` y `check_true_v040_identity.mjs`).

**Reglas comunes:** `briefs/F3B_B1_comun.md`, con la tabla de dueños de abajo.
**Contrato:** `briefs/05_CONTRATOS_FASE3B.md`, en especial F6.5, F6.6, F6.7, F6.13 y E16v a E16z.

La ola de motor R15-M1 a M3 corre en paralelo y solo toca `crates/ogs-core`, `schema/` y `verification/`. Tú no toques
esas carpetas. La nota nueva `non_circular_not_refined` (E16x) ya tiene nombre fijo, así que puedes darle texto en la
web aunque el motor todavía no la emita.

**No subas versiones.** El paso a 0.5.0 de crates y paquetes lo hace el coordinador en el corte de la release.

## W-R15a: editor y Casos (Antigravity)

**Archivos tuyos:**
- `apps/web/src/App.tsx`
- `apps/web/src/editor/panels/{MaterialsPanel,SearchPanel,AnalysisPanel,ReinforcementsPanel}.tsx` y `forms.ts`
- `apps/web/src/editor/state/validateLocal.ts`
- `apps/web/src/editor/app/{issueNav,ResultSummary,useEngineCheck}.ts(x)`
- `apps/web/src/editor/EditorApp.tsx`, solo para el bloqueo por borradores
- `apps/web/src/ui/ResultsTable.tsx`
- `apps/web/src/engine/validate.ts`
- tests nuevos `*.r15.test.ts(x)`

**Tareas:**
1. **R15B-01 (crítica): borradores de materiales.**
   - `MaterialCard` muestra el mismo aviso que `ReinforcementCard` («Hay cambios de esta tarjeta sin aplicar al
     modelo…»).
   - Mientras haya un borrador sin aplicar en cualquier tarjeta, «Comprobar» y las exportaciones (PDF y CSV) quedan
     deshabilitados, con el motivo visible y accesible. Lo mismo vale para una tabla `ocr_by_elevation` inválida.
   - Haz un test de que no se puede calcular con el material anterior mientras la tarjeta muestra otro.
2. **R15B-02: Casos.**
   - `bishopBlocked` también es verdadero con `analysis.search.non_circular`, con su motivo (F6.4).
   - `describeAnalysis` menciona la búsqueda no circular.
   - Haz un test de que los 15 casos `-nc` y los no circulares promovidos calculan sin error con la selección por
     defecto.
3. **R15B-08: tabla de resultados.**
   - Rótulo «Superficie crítica» cuando hay `search`, como el PDF (`report/content.ts:728`).
   - Resumen de las pasadas de Hoek-Brown y de la búsqueda no circular: semillas, evaluadas, `seed_fos` y
     `polyline_fos`.
4. **R15B-09: `validateLocal`.** Usa `(methods ?? ['bishop']).includes('bishop')` para `non_circular`, como en la
   polilínea fija, y haz un test de paridad con la CLI.
5. **R15B-10: combinaciones F6.5 en los paneles.**
   - Con un material Hoek-Brown o SHANSEP, al activar la grieta la profundidad inicial es numérica, no `auto`, con una
     nota en línea.
   - Ito-Matsui con esos materiales y `non_circular` con Bishop muestran una nota en línea en su panel, no solo en
     Diagnósticos.
6. **R15B-11: cálculos largos.**
   - Un contador de segundos transcurridos y el método en curso, si el worker lo informa; si no, solo el contador.
   - Un botón «Cancelar» en Casos (`AbortController`, como en el Editor).
7. **R15B-16: navegación y validación.**
   - Los campos v0.6 en `MATERIAL_FIELDS` y `SEARCH_FIELDS` de `issueNav.ts`.
   - `path` y `onReset` en los controles de OCR, POP, la tabla y `non_circular`.
   - Etiquetas en español en `forms.ts:485`, en lugar de `disturbance` o `ratio`.
   - `isAnalysisReport` valida `strength` y `search.non_circular`.
8. **Chrome.** Regresión con el motor WASM real en `vite preview --port 5189`, en claro y en oscuro, de cada arreglo
   1 a 7.
   - Consola sin errores y red sin respuestas ≥ 400.
   - Capturas en `$TMPDIR/r15w-a/`. Inspecciónalas y describe en el informe lo que se ve en cada una.

## W-R15b: avisos, Ayuda, informe e identidad (Sonnet)

**Archivos tuyos:**
- `apps/web/src/engine/warnings.ts`
- `apps/web/src/onboarding/helpContent.ts` y `apps/web/src/ui/HelpDialog.tsx`
- `apps/web/src/report/{content,pdf,methodInfo}.ts` y `apps/web/src/report/identity.f3b.mjs`
- `apps/web/src/report/{pdf,content}.f3b.test.ts`
- `apps/web/src/editor/state/geotech.ts`
- tests nuevos `*.r15.test.ts`

**Tareas:**
1. **R15B-03: el riesgo de rama de tracción (V002, E16u).**
   - Cuando un resultado trae a la vez `negative_lambda` y `negative_effective_normal_major`, sobre todo si viene de la
     búsqueda no circular, la web y el PDF muestran un aviso combinado: el FS puede venir de una rama con tracción y
     quedar bajo el real; compárelo con Janbu y revise λ y N′.
   - La Ayuda no sugiere Bishop cuando no aplica.
   - Es un aviso de la interfaz, derivado; el motor no cambia.
2. **R15B-05: avisos del PDF.**
   - Deduplicar los avisos geotécnicos por `(code, path)`.
   - El texto de `editor.hoek_brown_ucs` usa las unidades activas: kPa/MPa en SI, psf/psi en imperial.
3. **R15B-12: SHANSEP y sismo.** Nota de convención en el bloque SHANSEP del PDF: `Su = S·σ′v·OCR^m` con σ′v
   estático, sin término sísmico (E16o).
4. **R15B-04, parte web.** Para un modelo Hoek-Brown sin FS (`m_alpha`, `no_admissible_root` o
   `hoek_brown_not_converged`, junto con `hoek_brown_low_confinement`), el texto orienta hacia la presión de poros alta
   o la tracción en Hoek-Brown, no solo hacia los rangos de búsqueda.
5. **Nota nueva `non_circular_not_refined`** (E16x): texto informativo en `warnings.ts`, en la Ayuda y en el PDF, y entra
   en las listas de notas informativas de la web.
6. **R15B-14 y R15C-03: identidad.**
   - `identity.f3b.mjs` compara por defecto contra el tag `v0.4.0` real; `BASE_REF` es parametrizable.
   - Ejecuta `openOgsJson` y `buildReportInput` en los dos árboles, con avisos y chequeos reales.
   - Amplía la muestra a grieta, refuerzos, Ito-Matsui, agua embalsada y polilínea fija; toma los cinco de
     `$TMPDIR/r15-B/check_true_v040_identity.mjs`.
   - Renombra los tests de `pdf.f3b.test.ts` y `content.f3b.test.ts` a «ausente y null dan el mismo PDF».
7. **Comprobación.** `node src/report/identity.f3b.mjs` debe salir con exit 0 y todo IGUAL contra `v0.4.0`. Cita la
   salida.

## P-R15: Python y CLI (Sonnet)

**Archivos tuyos:**
- `crates/ogs-py/tests/*`, `crates/ogs-py/python/opengeoslide/__init__.py` y `crates/ogs-py/README.md`
- `crates/ogs-cli/src/{main.rs,bench.rs}` y los tests de `crates/ogs-cli`

**Tareas:**
1. **R15B-06: Python.**
   - Reemplaza `test_v06_reaches_hoek_brown_stub` por pruebas reales de Hoek-Brown, SHANSEP, búsqueda no circular,
     las combinaciones F6.5, `strength` y `search.non_circular`.
   - Documenta la v0.6 en `__init__.py` y en el README del paquete.
   - Compila el wheel con `maturin build --release`, en un venv del scratch, y corre `pytest crates/ogs-py/tests` con
     0 fallas. Cita la salida.
2. **R15B-13: CLI.**
   - `ogs bench --method all` omite Bishop cuando el modelo trae `non_circular`, igual que con la polilínea fija si ya
     lo hace; si no, sigue el mismo criterio y anótalo.
   - `USAGE` documenta las salidas v0.6: `strength` con `passes`, `normal_stress`, `vertical_stress` y `ocr`, y
     `search.non_circular`.
   - Haz un test.

## Para los tres

- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`
  - `export CARGO_TARGET_DIR=$TMPDIR/<r15w-a|r15w-b|r15p>-target`
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Gates de la web:**
  - `pnpm test` y `OGS_BIN=$CARGO_TARGET_DIR/release/ogs pnpm test`, con 0 fallas;
  - `pnpm exec tsc --noEmit` y `pnpm build`;
  - `identity.f3b.mjs` en verde.
- **Gates de Python y CLI:**
  - `cargo clippy -p ogs-cli --all-targets -- -D warnings`;
  - los tests de `ogs-cli`;
  - el pytest del wheel.
- **Commits** por partes, con rutas explícitas. Sin push, sin tags y sin merge. Commitea apenas cierres cada tarea.
- **Paradas:** detente solo ante una contradicción que cambie la física o el formato. Ante cuestiones de forma con
  precedente, sigue el precedente y anótalo.
