"""OpenGeoSlide model (the ``model`` of a verification case) -> xslope 1.1.0 ``slope_data`` and one run.

xslope is an **informative third column** of the harness, not a judge (X36). This module only translates and runs;
the report and the verdicts are in ``verification/xslope/run.py``.

Scope. A check is converted only when xslope applies the same rule as ogs. Everything else raises
``Unsupported(<rasgo>)``, and the report counts those checks by rasgo:

======================================  ==========================================================================
ogs                                     xslope ``slope_data``
======================================  ==========================================================================
``mohr_coulomb``                        material ``option='mc'``, ``c``, ``phi``                       (slice.py:2868)
``undrained`` without gradient          ``option='cp'``, ``c = Su``, ``cp = 0``                        (slice.py:2876);
                                        with ``Su = 0``: ``option='mc'``, ``c = 0``, ``phi = 0`` (the preflight
                                        of xslope refuses a 'cp' with no strength)
``undrained`` with gradient             ``option='cp'``, ``c = Su0``, ``cp = g``, ``r_elev = datum``, **only** when
                                        no slice base can lie above the datum (see ``_check_gradient``)
``piezometric_line``                    ``piezo_line``, ``u='piezo'`` on every material without ``ru``, and
                                        ``water_loads='auto'`` (ponded water: weight and thrust of the water)
``ru``                                  ``u='ru'``, ``ru``                                             (slice.py:2707)
``unit_weight_sat``                     ``gamma_sat``
``water.unit_weight``                   ``gamma_water`` (default of ogs, imperial included, via ``to_cslope``)
fixed circle                            ``circles = [{Xo, Yo, Depth = yc - r, R}]``
fixed polyline                          ``non_circ = [{X, Y, Movement: None}]``
``circular_entry_exit`` search          ``search_window`` (``entry_x_*``, ``exit_x_*``; the domain when absent)
======================================  ==========================================================================

Undrained with gradient. ogs: ``Su(y) = max(0, Su0 + (datum - y)·g)`` for every ``y``. xslope 'cp':
``Su = c + max(0, r_elev - y)·cp``. They agree for ``y <= datum`` and ``g >= 0`` (the maximum never bites and the
increase below the datum is the same), and differ above the datum, where ogs lets the strength fall and xslope keeps
``c``. So the gradient is converted only if every slice base is at or below the datum; for a search, if the
material cannot reach above it inside the search window.

Not converted (``Unsupported``): methods other than bishop and spencer, non-circular search, a search window of zero
width, ``hoek_brown`` and ``shansep``, ``strength_limit``, loads, seismic, tension crack, reinforcements. The adjustments of the search
(``n_entry``, ``n_exit``, ``n_radius``, ``max_radius_factor``, ``refine``, ``min_width``) are not used: xslope has its
own generator, so the search comparison is between engines, not between grids.

Version. Written and checked against ``xslope==1.1.0``; ``require_version`` stops on any other.
"""

from __future__ import annotations

import contextlib
import copy
import io
import math
import os
import sys
import warnings
from dataclasses import dataclass, field
from importlib import metadata
from typing import Any, Iterator

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from shapely.geometry import LineString, Polygon, box  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from to_cslope import (  # noqa: E402
    UnsupportedModel,
    arc_y,
    default_water_unit_weight,
    regions_of,
)

XSLOPE_VERSION = "1.1.0"
SUPPORTED_METHODS = ("bishop", "spencer")
DEFAULT_SLICES = 50          # the engine default when neither the check nor the model say
GRADIENT_TOL = 1e-9          # tolerance of «base at or below the datum»
ARC_SAMPLES = 2000

# Keys of an xslope material (the dictionary ``load_slope_data`` builds, fileio.py ~1900-2060).
MATERIAL_DEFAULTS: dict[str, Any] = {
    "name": "", "gamma": 0.0, "gamma_sat": None, "option": "", "c": 0.0, "phi": 0.0, "cp": 0.0,
    "r_elev": 0.0, "d": 0, "psi": 0, "t_cut": None, "phi_b": None, "s_cap": None, "Ss": None, "Sy": None,
    "pow_a": 0.0, "pow_b": 0.0, "pow_c": 0.0, "pow_d": 0.0, "u": "none", "ru": 0.0,
    "sigma_gamma": 0.0, "sigma_c": 0.0, "sigma_phi": 0.0, "sigma_cp": 0.0, "sigma_d": 0.0, "sigma_psi": 0.0,
    "k1": 0.0, "k2": 0.0, "alpha": 0.0, "unsat": "lf", "kr0": 0.0, "h0": 0.0, "vg_a": 0.0, "vg_n": 0.0,
}


