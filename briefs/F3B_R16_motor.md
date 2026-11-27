# Brief F3B-R16-M: el contacto con todas las cargas verticales y la finitud del OCR (E16aa y E16ab)

Responde en **español neutro, sin voseo**. La lente A de la revisión de cierre R16 (`$TMPDIR/r16-A/R16_A.md`) dio
**APTO CON CORRECCIONES**. El coordinador reprodujo **R16A-01** con el binario integrado. El fallo viene del contrato:
E16v no pedía incluir el embalse ni las cargas. Además, el coordinador encontró que el mismo defecto existe entre dos
materiales lineales desde la v0.4.0. Lee las enmiendas **E16aa** y **E16ab**, al final de
`briefs/05_CONTRATOS_FASE3B.md`. Ahí están las reglas, las cifras y las pruebas.

## Tareas

1. **E16aa: el contacto con σv total**, en todas las ramas.
   - Implementa la opción que prefieras (diferir la elección o sumar en el slicer), pero respeta el **invariante**
     del test, a 1e-12 relativo.
   - Modelos de partida en `$TMPDIR/r16-A/`:
     - `_tgt_hbpond_{6.999,7.0,7.001}.json`, MC sobre HB con embalse;
     - `_reg_udl_{7.999,8.0,8.001}.json`, MC sobre SHANSEP con `udl`;
     - `_reg_pond_{mc_sh,sh_mc}_*.json`, que hoy dan Spencer y Janbu `invalid`. Explica por qué son inválidos; no hace
       falta corregirlos;
     - `$TMPDIR/f3b-coord/r16/ll_{fric_sobre_coh,coh_sobre_fric}_{6.999,7.0,7.001}.json`, lineal sobre lineal con embalse, en v0.5 (el binario de la v0.4.0 da lo mismo).
   - Agrega uno con **carga lineal** sobre el contacto.
   - Criterio: FS sobre el contacto ≤ min(encima, debajo) + 0,5 % con Spencer, y la elección por dovela coherente con
     la resistencia real.
   - Pon los tests nuevos en `crates/ogs-core/tests/f3b_r16_contact.rs`, con los datos en `tests/data/f3b/r16/`.
     Incluye los seis contactos secos de E16v (`f3b_r15_contact.rs`), que no deben cambiar.
2. **Identidad frente a la v0.4.0:**
   ```
   identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --with-v06 \
     --base $TMPDIR/f3b-base/ogs --new <tu binario>
   ```
   - Cada diferencia tiene que deberse a E16aa. Lista el modelo, las dovelas cuyo material cambia y el FS antes y
     después.
   - Si la lista sale vacía, dilo.
   - Haz lo mismo con los 347 checks de aceptación y con la batería diferencial: tienen que seguir en 0 fallas.
     Cualquier cifra que se mueva tiene que estar explicada.
3. **E16ab: finitud del OCR** en `shansep::apply`, y en cualquier otro lugar donde se reporte el OCR.
   - Test con `{ratio 0,25, pop 1e308, exponent 0}` sobre el modelo de `r16_targeted_probes.py` §1. Arma el JSON a
     partir de `$TMPDIR/r16-A/r16_targeted_probes.py`.
   - Resultado esperado: código 2 y el mensaje de E16y.
4. **Documentación mínima:**
   - una línea en `docs/limitaciones.md` sobre el contacto bajo embalse o carga y la corrección deliberada frente a la
     v0.4.0, con las cifras;
   - lo mismo en `docs/formato-ogs-json.md`, en la sección del contacto;
   - una línea de CHANGELOG, en «Corregido», que el coordinador integra.

## Archivos tuyos

- `crates/ogs-core/src/slicer.rs`, `water.rs`, `shansep.rs` y `lib.rs`, solo en el camino del contacto o de la
  finitud
- tests nuevos en `crates/ogs-core/tests/`
- `docs/limitaciones.md` y `docs/formato-ogs-json.md`, solo las líneas de E16aa y E16ab

**No toques** `apps/web/`: ahí trabaja R16-W en paralelo.

## Entorno y gates

- **Worktree:** `/home/xodla/archivos/opengeoslide-wt/f3b-r16m`, rama `f3b-r16m`.
- **Variables:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `export CARGO_TARGET_DIR=$TMPDIR/r16m-target`.
- **Python:** siempre con `env -u PYTHONPATH -u PYTHONHOME`, con `uv run --python 3.13 --no-project` y las
  dependencias de `gates-r15.log`.
- **Gates:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release`, normal y con `--features parallel`;
  - aceptación 347/0;
  - `pytest verification` con `OGS_BIN`;
  - la identidad de la tarea 2;
  - `validar_ejemplos.py`;
  - la batería diferencial con `--require-f3 --require-f3r --require-f3g --require-f3b`.
- **Commits** por tarea, con rutas explícitas. Sin push, sin tags y sin merge. No subas versiones.
- **Te detienes solo** ante una contradicción de física o de formato. Si la identidad cambia en modelos que **no**
  tienen contacto con embalse o carga, eso es una contradicción.
