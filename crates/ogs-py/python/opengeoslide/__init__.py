"""OpenGeoSlide: motor de estabilidad de taludes 2D por equilibrio límite.

API pública:

- ``version()``: versión del motor (``ogs-core``).
- ``analyze_json(model_json)``: recibe un modelo ``.ogs.json`` como texto y devuelve el informe como texto JSON.
- ``analyze(model)``: igual, pero con un ``dict`` de entrada y un ``dict`` de salida.

Errores: ``ValueError`` si el motor rechaza el modelo; ``RuntimeError`` si el motor entra en pánico.
El mensaje de ``ValueError`` empieza por el código del error (``InvalidModel``, ``NoSurface``,
``NoValidSurface`` o ``Json``), seguido de ``: `` y el detalle en español.
"""

import json
from typing import Any

from ._core import analyze_json, version

__all__ = ["analyze", "analyze_json", "version"]


def analyze(model: dict[str, Any]) -> dict[str, Any]:
    """Analiza un modelo ``.ogs.json`` ya cargado como ``dict`` y devuelve el informe como ``dict``."""
    return json.loads(analyze_json(json.dumps(model)))