class Unsupported(ValueError):
    """A model feature that this conversion does not translate with the same rule.

    ``features`` lists the rasgos (short, stable strings), most restrictive first; ``feature`` is the first, the one
    the report counts the check under.
    """

    def __init__(self, *features: str):
        self.features: tuple[str, ...] = tuple(features) or ("sin rasgo",)
        super().__init__("; ".join(self.features))

    @property
    def feature(self) -> str:
        return self.features[0]


@dataclass
class Conversion:
    slope_data: dict
    mode: str                  # 'fixed_circle' | 'fixed_polyline' | 'search_circular'
    method: str                # 'bishop' | 'spencer'
    num_slices: int
    notes: list[str] = field(default_factory=list)


# --------------------------------------------------------------- version

def require_version() -> str:
    """The installed xslope version; ``RuntimeError`` if it is not ``XSLOPE_VERSION``."""
    try:
        found = metadata.version("xslope")
    except metadata.PackageNotFoundError as exc:
        raise RuntimeError(f"xslope no está instalado; use uv --with xslope=={XSLOPE_VERSION}") from exc
    if found != XSLOPE_VERSION:
        raise RuntimeError(f"se exige xslope=={XSLOPE_VERSION} y está instalado xslope=={found}")
    return found


# -------------------------------------------------------------- features

def _seismic_active(seismic: Any) -> bool:
    if not seismic:
        return False
    return any(float((seismic or {}).get(k) or 0.0) != 0.0 for k in ("kh", "kv"))


def unsupported_features(model: dict, check: dict) -> list[str]:
    """Rasgos of ``(model, check)`` that are not converted, most restrictive first (empty: convertible).

    Purely structural: the geometric condition of the undrained gradient is in ``_check_gradient``.
    """
    an = model.get("analysis") or {}
    out: list[str] = []
    if check.get("method") not in SUPPORTED_METHODS:
        out.append(f"método {check.get('method')}")
    search = an.get("search") or {}
    if search.get("non_circular") is not None:
        out.append("búsqueda no circular")
    for key in ("entry", "exit"):
        window = search.get(key)
        if window is not None and float(window[0]) == float(window[1]):
            # xslope keeps a trial only if its end point falls inside the window (search.py:377); a window of zero
            # width needs an exact float and no trial gets there (V054: exit = [55, 55]).
            out.append("ventana de búsqueda de ancho cero")
    for m in model.get("materials") or []:
        kind = m.get("model")
        if kind not in ("mohr_coulomb", "undrained"):
            out.append(f"material {kind}")
        if kind == "undrained" and m.get("strength_limit") is not None:
            out.append("strength_limit")
    if model.get("loads"):
        out.append("cargas")
    if _seismic_active(an.get("seismic")):
        out.append("sismo")
    if an.get("tension_crack"):
        out.append("grieta de tracción")
    if model.get("reinforcements"):
        out.append("refuerzos")
    return list(dict.fromkeys(out))


# ------------------------------------------------- undrained with gradient

def _gradient_materials(model: dict) -> list[dict]:
    """The undrained materials whose strength depends on the elevation (gradient present and not zero)."""
    return [m for m in model.get("materials") or []
            if m.get("model") == "undrained" and m.get("strength_datum") is not None
            and m.get("strength_gradient") not in (None, 0, 0.0)]


def _region_polygons(model: dict) -> dict[str, list[Polygon]]:
    out: dict[str, list[Polygon]] = {}
    for mat_id, poly in regions_of(model):
        out.setdefault(mat_id, []).append(poly)
    return out


def _lower_arc(circle: dict, outline: Polygon) -> LineString | None:
    """The lower arc of a fixed circle over the x span of the model, as a dense polyline.

    The part above the ground is outside every region, so intersecting with a region keeps only the real base. The
    span is not cut at the crossings with the ground: an arc may leave the model through a vertical side (V023).
    """
    xc, r = float(circle["xc"]), float(circle["r"])
    minx, _, maxx, _ = outline.bounds
    a, b = max(xc - r, minx), min(xc + r, maxx)
    if not a < b:
        return None
    xs = [a + (b - a) * i / ARC_SAMPLES for i in range(ARC_SAMPLES + 1)]
    return LineString([(x, arc_y(circle, x)) for x in xs])


