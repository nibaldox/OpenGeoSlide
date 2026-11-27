# Brief F3B-B2a: promoción de casos, correcciones de B1 y regresión en Chrome

Responde en **español neutro, sin voseo**. Eres el escritor B2a del bloque F3B de OpenGeoSlide: Hoek-Brown, SHANSEP y
búsqueda no circular, formato v0.6, que saldrá como release v0.5.0. En paralelo, otro escritor (B2b) actualiza la
documentación en `docs/`. Tú no tocas `docs/` ni `CHANGELOG.md`; propón en tu informe las líneas que correspondan.

## Punto de partida

- Rama de integración `f3b-integracion` en `df2dfd7`. Ya están integradas las seis tareas de B1: M-HB, M-NC, M-SH, V,
  W1 y W2.
- **Contrato:** `briefs/05_CONTRATOS_FASE3B.md`, de F6.1 a F6.14, con las enmiendas E16a a E16u.
- **Reglas comunes:** `briefs/F3B_B1_comun.md`, con los dueños de archivo, el entorno, los gates y el formato del
  informe. Valen para ti, con la tabla de dueños de abajo.
- **Gates del coordinador en `df2dfd7`:**
  - motor: fmt y clippy OK; 759 tests pasan y 2 se ignoran, en modo normal y con `parallel`; 327 checks de aceptación;
  - Python: pytest de `verification` 1539 OK;
  - identidad: 0 diferencias en 180 modelos;
  - diferencial: 3a 71/71, v0.4 12/12, v0.5 58 OK y 2 explicados, F3B 40 OK y 2 explicados, 0 fallas;
  - web: 3575 tests, y 3864 con `OGS_BIN`.
  - Logs: `$TMPDIR/f3b-coord/gates-b1d.log` y `$TMPDIR/f3b-coord/diff-f3b2/REPORT.md`.

## Archivos tuyos

- `verification/cases/` (casos promovidos e `INDEX.md`), `verification/pending/F3B/` (`INDEX.md` y `HOLD.json`) y
  `verification/REPORT.md`, regenerado.
- `verification/tools/import_cslope.py` y su test, solo si la promoción lo exige.
- `crates/ogs-core/tests/acceptance.rs`, solo si la cuenta de checks está fijada en el código. `crates/ogs-core/src/lib.rs`,
  **solo los comentarios** de LIB-1.
- En la web, exactamente estos: `apps/web/src/editor/panels/MaterialsPanel.tsx`, `apps/web/src/editor/state/units.f3b.test.ts`,
  `apps/web/src/report/hoekBrown.ts` y los archivos de `apps/web/src/report/` que lo importan, más la lista de casos de la
  web si la promoción la exige (precedente: `ae3af9d`).
- Tests nuevos `*.f3b.test.ts` o `tests/f3b_*.rs` para lo que corrijas.

No toques el resto de `crates/ogs-core/src/`, los esquemas, `package.json`, `pnpm-lock.yaml`, `docs/` ni `CHANGELOG.md`.
Si hace falta cambiar otro archivo, propón el diff en el informe.

## Tareas

### 1. Promover `verification/pending/F3B` a `verification/cases`

Hay 18 casos y 22 checks. El coordinador ya los midió con el motor integrado (`$TMPDIR/f3b-coord/pending_f3b_probe.txt`):
**21 de 22 quedan dentro de su tolerancia relativa.** El único fuera es **V002, con Spencer en búsqueda**: ogs da 0,3864,
el publicado es 0,414 ± 2,12 % (−6,66 %), y aparecen las notas `negative_lambda` y `negative_effective_normal_major`.
Es la limitación conocida de E16u.

- Promueve los checks que se reproducen, siguiendo el precedente de F3G y F3I (`git log --oneline --grep=promov`,
  `96f5501` y `ae3af9d`, con la opción `--promote-*` de `import_cslope.py`).
- Pon **V002 en `HOLD.json`** con su diagnóstico y sus cifras, citando E16u y la evidencia
  `docs/fase3/exploracion/X29_proto/v002_raices_coordinador.json`. No cambies tolerancias, publicados ni modelos.
- Regenera `verification/REPORT.md` con el harness. La aceptación debe quedar en **327 + N checks y 0 fallas**. Informa
  N con su lista.
- Si un caso promovido rompe algo en la web (el índice de Casos, la versión 0.6, los títulos), corrígelo según el
  precedente `ae3af9d`.

### 2. Corregir los hallazgos de B1

Están en `$TMPDIR/f3b-coord/hallazgos_coordinador.md`:
- **W1-UX-1.** mb, s y a se muestran con 4 cifras significativas, y s en notación científica (7,128·10⁻⁴). Respeta el
  separador decimal de la web.
