# Brief F3B-R15: correcciones del motor tras la revisión adversarial R15

Responde en **español neutro, sin voseo**. La revisión R15 encontró defectos en el bloque F3B, que cubre Hoek-Brown,
SHANSEP y la búsqueda no circular, formato v0.6, para la release v0.5.0. El coordinador los reprodujo y fijó las
correcciones en `briefs/05_CONTRATOS_FASE3B.md`, **enmiendas E16v a E16z**. Esas enmiendas son tu contrato: léelas
primero, completas.

Hay tres escritores en paralelo, cada uno en su worktree desde `f3b-integracion`. Valen las reglas comunes de
`briefs/F3B_B1_comun.md` (entorno, gates y formato del informe) con la tabla de dueños de abajo.

**Identidad.** Ningún cambio puede tocar un modelo sin campos v0.6. Se comprueba con
`identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --with-v06` contra
`$TMPDIR/f3b-base/ogs`, y el resultado debe ser 0 diferencias.

**Evidencia de la revisión.**
- Informe de la lente A: `$TMPDIR/r15-A/R15_A.md`, con sus scripts y modelos en la misma carpeta.
- Informe de la lente C: `$TMPDIR/r15-C/R15_C.md`.
- Arbitraje del coordinador: `$TMPDIR/f3b-coord/r15/arbitraje.md`.

Reutiliza esos modelos como tests de regresión, copiándolos a `crates/ogs-core/tests/data/f3b/r15/`.

## R15-M1: contacto, caras y SHANSEP (E16v, E16y)

- **Archivos tuyos:**
  - `crates/ogs-core/src/slicer.rs`: solo `weaker_at_contact` y la rama Hoek-Brown/SHANSEP de las caras;
  - `crates/ogs-core/src/shansep.rs` y `crates/ogs-core/src/strength.rs`;
  - en `crates/ogs-core/src/lib.rs`, solo la llamada a `shansep::apply`, si cambia de firma;
  - tests nuevos `crates/ogs-core/tests/f3b_r15_contact.rs` y `f3b_r15_faces.rs`, y `f3b_shansep.rs`;
  - los datos de `tests/data/f3b/r15/{contact,faces,sh}/`.
- **Tareas:**
  - **E16v:** el contacto con la resistencia real, con las seis combinaciones MC/HB/SH encima, sobre y debajo del
    contacto (`r15-A/ct_*.json`).
  - **E16y, caras:** el peso del agua embalsada en σv, con la prueba de Arquímedes (`r15-A/sh2_arch_{dry,sub}.json`)
    y una versión con Hoek-Brown.
  - **E16y, POP y finitud:** la forma de POP sin cociente y el error de finitud. La prueba usa `ocr` = 1e308
    (`r15-C/huge_ocr.json`) y `pop` enorme.
- **Medir y reportar:** las 13 filas de M-SH por 5 métodos, que deben seguir ≤ 0,022 %, y los casos SHANSEP de
  `cases_f3b` antes y después.

## R15-M2: el lazo de Hoek-Brown y su costo (E16w)

- **Archivos tuyos:**
  - `crates/ogs-core/src/strength_loop.rs` y `crates/ogs-core/src/hoek_brown.rs`;
  - en `crates/ogs-core/src/strength.rs`, solo `HoekBrownParams`, si precalculas campos. M1 también toca
    `strength.rs`: limita tu cambio a ese struct y a su constructor, y anótalo;
  - `crates/ogs-core/tests/f3b_hoek_brown.rs` y los datos de `tests/data/f3b/r15/hb/`;
  - `docs/fase3/exploracion/X28_proto/`, solo si el prototipo necesita el mismo arranque para seguir siendo el
    oráculo. Si lo cambias, explica por qué.
- **Tareas:**
  - **El arranque** `max(0, ·)`.
  - **RU03:** mide los cinco métodos (`r15-A/hb_sb_ru03.json`) y compáralos con cSlope (0,9618 Bishop y 1,0103 Spencer).
    Por la envolvente completa, la diferencia debe quedar del lado seguro.
  - **`fos` null** con `hoek_brown_not_converged`, con un test que lo fuerce.
  - **El costo**, sin cambiar el FS más de 1e-9 relativo en todas las pruebas de Hoek-Brown.
- **Medir y reportar,** antes y después:
  - las 20 filas del producto, las 33 de compatibilidad y HAM1;
  - las 6 filas Hoek-Brown de la batería F3B;
  - los tiempos de F3B-HB-01 y F3B-HB-02 con búsqueda Bishop, en serie y con `parallel`;
  - las pasadas por candidato.

## R15-M3: la búsqueda no circular, la verificación y el esquema (E16x, E16z)

- **Archivos tuyos:**
  - `crates/ogs-core/src/{surface.rs,noncircular.rs,search.rs}`;
  - en `crates/ogs-core/src/lib.rs`, solo la nota `non_circular_not_refined`;
  - `crates/ogs-core/tests/{f3b_noncircular.rs,acceptance.rs}`, en esta última solo la lista de notas informativas;
  - `verification/differential/{run.py,test_f3b.py,build_f3b.py,cases_f3b/*}`;
  - `schema/ogs-0.6.schema.json` y `verification/tools/test_schema.py`;
  - los datos de `tests/data/f3b/r15/nc/`.
- **Tareas:**
  - **E16x:**
    - los extremos de la conversión;
    - la holgura en las ventanas;
    - las tolerancias con escala;
    - la nota nueva;
    - los 16 taludes homogéneos (`r15-A/diag_u_*.json`) con `evaluated > 0`;
    - `bench_nc_ogs.json` contra cSlope, con `to_cslope.py` y `$TMPDIR/oracle-venv/bin/python`.
  - **E16z:** los dos archivos de `cases_f3b`, la cota de 1,05 del veredicto m_α, la lista de notas desde una sola
    fuente y `null` en el esquema.
- **Medir y reportar,** antes y después:
  - las 10 filas A1 a A3 de X29 y los 20 checks promovidos de F3B;
  - la batería diferencial completa, con `--require-f3 --require-f3r --require-f3g --require-f3b`;
  - el costo no circular frente al circular en V001, V034a y V036a.
- **Fuera de tu alcance:** la web. Propón en tu informe el texto de `apps/web/src/engine/warnings.ts` para la nota
  nueva; la web va en otra ola.

## Para los tres

- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - `export CARGO_TARGET_DIR=$TMPDIR/r15<m1|m2|m3>-target`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Gates,** todos en tu worktree:
  - `cargo fmt --all --check`, y clippy con `-D warnings`;
  - `cargo test -p ogs-core --release`, normal y con `--features parallel`;
  - la aceptación: 347 checks y 0 fallas;
  - `pytest verification` con `OGS_BIN`;
  - la identidad: 0 diferencias.
- **Commits** por partes, con rutas explícitas. Sin push, sin tags y sin merge de `f3b-integracion`.
- **Presupuesto de pasos.** Commitea apenas cierres cada enmienda, para que nada quede sin commitear si te cortan.
- **Paradas.** Detente solo ante una contradicción que cambie la física o el formato, por ejemplo si una fila de
  aceptación sale de su gate. Ante cuestiones de forma con precedente, sigue el precedente y anótalo.
