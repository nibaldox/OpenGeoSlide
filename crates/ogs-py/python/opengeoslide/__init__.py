"""OpenGeoSlide: motor de estabilidad de taludes 2D por equilibrio límite.

API pública:

- ``version()``: versión del motor (``ogs-core``).
- ``analyze_json(model_json)``: recibe un modelo ``.ogs.json`` como texto y devuelve el informe como texto JSON.
- ``analyze(model)``: igual, pero con un ``dict`` de entrada y un ``dict`` de salida.

Errores: ``ValueError`` si el motor rechaza el modelo o si el ``dict`` contiene NaN o infinitos;
``RuntimeError`` si el motor entra en pánico.
El mensaje de ``ValueError`` empieza por el código del error (``InvalidModel``, ``NoSurface``,
``NoValidSurface`` o ``Json``), seguido de ``: `` y el detalle en español.

Formato v0.3 (``"version": "0.3"``): material ``undrained`` (``undrained_strength``, ``strength_datum``,
``strength_gradient``, ``strength_limit``), superficie ``polyline``, métodos ``morgenstern_price``, ``janbu_simplified``
y ``janbu_corrected`` y ``analysis.interslice``. Un campo de 0.3 con ``"version": "0.1"`` o ``"0.2"`` es
``InvalidModel`` (``<campo> requiere version "0.3"``); Bishop con una polilínea también lo es. En el informe,
``surface`` es ``{"xc", "yc", "r"}`` para un círculo y ``{"points": [[x, y], ...]}`` para una polilínea (ya ajustada al
terreno), y ``janbu_corrected`` agrega ``correction_factor`` (f₀) y ``morgenstern_price`` agrega ``interslice``.
Los estados ``Invalid`` nuevos son ``polyline_no_ground_crossing`` y ``polyline_outside_ground``; la Fase 3a no crea
códigos de aviso nuevos.
"""

import json
import math
from typing import Any

from ._core import analyze_json, version

__all__ = ["analyze", "analyze_json", "version"]


def analyze(model: dict[str, Any]) -> dict[str, Any]:
    """Analiza un modelo ``.ogs.json`` ya cargado como ``dict`` y devuelve el informe como ``dict``.

    Un NaN o un infinito en el ``dict`` no es JSON válido: se rechaza antes de llegar al motor con
    ``ValueError`` (código ``InvalidModel``, con la ruta del valor).
    """
    try:
        text = json.dumps(model, allow_nan=False)
    except ValueError as exc:
        location = _non_finite_location(model)
        if location is None:
            raise ValueError(f"Json: {exc}") from exc
        raise ValueError(
            f"InvalidModel: el modelo contiene un valor no finito (NaN o infinito) en {location}; "
            "un modelo .ogs.json solo admite números finitos"
        ) from exc
    return json.loads(analyze_json(text))


def _non_finite_location(value: Any, path: str = "modelo", active: tuple[int, ...] = ()) -> str | None:
    """Ruta del primer float no finito dentro de ``value``, o ``None``. Ignora las referencias circulares."""
    if isinstance(value, float):
        return None if math.isfinite(value) else path
    if isinstance(value, (dict, list, tuple)):
        if id(value) in active:
            return None  # referencia circular: json.dumps ya informa de ella
        stack = (*active, id(value))
        if isinstance(value, dict):
            children = [(f"{path}.{key}" if isinstance(key, str) else f"{path}[{key!r}]", item) for key, item in value.items()]
        else:
            children = [(f"{path}[{index}]", item) for index, item in enumerate(value)]
        for child_path, item in children:
            found = _non_finite_location(item, child_path, stack)
            if found is not None:
                return found
    return None