def _max_y(geom: Any) -> float | None:
    return None if geom.is_empty else float(geom.bounds[3])


def _check_gradient(model: dict, check: dict, mode: str) -> None:
    """Raise ``Unsupported`` unless the undrained gradient is exact: every base of a gradient material at or below
    its datum, and ``gradient > 0`` (a negative gradient reaches the ogs floor ``max(0, ·)``, xslope has none).

    - fixed circle / polyline: the part of the surface that lies in each gradient material (its regions) must not
      rise above the datum of that material;
    - search: the surface is unknown, so the bound is the whole material inside the strip of x between the leftmost
      and the rightmost limit of the entry and exit windows (a base is under the ground and between those limits).
    """
    gradient = _gradient_materials(model)
    if not gradient:
        return
    if any(float(m["strength_gradient"]) < 0 for m in gradient):
        raise Unsupported("undrained con gradiente negativo")
    regions = _region_polygons(model)
    an = model.get("analysis") or {}
    surface: LineString | None = None
    window: tuple[float, float] | None = None
    if mode == "fixed_circle":
        surface = _lower_arc(an["surface"], unary_union([p for ps in regions.values() for p in ps]))
        if surface is None:
            return      # the circle is outside the model: both engines will say so
    elif mode == "fixed_polyline":
        surface = LineString([(float(x), float(y)) for x, y in an["surface"]["points"]])
    else:
        s = an.get("search") or {}
        xs = [float(v) for key in ("entry", "exit") for v in (s.get(key) or [])]
        if xs:
            window = (min(xs), max(xs))
    for m in gradient:
        datum = float(m["strength_datum"])
        tops: list[float] = []
        for poly in regions.get(m["id"], []):
            if surface is not None:
                part = surface.intersection(poly)
            elif window is not None:
                lo, hi = window
                part = poly.intersection(box(lo, poly.bounds[1] - 1.0, hi, poly.bounds[3] + 1.0))
            else:
                part = poly
            top = _max_y(part)
            if top is not None:
                tops.append(top)
        if tops and max(tops) > datum + GRADIENT_TOL:
            raise Unsupported("undrained con gradiente: bases sobre el datum")


# ------------------------------------------------------------ conversion

def _materials(model: dict, piezo: Any, notes: list[str]) -> list[dict]:
    out = []
    for mo in model.get("materials") or []:
        d = copy.deepcopy(MATERIAL_DEFAULTS)
        d["name"] = mo["id"]
        d["gamma"] = float(mo["unit_weight"])
        sat = mo.get("unit_weight_sat")
        d["gamma_sat"] = None if sat is None else float(sat)
        ru = mo.get("ru")
        d["ru"] = 0.0 if ru is None else float(ru)
        # ogs: a material with ru has u = ru·σ_soil and does not receive the piezometric line; without ru, it does.
        d["u"] = "ru" if ru is not None else ("piezo" if piezo else "none")
        if mo["model"] == "mohr_coulomb":
            d.update(option="mc", c=float(mo["cohesion"]), phi=float(mo["friction_angle"]))
        else:   # undrained, checked
            su0 = float(mo["undrained_strength"])
            gradient = mo.get("strength_gradient")
            if gradient not in (None, 0, 0.0) and mo.get("strength_datum") is not None:
                d.update(option="cp", c=su0, cp=float(gradient), r_elev=float(mo["strength_datum"]))
                notes.append(f"{mo['id']}: undrained con gradiente (cp={float(gradient):g}, "
                             f"r_elev={float(mo['strength_datum']):g}), con las bases bajo el datum")
            elif su0 == 0.0:
                # Zero strength. xslope refuses 'cp' with c = 0 and cp = 0 (preflight: «carries no strength»), even if
                # no base passes through the material; 'mc' with c = 0 and phi = 0 is the same zero strength and runs.
                d.update(option="mc", c=0.0, phi=0.0)
                notes.append(f"{mo['id']}: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de "
                             "xslope rechaza 'cp' sin resistencia)")
            else:
                d.update(option="cp", c=su0, cp=0.0, r_elev=0.0)
        out.append(d)
    return out


