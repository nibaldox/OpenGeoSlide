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
``development``), ``pile`` (``force`` por pilote, o ``lateral_pressure`` desde la v0.5; ``spacing``, ``direction`` en
``angle``, ``tangent`` o ``perpendicular`` y ``angle`` solo con ``angle``) y ``sheet_pile`` (``force`` por metro de muro,
vertical: ``x1 = x2``). Todos llevan ``id`` único, ``x1, y1`` (cabeza), ``x2, y2`` (punta) y ``application`` (``active`` o
``passive``, obligatorio). ``reinforcements`` no vacío con ``version`` menor que ``"0.4"`` es ``InvalidModel``
(``reinforcements requiere version "0.4"``). Con la lista ausente o vacía el resultado es idéntico al de la v0.2.0, con
dos excepciones documentadas: V065 (un círculo con la tangente vertical sobre el terreno, que la v0.2.0 rechazaba por
redondeo) y, desde la v0.5, el agua embalsada (véase más abajo). Los errores de campo llevan su ruta JSON
(``reinforcements[0].pullout.coverage debe estar en (0, 1], no 1.5``). Un ``pile`` o una ``sheet_pile`` con ``force`` no
admite ``location``: con una fuerza dada no cambia ningún número; en el pilote con ``lateral_pressure``, ``location`` va
dentro de ese objeto.

Informe con refuerzos: ``results[i]["reinforcement_forces"]`` (se omite si no hay refuerzos) trae, solo en la superficie
final, una entrada por cruce con ``id``, ``crossing``, ``x``, ``y``, ``station``, ``available`` (por metro), ``fx`` y ``fy``
(fuerza aplicada por metro, en coordenadas del modelo con y hacia arriba; en un pasivo, antes de dividir por F),
``application`` y ``status``: ``applied``, ``outside_mass``, ``compression_ignored`` o ``no_capacity`` (capacidad nula en el
cruce, por ejemplo el tramo libre de un tirante sin ``end1_capacity``; no emite nota). Notas informativas nuevas en
``warnings``: ``reinforcement_outside_mass``, ``reinforcement_compression_ignored`` y ``structural_checks_not_covered``.

Formato v0.5 (``"version": "0.5"``), publicado en la 0.4.0: la grieta de tracción y la presión de suelo de
Ito-Matsui en un pilote. El **agua embalsada** no es un campo y vale en todas las versiones (véase más abajo). Un campo de
0.5 con una versión menor es ``InvalidModel`` (``tension_crack requiere version "0.5"`` o ``lateral_pressure requiere
version "0.5"``).

**Grieta de tracción** (``analysis.tension_crack``). Es un objeto con ``depth`` (un número finito > 0 en la unidad de
longitud del modelo, o la cadena ``"auto"``, la profundidad de Rankine) y ``water_fill`` (fracción llena de agua, de 0 a
1; obligatorio y sin valor por defecto). Es vertical, una por superficie y sin campo de posición: su ``x`` sale de la
superficie y de la profundidad. La grieta **trunca cada superficie**: quita la masa del lado de la cresta, que no se
conserva como carga, y deja una cara vertical sin resistencia. Con agua, ``Pw = ½·γw·(water_fill·depth)²`` es una fuerza
horizontal en el sentido del deslizamiento, que no pesa ni cambia la presión de poros de la base. Cada resultado cuya
superficie se truncó trae ``results[i]["tension_crack"] = {"x", "depth", "water_force"}`` (más ``"face_height"`` cuando la cara
cortada difiere de ``depth``; se omite sin grieta; con
``"auto"`` y profundidad nula, ``depth`` y ``water_force`` valen 0 y el FS es el de la superficie sin grieta). Una
superficie que no alcanza la profundidad se descarta en una búsqueda y, si es fija, es
``ValueError("NoValidSurface: tension_crack_not_reached: ...")``; no hay tope de profundidad por la altura del talud. Una
grieta **seca** puede subir el FS (la masa que se quita empujaba); con agua, el FS baja con ``water_fill``.

Si la profundidad automática salta por una carga ``udl``, por un cambio lateral de material o por un escalón del terreno,
la profundidad y el agua salen de ``d(x_c)`` en el ``x_c`` de la bisección (como cSlope; con una profundidad numérica, es la
del usuario), y cuando la cara cortada, ``terreno(x_c) − base(x_c)``, difiere de ``depth``, el informe agrega
``tension_crack["face_height"]`` (se omite en una grieta normal); si esa cara no pasa de la tolerancia, no hay grieta
(E15m-15, que revisa E15l-2). Medido con una ``udl`` de 100 kN/m sobre la cresta (talud de 10 m, c = 20, φ = 10°, círculo fijo,
``docs/fase3/r12/repro/a04_udl.json``), Bishop da ``depth`` 0, ``water_force`` 0 y ``face_height`` 1,78272, con FS 1,102248
(cSlope 0.1.0, 1,102311; E15l-2 daba 1,095348). Una búsqueda en la que
todos los candidatos fallan por la grieta termina en ``ValueError("NoValidSurface: ... (E evaluadas, 0 válidas; K no
alcanzan la grieta de tracción, tension_crack_not_reached)")``; por ejemplo, con ``depth`` 40 m en el talud de
``a01_ltr.json``: ``(7400 evaluadas, 0 válidas; 7397 no alcanzan la grieta de tracción, tension_crack_not_reached)``.

