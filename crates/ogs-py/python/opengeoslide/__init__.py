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
``InvalidModel`` (``<campo> requiere version "0.3"``). Bishop con una polilínea también es ``InvalidModel``, y como sin
``analysis.methods`` el método por defecto es ``["bishop"]``, una polilínea fija **exige** ``methods`` (E13l-8; el
esquema ``ogs-0.3.schema.json`` lo exige igual).

El informe (``results[i]``):

- ``surface`` es ``{"xc", "yc", "r"}`` para un círculo y ``{"points": [[x, y], ...]}`` para una polilínea, ya ajustada
  al terreno (prolongada o recortada en sus extremos). Si la masa se trunca (``truncated_driving_mass``), la polilínea
  informada se recorta al rango analizado (E13l-7).
- ``janbu_corrected`` agrega ``correction_factor`` (f₀ ≥ 1: la corrección nunca reduce F₀, E13l-1) y
  ``morgenstern_price`` agrega ``interslice`` (``function`` y, con ``data_points``, ``points``) y ``lambda``.

Estados y avisos de la Fase 3a, en ``results[i]["status"]`` y ``results[i]["warnings"]``:

- ``status == "invalid"`` con ``polyline_no_ground_crossing`` (un extremo no corta el terreno al prolongarlo) o
  ``polyline_outside_ground`` (un vértice interior no queda bajo el terreno, o un tramo pasa sobre él). No son
  excepciones: la corrida termina y el método queda sin FS.
- ``bishop_non_circular`` (``invalid``): Bishop sobre una superficie no circular; el motor ya lo rechaza al validar, y
  esta es la defensa.
- ``interslice_shear_exceeds_strength`` (aviso, E13k): en Spencer y M-P, el cortante entre dovelas supera la
  resistencia de las caras verticales (Chen y Morgenstern, 1983; ``r_v > 3``). El FS puede no ser físico: compárelo con
  Janbu. Que no aparezca no garantiza que la solución sea física (``docs/limitaciones.md``).
- Desde E13l: la nota ``janbu_correction_extrapolated`` (el factor f₀ de Janbu se extrapola más allá del gráfico de 1973)
  y ``non_positive_fos`` (``not_converged``: el método llegó a un FS no positivo o no finito; ningún método devuelve
  ``converged`` con un FS ≤ 0).

Formato v0.4 (``"version": "0.4"``): ``reinforcements``, una lista al nivel raíz, después de ``loads``. Tipos
(``type``): ``anchor``, ``nail`` y ``geosynthetic`` (tracción: ``tensile_capacity``, ``end1_capacity``, ``end2_capacity``,
``spacing``, ``direction`` en ``axial``, ``tangent`` o ``bisector`` y ``pullout`` con ``model`` ``bond``, ``interface`` o
``development``), ``pile`` (``force`` por pilote, ``spacing``, ``direction`` en ``angle``, ``tangent`` o ``perpendicular``
y ``angle`` solo con ``angle``) y ``sheet_pile`` (``force`` por metro de muro, vertical: ``x1 = x2``). Todos llevan ``id``
único, ``x1, y1`` (cabeza), ``x2, y2`` (punta) y ``application`` (``active`` o ``passive``, obligatorio). ``reinforcements``
no vacío con ``version`` menor que ``"0.4"`` es ``InvalidModel`` (``reinforcements requiere version "0.4"``); con la lista
ausente o vacía el resultado es idéntico al de la v0.2.0. Los errores de campo llevan su ruta JSON
(``reinforcements[0].pullout.coverage debe estar en (0, 1], no 1.5``); ``pile`` y ``sheet_pile`` no admiten ``location``.

Informe con refuerzos: ``results[i]["reinforcement_forces"]`` (se omite si no hay refuerzos) trae, solo en la superficie
final, una entrada por cruce con ``id``, ``crossing``, ``x``, ``y``, ``station``, ``available`` (por metro), ``fx`` y ``fy``
(fuerza aplicada por metro, en coordenadas del modelo con y hacia arriba; en un pasivo, antes de dividir por F),
``application`` y ``status``: ``applied``, ``outside_mass``, ``compression_ignored`` o ``no_capacity`` (capacidad nula en el
cruce, por ejemplo el tramo libre de un tirante sin ``end1_capacity``; no emite nota). Notas informativas nuevas en
``warnings``: ``reinforcement_outside_mass``, ``reinforcement_compression_ignored`` y ``structural_checks_not_covered``.

**Límite estructural (F4.8).** Con un ``pile`` o una ``sheet_pile``, OpenGeoSlide calcula la estabilidad **global** con el
elemento incluido como una fuerza dada. **No** calcula el empuje sobre el elemento, el empotramiento, el momento flector, la
deflexión ni las comprobaciones internas o externas de un muro (nota ``structural_checks_not_covered``). Véanse
``docs/formato-ogs-json.md`` y ``docs/limitaciones.md``.
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