def _empty_slope_data() -> dict:
    return {
        "piezo_phreatic": False, "piezo_line2": [], "piezo_phreatic2": False,
        "circles": [], "circular": False, "non_circ": [],
        "dloads": [], "dloads2": [], "dload_dirs": [], "dload2_dirs": [],
        "line_loads": [], "reinforce_lines": [], "reinforcement_lines": [], "pile_lines": [],
        "joint_lines": [], "profile_lines": [], "seepage_bc": {}, "seepage_bc2": {},
        "tcrack_depth": 0.0, "tcrack_water": 0.0, "tcrack_surface": None,
        "k_seismic": 0.0, "k_vertical": 0.0, "water_loads": "manual",
        "unit_system": None, "time_unit": None,
    }


def convert(model: dict, check: dict) -> Conversion:
    """The xslope input of one check. Raises ``Unsupported`` for what is not converted."""
    from xslope.fileio import build_ground_surface_from_polygons

    feats = unsupported_features(model, check)
    if feats:
        raise Unsupported(*feats)
    an = model.get("analysis") or {}
    kind = check.get("kind")
    notes: list[str] = []

    if kind == "fixed":
        surf = an.get("surface")
        if not surf:
            raise Unsupported("fija sin analysis.surface")
        if surf.get("type") == "polyline":
            mode = "fixed_polyline"
        elif surf.get("type") == "circle":
            mode = "fixed_circle"
        else:
            raise Unsupported(f"superficie fija {surf.get('type')}")
    elif kind == "search":
        s = an.get("search") or {}
        if s.get("type") != "circular_entry_exit":
            raise Unsupported(f"búsqueda {s.get('type')}")
        mode = "search_circular"
    else:
        raise Unsupported(f"tipo de check {kind}")

    _check_gradient_safely(model, check, mode)

    water = model.get("water") or {}
    piezo = water.get("piezometric_line") or None
    gamma_w = float(water.get("unit_weight", default_water_unit_weight(model)))

    try:
        regions = regions_of(model)
    except UnsupportedModel as exc:
        raise Unsupported(f"regiones: {exc}") from exc
    mat_index = {m["id"]: i for i, m in enumerate(model["materials"])}
    polys = [{"polygon": poly, "mat_id": mat_index[mat_id], "size": None} for mat_id, poly in regions]
    ground, domain = build_ground_surface_from_polygons(polys)
    minx, _miny, maxx, _maxy = domain.bounds

    sd = _empty_slope_data()
    sd.update(
        materials=_materials(model, piezo, notes),
        polygons=polys, ground_surface=ground, domain_polygon=domain, gamma_water=gamma_w,
        piezo_line=[(float(x), float(y)) for x, y in piezo] if piezo else [],
    )
    if piezo:
        # Where the line is above the ground (ponded water) ogs loads the ground with the weight and the thrust of the
        # water (F5.3). xslope does it only in 'auto' mode (xslope.water.derive_water_loads); in 'manual' it ignores
        # that water (V089, V091, V092: -7 % to -18 %) and Spencer does not even solve (V023). Where the line is
        # under the ground 'auto' derives nothing, so the mode is set whenever there is a piezometric line.
        sd["water_loads"] = "auto"


    slices = int((check.get("options") or {}).get("slices", an.get("slices", DEFAULT_SLICES)))
    if mode == "fixed_circle":
        surf = an["surface"]
        r = float(surf["r"])
        sd["circles"] = [{"Xo": float(surf["xc"]), "Yo": float(surf["yc"]), "Depth": float(surf["yc"]) - r, "R": r}]
        sd["circular"] = True
    elif mode == "fixed_polyline":
        sd["non_circ"] = [{"X": float(x), "Y": float(y), "Movement": None} for x, y in an["surface"]["points"]]
    else:
        s = an["search"]
        entry = s.get("entry") or [minx, maxx]
        exit_ = s.get("exit") or [minx, maxx]
        sd["search_window"] = {
            "entry_x_min": float(entry[0]), "entry_x_max": float(entry[1]),
            "exit_x_min": float(exit_[0]), "exit_x_max": float(exit_[1]),
        }
        sd["circular"] = True
        notes.append("búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs")
    return Conversion(slope_data=sd, mode=mode, method=check["method"], num_slices=slices, notes=notes)


