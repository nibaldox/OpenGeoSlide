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

### Ejemplo con sismo (esquema v0.2)

`analysis.seismic` y `loads` solo existen con `"version": "0.2"`; con `"0.1"` el motor lanza
`ValueError("InvalidModel: los campos 'loads' y 'analysis.seismic' requieren version \"0.2\"")`.

```python
import json
import opengeoslide

model = json.load(open("examples/acads1a.ogs.json"))   # ACADS 1(a), version "0.1"
base = opengeoslide.analyze(model)                      # sin sismo

model["version"] = "0.2"
model["analysis"]["seismic"] = {"kh": 0.1, "kv": 0.0}   # kh·W en el sentido del deslizamiento
model["loads"] = []                                     # opcional; también admite "udl" y "line"
seismic = opengeoslide.analyze(model)

for r0, r1 in zip(base["results"], seismic["results"]):
    print(r0["method"], round(r0["fos"], 4), "->", round(r1["fos"], 4))
# bishop 0.9851 -> 0.7901
# spencer 0.9841 -> 0.7906
```

(Valores obtenidos con el binario `ogs analyze` sobre el mismo modelo; el paquete Python envuelve el mismo motor.)

### Ejemplo con una polilínea (esquema v0.3)

Una polilínea fija exige `analysis.methods` y no admite Bishop; `analysis.interslice` solo viaja con
`morgenstern_price`. El informe devuelve la polilínea ya ajustada al terreno.

```python
import json
import opengeoslide

model = json.load(open("examples/acads1a.ogs.json"))
model["version"] = "0.3"
del model["analysis"]["search"]
model["analysis"]["surface"] = {"type": "polyline", "points": [[30, 25.000001], [35, 25.520953], [40, 26.973391],
                                                               [45, 29.525055], [51.29111842105263, 35.0]]}
model["analysis"]["methods"] = ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
model["analysis"]["interslice"] = {"function": "half_sine"}

for r in opengeoslide.analyze(model)["results"]:
    print(r["method"], r["status"], round(r["fos"], 4), r["warnings"])
# spencer converged 0.9991 []
# morgenstern_price converged 0.9999 []
# janbu_simplified converged 0.9567 []
# janbu_corrected converged 0.9994 []
```

Los estados `invalid` (`polyline_no_ground_crossing`, `polyline_outside_ground`) no son excepciones: el método queda sin
FS y el motivo va en `warnings`. Los códigos de aviso de la Fase 3a están en el docstring del paquete y en
`docs/formato-ogs-json.md`.

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

`tests/test_v03.py` cubre el formato v0.3 (polilínea, no drenado, M-P, Janbu y el aviso de E13k) con valores de cSlope
0.1.0. Los tests usan el wheel instalado, no el código fuente. `OGS_PY_TEST_HOOKS` fija qué build se espera:
`1` exige el hook, `0` exige que no exista; sin definir, los tests de pánico se omiten si el hook no está.

## Licencia

Apache-2.0.
