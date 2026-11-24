# Brief W2d: paquete Python `opengeoslide` (PyO3 + maturin)

**Lee primero:** `briefs/00_CONTRATOS.md` (§3: `analyze_json`, `VERSION`). Responde en español.

## Objetivo
Crear el crate `crates/ogs-py`: un módulo de extensión Python `opengeoslide` que expone el motor. Instalable como wheel
y probado con pytest.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w2d` (rama `w2d-python`).

## Archivos que te pertenecen
- `crates/ogs-py/**` (`Cargo.toml`, `src/lib.rs`, `pyproject.toml`, `python/opengeoslide/__init__.py`, `tests/test_smoke.py`, `README.md`)
- Del `Cargo.toml` raíz, **solo** puedes agregar `"crates/ogs-py"` a `members`. **No** lo agregues a `default-members`,
  para que `cargo build` y `cargo test` del workspace no requieran Python.

**No toques** nada más.

## Requisitos
- PyO3 en su **última versión estable** con soporte para Python 3.13 y 3.14 (verifica con `cargo search pyo3` o crates.io).
  Usa `abi3-py311` si es compatible; si no, sin abi3.
- API Python:
  - `opengeoslide.version() -> str`;
  - `opengeoslide.analyze_json(model_json: str) -> str`: lanza `ValueError` con el mensaje del motor si este devuelve error;
  - `opengeoslide.analyze(model: dict) -> dict`, conveniencia en Python puro sobre `analyze_json`.
- Un pánico de Rust **no** debe tumbar el intérprete: atrápalo y conviértelo en `RuntimeError`. Usa `catch_unwind` o el
  `PanicException` de PyO3 y documenta cuál.
- `pyproject.toml` con backend maturin, `module-name = "opengeoslide._core"`, `python-source = "python"`, licencia
  Apache-2.0 y descripción en español.

## Tests (`tests/test_smoke.py`)
- `version()` coincide con la versión de `crates/ogs-core/Cargo.toml`.
- Un JSON inválido → `ValueError`.
- Un modelo sin superficie → `ValueError` con un mensaje que menciona la superficie.
- `analyze` sobre `examples/acads1a.ogs.json`: hoy el motor puede estar en stubs (pánico `not yet implemented`). Escribe
  el test para que **verifique el resultado real** (FS de Bishop entre 0.95 y 1.03) y márcalo
  `@pytest.mark.xfail(strict=False, reason="motor en stubs hasta W1")`. **Además** verifica, en un test aparte, que el
  pánico llega a Python como `RuntimeError` y no como un abort.

## Gates
```
cd crates/ogs-py
uv run --python 3.13 --no-project --with maturin --with pytest maturin build --release --out $TMPDIR/ogs-py-dist
uv venv -q -p 3.13 $TMPDIR/ogs-py-venv && VIRTUAL_ENV=$TMPDIR/ogs-py-venv uv pip install $TMPDIR/ogs-py-dist/*.whl pytest
$TMPDIR/ogs-py-venv/bin/python -m pytest tests -v
```
Repite el build y los tests con `-p 3.14`. Desde la raíz, `cargo build` (sin `-p`) sigue en verde y `cargo clippy -p ogs-py -- -D warnings`
queda limpio.

## Cierre
- Commit en tu rama con rutas explícitas y el mensaje `feat(py): paquete Python opengeoslide con PyO3`. Sin push.
  **No** subas wheels.
- **Resumen:** versión de PyO3, abi3 sí o no, gates con salida real para 3.13 y 3.14, y hash del commit.
- **Presupuesto:** ~40 iteraciones.