def _check_gradient_safely(model: dict, check: dict, mode: str) -> None:
    try:
        _check_gradient(model, check, mode)
    except UnsupportedModel as exc:
        raise Unsupported(f"regiones: {exc}") from exc


# ----------------------------------------------------------------- run

@contextlib.contextmanager
def surface_supplied_preflight() -> Iterator[None]:
    """Make ``circular_search`` accept a search that starts from the grid, with no circle of its own.

    Why: ``xslope.search.circular_search`` calls ``preflight`` (search.py:822), whose rule ``surface.none_defined``
    (preflight.py:2759) demands a starting circle or a non-circular surface. A search with ``seed='grid'`` has none
    (xslope builds the starting circles from the grid, search.py:455), so the rule refuses a model that is fine. The
    preflight context honours ``selection['surface_supplied']`` (preflight.py:846 and 2770): the run brought its own
    surface. We set it and leave every other rule untouched.

    It replaces ``xslope.search.preflight``, an internal name, only while the block runs, and restores it after.
    Checked against **xslope 1.1.0** (``require_version``); revalidate on any other version.
    """
    import xslope.search as xs_search

    real = xs_search.preflight

    def patched(slope_data, analysis, selection=None, **kw):
        sel = dict(selection or {})
        sel["surface_supplied"] = True
        return real(slope_data, analysis, sel, **kw)

    xs_search.preflight = patched
    try:
        yield
    finally:
        xs_search.preflight = real


def solve(conv: Conversion) -> dict:
    """Run a conversion. ``{'fos', 'error', 'trials', 'surface'}``; ``fos`` is ``None`` with an ``error`` if it failed."""
    from xslope.search import analysis_search_kwargs, circular_search
    from xslope.slice import generate_slices
    from xslope.solve import solve_selected

    out: dict = {"fos": None, "error": None, "trials": None, "surface": None}
    sd = conv.slope_data
    try:
        # xslope prints its progress (iterations, admissibility warnings) on stdout: it is not part of the result.
        with warnings.catch_warnings(), contextlib.redirect_stdout(io.StringIO()):
            warnings.simplefilter("ignore")
            if conv.mode == "search_circular":
                kw = analysis_search_kwargs(sd, circular=True, announce=False)
                with surface_supplied_preflight():
                    fs_cache, _conv, _path, _circ = circular_search(
                        sd, conv.method, seed="grid", num_slices=conv.num_slices, **kw)
                if not fs_cache:
                    out["error"] = "sin superficie admisible: la rejilla semilla de xslope no dio ningún círculo dentro de las ventanas"
                    return out
                best = min(fs_cache, key=lambda r: r["FS"])
                res = {"FS": best["FS"], "failure": None}
                out["trials"] = len(fs_cache)
                out["surface"] = {"xc": float(best["Xo"]), "yc": float(best["Yo"]),
                                  "r": float(best["Yo"]) - float(best["Depth"])}
            else:
                circle = sd["circles"][0] if conv.mode == "fixed_circle" else None
                non_circ = sd["non_circ"] if conv.mode == "fixed_polyline" else None
                ok, gen = generate_slices(sd, circle=circle, non_circ=non_circ, num_slices=conv.num_slices, debug=False)
                if not ok:
                    out["error"] = f"generate_slices: {str(gen)[:200]}"
                    return out
                slice_df, _surface = gen
                res = solve_selected(conv.method, slice_df)
        if not isinstance(res, dict):       # a method that does not solve answers with its message
            out["error"] = f"sin FS: {str(res)[:200]}"
            return out
        fos = res.get("FS")
        if fos is None or not math.isfinite(float(fos)):
            out["error"] = f"sin FS finito: {res.get('failure')}"
        else:
            out["fos"] = float(fos)
    except Exception as exc:  # noqa: BLE001 - recorded in the report, the run goes on
        out["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
    return out


def run_xslope(model: dict, check: dict) -> dict:
    """Convert and run one check: the result of ``solve`` plus ``mode``, ``notes`` and ``unsupported``."""
    try:
        conv = convert(model, check)
    except Unsupported as exc:
        return {"fos": None, "error": None, "trials": None, "surface": None, "mode": None, "notes": [],
                "unsupported": exc.feature, "unsupported_all": list(exc.features)}
    out = solve(conv)
    out.update(mode=conv.mode, notes=conv.notes, unsupported=None, unsupported_all=[])
    return out