- **W1-UX-2.** La nota de rangos del panel de materiales incluye Hoek-Brown (GSI en [0, 100], D en [0, 1], mi > 0,
  σci > 0) y SHANSEP (ratio > 0, exponent en [0, 1], exactamente una fuente de OCR, OCR ≥ 1, pop ≥ 0). Toma las cifras
  de `crates/ogs-core/src/strength.rs`, no las inventes.
- **W1-UX-3.** La tabla de OCR por cota es una tabla compacta de dos columnas (Cota, OCR) con «Quitar» por fila. Debe
  ser accesible con teclado y lector de pantalla: `<table>` o una grilla con etiquetas.
- **W1-T1.** El test «el FS v0.6 se conserva entre SI e imperial» de `units.f3b.test.ts` tiene un modelo inválido.
  - Arma un modelo v0.6 válido a partir de `crates/ogs-core/tests/data/f3b/hb/` (SA) y de los de `sh/`, con
    materiales Hoek-Brown y SHANSEP que la superficie atraviese.
  - Quita la condición `OGS_F3B_PHYSICS`: el motor ya tiene la física. El test corre siempre que haya `OGS_BIN`.
  - Comprueba |ΔFS| ≤ 1e-9 en cada método, o la tolerancia que ya usen los otros tests de unidades, si es más
    holgada; en ese caso, cita cuál.
- **W2-HB.** Unifica `apps/web/src/report/hoekBrown.ts` con la calculadora de W1, `apps/web/src/editor/state/hoekBrown.ts`:
  el informe debe importar la de W1. Prueba la paridad y deja la identidad del PDF v0.5 intacta con
  `src/report/identity.f3b.mjs`, cuyo comando está en su cabecera.
- **LIB-1.** Actualiza en `lib.rs` los comentarios de los ganchos de B0 que todavía dicen `todo!("F3B-…")`. Es solo
  texto: el binario no puede cambiar. Compruébalo con la identidad.
- **M-HB-PERF, solo medir.** Mide las pasadas promedio del lazo de Hoek-Brown por candidato en la búsqueda Bishop de SA
  y SB, y el tiempo frente a Mohr-Coulomb. **No cambies el motor.** Propón en el informe, con números, si un arranque en
  caliente desde el candidato vecino valdría la pena.

### 3. Regresión completa en Chrome, con el motor WASM real

Usa `vite preview` en el puerto **5183**, nunca 5180 ni 5181. Recorre en claro y en oscuro:
1. **Hoek-Brown:** crea un modelo con un material Hoek-Brown, con la calculadora de mb, s y a y el aviso de σci.
   Calcula con Bishop y Spencer y revisa el FS, el lienzo, la tabla, Diagnósticos (pasadas del lazo, nota F6.8), el PDF
   y los dos CSV (resultados y dovelas).
2. **SHANSEP:** haz lo mismo con POP y con OCR por cota.
3. **Búsqueda no circular:** actívala con Spencer. Revisa que la polilínea crítica se dibuje con sus vértices, que
   aparezcan las estadísticas `non_circular`, que Bishop quede deshabilitado con su motivo y, si hay un caso que la
   emita, la nota `non_circular_large_change`.
4. **Guardar y reabrir** un archivo v0.6. Abre un modelo v0.5 de `examples/` y comprueba que sigue en 0.5 y da lo mismo
   que antes.
5. **Imperial:** convierte el modelo Hoek-Brown a imperial y comprueba que el FS no cambia.
6. **Teclado:** recorre con Tab los formularios nuevos.

Exige consola sin errores y red sin respuestas ≥ 400. Deja capturas en `$TMPDIR/f3b2a/` e inspecciónalas tú mismo. En
el informe, describe lo que viste en cada una, sin limitarte a listarlas.

### 4. Gates

Corre todos los gates de `F3B_B1_comun.md` y, además:
- la batería diferencial completa:
  `uv run ... verification/differential/run.py --ogs $CARGO_TARGET_DIR/release/ogs --out $TMPDIR/f3b2a/diff --require-f3 --require-f3r --require-f3g --require-f3b`,
  que debe salir con exit 0;
- `OGS_BIN=$CARGO_TARGET_DIR/release/ogs pnpm test`, con 0 fallas y ningún test F3B saltado por falta de física.

## Entorno

- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`
- `export CARGO_TARGET_DIR=$TMPDIR/f3b2a-target`
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`. El oráculo está en `$TMPDIR/oracle-venv/bin/python`.
- El binario base v0.4.0 está en `$TMPDIR/f3b-base/ogs`; no lo reemplaces.
- Commits por partes con rutas explícitas. Sin push ni tags.

Detente solo ante una contradicción que cambie la física o el formato. Ante cuestiones de forma con precedente, sigue el
precedente y anótalo.
