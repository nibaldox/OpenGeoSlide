"""OpenGeoSlide .ogs.json v0.1 / v0.2 / v0.3 / v0.4 / v0.5 / v0.6 -> cSlope 0.1.0 analysis document.

Translation only: nothing is computed here. The correspondence table and the
known, documented differences are in README.md.

Hoek-Brown, SHANSEP and non-circular search (schema v0.6, contracts F6.1-F6.5)
------------------------------------------------------------------------------
- material ``hoek_brown`` -> cSlope ``hoek-brown``: ``ucs``, ``gsi``, ``mi`` and ``disturbance`` (always written
  explicitly; ogs gives ``disturbance`` no default, F6.2). In low confinement ogs follows the full Hoek-Brown envelope
  down to ``σt = -s·ucs/mb`` while cSlope extrapolates the ``σ3 = 0`` tangent (F6.8, E16q); the note records this.
- material ``shansep`` -> cSlope ``shansep``: ``shansep.ratio`` -> ``ratio``, ``shansep.exponent`` -> ``exponent``
  (default ``0.8``, always written), and the single OCR source ``shansep.ocr`` -> ``ocr``, ``shansep.pop`` -> ``pop``
  or ``shansep.ocr_by_elevation`` -> ``ocrByElevation`` (F6.3; X26 §2.1). Missing or multiple OCR sources are refused.
- ``analysis.search.non_circular {seeds, max_vertices}`` -> ``options.nonCircularOptimization = true`` on ``search``
  checks (F6.4). cSlope 0.1.0 has no document fields for ``seeds`` or ``max_vertices`` (its engine fixes 3 seeds and up
  to 33 vertices in ``optimize.rs``), so they stay at cSlope's built-in defaults and a conversion note records it.
  ``bishop`` with ``non_circular`` is refused, as are ``tension_crack.depth = "auto"`` and ``lateral_pressure`` with
  ``hoek_brown`` or ``shansep`` materials (F6.4, F6.5).

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

Reinforcements (schema v0.4, contracts F4.2 and E14m)
-----------------------------------------------------
- ``anchor``, ``nail`` and ``geosynthetic`` -> ``definition.reinforcements[]``: ``x1, y1, x2, y2``,
  ``tensile_capacity`` -> ``tensileCapacity``, ``end1_capacity`` / ``end2_capacity`` -> ``end1Capacity`` /
  ``end2Capacity``, ``spacing``, ``direction`` and ``application`` (always written, explicit). ``pullout``:
  ``bond`` -> ``{kind: "bond", strength, bondedLength}``, ``interface`` -> ``{kind: "interface", adhesion,
  frictionAngle, coverage}``, ``development`` -> ``{kind: "development", length1, length2}``.
- ``pile`` and ``sheet_pile`` -> ``definition.piles[]``: ``force``, ``spacing`` (the sheet pile has none: ``spacing 1`` and
  ``force`` per metre of wall, ``wall: true``), ``direction``, ``angle`` (only with ``direction: "angle"``) and
  ``application`` explicit. ``location`` is written as ``"slip-surface"`` with a hyphen (E14m-3: ogs has no such
  field; with a constant force it changes no number, X17 §3).
- A model with reinforcements needs ``version "0.4"``. The force is a per-element value divided by ``spacing`` in both
  programs; ``fx``/``fy`` of the oracle are in model coordinates (E14m-4).

Tension crack and ponded water (schema v0.5, contracts F5.2 and F5.3)
---------------------------------------------------------------------
- ``analysis.tension_crack {depth, water_fill}`` (version ``"0.5"`` only) -> ``options.tensionCrackDepth`` (a number)
  or ``options.tensionCrackAuto: true`` (``depth: "auto"``), and ``options.tensionCrackWater = water_fill`` (a fraction
  in [0, 1], always written). With ``water_fill > 0`` the crack weighs ``γw`` of cSlope (9.807), as the piezometric
  line does.
- The ponded water has no field in ogs: it is applied in **every** version when the piezometric line is above the
  ground (decision D1). The piezometric line is therefore always written with ``freeWater: true`` and
  ``followBoundary: false``, so cSlope loads the free water with its weight and thrust. Where the line does not go
  above the ground that changes nothing (the free-water region is empty and the pore pressure is the same);
  ``verification/harness/README.md`` and the notes of F3G-V give the numbers.
- A material with ``ru`` under ponded water is not comparable: ogs adds ``ru·V/b`` (E15c-ru, the Slide2 rule) and
  cSlope does not. The conversion notes it.

Ito-Matsui piles (schema v0.5, contract E15i)
---------------------------------------------
- A ``pile`` carries **exactly one** of ``force`` and ``lateral_pressure {model: "ito_matsui", diameter, location}``;
  ``capacity {shear, moment}`` (at least one, each finite and > 0) goes only with ``lateral_pressure``. Both new fields
  need version ``"0.5"``. A pile without ``lateral_pressure`` converts byte for byte as before.
- ``lateral_pressure`` -> ``definition.piles[]`` with ``diameter`` and **no** ``force`` (cSlope reads that as
  Ito-Matsui); ``location`` ``"centroid"`` -> ``"centroid"``, ``"slip_surface"`` -> ``"slip-surface"``;
  ``capacity.shear`` -> ``shearCapacity`` (force per pile) and ``capacity.moment`` -> ``momentCapacity`` (moment per
  pile). Same checks as the engine: the pile is vertical (``|x2 - x1| <= 1e-6``) and ``spacing > diameter``
  (``spacing`` defaults to 1).
- ``direction`` and ``angle`` keep the flat v0.4 spelling (``"direction": "angle", "angle": 0``).

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

import bisect
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
F4_VERSION = "0.4"
F5_VERSION = "0.5"
F6_VERSION = "0.6"
ALL_VERSIONS = ("0.1", SEISMIC_LOADS_VERSION, F3_VERSION, F4_VERSION, F5_VERSION, F6_VERSION)
# versions that admit the fields of each stage (a later version admits everything of the earlier ones)
SEISMIC_LOADS_VERSIONS = (SEISMIC_LOADS_VERSION, F3_VERSION, F4_VERSION, F5_VERSION, F6_VERSION)
F3_VERSIONS = (F3_VERSION, F4_VERSION, F5_VERSION, F6_VERSION)
F4_VERSIONS = (F4_VERSION, F5_VERSION, F6_VERSION)
F5_VERSIONS = (F5_VERSION, F6_VERSION)
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
        # the higher end of the polyline, once fitted to the ground (E13c), is the entry
        (_, y_p), (_, y_q) = fitted_polyline_ends(surface["points"], outline)
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


def _ground_pieces(outline: Polygon) -> list[tuple[float, float, float, float]]:
    """The terrain as straight pieces (x0, x1, y0, y1) between consecutive vertex abscissae of the outline.

    ``y0`` and ``y1`` are the one-sided limits at ``x0`` and ``x1`` (they differ across a vertical face): they are
    taken from the heights at the quarter points of the piece, where the terrain is a straight line.
    """
    xs = sorted({round(float(x), 12) for x, _ in outline.exterior.coords})
    pieces = []
    for x0, x1 in zip(xs, xs[1:]):
        try:
            ya, yb = y_top(outline, x0 + 0.25 * (x1 - x0)), y_top(outline, x0 + 0.75 * (x1 - x0))
        except UnsupportedModel:
            continue                      # a gap in the ground
        k = (yb - ya) / (0.5 * (x1 - x0))
        pieces.append((x0, x1, ya - k * 0.25 * (x1 - x0), yb + k * 0.25 * (x1 - x0)))
    return pieces


def _fit_start(pts: list[tuple[float, float]], pieces: list[tuple[float, float, float, float]],
               tol: float) -> tuple[float, float]:
    """The first end of ``pts`` fitted to the ground (E13c): extended along its segment to the first crossing if it is
    under the ground, trimmed at the first crossing from over to under if it is over, kept if it is on it. The ends as
    written are returned when no crossing exists (the engine then rejects the polyline, and the direction is moot)."""
    (x0, y0), (x1, y1) = pts[0], pts[1]
    g = next(((a, b, ya, yb) for a, b, ya, yb in pieces if a <= x0 < b), None)
    if g is None:
        return pts[0]
    a, b, ya, yb = g
    h0 = y0 - (ya + (x0 - a) * (yb - ya) / (b - a))
    if abs(h0) <= tol:
        return pts[0]

    def ground(piece, x):
        pa, pb, pya, pyb = piece
        return pya + (x - pa) * (pyb - pya) / (pb - pa)

    if h0 < 0:                                              # extend toward smaller x
        slope = (y1 - y0) / (x1 - x0)
        line = lambda x: y0 + slope * (x - x0)              # noqa: E731
        for piece in sorted((p for p in pieces if p[0] < x0), key=lambda p: -p[0]):
            hi = min(piece[1], x0)
            hb = line(hi) - ground(piece, hi)
            if hb >= -tol:
                return (hi, line(hi))                       # comes out through a vertical face
            ha = line(piece[0]) - ground(piece, piece[0])
            if ha >= -tol:
                xc = hi - (hi - piece[0]) * (-hb) / (ha - hb) if ha > 0 else piece[0]
                return (xc, line(xc))
        return pts[0]
    # trim: the first stretch where the polyline goes under the ground
    xs = sorted({x for x, _ in pts} | {v for p in pieces for v in p[:2]})
    xs = [x for x in xs if pts[0][0] <= x <= pts[-1][0]]

    px = [x for x, _ in pts]

    def poly_y(x):
        i = max(0, min(len(pts) - 2, bisect.bisect_right(px, x) - 1))
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        return ay + (x - ax) * (by - ay) / (bx - ax)

    for u, v in zip(xs, xs[1:]):
        xm = 0.5 * (u + v)
        piece = next((p for p in pieces if p[0] <= xm <= p[1]), None)
        if piece is None:
            return pts[0]
        hu, hv = poly_y(u + 1e-12 * (v - u)) - ground(piece, u), poly_y(v - 1e-12 * (v - u)) - ground(piece, v)
        if hu < -tol or hv < -tol:
            xc = u + (v - u) * hu / (hu - hv) if (hu > 0 and hv < -tol) else u
            return (xc, poly_y(xc))
    return pts[0]


def fitted_polyline_ends(points: list, outline: Polygon) -> tuple[tuple[float, float], tuple[float, float]]:
    """The (left, right) ends of a fixed polyline once fitted to the ground (E13c: extended or trimmed to the first
    crossing). The harness uses them to resolve ``direction: auto`` like the engine does (R10A-11)."""
    pts = [(float(x), float(y)) for x, y in points]
    minx, miny, maxx, maxy = outline.bounds
    tol = 1e-9 * max(maxx - minx, maxy - miny)
    pieces = _ground_pieces(outline)
    left = _fit_start(pts, pieces, tol)
    mirrored = [(-x, y) for x, y in reversed(pts)]
    mirror_pieces = [(-b, -a, yb, ya) for a, b, ya, yb in reversed(pieces)]
    mx, my = _fit_start(mirrored, mirror_pieces, tol)
    return left, (-mx, my)



def is_imperial(model: dict) -> bool:
    """Same detection as the engine and the web (`isImperialUnits`): case and leading spaces do not matter, `imp…`."""
    units = model.get("units")
    return isinstance(units, str) and units.lstrip()[:3].lower() == "imp"


def unit_label(model: dict) -> str:
    """Unit name for notes: 'pcf' for imperial models, 'kN/m3' otherwise."""
    return "pcf" if is_imperial(model) else "kN/m3"


# E15l-6: water.unit_weight absent means 9.81 kN/m3, and in imperial units the same value converted with the factor of
# `apps/web/src/editor/state/units.ts` (LBF_PER_KN / FT_PER_M**3, about 62.45 pcf).
DEFAULT_WATER_UNIT_WEIGHT_SI = 9.81
_FT_PER_M = 1 / 0.3048
_LBF_PER_KN = 1000 / 4.4482216152605


def default_water_unit_weight(model: dict) -> float:
    """gamma_w of the model when `water.unit_weight` is absent (same rule as the engine, E15l-6)."""
    if is_imperial(model):
        return DEFAULT_WATER_UNIT_WEIGHT_SI * (_LBF_PER_KN / _FT_PER_M**3)
    return DEFAULT_WATER_UNIT_WEIGHT_SI


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
    """OpenGeoSlide piezometric_line -> cSlope waterTable (custom, not clipped to the ground).

    ``freeWater: true`` with ``followBoundary: false``: where the line is above the ground cSlope loads the ponded
    water with its weight and thrust (ogs does it in every version, F5.3); elsewhere the pressure is the one of the
    line clipped to the ground, so a model without ponded water gives the same number as before F3G.
    """
    pts = sorted(([float(x), float(y)] for x, y in points), key=lambda p: p[0])
    return {"mode": "custom", "value": pts, "freeWater": True, "followBoundary": False}


def water_above_ground(outline: Polygon, piezo: list) -> bool:
    """True if the piezometric line goes above the ground anywhere (only to write a note; ogs decides on its own)."""
    pts = sorted(([float(x), float(y)] for x, y in piezo), key=lambda p: p[0])
    minx, _, maxx, _ = outline.bounds

    def line(x: float) -> float:
        if x <= pts[0][0]:
            return pts[0][1]
        if x >= pts[-1][0]:
            return pts[-1][1]
        i = bisect.bisect_right([p[0] for p in pts], x)
        (x0, y0), (x1, y1) = pts[i - 1], pts[i]
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0)

    xs = sorted({x for x, _ in outline.exterior.coords} | {x for x, _ in pts} | {minx, maxx})
    xs = [x for x in xs if minx <= x <= maxx]
    samples = []
    for a, b in zip(xs, xs[1:]):
        if b > a:
            samples += [a + (b - a) * 1e-6, 0.5 * (a + b), b - (b - a) * 1e-6]
    return any(line(x) - y_top(outline, x) > 1e-9 for x in samples)


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


# ------------------------------------------------------------ reinforcements (v0.4)

TENSION_TYPES = ("anchor", "nail", "geosynthetic")
PILE_TYPES = ("pile", "sheet_pile")
# cSlope spells the location of a pile force with a hyphen; ogs has no such field since E14m-3
CSLOPE_PILE_LOCATION = "slip-surface"
_TENSION_KEYS = {"id", "type", "x1", "y1", "x2", "y2", "application", "tensile_capacity", "end1_capacity",
                 "end2_capacity", "spacing", "direction", "pullout"}
_SHEET_KEYS = {"id", "type", "x1", "y1", "x2", "y2", "application", "force", "direction", "angle"}
_PILE_KEYS = _SHEET_KEYS | {"spacing"}
# E15i-1 (v0.5): a pile takes either ``force`` or ``lateral_pressure``, and ``capacity`` only with the latter
_PILE_KEYS_V05 = _PILE_KEYS | {"lateral_pressure", "capacity"}
_LATERAL_PRESSURE_KEYS = {"model", "diameter", "location"}
_CAPACITY_KEYS = {"shear", "moment"}
# cSlope's own tolerance for a vertical pile (|x2 - x1| <= 1e-6, ``model/slope.rs``)
PILE_VERTICAL_TOL = 1e-6
_LP_LOCATIONS = {"centroid": "centroid", "slip_surface": "slip-surface"}
_PULLOUT_KEYS = {"bond": {"model", "strength", "bonded_length"},
                 "interface": {"model", "adhesion", "friction_angle", "coverage"},
                 "development": {"model", "length1", "length2"}}


def _unknown(item: dict, allowed: set[str], where: str) -> None:
    unknown = sorted(set(item) - allowed)
    if unknown:
        raise UnsupportedModel(f"{where} con campos desconocidos: " + ", ".join(unknown))


def _non_negative(value: Any, name: str) -> float:
    """Finite and ``>= 0``, like ``non_negative`` of ``reinforcement.rs`` (F4.2)."""
    v = _finite(value, name)
    if v < 0.0:
        raise UnsupportedModel(f"{name} debe ser mayor o igual que 0, no {value!r}")
    return v


def _positive(value: Any, name: str) -> float:
    """Finite and ``> 0``, like ``positive`` of ``reinforcement.rs`` (F4.2)."""
    v = _finite(value, name)
    if v <= 0.0:
        raise UnsupportedModel(f"{name} debe ser mayor que 0, no {value!r}")
    return v


def _angle_in_range(value: Any, name: str) -> float:
    """The ``angle`` of a pile, in the open interval (-90, 90) degrees (E14b)."""
    v = _finite(value, name)
    if not -90.0 < v < 90.0:
        raise UnsupportedModel(f"{name} debe estar en (-90, 90) grados, no {value!r}")
    return v


def _pullout_to_cslope(pullout: dict, where: str, length: float) -> dict:
    kind = pullout.get("model")
    if kind not in _PULLOUT_KEYS:
        raise UnsupportedModel(f"{where}.pullout.model {kind!r} desconocido")
    _unknown(pullout, _PULLOUT_KEYS[kind], f"{where}.pullout")
    if kind == "bond":
        out: dict[str, Any] = {"kind": "bond",
                               "strength": _non_negative(pullout.get("strength"), f"{where}.pullout.strength")}
        if pullout.get("bonded_length") is not None:
            name = f"{where}.pullout.bonded_length"
            out["bondedLength"] = _positive(pullout["bonded_length"], name)
            if out["bondedLength"] > length:
                raise UnsupportedModel(f"{name} debe ser menor o igual que la longitud del elemento {length}, "
                                       f"no {pullout['bonded_length']!r}")
        return out
    if kind == "interface":
        name = f"{where}.pullout.friction_angle"
        friction = _finite(pullout.get("friction_angle"), name)
        if not 0.0 <= friction < 90.0:
            raise UnsupportedModel(f"{name} debe estar en [0, 90) grados, no {pullout.get('friction_angle')!r}")
        name = f"{where}.pullout.coverage"
        coverage = _finite(pullout.get("coverage"), name)
        if not 0.0 < coverage <= 1.0:
            raise UnsupportedModel(f"{name} debe estar en (0, 1], no {pullout.get('coverage')!r}")
        return {"kind": "interface",
                "adhesion": _non_negative(pullout.get("adhesion"), f"{where}.pullout.adhesion"),
                "frictionAngle": friction, "coverage": coverage}
    return {"kind": "development",
            "length1": _non_negative(pullout.get("length1"), f"{where}.pullout.length1"),
            "length2": _non_negative(pullout.get("length2"), f"{where}.pullout.length2")}


def _ito_matsui_pile(item: dict, lateral: Any, geometry: dict, where: str) -> dict[str, Any]:
    """The ``pile`` entry of cSlope for a ``lateral_pressure`` pile (E15i-1, E15i-10): ``diameter`` and no ``force``.

    Validates like the engine: exactly one of ``force`` and ``lateral_pressure``, ``model`` ``"ito_matsui"``,
    ``diameter`` finite and > 0, ``location`` mandatory, ``capacity`` with at least one finite value > 0, a vertical
    pile and ``spacing > diameter``. ``direction``, ``application`` and ``angle`` are added by the caller.
    """
    if item.get("force") is not None:
        raise UnsupportedModel(f"{where}: force y lateral_pressure se excluyen; tiene que haber exactamente uno")
    if not isinstance(lateral, dict):
        raise UnsupportedModel(f"{where}.lateral_pressure debe ser un objeto")
    _unknown(lateral, _LATERAL_PRESSURE_KEYS, f"{where}.lateral_pressure")
    if lateral.get("model") != "ito_matsui":
        raise UnsupportedModel(f"{where}.lateral_pressure.model debe ser \"ito_matsui\", no {lateral.get('model')!r}")
    diameter = _positive(lateral.get("diameter"), f"{where}.lateral_pressure.diameter")
    location = lateral.get("location")
    if location not in _LP_LOCATIONS:
        raise UnsupportedModel(
            f"{where}.lateral_pressure.location es obligatorio y debe ser centroid o slip_surface, no {location!r}")
    if abs(geometry["x2"] - geometry["x1"]) > PILE_VERTICAL_TOL:
        raise UnsupportedModel(f"{where}.x2 debe ser igual a x1 (el pilote con lateral_pressure es vertical), "
                               f"no {geometry['x2']} frente a {geometry['x1']}")
    spacing = _positive(item["spacing"], f"{where}.spacing") if item.get("spacing") is not None else 1.0
    if not spacing > diameter:
        raise UnsupportedModel(f"{where}.spacing debe ser mayor que el diameter {diameter}, no {spacing}")
    out: dict[str, Any] = {**geometry, "diameter": diameter, "location": _LP_LOCATIONS[location], "spacing": spacing}
    capacity = item.get("capacity")
    if capacity is not None:
        if not isinstance(capacity, dict):
            raise UnsupportedModel(f"{where}.capacity debe ser un objeto")
        _unknown(capacity, _CAPACITY_KEYS, f"{where}.capacity")
        present = [k for k in ("shear", "moment") if capacity.get(k) is not None]
        if not present:
            raise UnsupportedModel(f"{where}.capacity no puede ir vacío: shear, moment o ambos")
        for key, name in (("shear", "shearCapacity"), ("moment", "momentCapacity")):
            if key in present:
                out[name] = _positive(capacity[key], f"{where}.capacity.{key}")
    return out


def reinforcements_to_cslope(model: dict, notes: list[str]) -> dict[str, list[dict]]:
    """``reinforcements[]`` (v0.4) -> ``{"reinforcements": [...], "piles": [...]}`` (only the non-empty lists).

    ``anchor``, ``nail`` and ``geosynthetic`` go to ``reinforcements``; ``pile`` and ``sheet_pile`` go to ``piles``.
    ``application`` and ``direction`` are always written, explicit, so no cSlope default decides the result. A
    ``sheet_pile`` is a pile with ``spacing 1``, ``force`` per metre and ``wall: true``; ``location`` is written as
    ``"slip-surface"`` for the piles. Only ``version "0.4"`` and later admit them (F4.1).
    """
    items = model.get("reinforcements")
    if items is None:
        return {}
    if not isinstance(items, list):
        raise UnsupportedModel("reinforcements debe ser una lista")
    if not items:
        return {}
    if model.get("version") not in F4_VERSIONS:
        raise UnsupportedModel(f'reinforcements requiere version "{F4_VERSION}"')
    tension: list[dict] = []
    piles: list[dict] = []
    seen: set[str] = set()
    for i, item in enumerate(items):
        where = f"reinforcements[{i}]"
        kind = item.get("type")
        rid = item.get("id")
        if not rid or rid in seen:
            raise UnsupportedModel(f"{where}.id vacío o repetido: {rid!r}")
        seen.add(rid)
        application = item.get("application")
        if application not in ("active", "passive"):
            raise UnsupportedModel(f"{where}.application debe ser active o passive, no {application!r}")
        geometry = {k: _finite(item.get(k), f"{where}.{k}") for k in ("x1", "y1", "x2", "y2")}
        length = math.hypot(geometry["x2"] - geometry["x1"], geometry["y2"] - geometry["y1"])
        if length <= 0.0:
            raise UnsupportedModel(f"{where} tiene longitud 0: (x1, y1) y (x2, y2) coinciden")
        if kind in TENSION_TYPES:
            _unknown(item, _TENSION_KEYS, where)
            direction = item.get("direction")
            if direction not in ("axial", "tangent", "bisector"):
                raise UnsupportedModel(f"{where}.direction {direction!r} no es axial, tangent ni bisector")
            out: dict[str, Any] = {**geometry,
                                   "tensileCapacity": _non_negative(item.get("tensile_capacity"), f"{where}.tensile_capacity"),
                                   "direction": direction, "application": application}
            for key, name in (("end1_capacity", "end1Capacity"), ("end2_capacity", "end2Capacity")):
                if item.get(key) is not None:
                    out[name] = _non_negative(item[key], f"{where}.{key}")
            if item.get("spacing") is not None:
                out["spacing"] = _positive(item["spacing"], f"{where}.spacing")
            if item.get("pullout") is not None:
                out["pullout"] = _pullout_to_cslope(item["pullout"], where, length)
            tension.append(out)
        elif kind in PILE_TYPES:
            _unknown(item, _PILE_KEYS_V05 if kind == "pile" else _SHEET_KEYS, where)
            lateral = item.get("lateral_pressure")
            if lateral is not None or item.get("capacity") is not None:
                if model.get("version") not in F5_VERSIONS:
                    raise UnsupportedModel(f'lateral_pressure requiere version "{F5_VERSION}"')
            direction = item.get("direction")
            if direction not in ("angle", "tangent", "perpendicular"):
                raise UnsupportedModel(f"{where}.direction {direction!r} no es angle, tangent ni perpendicular")
            if (direction == "angle") != (item.get("angle") is not None):
                raise UnsupportedModel(f"{where}.angle va solo con direction \"angle\"")
            if kind == "sheet_pile" and geometry["x1"] != geometry["x2"]:
                raise UnsupportedModel(f"{where}.x2 debe ser igual a x1 (la tablestaca es vertical), "
                                       f"no {geometry['x2']} frente a {geometry['x1']}")
            if lateral is not None:
                out = _ito_matsui_pile(item, lateral, geometry, where)
                out.update({"direction": direction, "application": application})
            else:
                if item.get("capacity") is not None:
                    raise UnsupportedModel(f"{where}.capacity solo se admite junto con lateral_pressure (E15i-1)")
                out = {**geometry, "force": _non_negative(item.get("force"), f"{where}.force"),
                       "direction": direction, "application": application, "location": CSLOPE_PILE_LOCATION}
            if direction == "angle":
                out["angle"] = _angle_in_range(item["angle"], f"{where}.angle")
            if kind == "sheet_pile":
                out["spacing"] = 1.0
                out["wall"] = True
            elif item.get("spacing") is not None:
                out["spacing"] = _positive(item["spacing"], f"{where}.spacing")
            piles.append(out)
        else:
            raise UnsupportedModel(f"{where}.type {kind!r} no soportado")
    out_doc: dict[str, list[dict]] = {}
    if tension:
        out_doc["reinforcements"] = tension
    if piles:
        out_doc["piles"] = piles
        notes.append(
            "pilotes y tablestacas: location \"slip-surface\" (sin efecto con fuerza constante, X17 §3); la tablestaca "
            "va con spacing 1, force por metro y wall true."
        )
        if any("diameter" in p for p in piles):
            notes.append(
                "pilotes Ito-Matsui (E15i): diameter sin force, location centroid o slip-surface y las capacidades "
                "shearCapacity y momentCapacity por pilote; cSlope aplica el piso de φ = 0 y la tensión efectiva."
            )
    notes.append(
        "refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los "
        "activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0."
    )
    return out_doc


# ------------------------------------------------------------- conversion

_ALL_MATERIAL_KEYS = {
    "id", "name", "model", "unit_weight", "unit_weight_sat", "ru",
    "cohesion", "friction_angle",
    "undrained_strength", "strength_datum", "strength_gradient", "strength_limit",
    "ucs", "gsi", "mi", "disturbance", "shansep",
}
_SHANSEP_KEYS = {"ratio", "exponent", "ocr", "pop", "ocr_by_elevation"}
_NON_CIRCULAR_KEYS = {"seeds", "max_vertices"}


def _material_field_rules(m: dict, model_name: str, forbidden: tuple[str, ...]) -> None:
    mid = m.get("id", "")
    unknown = sorted(set(m) - _ALL_MATERIAL_KEYS)
    if unknown:
        raise UnsupportedModel(f"material {mid} ({model_name}) con campos desconocidos: " + ", ".join(unknown))
    for field_name in forbidden:
        if m.get(field_name) is not None:
            raise UnsupportedModel(
                f"el material '{mid}' con model \"{model_name}\" no admite el campo '{field_name}'"
            )


def _require_material_field(m: dict, model_name: str, field_name: str) -> Any:
    if m.get(field_name) is None:
        raise UnsupportedModel(
            f"el material '{m.get('id', '')}' con model \"{model_name}\" requiere el campo '{field_name}'"
        )
    return m[field_name]


def _mohr_coulomb_definition(m: dict) -> dict:
    mid = m["id"]
    _material_field_rules(
        m,
        "mohr_coulomb",
        ("undrained_strength", "strength_datum", "strength_gradient", "strength_limit",
         "ucs", "gsi", "mi", "disturbance", "shansep"),
    )
    cohesion = _finite(_require_material_field(m, "mohr_coulomb", "cohesion"), f"material {mid}.cohesion")
    if cohesion < 0.0:
        raise UnsupportedModel(f"la cohesión del material '{mid}' debe ser ≥ 0")
    phi = _finite(_require_material_field(m, "mohr_coulomb", "friction_angle"), f"material {mid}.friction_angle")
    if not 0.0 <= phi < 90.0:
        raise UnsupportedModel(f"el ángulo de fricción del material '{mid}' debe estar en [0, 90)")
    return {
        "kind": "mohr-coulomb",
        "unitWeight": _positive(m.get("unit_weight"), f"material {mid}.unit_weight"),
        "cohesion": cohesion,
        "frictionAngle": phi,
    }


def _hoek_brown_definition(m: dict) -> dict:
    """ogs ``hoek_brown`` -> cSlope ``hoek-brown`` (F6.2). ``disturbance`` is always written explicitly."""
    mid = m["id"]
    _material_field_rules(
        m,
        "hoek_brown",
        ("cohesion", "friction_angle", "undrained_strength", "strength_datum",
         "strength_gradient", "strength_limit", "shansep"),
    )
    uw = _positive(m.get("unit_weight"), f"material {mid}.unit_weight")
    raw_ucs = _require_material_field(m, "hoek_brown", "ucs")
    raw_gsi = _require_material_field(m, "hoek_brown", "gsi")
    raw_mi = _require_material_field(m, "hoek_brown", "mi")
    raw_d = _require_material_field(m, "hoek_brown", "disturbance")
    ucs = _finite(raw_ucs, f"material {mid}.ucs")
    if ucs <= 0.0:
        raise UnsupportedModel(f"el ucs del material '{mid}' debe ser finito y > 0")
    gsi = _finite(raw_gsi, f"material {mid}.gsi")
    if not 0.0 <= gsi <= 100.0:
        raise UnsupportedModel(f"el GSI del material '{mid}' debe estar en [0, 100]")
    mi = _finite(raw_mi, f"material {mid}.mi")
    if mi <= 0.0:
        raise UnsupportedModel(f"el mi del material '{mid}' debe ser finito y > 0")
    disturbance = _finite(raw_d, f"material {mid}.disturbance")
    if not 0.0 <= disturbance <= 1.0:
        raise UnsupportedModel(f"el disturbance del material '{mid}' debe estar en [0, 1]")
    return {
        "kind": "hoek-brown",
        "unitWeight": uw,
        "ucs": ucs,
        "gsi": gsi,
        "mi": mi,
        "disturbance": disturbance,
    }


def _shansep_definition(m: dict) -> dict:
    """ogs ``shansep`` -> cSlope ``shansep`` (F6.3; X26 §2.1)."""
    mid = m["id"]
    _material_field_rules(
        m,
        "shansep",
        ("cohesion", "friction_angle", "undrained_strength", "strength_datum",
         "strength_gradient", "strength_limit", "ucs", "gsi", "mi", "disturbance"),
    )
    uw = _positive(m.get("unit_weight"), f"material {mid}.unit_weight")
    spec = _require_material_field(m, "shansep", "shansep")
    if not isinstance(spec, dict):
        raise UnsupportedModel(f"material {mid}.shansep debe ser un objeto")
    _unknown(spec, _SHANSEP_KEYS, f"material {mid}.shansep")
    if spec.get("ratio") is None:
        raise UnsupportedModel(f"el shansep.ratio del material '{mid}' es obligatorio")
    ratio = _finite(spec["ratio"], f"material {mid}.shansep.ratio")
    if ratio <= 0.0:
        raise UnsupportedModel(f"el shansep.ratio del material '{mid}' debe ser finito y > 0")
    if spec.get("exponent") is None:
        exponent = 0.8
    else:
        exponent = _finite(spec["exponent"], f"material {mid}.shansep.exponent")
        if not 0.0 <= exponent <= 1.0:
            raise UnsupportedModel(f"el shansep.exponent del material '{mid}' debe estar en [0, 1]")
    present = [k for k in ("ocr", "pop", "ocr_by_elevation") if spec.get(k) is not None]
    if len(present) != 1:
        raise UnsupportedModel(
            f"el material '{mid}' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation"
        )
    out: dict[str, Any] = {
        "kind": "shansep",
        "unitWeight": uw,
        "ratio": ratio,
        "exponent": exponent,
    }
    src = present[0]
    if src == "ocr":
        ocr = _finite(spec["ocr"], f"material {mid}.shansep.ocr")
        if ocr < 1.0:
            raise UnsupportedModel(f"el shansep.ocr del material '{mid}' debe ser finito y ≥ 1")
        out["ocr"] = ocr
    elif src == "pop":
        pop = _finite(spec["pop"], f"material {mid}.shansep.pop")
        if pop < 0.0:
            raise UnsupportedModel(f"el shansep.pop del material '{mid}' debe ser finito y ≥ 0")
        out["pop"] = pop
    else:
        raw_table = spec["ocr_by_elevation"]
        if not isinstance(raw_table, list) or len(raw_table) < 2:
            raise UnsupportedModel(f"el shansep.ocr_by_elevation del material '{mid}' necesita al menos 2 filas")
        table: list[list[float]] = []
        for row in raw_table:
            if not isinstance(row, (list, tuple)) or len(row) != 2:
                raise UnsupportedModel(f"el shansep.ocr_by_elevation del material '{mid}' debe ser una lista de pares [y, OCR]")
            try:
                y_val = _finite(row[0], f"material {mid}.shansep.ocr_by_elevation.y")
                ocr_val = _finite(row[1], f"material {mid}.shansep.ocr_by_elevation.ocr")
            except UnsupportedModel as exc:
                raise UnsupportedModel(
                    f"el shansep.ocr_by_elevation del material '{mid}' tiene valores no finitos o OCR < 1"
                ) from exc
            if ocr_val < 1.0:
                raise UnsupportedModel(
                    f"el shansep.ocr_by_elevation del material '{mid}' tiene valores no finitos o OCR < 1"
                )
            table.append([y_val, ocr_val])
        if any(b[0] <= a[0] for a, b in zip(table, table[1:])):
            raise UnsupportedModel(
                f"el shansep.ocr_by_elevation del material '{mid}' debe tener y estrictamente creciente"
            )
        out["ocrByElevation"] = table
    return out


def _material_definitions(model: dict, notes: list[str], piezo: bool) -> tuple[list[dict], bool]:
    materials = model.get("materials", [])
    for i, m in enumerate(materials):
        if not m.get("id"):
            raise UnsupportedModel(f"el id del material {i} está vacío: debe tener al menos un carácter")
    ids = [m["id"] for m in materials]
    if len(set(ids)) != len(ids):
        raise UnsupportedModel("repeated material ids")
    defs: list[dict] = []
    needs_dry_line = False
    has_hb = False
    has_sh = False
    for m in materials:
        kind = m.get("model", "mohr_coulomb")
        if kind == "undrained":
            model_def = _undrained_definition(m)
        elif kind == "mohr_coulomb":
            model_def = _mohr_coulomb_definition(m)
        elif kind == "hoek_brown":
            model_def = _hoek_brown_definition(m)
            has_hb = True
        elif kind == "shansep":
            model_def = _shansep_definition(m)
            has_sh = True
        else:
            raise UnsupportedModel(
                f"material model {m.get('model')!r} is not mohr_coulomb, undrained, hoek_brown or shansep"
            )
        if m.get("unit_weight_sat") is not None:
            model_def["unitWeightSat"] = _positive(m["unit_weight_sat"], f"material {m['id']}.unit_weight_sat")
        mdef: dict[str, Any] = {"name": m["id"], "model": model_def}
        if m.get("ru") is not None:
            ru_val = _finite(m["ru"], f"material {m['id']}.ru")
            if not 0.0 <= ru_val < 1.0:
                raise UnsupportedModel(f"ru del material '{m['id']}' debe estar en [0, 1)")
            model_def["ru"] = ru_val
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
    if has_hb:
        notes.append(
            "Hoek-Brown (F6.2, F6.8): ucs, gsi, mi y disturbance explícito; en bajo confinamiento cSlope extrapola "
            "la tangente de σ3 = 0 para σ'n <= sn(0), mientras ogs usa la envolvente completa hasta σt (E16q)."
        )
    if has_sh:
        notes.append(
            "SHANSEP (F6.3, F6.9): ratio, exponent explícito y fuente de OCR (ocr, pop u ocrByElevation)."
        )
    return defs, needs_dry_line


def _undrained_definition(m: dict) -> dict:
    """ogs ``undrained`` -> cSlope ``undrained`` (F3.2 / F3.8). The datum is an elevation in both."""
    mid = m["id"]
    _material_field_rules(
        m,
        "undrained",
        ("cohesion", "friction_angle", "ucs", "gsi", "mi", "disturbance", "shansep"),
    )
    su = _finite(_require_material_field(m, "undrained", "undrained_strength"), f"material {mid}.undrained_strength")
    if su < 0.0:
        raise UnsupportedModel(f"undrained_strength del material '{mid}' debe ser finito y ≥ 0")
    out: dict[str, Any] = {
        "kind": "undrained",
        "unitWeight": _positive(m.get("unit_weight"), f"material {mid}.unit_weight"),
        "undrainedShearStrength": su,
    }
    if m.get("strength_datum") is not None or m.get("strength_gradient") is not None:
        if m.get("strength_datum") is None or m.get("strength_gradient") is None:
            raise UnsupportedModel(f"material {mid}: strength_datum y strength_gradient van juntos")
        out["suRefDepth"] = _finite(m["strength_datum"], f"material {mid}.strength_datum")
        out["suRateOfChange"] = _finite(m["strength_gradient"], f"material {mid}.strength_gradient")
    if m.get("strength_limit") is not None:
        if m.get("strength_gradient") is None:
            raise UnsupportedModel(f"material {mid}: strength_limit sin strength_gradient")
        limit = _finite(m["strength_limit"], f"material {mid}.strength_limit")
        if limit < 0.0:
            raise UnsupportedModel(f"strength_limit del material '{mid}' debe ser ≥ 0")
        out["suMax"] = limit
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


def first_v06_field(model: dict) -> str | None:
    """First field of ``model`` that needs version ``"0.6"`` (contract F6.1; ``loads.rs::first_v06_field``)."""
    for i, m in enumerate(model.get("materials") or []):
        if not isinstance(m, dict):
            continue
        if m.get("model") == "hoek_brown":
            return f'materials[{i}].model = "hoek_brown"'
        if m.get("model") == "shansep":
            return f'materials[{i}].model = "shansep"'
        for name in ("ucs", "gsi", "mi", "disturbance", "shansep"):
            if m.get(name) is not None:
                return f"materials[{i}].{name}"
    search = (model.get("analysis") or {}).get("search")
    if isinstance(search, dict) and search.get("non_circular") is not None:
        return "analysis.search.non_circular"
    return None


def _has_new_v06_material(model: dict) -> bool:
    return any(isinstance(m, dict) and m.get("model") in ("hoek_brown", "shansep")
               for m in (model.get("materials") or []))


def validate_v06_interactions(model: dict) -> None:
    """Contract F6.5 rejections: ``tension_crack.depth == "auto"`` and ``lateral_pressure`` with ``hoek_brown`` or
    ``shansep``."""
    if not _has_new_v06_material(model):
        return
    crack = (model.get("analysis") or {}).get("tension_crack")
    if isinstance(crack, dict) and crack.get("depth") == "auto":
        raise UnsupportedModel(
            'analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep; '
            "use una profundidad fija"
        )
    for r in model.get("reinforcements") or []:
        if isinstance(r, dict) and r.get("type") == "pile" and r.get("lateral_pressure") is not None:
            raise UnsupportedModel(
                "lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep"
            )


def non_circular_options(model: dict, method: str, kind: str, notes: list[str]) -> dict[str, Any]:
    """``analysis.search.non_circular`` (v0.6, F6.4) -> ``options.nonCircularOptimization`` on search checks.

    cSlope 0.1.0 fixes ``SEEDS = 3`` and ``MAX_VERTICES = 33`` internally and exposes no option for them, so they stay
    at cSlope's built-in defaults and a note records the requested values.
    """
    analysis = model.get("analysis") or {}
    search = analysis.get("search")
    if not isinstance(search, dict) or search.get("non_circular") is None:
        return {}
    nc = search["non_circular"]
    if not isinstance(nc, dict):
        raise UnsupportedModel("analysis.search.non_circular debe ser un objeto")
    _unknown(nc, _NON_CIRCULAR_KEYS, "analysis.search.non_circular")
    raw_seeds = nc.get("seeds")
    if raw_seeds is None:
        seeds = 3
    else:
        if isinstance(raw_seeds, bool) or not isinstance(raw_seeds, int) or not 1 <= raw_seeds <= 10:
            raise UnsupportedModel(f"analysis.search.non_circular.seeds debe estar en [1, 10], no {raw_seeds!r}")
        seeds = raw_seeds
    raw_mv = nc.get("max_vertices")
    if raw_mv is None:
        max_vertices = 33
    else:
        if isinstance(raw_mv, bool) or not isinstance(raw_mv, int) or raw_mv not in (9, 17, 33):
            raise UnsupportedModel(
                f"analysis.search.non_circular.max_vertices debe ser 9, 17 o 33, no {raw_mv!r}"
            )
        max_vertices = raw_mv
    if method == "bishop" or "bishop" in (analysis.get("methods") or []):
        raise UnsupportedModel(
            "el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)"
        )
    if kind != "search":
        return {}
    notes.append(
        f"búsqueda no circular (F6.4): nonCircularOptimization=true; ogs pide seeds={seeds}, "
        f"max_vertices={max_vertices}, pero cSlope 0.1.0 no tiene parámetro equivalente y usa sus valores fijos "
        "por defecto (3 semillas, hasta 33 vértices)."
    )
    return {"nonCircularOptimization": True}


def tension_crack_options(model: dict) -> dict[str, Any]:
    """``analysis.tension_crack`` (v0.5, F5.2) -> the cSlope options of the crack; ``{}`` without crack.

    ``depth`` is a finite number > 0 (``tensionCrackDepth``) or ``"auto"`` (``tensionCrackAuto``); ``water_fill`` is
    required, in [0, 1] (``tensionCrackWater``, the same fraction). The checks repeat what the engine rejects.
    """
    crack = (model.get("analysis") or {}).get("tension_crack")
    if crack is None:
        return {}
    if model.get("version") not in F5_VERSIONS:
        raise UnsupportedModel(f'tension_crack requiere version "{F5_VERSION}"')
    if not isinstance(crack, dict):
        raise UnsupportedModel("analysis.tension_crack debe ser un objeto")
    unknown = sorted(set(crack) - {"depth", "water_fill"})
    if unknown:
        raise UnsupportedModel(f"analysis.tension_crack con campo desconocido: {unknown[0]}")
    for key in ("depth", "water_fill"):
        if key not in crack:
            raise UnsupportedModel(f"analysis.tension_crack.{key} es obligatorio")
    depth, fill = crack["depth"], crack["water_fill"]
    out: dict[str, Any] = {}
    if depth == "auto":
        out["tensionCrackAuto"] = True
    else:
        d = _finite(depth, "analysis.tension_crack.depth")
        if d <= 0:
            raise UnsupportedModel("analysis.tension_crack.depth debe ser > 0 o \"auto\"")
        out["tensionCrackDepth"] = d
    f = _finite(fill, "analysis.tension_crack.water_fill")
    if not 0.0 <= f <= 1.0:
        raise UnsupportedModel("analysis.tension_crack.water_fill debe estar en [0, 1]")
    out["tensionCrackWater"] = f
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
    if "version" in model and model["version"] not in ALL_VERSIONS:
        raise UnsupportedModel(
            f'version debe ser "0.1", "0.2", "0.3", "0.4", "0.5" o "0.6", no {model["version"]!r}'
        )
    analysis = model.get("analysis") or {}
    notes: list[str] = []

    has_seismic = analysis.get("seismic") is not None
    if (model.get("loads") or has_seismic) and model.get("version") not in SEISMIC_LOADS_VERSIONS:
        raise UnsupportedModel(
            f"los campos 'loads' y 'analysis.seismic' requieren version \"{SEISMIC_LOADS_VERSION}\""
        )
    features = v03_features(model)
    if features and model.get("version") not in F3_VERSIONS:
        raise UnsupportedModel(f"{features[0]} requiere version \"{F3_VERSION}\"")
    raw_reinf = model.get("reinforcements")
    if isinstance(raw_reinf, list) and raw_reinf and model.get("version") not in F4_VERSIONS:
        raise UnsupportedModel(f'reinforcements requiere version "{F4_VERSION}"')
    if isinstance(raw_reinf, list) and any(
        isinstance(r, dict) and r.get("type") == "pile"
        and (r.get("lateral_pressure") is not None or r.get("capacity") is not None)
        for r in raw_reinf
    ) and model.get("version") not in F5_VERSIONS:
        raise UnsupportedModel(f'lateral_pressure requiere version "{F5_VERSION}"')
    crack_options = tension_crack_options(model)
    v06_field = first_v06_field(model)
    if v06_field is not None and model.get("version") != F6_VERSION:
        raise UnsupportedModel(f'{v06_field} requiere version "{F6_VERSION}"')
    validate_v06_interactions(model)
    nc_options = non_circular_options(model, method, kind, notes)
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
    gamma_w = float(water.get("unit_weight", default_water_unit_weight(model)))
    # the crack weighs gamma_w too when it holds water (F5.2): cSlope only knows 9.807
    uses_water = bool(piezo) or float(crack_options.get("tensionCrackWater", 0.0)) > 0.0
    if uses_water and abs(gamma_w - CSLOPE_WATER_UNIT_WEIGHT) > WATER_UNIT_WEIGHT_TOL:
        # cSlope 0.1.0 takes no water weight from the model: it always computes the pore pressure
        # of the piezometric line with 9.807. A different declared value would be silently wrong.
        raise UnsupportedModel(
            f"water.unit_weight={gamma_w} ({unit_label(model)}) con agua (piezometric_line o grieta con agua): cSlope 0.1.0 "
            f"ignora waterUnitWeight y usa {CSLOPE_WATER_UNIT_WEIGHT}; el resultado no sería fiel"
        )
    materials, needs_dry_line = _material_definitions(model, notes, bool(piezo))
    if uses_water and abs(gamma_w - CSLOPE_WATER_UNIT_WEIGHT) > 1e-12:
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
        if needs_dry_line and water_above_ground(outline, piezo):
            notes.append(
                "agua embalsada con un material con ru: ogs suma ru·V/b a la presión de poros (E15c-ru, regla de "
                "Slide2) y cSlope no; el resultado no es comparable."
            )
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
    options.update(crack_options)
    options.update(nc_options)
    definition.update(loads_to_cslope(model, notes))
    definition.update(reinforcements_to_cslope(model, notes))

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
