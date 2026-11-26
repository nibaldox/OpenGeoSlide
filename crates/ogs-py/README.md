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

opengeoslide.version()                  # p. ej. "0.2.0": versión de ogs-core
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

### Ejemplo con refuerzos (esquema v0.4)

`reinforcements` exige `"version": "0.4"`. Hay cinco tipos (`anchor`, `nail`, `geosynthetic`, `pile` y `sheet_pile`), cada
uno activo o pasivo (`application`, obligatorio). Este es el ejemplo de la tablestaca anclada de
[`docs/formato-ogs-json.md`](../../docs/formato-ogs-json.md#ejemplo-completo-una-tablestaca-anclada): una `sheet_pile`
pasiva de 120 kN por metro de muro y un `anchor` activo con un bulbo `bond` en los últimos 10 m, sobre ACADS 1(a) con
su círculo fijo.

```python
import json
import opengeoslide

model = json.load(open("examples/acads1a.ogs.json"))
model["version"] = "0.4"
model["slope"] = {"direction": "right_to_left"}
del model["analysis"]["search"]
model["analysis"]["surface"] = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
model["reinforcements"] = [
    {"type": "sheet_pile", "id": "tablestaca", "application": "passive",
     "x1": 40, "y1": 33, "x2": 40, "y2": 22, "force": 120, "direction": "angle", "angle": 0},
    {"type": "anchor", "id": "tirante", "application": "active",
     "x1": 40, "y1": 29, "x2": 64, "y2": 22.8, "tensile_capacity": 300, "end1_capacity": 300, "spacing": 2.5,
     "direction": "axial", "pullout": {"model": "bond", "strength": 20, "bonded_length": 10}},
]

for r in opengeoslide.analyze(model)["results"]:
    print(r["method"], r["status"], round(r["fos"], 4), r["warnings"])
    for f in r["reinforcement_forces"]:
        print("  ", f["id"], f["status"], round(f["x"], 2), round(f["available"], 1), round(f["fx"], 1), round(f["fy"], 1))
# bishop converged 1.598 ['structural_checks_not_covered', 'truncated_mass']
#    tablestaca applied 40.0 120.0 120.0 0.0
#    tirante applied 42.84 80.0 77.5 -20.0
# spencer converged 1.5921 ['structural_checks_not_covered', 'truncated_mass']
#    tablestaca applied 40.0 120.0 120.0 0.0
#    tirante applied 42.84 80.0 77.5 -20.0
```

- **`reinforcement_forces`** (en cada `results[i]`, solo sobre la superficie final; se omite sin refuerzos): una entrada
  por cruce con `id`, `crossing`, `x`, `y`, `station`, `available` (por metro), `fx` y `fy` (la fuerza aplicada por metro,
  en coordenadas del modelo con y hacia arriba; en un pasivo, antes de dividir por F), `application` y `status`
  (`applied`, `outside_mass`, `compression_ignored` o `no_capacity`).
- **Notas informativas** en `warnings`: `reinforcement_outside_mass`, `reinforcement_compression_ignored` y
  `structural_checks_not_covered`. `no_capacity` no emite nota.
- **Rechazos** como `ValueError`, con la ruta JSON del campo: `InvalidModel: reinforcements[0].pullout.coverage debe
  estar en (0, 1], no 1.5`, o `reinforcements requiere version "0.4"` con una versión menor. `pile` y `sheet_pile` no
  admiten `location`.
- **Límite estructural.** Con un `pile` o una `sheet_pile`, OpenGeoSlide calcula la estabilidad **global** con el
  elemento incluido como una fuerza dada. **No** calcula el empuje sobre el elemento, el empotramiento, el momento flector,
  la deflexión ni las comprobaciones internas o externas de un muro
  ([Limitaciones](../../docs/limitaciones.md#pilotes-y-tablestacas-el-límite-estructural-f48)).
- Con una **búsqueda** (`analysis.search`), el círculo crítico puede esquivar el refuerzo: si el resultado trae
  `reinforcement_outside_mass`, el FS mínimo es el de una superficie que no lo cruza
  ([Limitaciones](../../docs/limitaciones.md#la-búsqueda-con-refuerzos-tiene-discontinuidades)).

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
0.1.0. `tests/test_v04.py` cubre el formato v0.4: las 32 filas de `docs/fase3/exploracion/X17.md` (siete de F4.13, 16 de
dirección inclinada y nueve de capacidad) contra el oráculo, con los cinco tipos y los tres modelos de `pullout`, los
estados de `reinforcement_forces` (`applied`, `outside_mass`, `compression_ignored` y `no_capacity`), las tres notas
nuevas, las identidades de la tablestaca, la compuerta de versión y los rechazos con su ruta JSON. Los tests usan el wheel instalado, no el código fuente. `OGS_PY_TEST_HOOKS` fija qué build se espera:
`1` exige el hook, `0` exige que no exista; sin definir, los tests de pánico se omiten si el hook no está.

## Licencia

Apache-2.0.