**Agua embalsada** (todas las versiones, sin campo). Si la piezométrica (``water.piezometric_line``) pasa **sobre el
terreno**, el agua libre entre la piezométrica y el terreno carga las dovelas con su peso (vertical) y su empuje
horizontal, además de la presión de poros de siempre; en una cara vertical (presa) entra el empuje hidrostático del
paramento. El sismo pseudoestático no actúa sobre esa agua ni sobre ``Pw``. En un material con ``ru``, la presión de poros
es ``u = ru·(W + V)/b`` (``V`` es el peso del agua embalsada), la regla de Slide2, que no se puede comparar con el
oráculo. **Cambia el resultado frente a la v0.3.0:** un modelo cuya piezométrica pasa sobre el terreno, que la v0.3.0
marcaba con ``water_above_ground``, da otro FS a propósito (V047a con 2 m de agua al pie, Bishop con superficie fija:
0,848 con la v0.3.0 y 0,939 ahora, el valor de cSlope); si guardó resultados de ese tipo, vuelva a calcularlos. Un modelo
sin agua sobre el terreno y sin ``tension_crack`` da la misma salida, byte a byte, que la v0.3.0, **salvo en unidades
imperiales con agua y sin ``water.unit_weight``**: ese archivo toma γw ≈ 62,45 pcf (la v0.3.0 tomaba 9,81 «pcf»), cambia
de FS a propósito (tercera excepción a la identidad, E15l-6 y E15m-6) y el motor agrega el aviso informativo
``water_unit_weight_default``. ``water_above_ground``
queda como **nota informativa**. El peso unitario del agua es ``water.unit_weight``; si falta, vale 9,81 kN/m³ en SI y,
en imperial, el resultado de convertir ese valor (alrededor de 62,45 pcf), y rige para la piezométrica, el agua embalsada
y el agua de la grieta. Medido: una grieta de 2 m con agua y sin bloque ``water``, convertida de SI a imperial, da con
Bishop el mismo FS que en SI (1,69865) y ``Pw`` = 1344,40 lbf/ft (γw = 62,449 pcf); antes daba 1,71248 y 211,19 lbf/ft, con
γw = 9,81 «pcf».

**Pilote de Ito-Matsui** (``reinforcements[i].lateral_pressure``, en un ``pile``). En lugar de una ``force`` dada, el motor
calcula la fuerza que el suelo **entre pilotes** ejerce sobre una fila de pilotes **rígidos y verticales**, según Ito y
Matsui (1975), en deformación plana. ``force`` y ``lateral_pressure`` se excluyen: tiene que haber exactamente uno.
``lateral_pressure = {"model": "ito_matsui", "diameter": D, "location": "centroid" | "slip_surface"}``, con ``location``
obligatorio; ``spacing`` (de eje a eje) debe ser mayor que ``diameter`` y el pilote es vertical (``x1 = x2``).
``capacity`` (opcional, solo con ``lateral_pressure``) lleva ``shear`` (fuerza de corte por pilote), ``moment`` (momento
por pilote) o ambos, y es un **tope**, no una comprobación del perfil. Cada cruce agrega a su entrada de
``reinforcement_forces`` los campos ``soil_force`` (fuerza del suelo por metro, antes del tope), ``governs`` (``soil``,
``shear`` o ``bending``) y ``arm`` (el brazo de la resultante sobre el cruce); un pilote con ``force`` no los trae. El
aviso ``ito_matsui_spacing_range`` sale con S/D < 2 o S/D > 8, donde la fórmula pierde validez. Si el perfil de presión no
es finito (S/D cerca de 1 con φ alto), el motor rechaza el modelo con ``ValueError("InvalidModel:
reinforcements[i].lateral_pressure: la presión de Ito-Matsui no es finita ...")`` y nunca devuelve ``NaN`` ni ``∞``. En un
material con ``ru``, la tensión efectiva vertical es ``σ′v = σv − ru·σ_suelo``, sin restar la ``u`` de la piezométrica.
Medido: con φ = 35°, S/D = 1,00125 y ``capacity``, el modelo de ``a02_fixed.json`` da ``InvalidModel: ... la presión de
Ito-Matsui no es finita con S/D = 1.00125 y φ = 35° ...`` (antes, Bishop daba ``invalid`` y los otros tres métodos
``not_converged``); la fila X22-S16, con ``ru`` y piezométrica, queda a 0,026 % o menos de cSlope en los cinco métodos (antes,
de −1,88 % a −1,97 %); y con la cabeza a 0,0124 m sobre el cruce, ``arm`` vale 0,006182 m y gobierna ``bending`` (antes, 0 y
``soil``).

**Límite estructural.** Con un ``pile`` o una ``sheet_pile`` con ``force``, OpenGeoSlide calcula la estabilidad **global**
con el elemento incluido como una fuerza dada y **no** calcula el empuje sobre él. Con ``lateral_pressure`` el motor estima
la fuerza del suelo entre pilotes (``soil_force``) y la acota con ``capacity``, pero eso **no es el diseño del pilote**:
supone un pilote rígido, no calcula el empotramiento, el momento flector, la deflexión ni las comprobaciones internas o
externas de un muro, y no comprueba que el perfil resista ``shear`` o ``moment``. La nota
``structural_checks_not_covered`` sale siempre que hay un ``pile`` o una ``sheet_pile``. Véanse
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
