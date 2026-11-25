# opengeoslide (Python)

Paquete Python del motor de estabilidad de taludes 2D [OpenGeoSlide](../../README.md), construido con
[PyO3](https://pyo3.rs) 0.30 y [maturin](https://www.maturin.rs). Envuelve `ogs-core`; no reimplementa el cálculo.

## Instalación (desarrollo)

Desde `crates/ogs-py`, con Python ≥ 3.11 y `uv`:

```sh
uv run --python 3.13 --no-project --with maturin maturin build --release --out "$TMPDIR/ogs-py-dist"
uv venv -p 3.13 "$TMPDIR/ogs-py-venv"
VIRTUAL_ENV="$TMPDIR/ogs-py-venv" uv pip install "$TMPDIR"/ogs-py-dist/*.whl pytest
```

El wheel es `abi3-py311`: un único binario sirve para CPython 3.11 o superior. En v0.1 solo se han probado
3.13 y 3.14.

### Wheel con hooks de prueba

El hook de pánico `_panic_for_tests` está detrás de la feature `test-hooks` y **no** entra en el wheel de
producción. Para probar la ruta de pánico, compile un wheel aparte:

```sh
uv run --python 3.13 --no-project --with maturin maturin build --release --features test-hooks --out "$TMPDIR/ogs-py-dist-hooks"
uv venv -p 3.13 "$TMPDIR/ogs-py-venv-hooks"
VIRTUAL_ENV="$TMPDIR/ogs-py-venv-hooks" uv pip install "$TMPDIR"/ogs-py-dist-hooks/*.whl pytest
```

## API

```python
import opengeoslide

opengeoslide.version()                  # "0.1.0": versión de ogs-core
report_json = opengeoslide.analyze_json(model_json)   # str en, str (JSON del informe) fuera
report = opengeoslide.analyze(model)    # dict en, dict fuera (envoltorio sobre analyze_json)
```

- `analyze_json(model_json: str) -> str`: `ValueError` con el mensaje del motor si este rechaza el modelo
  (JSON inválido, sin superficie, etc.). El mensaje empieza por el código E6 (`Json`, `InvalidModel`, ...).
- `analyze(model: dict) -> dict`: serializa el `dict` con `allow_nan=False`. Un NaN o un infinito en el
  modelo se rechaza antes de llegar al motor con `ValueError("InvalidModel: ... en modelo.materials[0].cohesion ...")`,
  con la ruta del valor. Un ciclo en el `dict` da `ValueError("Json: ...")`.

## Pánicos

Un pánico de Rust dentro del motor **no** aborta el intérprete. `analyze_json` lo captura con
`std::panic::catch_unwind` y lo relanza como `RuntimeError` con el mensaje del pánico (prefijo `Rust panic: `).
No se usa `PanicException` de PyO3, porque hereda de `BaseException` y no sería capturada por `except Exception`.

## Tests

```sh
# Wheel de producción (el hook no debe existir):
OGS_PY_TEST_HOOKS=0 $TMPDIR/ogs-py-venv/bin/python -m pytest tests -v
# Wheel con --features test-hooks (ejercita el pánico):
OGS_PY_TEST_HOOKS=1 $TMPDIR/ogs-py-venv-hooks/bin/python -m pytest tests -v
```

Los tests usan el wheel instalado, no el código fuente. `OGS_PY_TEST_HOOKS` fija qué build se espera:
`1` exige el hook, `0` exige que no exista; sin definir, los tests de pánico se omiten si el hook no está.

## Licencia

Apache-2.0.
