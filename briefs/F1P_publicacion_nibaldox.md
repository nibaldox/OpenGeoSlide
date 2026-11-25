# Brief F1-P: dejar el repositorio listo para publicarse en `nibaldox/opengeoslide` (un escritor Sonnet)

Responde en **español neutro, sin voseo**. Lee `docs/fase1_cierre.md`, `docs/fase1/exploracion/X4.md` §3 y
`briefs/F1D_publicacion.md` («Propietario del repositorio»).

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1p`, rama `f1p-publicacion`, desde `main`.

## Decisiones del usuario (definitivas)
- **Repositorio:** `https://github.com/nibaldox/opengeoslide`. La web irá en `https://nibaldox.github.io/opengeoslide/`.
- **Visibilidad:** el repositorio será público.
- **PyPI:** el usuario **no tiene cuenta**. No se publica en PyPI por ahora; los wheels se distribuyen como assets del
  GitHub Release.
- **crates.io:** queda como está, detrás de `workflow_dispatch` y del secret. Hoy no se publica.

## Tareas (sin red: no crees el repo, no hagas push ni publiques)
1. **Propietario:**
   - Reemplaza `opengeoslide/opengeoslide` por `nibaldox/opengeoslide` y `opengeoslide.github.io` por
     `nibaldox.github.io` en `Cargo.toml`, `crates/ogs-py/pyproject.toml`, `CITATION.cff` y `CHANGELOG.md`.
   - Quita los comentarios «PROPIETARIO PROVISIONAL».
   - **No** toques `docs/fase1/exploracion/X4.md` (es histórico) ni `briefs/F1D_publicacion.md`.
   - Comprueba que `.github/workflows/pages.yml` y `apps/web/vite.config.ts` usan `/opengeoslide/`, que es el nombre del
     repositorio.
2. **PyPI desactivado sin romper el release** (`.github/workflows/wheels.yml`):
   - el job `publish` a PyPI solo corre si `vars.PYPI_PUBLISH == 'true'`, además de su guarda actual (`push` + tag
     `v*`). Documenta en un comentario cómo activarlo: crear la cuenta, configurar Trusted Publishing y definir la
     variable;
   - un job nuevo, `release-assets`, que en `push` de un tag `v*` sube los wheels y el sdist al GitHub Release del tag,
     con `softprops/action-gh-release`, la misma versión que usa `release.yml`. Permisos mínimos: `contents: write`
     solo en ese job;
   - `actionlint` limpio (`/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1d-actionlint/actionlint`).
     También debe pasar `apps/web/src/ci/workflows.test.ts`; actualízalo si agregas guardas.
3. **Limpieza de rutas personales en archivos públicos y vigentes:**
   - `verification/differential/{README.md,run.py}` y `verification/harness/README.md`: cambia
     `export TMPDIR=/home/xodla/...` por instrucciones genéricas, por ejemplo `export TMPDIR="$(mktemp -d)"` u omite la
     línea. `run.py` no debe escribir esa ruta en `REPORT.md`. Regenera `verification/differential/REPORT.md` y
     `report.json` con el binario de `main` (`cargo build --release -p ogs-cli`).
   - `verification/harness/sample/`: está obsoleto (un reporte con «binario ogs no encontrado»). **Regenéralo** con el
     binario actual usando rutas **relativas** al repositorio, o elimínalo si nada lo usa. Revisa con `git grep` quién lo
     referencia.
   - Al final, `git grep -nI "/home/xodla" -- . ':!briefs' ':!docs/reviews' ':!docs/fase1/exploracion'` debe quedar
     **vacío**. Los briefs, las revisiones y las exploraciones son registros históricos y quedan sin cambios.
   - Crea `briefs/README.md` en español. Debe explicar que `00_CONTRATOS.md` y `01_CONTRATOS_FASE1.md` son el contrato
     normativo, y que el resto son instrucciones de trabajo para los agentes de desarrollo, con las rutas del entorno
     original. Se conservan por trazabilidad.
4. **README.md:**
   - arriba, los enlaces a la app en línea (`https://nibaldox.github.io/opengeoslide/`), al repositorio, a los releases
     y a la licencia;
   - una sección «Instalación»:
     - web: sin instalación; la app se puede instalar como PWA;
     - CLI: compilar con `cargo`;
     - Python: el wheel del GitHub Release, con un `pip install` de la URL del asset (patrón de nombre), o compilar con
       `maturin`. Indica que aún no está en PyPI.
   - Verifica que los comandos del README funcionan en local (CLI y build de la web).
5. **CHANGELOG.md:** agrega una entrada para la versión que se publicará, `0.1.0`. **No** cambies la versión de los
   crates ni del wheel, que sigue siendo `0.1.0`. Deja Unreleased vacío si corresponde y corrige los enlaces de
   comparación al repositorio nuevo.

## Gates
- `cargo fmt --all --check`, `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings` y
  `cargo test -p ogs-core --release`
- `cargo publish --workspace --dry-run --locked --allow-dirty`
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && VITE_BASE=/opengeoslide/ pnpm build`
- pytest (con `env -u PYTHONPATH -u PYTHONHOME`):
  ```
  uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```
- Batería diferencial 28/28 + 28/28
- `actionlint` limpio
- El `git grep` del punto 3 vacío

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** archivos cambiados, gates con salida real, el `git grep` vacío y los hashes.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses los puertos 5180 a 5187.
- **Presupuesto:** ~40 iteraciones.
