# Formato `.ogs.json`: sismo y cargas (v0.2)

Los modelos de OpenGeoSlide se guardan como `.ogs.json`. La web los abre y los guarda, la CLI y el paquete de Python
los leen. Esquemas: [`schema/ogs-0.1.schema.json`](../schema/ogs-0.1.schema.json) (v0.1) y
[`schema/ogs-0.2.schema.json`](../schema/ogs-0.2.schema.json) (v0.2, que agrega `loads` y `analysis.seismic` y acepta
también v0.1). El ejemplo mínimo es [`examples/acads1a.ogs.json`](../examples/acads1a.ogs.json).

## Ejemplo y reglas de v0.2

El motor acepta `version: "0.1"` y `"0.2"`. Los campos `loads` y `analysis.seismic` solo se admiten con `"0.2"`; con
`"0.1"` el motor responde `InvalidModel: los campos 'loads' y 'analysis.seismic' requieren version "0.2"`. Un modelo sin
estos campos da el mismo resultado en las dos versiones. Esquema: [`schema/ogs-0.2.schema.json`](../schema/ogs-0.2.schema.json).

```json
{
  "format": "opengeoslide",
  "version": "0.2",
  "meta": { "id": "ejemplo-sismo-cargas", "title": "Talud con sobrecarga y sismo" },
  "units": "SI",
  "materials": [
    { "id": "soil", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 15.0, "friction_angle": 26.0 }
  ],
  "regions": [
    { "material": "soil", "polygon": [[0, -8], [0, 10], [10, 10], [25, 0], [40, 0], [40, -8]] }
  ],
  "water": { "unit_weight": 9.81 },
  "loads": [
    { "type": "udl",  "id": "u1", "x1": 7.0, "x2": 10.0, "q": 20.0 },
    { "type": "line", "id": "l1", "x": 4.0, "p": 100.0, "angle": 15.0 }
  ],
  "slope": { "direction": "left_to_right" },
  "analysis": {
    "methods": ["bishop", "spencer"],
    "slices": 50,
    "seismic": { "kh": 0.1, "kv": 0.0 },
    "search": { "type": "circular_entry_exit" }
  }
}
```

Con la búsqueda por defecto, este modelo da Bishop 1,2723 y Spencer 1,2704 (`ogs analyze`).

- `loads` va después de `water` y antes de `slope`. Cada carga puede llevar un `id` (único).
  - `udl`: carga vertical `q` ≥ 0 (kPa; psf en imperial) sobre el terreno entre `x1` < `x2`, dentro del rango x del modelo.
  - `line`: carga lineal `p` ≥ 0 (kN/m; lbf/ft en imperial) en `(x, y_top(x))`. `angle` en [−90°, 90°] desde la vertical
    hacia abajo; el positivo inclina la carga hacia +x del modelo.
- `analysis.seismic`: `kh` en [0, 1) y `kv` en (−1, 1). `kh·W` actúa en el sentido del deslizamiento; con `kv > 0`, `kv·W`
  actúa hacia abajo. Se aplican al peso del suelo, nunca a las cargas.
- Una carga que no toca ninguna dovela de suelo de la superficie reportada da la nota `load_outside_mass`.
