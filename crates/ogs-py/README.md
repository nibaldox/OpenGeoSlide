# opengeoslide (Python)

Paquete Python del motor de estabilidad de taludes 2D [OpenGeoSlide](../../README.md), construido con
[PyO3](https://pyo3.rs) 0.30 y [maturin](https://www.maturin.rs). Envuelve `ogs-core`; no reimplementa el cálculo.

## Instalación (Release v0.5.0)

OpenGeoSlide aún no está en PyPI: el wheel se instala desde los assets del
[Release v0.5.0](https://github.com/nibaldox/OpenGeoSlide/releases/tag/v0.5.0). El wheel es `abi3` y sirve para
CPython 3.11 o superior; este es el de Linux x86-64:

```sh
WHL=opengeoslide-0.5.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl
pip install "https://github.com/nibaldox/OpenGeoSlide/releases/download/v0.5.0/$WHL"
```

Para macOS y Windows, cambie `WHL` por el nombre del `.whl` de su plataforma, que figura en la página del release. Con
`opengeoslide.version()` debe dar `0.5.0`.

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

opengeoslide.version()                  # "0.5.0" en este release: versión de ogs-core (la de su Cargo.toml)
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
  estar en (0, 1], no 1.5`, o `reinforcements requiere version "0.4"` con una versión menor. Un `pile` o una
  `sheet_pile` con `force` no admite `location` (con una fuerza dada no cambia ningún número; en el pilote con
  `lateral_pressure`, de la v0.5, `location` va dentro de ese objeto).
- **Límite estructural.** Con un `pile` o una `sheet_pile` con `force`, OpenGeoSlide calcula la estabilidad **global** con
  el elemento incluido como una fuerza dada: **no** calcula el empuje sobre él, ni el empotramiento, el momento flector, la
  deflexión ni las comprobaciones internas o externas de un muro. El pilote con `lateral_pressure` (v0.5, más abajo)
  estima la fuerza del suelo entre pilotes, pero tampoco es el diseño del pilote
  ([Limitaciones](../../docs/limitaciones.md#pilotes-y-tablestacas-el-límite-estructural-f48)).
- Con una **búsqueda** (`analysis.search`), el círculo crítico puede esquivar el refuerzo: si el resultado trae
  `reinforcement_outside_mass`, el FS mínimo es el de una superficie que no lo cruza
  ([Limitaciones](../../docs/limitaciones.md#la-búsqueda-con-refuerzos-tiene-discontinuidades)).

### Ejemplo con grieta de tracción y agua embalsada (esquema v0.5)

`analysis.tension_crack` exige `"version": "0.5"`. Es un objeto con `depth` (un número > 0 en la unidad de longitud del
modelo, o `"auto"`, la profundidad de Rankine) y `water_fill` (de 0, seca, a 1, llena; **obligatorio**). La grieta trunca
cada superficie: quita la masa del lado de la cresta y, con agua, suma `Pw = ½·γw·(water_fill·depth)²` en el sentido del
deslizamiento. Sobre ACADS 1(a) con su círculo fijo, una grieta de 2 m llena de agua:

```python
import json
import opengeoslide

model = json.load(open("examples/acads1a.ogs.json"))   # ACADS 1(a), version "0.1"
model["version"] = "0.5"
model["slope"] = {"direction": "right_to_left"}
del model["analysis"]["search"]
model["analysis"]["surface"] = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}

base = opengeoslide.analyze(model)
model["analysis"]["tension_crack"] = {"depth": 2.0, "water_fill": 1.0}   # 2 m, llena de agua
cracked = opengeoslide.analyze(model)
for r0, r1 in zip(base["results"], cracked["results"]):
    crack = r1["tension_crack"]
    print(r0["method"], round(r0["fos"], 4), "->", round(r1["fos"], 4),
          f"x={crack['x']:.4f} depth={crack['depth']} Pw={crack['water_force']:.2f}")
# bishop 0.9851 -> 0.9795 x=48.7109 depth=2.0 Pw=19.62
# spencer 0.9841 -> 0.9785 x=48.7109 depth=2.0 Pw=19.62
```

- **La salida.** Cada resultado cuya superficie se truncó trae `results[i]["tension_crack"] = {"x", "depth", "water_force"}`
  (más `"face_height"` cuando la cara cortada difiere de `depth`, E15m-15; se omite sin grieta; con `"auto"` y profundidad nula, `depth` y `water_force` valen 0 y el FS es el de la superficie
  sin grieta). Una grieta **seca** puede subir el FS: la masa que se quita empujaba (con `water_fill = 0` y 2 m, Bishop
  pasa de 0,9851 a 1,0263).
- **Una superficie que no alcanza la profundidad** se descarta en una búsqueda y, con una superficie fija, es
  `ValueError("NoValidSurface: tension_crack_not_reached: ...")`. No hay tope de profundidad por la altura del talud.
- **Rechazos** con ruta JSON: `InvalidModel: analysis.tension_crack.water_fill es obligatorio`,
  `analysis.tension_crack.depth debe ser finito y mayor que 0 (o "auto")` y `tension_crack requiere version "0.5"` con una
  versión menor.
- **Reglas de los contratos R12 y R13** (E15m-15, que revisa E15l-2, y E15l-7), que se cumplen desde el motor integrado:
  la grieta sobre una discontinuidad (una carga `udl`, un cambio lateral de material o un escalón del terreno) toma
  profundidad y agua de `d(x_c)`, como cSlope; y cuando la cara cortada, `terreno(x_c) − base(x_c)`, difiere de `depth`,
  el informe agrega `tension_crack["face_height"]` (se omite en una grieta normal). Medido con
  `docs/fase3/r12/repro/a04_udl.json`, Bishop da `depth` 0, `water_force` 0, `face_height` 1,78272 y FS 1,102248 (cSlope
  1,102311; E15l-2 daba 1,095348). Una búsqueda en la que todos los candidatos fallan por la grieta termina en
  `NoValidSurface: ... (E evaluadas, 0 válidas; K no alcanzan la grieta de tracción, tension_crack_not_reached)`; con
  `depth` 40 m en el talud de `a01_ltr.json`, `(7400 evaluadas, 0 válidas; 7397 no alcanzan la grieta de tracción,
  tension_crack_not_reached)`.

**El agua embalsada cambia el resultado frente a la v0.3.0.** Si la piezométrica pasa **sobre el terreno**, el motor suma
el agua libre (su peso y su empuje horizontal) en **todas** las versiones del formato, sin ningún campo: la v0.3.0 solo
contaba la presión de poros. Es una corrección de física y **cambia el FS** de esos modelos (la v0.3.0 los marcaba con
`water_above_ground`); si guardó resultados de un modelo con agua sobre el terreno, vuelva a calcularlos. Un modelo sin agua
sobre el terreno y sin grieta da la misma salida, byte a byte, que la v0.3.0, **salvo en unidades imperiales** (véase abajo). Con 2 m de agua sobre el pie de ACADS 1(a):

```python
model = json.load(open("examples/acads1a.ogs.json"))
model["slope"] = {"direction": "right_to_left"}
del model["analysis"]["search"]
model["analysis"]["surface"] = {"type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704}
model["water"] = {"unit_weight": 9.81, "piezometric_line": [[20, 27], [70, 27]]}    # 2 m sobre el pie (y = 25)

for r in opengeoslide.analyze(model)["results"]:
    print(r["method"], round(r["fos"], 4), r["warnings"])
# bishop 0.9392 ['water_above_ground', 'truncated_mass']
# spencer 0.9387 ['water_above_ground', 'truncated_mass']
```

Con la v0.3.0, Bishop daba 0,848 en ese mismo modelo (sin el peso ni el empuje del agua) y cSlope da 0,939.
`water_above_ground` es ahora una **nota informativa**.

**Una tercera excepción a la identidad con la v0.3.0: γw por defecto en imperial** (E15l-6, E15m-6). Un archivo
`imperial` que usa agua (piezométrica, aunque quede bajo el terreno, agua embalsada o agua en la grieta) y no indica
`water.unit_weight` toma γw ≈ 62,45 pcf, no 9,81 «pcf» como la v0.3.0, y **cambia de FS** (ACADS 1(a) en pies con una
piezométrica bajo el terreno: Bishop 0,9300 con la v0.3.0 y 0,6339 ahora, el valor del mismo modelo en SI). En ese caso el
motor agrega a `warnings` el aviso informativo `water_unit_weight_default`; escriba `water.unit_weight` (62,4 pcf) para
fijar el valor. En SI no cambia nada ni se emite el aviso. Medido con ese modelo (ACADS 1(a) en pies, círculo fijo, con la
piezométrica bajo el terreno): `warnings` de Bishop = `['water_unit_weight_default', 'truncated_mass',
'negative_effective_normal']`, con el aviso una sola vez por método.

- **Convenciones.** El sismo pseudoestático no actúa sobre el agua embalsada ni sobre `Pw`. En un material con `ru`,
  `u = ru·(W + V)/b` (con `V` el peso del agua embalsada): es la regla de Slide2 y no se puede comparar con el oráculo.
  Sin `water.unit_weight`, γw vale 9,81 kN/m³ en SI y, en imperial, el resultado de convertir ese valor (alrededor de
  62,45 pcf) (E15l-6). Medido: una grieta de 2 m con agua y sin `water`, en imperial, da con Bishop 1,69865, igual que en SI
  (antes, 1,71248), y `Pw` = 1344,40 lbf/ft con γw = 62,449 pcf (antes, 211,19).

### Ejemplo con un pilote de Ito-Matsui (esquema v0.5)

Un `pile` puede llevar `lateral_pressure` en lugar de `force`: el motor calcula la fuerza que el suelo **entre pilotes**
ejerce sobre una fila de pilotes **rígidos y verticales** (Ito y Matsui, 1975, ecuaciones 13, 14 y 23), en deformación
plana, y la aplica en el cruce con la superficie. `force` y `lateral_pressure` se excluyen (exactamente uno);
`lateral_pressure` lleva `model` (`"ito_matsui"`), `diameter` y `location` (`"centroid"` o `"slip_surface"`, obligatorio);
`spacing` debe ser mayor que `diameter`, el pilote es vertical (`x1 = x2`) y `capacity` (opcional) lleva `shear`, `moment` o
ambos, como **topes** por pilote. El talud de Cai y Ugai (V013c) con su círculo fijo, un pilote de 0,8 m a 2,4 m de eje a eje
(S/D = 3) y topes de 150 kN de corte y 250 kN·m de momento:

```python
import opengeoslide

model = {
    "format": "opengeoslide", "version": "0.5", "units": "SI",
    "meta": {"id": "cai-ugai", "title": "Talud de Cai y Ugai con un pilote de Ito-Matsui"},
    "materials": [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0,
                   "cohesion": 10.0, "friction_angle": 20.0}],
    "regions": [{"material": "suelo", "polygon": [[0, -10], [0, 0], [10, 0], [25, 10], [35, 10], [35, -10]]}],
    "slope": {"direction": "auto"},
    "reinforcements": [{
        "type": "pile", "id": "P1", "application": "passive", "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0,
        "spacing": 2.4, "direction": "angle", "angle": 0,
        "lateral_pressure": {"model": "ito_matsui", "diameter": 0.8, "location": "centroid"},
        "capacity": {"shear": 150.0, "moment": 250.0},     # topes por pilote (opcional)
    }],
    "analysis": {"methods": ["bishop", "spencer"], "slices": 50, "tolerance": 1e-5,
                 "surface": {"type": "circle", "xc": 7.464496793583992, "yc": 26.311206196419032,
                             "r": 26.43308855461703}},
}

for r in opengeoslide.analyze(model)["results"]:
    f = r["reinforcement_forces"][0]
    print(r["method"], round(r["fos"], 4), f["status"], "soil_force", round(f["soil_force"], 2),
          "available", round(f["available"], 2), f["governs"], "arm", round(f["arm"], 4))
# bishop 1.3129 applied soil_force 117.92 available 62.5 shear arm 1.2238
# spencer 1.3102 applied soil_force 117.92 available 62.5 shear arm 1.2238
```

- **La salida.** Cada cruce de un pilote con `lateral_pressure` agrega a su entrada de `reinforcement_forces`
  `soil_force` (la fuerza del suelo por metro, antes del tope), `governs` (`soil`, `shear` o `bending`: qué fija `available`)
  y `arm` (el brazo de la resultante sobre el cruce). Un pilote con `force` no trae esos campos. Aquí gobierna el corte:
  150 kN/2,4 m = 62,5 kN/m frente a 117,92 kN/m del suelo. Sin la `capacity` gobierna el suelo y Bishop da 1,4373.
- **Aviso.** `ito_matsui_spacing_range` sale con S/D < 2 o S/D > 8, donde la fórmula pierde validez (sobrestima la fuerza con
  S/D pequeño y la subestima con S/D grande; Ukritchon y Keawsawasvong, 2017). Con `structural_checks_not_covered` sigue
  saliendo la nota de siempre.
- **Rechazos** como `ValueError`: `reinforcements[0]: force y lateral_pressure se excluyen`,
  `reinforcements[0].spacing debe ser mayor que lateral_pressure.diameter`, `reinforcements[0].x2 debe ser igual a x1` y
  `lateral_pressure requiere version "0.5"` con una versión menor.
- **Alcance estructural exacto.** El motor estima la fuerza del suelo entre pilotes rígidos y la acota con la `capacity` que
  usted declara. **No** es el diseño del pilote: no calcula el empotramiento, el momento flector, la deflexión ni la
  interacción suelo-estructura, y **no** comprueba que el perfil resista `shear` o `moment` (la `capacity` es un tope, no una
  verificación). Las cargas de superficie no entran en la presión, y el agua no empuja: solo entra en `σ′v`
  ([Limitaciones](../../docs/limitaciones.md#pilotes-de-ito-matsui-e15i-qué-hace-y-qué-no)).
- **Reglas del contrato R12** (E15l-11 y E15l-12), que se cumplen desde el motor integrado: un perfil de presión que no es
  finito (S/D cerca de 1 con φ alto) se rechaza antes de resolver con `ValueError("InvalidModel:
  reinforcements[i].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = ... y φ = ...° ...; aumente spacing")`,
  y la salida nunca lleva `NaN` ni `∞`; y en un material con `ru`, `σ′v = σv − ru·σ_suelo`, sin restar la `u` de la
  piezométrica, como el resto del motor. Medido: `docs/fase3/r12/repro/a02_fixed.json` (φ = 35°, S/D = 1,00125) da
  `InvalidModel: reinforcements[0].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = 1.00125 y φ = 35° ...`
  (antes, Bishop `invalid` y los otros tres `not_converged`); la fila X22-S16, con `ru` y piezométrica, queda a 0,026 % o
  menos del oráculo en los cinco métodos (antes, de −1,88 % a −1,97 %).

### Ejemplo con Hoek-Brown, SHANSEP y búsqueda no circular (esquema v0.6)

La v0.6 agrega dos modelos de resistencia de material, `hoek_brown` y `shansep`, y la búsqueda no circular
(`analysis.search.non_circular`). Los tres exigen `"version": "0.6"`: con una versión menor, el error es
`ValueError("InvalidModel: <campo> requiere version \"0.6\"")`, con el primer campo que encuentra, por ejemplo
`materials[0].model = "hoek_brown" requiere version "0.6"` o `analysis.search.non_circular requiere version "0.6"`. Un
modelo sin campos v0.6 da la misma salida que antes, aunque declare `"0.6"`. El formato completo y la física están en
[`docs/formato-ogs-json.md`](../../docs/formato-ogs-json.md#hoek-brown-shansep-y-búsqueda-no-circular-v06) y
[`docs/limitaciones.md`](../../docs/limitaciones.md#hoek-brown-shansep-y-búsqueda-no-circular-formato-v06-qué-hace-y-qué-no).

**Hoek-Brown** (`model: "hoek_brown"`): `unit_weight`, `ucs` (σci de la roca intacta, **en la unidad de esfuerzo del
modelo**: kPa en SI y psf en imperial; 12 MPa son `12000.0`), `gsi` (0 a 100), `mi` (> 0) y `disturbance` (el factor D, de 0
a 1, **sin valor por defecto**); `unit_weight_sat` y `ru` son opcionales. No admite `cohesion`, `friction_angle` ni
`shansep`. La resistencia depende de F, así que el motor itera (hasta 50 pasadas) y el informe trae `passes`.

```python
import opengeoslide

model = {
    "format": "opengeoslide", "version": "0.6", "units": "SI",
    "materials": [{"id": "roca", "name": "Roca", "model": "hoek_brown", "unit_weight": 25.0,
                   "ucs": 12000.0, "gsi": 25.0, "mi": 8.0, "disturbance": 0.7}],   # ucs en kPa (12 MPa)
    "regions": [{"material": "roca", "polygon": [[-40, -10], [72.3205, -10], [72.3205, 30], [32.3205, 30], [27.3205, 30],
                                                  [21.547, 20], [16.547, 20], [10.7735, 10], [5.7735, 10], [0, 0], [-40, 0]]}],
    "slope": {"direction": "right_to_left"},
    "analysis": {"methods": ["bishop", "spencer", "janbu_simplified"], "slices": 40,
                 "surface": {"type": "circle", "xc": 11.0648, "yc": 35.6726, "r": 18.8505}},
}
for r in opengeoslide.analyze(model)["results"]:
    strength = r["strength"]
    print(r["method"], r["status"], round(r["fos"], 4), "pasadas", strength["passes"],
          "dovelas de roca", len(strength["slices"]), r["warnings"])
    print("   ", strength["slices"][0])
# bishop converged 1.1804 pasadas 13 dovelas de roca 41 ['truncated_driving_mass', 'negative_effective_normal', 'hoek_brown_low_confinement']
#     {'law': 'hoek_brown', 'index': 0, 'normal_stress': -0.13491808290370108}
# spencer converged 1.1874 pasadas 11 dovelas de roca 41 ['truncated_driving_mass', 'negative_effective_normal', 'hoek_brown_low_confinement']
#     {'law': 'hoek_brown', 'index': 0, 'normal_stress': 3.854416496018189}
# janbu_simplified converged 1.1351 pasadas 13 dovelas de roca 41 ['truncated_driving_mass', 'negative_effective_normal', 'hoek_brown_low_confinement']
#     {'law': 'hoek_brown', 'index': 0, 'normal_stress': -0.1808731530132286}
```

(Con `morgenstern_price`, el motor usa la función de fuerzas entre dovelas por defecto, `half_sine`; las filas de referencia
de X28 usan `{"function": "constant"}`, que es la de cSlope y da el mismo FS que Spencer.)

**SHANSEP** (`model: "shansep"`): `unit_weight` y el objeto `shansep` con `ratio` (S, > 0), `exponent` (m, de 0 a 1, **0,8**
por defecto) y **exactamente uno** de `ocr` (≥ 1), `pop` (≥ 0, en la unidad de esfuerzo) u `ocr_by_elevation` (tabla
`[[y, OCR], …]` con `y` creciente, al menos 2 filas, constante fuera de la tabla). `Su = S·σ′v·OCR^m` con φ = 0, una vez por
dovela, sin iteración: el informe **no** trae `passes`. `σ′v` es estático: el sismo no entra.

```python
shansep = {
    "format": "opengeoslide", "version": "0.6", "units": "SI",
    "materials": [{"id": "arcilla", "name": "Arcilla", "model": "shansep", "unit_weight": 20.0,
                   "shansep": {"ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]]}}],
    "regions": [{"material": "arcilla", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]]}],
    "slope": {"direction": "right_to_left"},
    "analysis": {"methods": ["bishop", "spencer"], "slices": 50,
                 "surface": {"type": "circle", "xc": 29.511, "yc": 53.738, "r": 28.742}},
}
for r in opengeoslide.analyze(shansep)["results"]:
    s = r["strength"]["slices"][0]
    print(r["method"], round(r["fos"], 4), "passes" in r["strength"], s["law"], round(s["vertical_stress"], 3), round(s["ocr"], 4))
# bishop 0.831 False shansep 2.026 1.1668
# spencer 0.831 False shansep 2.026 1.1668
```

**Búsqueda no circular** (`analysis.search.non_circular`, un objeto con `seeds`, de 1 a 10 y **3** por defecto, y
`max_vertices`, 9, 17 o 33 y **33** por defecto; `{}` es válido). Parte de los mejores círculos de la búsqueda circular y
los refina a una polilínea. **No admite Bishop**, tampoco por defecto: sin `analysis.methods`, el método por defecto es
Bishop y el motor lo rechaza, así que declare los métodos.

```python
talud = {
    "format": "opengeoslide", "version": "0.6", "units": "SI",
    "materials": [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 18.82,
                   "cohesion": 41.65, "friction_angle": 15.0}],
    "regions": [{"material": "suelo", "polygon": [[-30, 0], [-30, 15], [18, 15], [48, 35], [100, 35], [100, 0]]}],
    "slope": {"direction": "auto"},
    "analysis": {"methods": ["spencer"], "slices": 50,
                 "search": {"type": "circular_entry_exit", "entry": [0, 66], "exit": [0, 66],
                            "n_entry": 20, "n_exit": 20, "n_radius": 20, "max_radius_factor": 5.0,
                            "non_circular": {"seeds": 3, "max_vertices": 33}}},
}
r = opengeoslide.analyze(talud)["results"][0]
nc = r["search"]["non_circular"]
print(r["method"], round(r["fos"], 4), nc["seeds"], nc["evaluated"], round(nc["seed_fos"], 4), round(nc["polyline_fos"], 4),
      len(r["surface"]["points"]), r["warnings"])
# spencer 1.3839 3 4500 1.4021 1.3839 33 ['negative_effective_normal']
```

- **La salida `strength`** (solo con algún material `hoek_brown` o `shansep`; se omite si no): `results[i]["strength"] =
  {"passes", "slices"}`. `passes` es el número de pasadas del lazo de Hoek-Brown de ese método y **se omite** sin
  Hoek-Brown. `slices` lista solo las dovelas de base `hoek_brown` o `shansep`, cada una con `index` (el de
  `results[i]["slices"]`), `law` y, en Hoek-Brown, `normal_stress` (σ′n de la solución) o, en SHANSEP, `vertical_stress`
  (σ′v) y `ocr`. En `results[i]["slices"]`, `cohesion` y `tan_phi` son los **con los que se calculó**: en Hoek-Brown, los de la
  última pasada; en SHANSEP, Su y 0.
- **La salida `search.non_circular`** (solo con `non_circular`): `results[i]["search"]["non_circular"] = {"seeds",
  "evaluated", "seed_fos", "polyline_fos"}`. `seed_fos` es el FS del mejor círculo antes de refinar y `polyline_fos` el de la
  mejor polilínea; `polyline_fos` **se omite** si ninguna polilínea fue admisible (entonces `evaluated` es 0 y el resultado es
  el círculo, con `surface` `{"xc", "yc", "r"}`, no `{"points"}`). Con polilínea, `fos` es `polyline_fos` y `surface` es
  `{"points": [[x, y], ...]}`.
- **Avisos nuevos** (códigos en `results[i]["warnings"]`): `hoek_brown_not_converged` (estado `not_converged`: el lazo no
  convergió en 50 pasadas), `hoek_brown_low_confinement` (nota: alguna dovela tiene σ′n bajo la regla de bajo confinamiento;
  una vez por método), `shansep_nonpositive_stress` (nota: alguna dovela tiene σ′v ≤ 0 y queda con Su = 0),
  `non_circular_large_change` (nota: el FS bajó más de 15 % respecto del mejor círculo) y `non_circular_not_refined` (nota:
  se pidió `non_circular` y `evaluated` es 0, E16x).
- **Combinaciones rechazadas** (F6.5), todas `ValueError` con código `InvalidModel`:

  ```python
  # roca con analysis.tension_crack = {"depth": "auto", "water_fill": 0.0}
  # InvalidModel: analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep; use una profundidad fija
  # un pile con lateral_pressure (Ito-Matsui) junto a un material hoek_brown o shansep
  # InvalidModel: lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep
  # bishop con analysis.search.non_circular
  # InvalidModel: el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)
  ```

  La grieta con profundidad numérica y un `pile` con `force` siguen permitidos. Los campos que el modelo no admite
  (`cohesion` en un `hoek_brown`, `ucs` en un `mohr_coulomb`, etc.) y los rangos (`el GSI del material 'roca' debe estar en
  [0, 100]`) se rechazan con el material y el campo en el mensaje.
- **Lo que hay que saber al leer los números.** Hoek-Brown usa la envolvente completa con bajo confinamiento: da el mismo FS que
  cSlope en roca confinada y **por debajo** (de −0,005 % a −2,9 % en las filas de X28) donde hay dovelas en tracción;
  nunca por encima. Una búsqueda no circular puede entrar a una rama con tracción (`negative_lambda` junto con
  `negative_effective_normal_major`) y dar un FS menor que el real: compare con Janbu o Bishop circular y revise N′. Véanse
  [Limitaciones](../../docs/limitaciones.md#hoek-brown-shansep-y-búsqueda-no-circular-formato-v06-qué-hace-y-qué-no).

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

`tests/test_v06.py` cubre el formato v0.6 con el wheel real: Hoek-Brown (las 20 filas de círculo fijo de X28 contra el prototipo de
la envolvente completa a 0,1 % y contra cSlope como cota, `strength.passes` y `strength.slices`, espejo, monotonía, sismo e
imperial), SHANSEP (las 13 filas de X30 contra cSlope 0.1.0 a 0,1 %, Su y OCR por dovela para `ocr`, `pop` y
`ocr_by_elevation`, sismo sin efecto en σ′v y el aviso de σ′v ≤ 0), la búsqueda no circular (V001-nc contra el publicado, las
cuatro cifras de `search.non_circular`, V050b, V093-nc, V103 sin polilínea admisible y la prohibición de Bishop), las
combinaciones de F6.5 y los rechazos de campos, rangos y versión. Las filas se leen de `docs/fase3/exploracion/` y
`verification/cases/`. `tests/test_v03.py` cubre el formato v0.3 (polilínea, no drenado, M-P, Janbu y el aviso de E13k) con valores de cSlope
0.1.0. `tests/test_v04.py` cubre el formato v0.4: las 32 filas de `docs/fase3/exploracion/X17.md` (siete de F4.13, 16 de
dirección inclinada y nueve de capacidad) contra el oráculo, con los cinco tipos y los tres modelos de `pullout`, los
estados de `reinforcement_forces` (`applied`, `outside_mass`, `compression_ignored` y `no_capacity`), las tres notas
nuevas, las identidades de la tablestaca, la compuerta de versión y los rechazos con su ruta JSON. `tests/test_v05.py`
cubre el formato v0.5: los cuatro ejemplos de [`docs/formato-ogs-json.md`](../../docs/formato-ogs-json.md) (grieta seca, embalse
al pie, pilote de Ito-Matsui y grieta con UDL y profundidad automática) con sus fragmentos, leídos del propio documento;
las filas contra cSlope 0.1.0 a 0,1 % (55 de grieta y agua embalsada de X21, 3 de R12 con agua embalsada activa, 28 de
Ito-Matsui de X22 y la de `ru` con piezométrica; se leen de `crates/ogs-core/tests/data/f3g*/`); las propiedades
(neutralidad entre v0.3 y v0.5, espejo, monotonía con `water_fill`, continuidad con `depth → 0`, sin sismo sobre el agua,
la compuerta de versión, los rechazos con su ruta y la salida siempre finita); y las reproducciones de las revisiones R12
y R13 (`docs/fase3/r12/repro/` y `docs/fase3/r13/repro/`): E15l-1, -5, -6, -7 y -11, y E15m-1, -2, -6, -7 y -15 corren sin marcas
(E15m-15 revisa E15l-2: la grieta sobre una discontinuidad toma profundidad y agua de `d(x_c)`, como cSlope, y el informe
trae `tension_crack.face_height`). Los tests usan el wheel instalado, no el código fuente.
`OGS_PY_TEST_HOOKS` fija qué build se espera:
`1` exige el hook, `0` exige que no exista; sin definir, los tests de pánico se omiten si el hook no está.

## Licencia

Apache-2.0.
