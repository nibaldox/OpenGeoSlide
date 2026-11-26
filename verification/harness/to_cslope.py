"""OpenGeoSlide .ogs.json v0.1 / v0.2 / v0.3 -> cSlope 0.1.0 analysis document.

Translation only: nothing is computed here. The correspondence table and the
known, documented differences are in README.md.

Schema v0.3 (contract F3.8)
---------------------------
- material ``undrained`` -> cSlope ``undrained``: ``undrained_strength`` -> ``undrainedShearStrength``,
  ``strength_datum`` -> ``suRefDepth`` (an elevation, not a depth), ``strength_gradient`` -> ``suRateOfChange``,
  ``strength_limit`` -> ``suMax``. (``s-f-datum`` is the same law with other names.)
- ``analysis.surface`` of type ``polyline`` -> ``definition.customSurfaces = [{points}]`` with
  ``customPlanesOnly`` (no axis: the method must not need one).
- ``morgenstern_price`` -> ``Morgenstern-Price`` with ``intersliceFunction`` in kebab-case (``half-sine`` by
  default, ``clipped-sine``, ``trapezoidal``, ``constant``, ``data-point-specified`` with ``intersliceDataPoints``).
  ``spencer`` stays ``Morgenstern-Price`` with ``constant``.
- ``janbu_simplified`` / ``janbu_corrected`` -> ``Janbu`` with ``janbuCorrection`` false / true.
- ``bishop`` on a polyline is refused (``UnsupportedModel``): contract F3.6, its FS would depend on the moment axis
  (the oracle accepts it, with the warning ``bishop-non-circular``).

Seismic coefficients and loads (schema v0.2, contract F1.1)
-----------------------------------------------------------
``analysis.seismic {kh, kv}`` -> ``options.seismicHorizontal`` / ``options.seismicVertical`` (a zero
coefficient is left out: cSlope takes ``kh`` in (0, 1] and treats a missing value as 0).
``loads[]`` of type ``udl`` -> ``definition.udls[] {magnitude: q, x1, x2, direction: "vertical"}``;
type ``line`` -> ``definition.lineLoads[] {x, magnitude: p, angle}``. A load with q = 0 or p = 0 is
left out (cSlope needs magnitude > 0) and noted. The fields are only accepted with ``version "0.2"``.
The ``id`` of an ogs load is not sent: the installed cslope 0.1.0 reports ``unknown-key`` (severity
``error``) for ``id`` in ``udls[]`` and ``lineLoads[]`` (checked with ``cslope.validate``; the newer source
clone does list it). Ids are still checked for repetition here.

Angle convention of the line load, checked against the oracle (cslope 0.1.0, V047a fixed circle
xc = 29.54334963719809, yc = 53.63784815923435, r = 28.641487934160704, Bishop, 50 slices, P = 20 kN/m,
load at x = 40 inside the mass; the ``ltr`` model is the mirror image of the ``rtl`` one, x -> -x,
so the load is at x = -40). The angle goes **unchanged** into ``lineLoads[].angle``: it is measured from
the downward vertical and a positive value tilts the load towards +x **of the model frame**, for both
orientations. cSlope mirrors a right-to-left geometry internally (``canonical.rs``: x -> xmin + xmax - x
and ``angle -> -angle``), so no sign flip is done here. Real output (minFOS)::

    rtl  sin carga          0.9850842466548518
    rtl  angle = +0         0.9836208911149462
    rtl  angle = +10        0.9920950618992327   (+x = against the sliding, which goes to -x: F rises)
    rtl  angle = -10        0.9753135037279751
    ltr  sin carga          0.9850842466548818
    ltr  angle = +0         0.9836208911149332
    ltr  angle = +10        0.9753135037279624   (+x = along the sliding: F falls)
    ltr  angle = -10        0.9920950618992197

The ``ltr`` mirror with the angle sign reversed reproduces the ``rtl`` value to 1e-13 (relative).
Seismic ``kh`` acts along the sliding direction in both orientations and ``kv > 0`` is downward.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, unary_union

# The installed cSlope 0.1.0 engine ignores the `waterUnitWeight` option and
# always uses 9.807 (in the units of the model). OpenGeoSlide's default is 9.81 (see README.md).
CSLOPE_WATER_UNIT_WEIGHT = 9.807
# Largest |water.unit_weight - 9.807| accepted with a piezometric line (contract §1: 9.81 is the default).
WATER_UNIT_WEIGHT_TOL = 0.01

# Water line of the materials whose ru replaces the piezometric pressure.
# Placed far below the model so that it contributes no pore pressure.
DRY_LINE_ID = "ogs-ru-no-water"
DRY_LINE_DEPTH = 1000.0
CSLOPE_MIN_SLICES = 10
CSLOPE_MAX_SLICES = 500
CSLOPE_MIN_ITERATIONS = 500
CSLOPE_MAX_ITERATIONS = 100000
METHOD_MAP = {
    "bishop": "Bishop", "spencer": "Morgenstern-Price", "morgenstern_price": "Morgenstern-Price",
    "janbu_simplified": "Janbu", "janbu_corrected": "Janbu",
}
SEISMIC_LOADS_VERSION = "0.2"
F3_VERSION = "0.3"
F3_METHODS = ("morgenstern_price", "janbu_simplified", "janbu_corrected")
# ogs interslice function -> cSlope `intersliceFunction`
INTERSLICE_MAP = {
    "constant": "constant", "half_sine": "half-sine", "clipped_sine": "clipped-sine",
    "trapezoidal": "trapezoidal", "data_points": "data-point-specified",
}


class UnsupportedModel(ValueError):
    """A model feature that cSlope 0.1.0 cannot express exactly."""


@dataclass
class Conversion:
    document: dict
    notes: list[str] = field(default_factory=list)
    orientation: str = "ltr"


# ---------------------------------------------------------------- geometry

def regions_of(model: dict) -> list[tuple[str, Polygon]]:
    """(material id, polygon) per region, validated: simple, non-overlapping."""
    out: list[tuple[str, Polygon]] = []
    for i, reg in enumerate(model.get("regions", [])):
        pts = [(float(x), float(y)) for x, y in reg["polygon"]]
        poly = Polygon(pts)
        if len(pts) < 3 or not poly.is_valid or poly.area <= 0:
            raise UnsupportedModel(f"region {i} is not a simple valid polygon")
        out.append((reg["material"], poly))
    if not out:
        raise UnsupportedModel("the model has no regions")
    for i in range(len(out)):
        for j in range(i + 1, len(out)):
            pi, pj = out[i][1], out[j][1]
            overlap = pi.intersection(pj).area
            if overlap > 1e-9 * min(pi.area, pj.area):
                raise UnsupportedModel(f"regions {i} and {j} overlap")
    return out


def outline_of(polys: list[tuple[str, Polygon]]) -> Polygon:
    """Exterior of the union of all regions (the slope outline)."""
    union = unary_union([p for _, p in polys])
    if not isinstance(union, Polygon):
        raise UnsupportedModel("the regions do not form one connected outline")
    if len(union.interiors):
        raise UnsupportedModel("the regions enclose holes")
    return union


def y_top(outline: Polygon, x: float) -> float:
    """Terrain elevation at x: the highest intersection of the vertical line."""
    miny, maxy = outline.bounds[1], outline.bounds[3]
    seg = LineString([(x, miny - 1.0), (x, maxy + 1.0)]).intersection(outline)
    if seg.is_empty:
        raise UnsupportedModel(f"x={x} is outside the model")
    return float(seg.bounds[3])


def arc_y(circle: dict, x: float) -> float:
    """Lower arc of the fixed circle at x (the part of the circle the slip surface uses)."""
    xc, yc, r = float(circle["xc"]), float(circle["yc"]), float(circle["r"])
    return yc - math.sqrt(max(r * r - (x - xc) ** 2, 0.0))


def arc_terrain_crossings(circle: dict, outline: Polygon) -> tuple[float, float] | None:
    """x of the outermost crossings of the lower arc with the terrain, or None.

    Mirrors ogs-core `lower_arc_tramo` (contract E2): the first and the last x where the arc
    passes from above to below the ground (or back). Sign changes are found on a dense grid and
    refined by bisection; a crossing lying between two grid points is therefore located to
    about width / 4000 / 2**60, and a tangency that falls between grid points is missed.
    """
    xc, r = float(circle["xc"]), float(circle["r"])
    minx, _, maxx, _ = outline.bounds
    a, b = max(xc - r, minx), min(xc + r, maxx)
    if not a < b:
        return None

    def under(x: float) -> bool:
        return arc_y(circle, x) < y_top(outline, x)

    n = 4000
    xs = [a + (b - a) * i / n for i in range(n + 1)]
    states = [under(x) for x in xs]
    flips = [i for i in range(n) if states[i] != states[i + 1]]
    if not flips:
        return None

    def refine(i: int) -> float:
        lo, hi = xs[i], xs[i + 1]
        lo_state = states[i]
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            if under(mid) == lo_state:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    return refine(flips[0]), refine(flips[-1])


def resolve_direction(model: dict, outline: Polygon, kind: str | None = None) -> str:
    """OpenGeoSlide slope.direction -> cSlope orientation ('ltr' | 'rtl').

    Resolution follows contract §1 (amendments E1, E1b) and ogs-core's `resolve_sliding`:

    0. an explicit ``left_to_right`` / ``right_to_left`` always wins;
    1. ``auto`` with both search ranges whose midpoints differ by more than 1e-9 · width: the mass
       goes from the entry range to the exit range (E1b: equal midpoints fall through to 2);
    2. the higher end of the terrain is the crest, when |y_top(x_min) - y_top(x_max)| > 1e-6 · height;
    3. a fixed circle (only when no search is analysed): the higher of its outermost ground
       crossings is the entry; the mass moves towards the lower one (tie: 1e-6 · height, go to 4);
    4. otherwise UnsupportedModel (indicate slope.direction).

    ``kind`` is the check kind ('fixed' | 'search') the direction is resolved for. ogs runs a fixed
    check without ``analysis.search`` and a search check without ``analysis.surface``, so the other
    block is ignored here too. ``None`` uses the model as written.
    """
    direction = (model.get("slope") or {}).get("direction", "auto")
    if direction == "left_to_right":
        return "ltr"
    if direction == "right_to_left":
        return "rtl"
    if direction != "auto":
        raise UnsupportedModel(f"unknown slope.direction {direction!r}")

    minx, miny, maxx, maxy = outline.bounds
    width, height = maxx - minx, maxy - miny
    analysis = model.get("analysis") or {}
    search = analysis.get("search")
    surface = analysis.get("surface")
    if kind == "fixed":
        search = None
    elif kind == "search":
        surface = None

    # 1. both search ranges (E1), with the E1b midpoint test
    if search and search.get("entry") is not None and search.get("exit") is not None:
        mid_entry = 0.5 * (float(search["entry"][0]) + float(search["entry"][1]))
        mid_exit = 0.5 * (float(search["exit"][0]) + float(search["exit"][1]))
        if abs(mid_entry - mid_exit) > 1e-9 * width:
            return "ltr" if mid_entry < mid_exit else "rtl"

    # 2. the higher end of the terrain is the crest
    y_left, y_right = y_top(outline, minx), y_top(outline, maxx)
    if abs(y_left - y_right) > 1e-6 * height:
        return "ltr" if y_left > y_right else "rtl"

    # 3. fixed circle: its higher outermost ground crossing is the entry
    if surface is not None and search is None and surface.get("type") == "polyline":
        # the higher end of the polyline is the entry (its ends, as written, stand for the ones fitted to the ground)
        pts = surface["points"]
        y_p, y_q = float(pts[0][1]), float(pts[-1][1])
        if abs(y_p - y_q) > 1e-6 * height:
            return "ltr" if y_p > y_q else "rtl"
    elif surface is not None and search is None:
        if surface.get("type") != "circle":
            raise UnsupportedModel("only circular and polyline fixed surfaces are supported")
        crossings = arc_terrain_crossings(surface, outline)
        if crossings is not None:
            y_p, y_q = arc_y(surface, crossings[0]), arc_y(surface, crossings[1])
            if abs(y_p - y_q) > 1e-6 * height:
                return "ltr" if y_p > y_q else "rtl"

    # 4. undetermined
    raise UnsupportedModel(
        "no se puede determinar el sentido del deslizamiento: indique slope.direction"
    )


def unit_label(model: dict) -> str:
    """Unit name for notes: 'pcf' for imperial models, 'kN/m3' otherwise."""
    return "pcf" if model.get("units") == "imperial" else "kN/m3"


def _linestrings(geom: Any) -> list[LineString]:
    if geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    if hasattr(geom, "geoms"):
        return [ls for g in geom.geoms for ls in _linestrings(g)]
    return []


def interior_boundaries(polys: list[tuple[str, Polygon]]) -> list[list[list[float]]]:
    """Shared edges between regions, as polylines (they never lie on the outline)."""
    lines: list[LineString] = []
    for i in range(len(polys)):
        for j in range(i + 1, len(polys)):
            shared = polys[i][1].boundary.intersection(polys[j][1].boundary)
            lines.extend(_linestrings(shared))
    if not lines:
        return []
    merged = linemerge(lines)
    return [[[float(x), float(y)] for x, y in ls.coords] for ls in _linestrings(merged)]


# ------------------------------------------------- water, circles (round trip)

def water_table_from_piezo(points: list) -> dict:
    """OpenGeoSlide piezometric_line -> cSlope waterTable (custom, clipped to ground)."""
    pts = sorted(([float(x), float(y)] for x, y in points), key=lambda p: p[0])
    return {"mode": "custom", "value": pts, "freeWater": False}


def piezo_from_water_table(water_table: dict) -> list[list[float]]:
    """Inverse of water_table_from_piezo."""
    if water_table.get("mode") != "custom":
        raise ValueError(f"only a custom water table has points, not {water_table.get('mode')!r}")
    return [[float(x), float(y)] for x, y in water_table["value"]]


def plane_from_circle(circle: dict) -> dict:
    """OpenGeoSlide fixed circle {xc, yc, r} -> cSlope customSearchPlanes entry."""
    if circle.get("type") != "circle":
        raise UnsupportedModel("only circular fixed surfaces are supported")
    return {"cx": float(circle["xc"]), "cy": float(circle["yc"]), "radius": float(circle["r"])}


def polyline_surface(surface: dict) -> dict:
    """OpenGeoSlide fixed polyline {points} -> cSlope customSurfaces entry (no axis)."""
    if surface.get("type") != "polyline":
        raise UnsupportedModel("only polyline surfaces map to customSurfaces")
    pts = [[float(x), float(y)] for x, y in surface["points"]]
    if len(pts) < 2 or any(b[0] <= a[0] for a, b in zip(pts, pts[1:])):
        raise UnsupportedModel("polyline with fewer than 2 points or x not strictly increasing")
    return {"points": pts}


def circle_from_plane(plane: dict) -> dict:
    """Inverse of plane_from_circle."""
    return {"type": "circle", "xc": float(plane["cx"]), "yc": float(plane["cy"]), "r": float(plane["radius"])}


# ---------------------------------------------- seismic coefficients and loads (v0.2)

def _finite(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise UnsupportedModel(f"{name} debe ser un número finito, no {value!r}")
    return float(value)


def seismic_options(model: dict, notes: list[str]) -> dict[str, float]:
    """``analysis.seismic`` -> cSlope ``seismicHorizontal`` / ``seismicVertical`` options.

    kh in [0, 1) and kv in (-1, 1) (contract F1.1). A zero coefficient is omitted.
    """
    seismic = (model.get("analysis") or {}).get("seismic")
    if seismic is None:
        return {}
    unknown = sorted(set(seismic) - {"kh", "kv"})
    if unknown:
        raise UnsupportedModel("analysis.seismic con campos desconocidos: " + ", ".join(unknown))
    kh = _finite(seismic.get("kh", 0.0), "analysis.seismic.kh")
    kv = _finite(seismic.get("kv", 0.0), "analysis.seismic.kv")
    if not 0.0 <= kh < 1.0:
        raise UnsupportedModel("analysis.seismic.kh debe estar en [0, 1)")
    if not -1.0 < kv < 1.0:
        raise UnsupportedModel("analysis.seismic.kv debe estar en (-1, 1)")
    out: dict[str, float] = {}
    if kh != 0.0:
        out["seismicHorizontal"] = kh
    if kv != 0.0:
        out["seismicVertical"] = kv
    if out:
        notes.append(
            f"sismo pseudoestático kh={kh:g}, kv={kv:g}: kh en el sentido del deslizamiento, kv>0 hacia abajo "
            "(misma convención en cSlope, ltr y rtl)."
        )
    return out


def loads_to_cslope(model: dict, notes: list[str]) -> dict[str, list[dict]]:
    """``loads[]`` -> ``{"udls": [...], "lineLoads": [...]}`` (only the non-empty lists).

    The line-load angle is passed through unchanged for ltr and rtl (see the module docstring).
    """
    udls: list[dict] = []
    lines: list[dict] = []
    seen: set[str] = set()
    for i, load in enumerate(model.get("loads") or []):
        kind = load.get("type")
        if kind not in ("udl", "line"):
            raise UnsupportedModel(f"carga {i}: tipo {kind!r} no soportado")
        allowed = {"type", "id", "x1", "x2", "q"} if kind == "udl" else {"type", "id", "x", "p", "angle"}
        unknown = sorted(set(load) - allowed)
        if unknown:
            raise UnsupportedModel(f"carga {i} ({kind}) con campos desconocidos: " + ", ".join(unknown))
        lid = load.get("id") or f"{kind}-{i}"
        if lid in seen:
            raise UnsupportedModel(f"id de carga repetido: {lid!r}")
        seen.add(lid)
        if kind == "udl":
            x1, x2 = _finite(load.get("x1"), f"loads[{i}].x1"), _finite(load.get("x2"), f"loads[{i}].x2")
            q = _finite(load.get("q"), f"loads[{i}].q")
            if not x1 < x2:
                raise UnsupportedModel(f"la carga {lid!r} tiene x1 >= x2")
            if q < 0:
                raise UnsupportedModel(f"la carga {lid!r} tiene q < 0")
            if q == 0:
                notes.append(f"carga {lid!r} con q = 0: omitida (cSlope exige magnitud > 0).")
                continue
            udls.append({"magnitude": q, "x1": x1, "x2": x2, "direction": "vertical"})
        else:
            x = _finite(load.get("x"), f"loads[{i}].x")
            p = _finite(load.get("p"), f"loads[{i}].p")
            angle = _finite(load.get("angle", 0.0), f"loads[{i}].angle")
            if p < 0:
                raise UnsupportedModel(f"la carga {lid!r} tiene p < 0")
            if not -90.0 <= angle <= 90.0:
                raise UnsupportedModel(f"la carga {lid!r} tiene angle fuera de [-90, 90]")
            if p == 0:
                notes.append(f"carga {lid!r} con p = 0: omitida (cSlope exige magnitud > 0).")
                continue
            lines.append({"x": x, "magnitude": p, "angle": angle})
    out: dict[str, list[dict]] = {}
    if udls:
        out["udls"] = udls
    if lines:
        out["lineLoads"] = lines
        notes.append(
            "cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; "
            "cSlope espeja la geometría rtl y el ángulo internamente)."
        )
    return out


# ------------------------------------------------------------- conversion

def _material_definitions(model: dict, notes: list[str], piezo: bool) -> tuple[list[dict], bool]:
    materials = model.get("materials", [])
    ids = [m["id"] for m in materials]
    if len(set(ids)) != len(ids):
        raise UnsupportedModel("repeated material ids")
    defs: list[dict] = []
    needs_dry_line = False
    for m in materials:
        kind = m.get("model", "mohr_coulomb")
        if kind == "undrained":
            model_def = _undrained_definition(m)
        elif kind == "mohr_coulomb":
            model_def = {
                "kind": "mohr-coulomb",
                "unitWeight": float(m["unit_weight"]),
                "cohesion": float(m["cohesion"]),
                "frictionAngle": float(m["friction_angle"]),
            }
        else:
            raise UnsupportedModel(f"material model {m.get('model')!r} is not mohr_coulomb or undrained")
        if m.get("unit_weight_sat") is not None:
            model_def["unitWeightSat"] = float(m["unit_weight_sat"])
        mdef: dict[str, Any] = {"name": m["id"], "model": model_def}
        if m.get("ru") is not None:
            model_def["ru"] = float(m["ru"])
            if piezo:
                # OpenGeoSlide: ru replaces the piezometric pressure in this material,
                # cSlope adds ru*sigma_v to the pressure of its water line. Giving the
                # material a water line with no water removes that addition. A
                # saturated weight would be lost with it, so that case is refused.
                if m.get("unit_weight_sat") is not None:
                    raise UnsupportedModel(
                        f"material {m['id']}: ru with a piezometric line and unit_weight_sat "
                        "cannot be expressed exactly in cSlope 0.1.0"
                    )
                mdef["waterTableId"] = DRY_LINE_ID
                needs_dry_line = True
                notes.append(
                    f"material {m['id']}: ru replaces the piezometric pressure; "
                    "mapped with a dry water line (cSlope adds ru·σv to its line)."
                )
        defs.append(mdef)
    return defs, needs_dry_line


def _undrained_definition(m: dict) -> dict:
    """ogs ``undrained`` -> cSlope ``undrained`` (F3.2 / F3.8). The datum is an elevation in both."""
    unknown = sorted(set(m) - {"id", "name", "model", "unit_weight", "unit_weight_sat", "undrained_strength",
                               "strength_datum", "strength_gradient", "strength_limit", "ru"})
    if unknown:
        raise UnsupportedModel(f"material {m['id']} (undrained) con campos desconocidos: " + ", ".join(unknown))
    out: dict[str, Any] = {
        "kind": "undrained",
        "unitWeight": float(m["unit_weight"]),
        "undrainedShearStrength": _finite(m.get("undrained_strength"), f"material {m['id']}.undrained_strength"),
    }
    if m.get("strength_datum") is not None or m.get("strength_gradient") is not None:
        if m.get("strength_datum") is None or m.get("strength_gradient") is None:
            raise UnsupportedModel(f"material {m['id']}: strength_datum y strength_gradient van juntos")
        out["suRefDepth"] = _finite(m["strength_datum"], f"material {m['id']}.strength_datum")
        out["suRateOfChange"] = _finite(m["strength_gradient"], f"material {m['id']}.strength_gradient")
    if m.get("strength_limit") is not None:
        if m.get("strength_gradient") is None:
            raise UnsupportedModel(f"material {m['id']}: strength_limit sin strength_gradient")
        out["suMax"] = _finite(m["strength_limit"], f"material {m['id']}.strength_limit")
    return out


def v03_features(model: dict) -> list[str]:
    """Names of the fields of the model that need version "0.3" (contract F3.1), in order of appearance."""
    analysis = model.get("analysis") or {}
    found = []
    for m in model.get("materials", []):
        if m.get("model") == "undrained":
            found.append("model: \"undrained\"")
            break
    if (analysis.get("surface") or {}).get("type") == "polyline":
        found.append("surface.type: \"polyline\"")
    found += [f"methods: {x}" for x in analysis.get("methods", []) if x in F3_METHODS]
    if "interslice" in analysis:
        found.append("analysis.interslice")
    return found


def interslice_options(model: dict, check: dict, notes: list[str]) -> dict[str, Any]:
    """Options of a ``morgenstern_price`` check: ``intersliceFunction`` and, for data points, the points.

    The function is ``check.options.interslice`` if the check carries one, else ``analysis.interslice``, else
    ``half_sine`` (contract F3.4).
    """
    spec = (check.get("options") or {}).get("interslice") or (model.get("analysis") or {}).get("interslice")
    fn = (spec or {}).get("function", "half_sine")
    if fn not in INTERSLICE_MAP:
        raise UnsupportedModel(f"interslice.function {fn!r} desconocida")
    out: dict[str, Any] = {"intersliceFunction": INTERSLICE_MAP[fn]}
    if fn == "data_points":
        pts = (spec or {}).get("points")
        if not pts or len(pts) < 2:
            raise UnsupportedModel("interslice data_points necesita al menos 2 puntos")
        out["intersliceDataPoints"] = [[_finite(x, "interslice.points"), _finite(f, "interslice.points")] for x, f in pts]
    elif spec and "points" in spec:
        raise UnsupportedModel("interslice.points solo se admite con data_points")
    notes.append(f"Morgenstern-Price con la función interslice {INTERSLICE_MAP[fn]} (kebab-case de cSlope).")
    return out


def ogs_to_cslope(model: dict, check: dict) -> Conversion:
    """Build the cSlope analysis document for one check of a verification case.

    ``check`` has ``method`` ('bishop' | 'spencer'), ``kind`` ('fixed' | 'search')
    and optional ``options.slices``. The analysis block of ``model`` supplies the
    surface, the search and the solver settings.
    """
    method = check.get("method")
    kind = check.get("kind")
    if method not in METHOD_MAP:
        raise UnsupportedModel(f"unsupported method {method!r}")
    analysis = model.get("analysis") or {}
    notes: list[str] = []

    has_seismic = analysis.get("seismic") is not None
    if (model.get("loads") or has_seismic) and model.get("version") not in (SEISMIC_LOADS_VERSION, F3_VERSION):
        raise UnsupportedModel(
            f"los campos 'loads' y 'analysis.seismic' requieren version \"{SEISMIC_LOADS_VERSION}\""
        )
    features = v03_features(model)
    if features and model.get("version") != F3_VERSION:
        raise UnsupportedModel(f"{features[0]} requiere version \"{F3_VERSION}\"")
    if method == "bishop" and (analysis.get("surface") or {}).get("type") == "polyline" and kind == "fixed":
        raise UnsupportedModel(
            "el método 'bishop' solo admite superficies circulares; use spencer, morgenstern_price o janbu (F3.6)"
        )

    polys = regions_of(model)
    outline = outline_of(polys)
    minx, miny, maxx, maxy = outline.bounds
    orientation = resolve_direction(model, outline, kind)

    water = model.get("water") or {}
    piezo = water.get("piezometric_line") or None
    gamma_w = float(water.get("unit_weight", 9.81))
    if piezo and abs(gamma_w - CSLOPE_WATER_UNIT_WEIGHT) > WATER_UNIT_WEIGHT_TOL:
        # cSlope 0.1.0 takes no water weight from the model: it always computes the pore pressure
        # of the piezometric line with 9.807. A different declared value would be silently wrong.
        raise UnsupportedModel(
            f"water.unit_weight={gamma_w} ({unit_label(model)}) con piezometric_line: cSlope 0.1.0 "
            f"ignora waterUnitWeight y usa {CSLOPE_WATER_UNIT_WEIGHT}; el resultado no sería fiel"
        )
    materials, needs_dry_line = _material_definitions(model, notes, bool(piezo))
    if piezo and abs(gamma_w - CSLOPE_WATER_UNIT_WEIGHT) > 1e-12:
        notes.append(
            f"gamma_w={gamma_w} {unit_label(model)} en OpenGeoSlide; cSlope 0.1.0 usa "
            f"{CSLOPE_WATER_UNIT_WEIGHT} (waterUnitWeight se ignora)."
        )

    # Region assignments: one representative point per region.
    material_names = {m["id"] for m in model.get("materials", [])}
    assignments = []
    for mat_id, poly in polys:
        if mat_id not in material_names:
            raise UnsupportedModel(f"region refers to unknown material {mat_id!r}")
        pt = poly.representative_point()
        assignments.append({"point": [float(pt.x), float(pt.y)], "materialName": mat_id})

    definition: dict[str, Any] = {
        "coordinates": [[float(x), float(y)] for x, y in list(outline.exterior.coords)[:-1]],
        "materials": materials,
        "regionAssignments": assignments,
        "orientation": orientation,
    }
    boundaries = interior_boundaries(polys)
    if boundaries:
        definition["materialBoundaries"] = [{"coordinates": c} for c in boundaries]
    if piezo:
        definition["waterTable"] = water_table_from_piezo(piezo)
    if needs_dry_line:
        definition["waterTables"] = [{
            "id": DRY_LINE_ID,
            "coordinates": [[minx, miny - DRY_LINE_DEPTH], [maxx, miny - DRY_LINE_DEPTH]],
            "freeWater": False,
        }]

    slices = int(check.get("options", {}).get("slices", analysis.get("slices", 50)))
    if not CSLOPE_MIN_SLICES <= slices <= CSLOPE_MAX_SLICES:
        raise UnsupportedModel(f"slices={slices} outside cSlope range {CSLOPE_MIN_SLICES}..{CSLOPE_MAX_SLICES}")

    options: dict[str, Any] = {
        "method": METHOD_MAP.get(method, "Morgenstern-Price"),
        "slices": slices,
        "tolerance": float(analysis.get("tolerance", 1e-5)),
        "maxIterations": int(analysis.get("max_iterations", 500)),
        "searchMethod": "circular",
        "compositeSurfaces": False,
        "compositeBase": False,
        "nonCircularOptimization": False,
        "bothDirections": False,
    }
    if method == "spencer":
        # Morgenstern-Price with a constant interslice function f(x) = 1 is Spencer.
        options["intersliceFunction"] = "constant"
    elif method == "morgenstern_price":
        options.update(interslice_options(model, check, notes))
    elif method in ("janbu_simplified", "janbu_corrected"):
        options["janbuCorrection"] = method == "janbu_corrected"
    if float(analysis.get("min_m_alpha", 0.2)) != 0.2:
        notes.append("min_m_alpha has no cSlope equivalent; cSlope applies its own validity rule.")
    options.update(seismic_options(model, notes))
    definition.update(loads_to_cslope(model, notes))

    if kind == "fixed":
        surface = analysis.get("surface")
        if not surface:
            raise UnsupportedModel("kind 'fixed' but analysis.surface is missing")
        if surface.get("type") == "polyline":
            definition["customSurfaces"] = [polyline_surface(surface)]
        else:
            definition["customSearchPlanes"] = [plane_from_circle(surface)]
        definition["customPlanesOnly"] = True
    elif kind == "search":
        search = analysis.get("search")
        if not search or search.get("type") != "circular_entry_exit":
            raise UnsupportedModel("kind 'search' needs analysis.search of type circular_entry_exit")
        entry = search.get("entry") or [minx, maxx]
        exit_ = search.get("exit") or [minx, maxx]
        definition["analysisLimits"] = {
            "entryLeftX": float(entry[0]), "entryRightX": float(entry[1]),
            "exitLeftX": float(exit_[0]), "exitRightX": float(exit_[1]),
        }
        budget = int(search.get("n_entry", 20)) * int(search.get("n_exit", 20)) * int(search.get("n_radius", 20))
        options["iterations"] = min(CSLOPE_MAX_ITERATIONS, max(CSLOPE_MIN_ITERATIONS, budget))
        options["refinedIterations"] = 1500 if search.get("refine", True) else 0
        min_width = search.get("min_width")
        if min_width is None:
            min_width = 0.01 * (maxx - minx)
        options["minFailureDist"] = float(min_width)
        notes.append(
            "search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size "
            f"({options['iterations']}); minFailureDist = min_width (cSlope measures entry-exit distance)."
        )
    else:
        raise UnsupportedModel(f"unknown check kind {kind!r}")

    document = {"format": "cslope-analysis", "formatVersion": 1, "definition": definition, "options": options}
    return Conversion(document=document, notes=notes, orientation=orientation)
