"""OpenGeoSlide .ogs.json v0.1 -> cSlope 0.1.0 analysis document.

Translation only: nothing is computed here. The correspondence table and the
known, documented differences are in README.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, unary_union

# The installed cSlope 0.1.0 engine ignores the `waterUnitWeight` option and
# always uses 9.807 kN/m3. OpenGeoSlide's default is 9.81 (see README.md).
CSLOPE_WATER_UNIT_WEIGHT = 9.807
# Water line of the materials whose ru replaces the piezometric pressure.
# Placed far below the model so that it contributes no pore pressure.
DRY_LINE_ID = "ogs-ru-no-water"
DRY_LINE_DEPTH = 1000.0
CSLOPE_MIN_SLICES = 10
CSLOPE_MAX_SLICES = 500
CSLOPE_MIN_ITERATIONS = 500
CSLOPE_MAX_ITERATIONS = 100000
METHOD_MAP = {"bishop": "Bishop", "spencer": "Morgenstern-Price"}


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


def resolve_direction(model: dict, outline: Polygon) -> str:
    """OpenGeoSlide slope.direction -> cSlope orientation ('ltr' | 'rtl')."""
    direction = (model.get("slope") or {}).get("direction", "auto")
    if direction == "left_to_right":
        return "ltr"
    if direction == "right_to_left":
        return "rtl"
    if direction != "auto":
        raise UnsupportedModel(f"unknown slope.direction {direction!r}")
    minx, maxx = outline.bounds[0], outline.bounds[2]
    # auto: moves towards +x (left_to_right) when y_top(x_min) > y_top(x_max)
    return "ltr" if y_top(outline, minx) > y_top(outline, maxx) else "rtl"


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


def circle_from_plane(plane: dict) -> dict:
    """Inverse of plane_from_circle."""
    return {"type": "circle", "xc": float(plane["cx"]), "yc": float(plane["cy"]), "r": float(plane["radius"])}


# ------------------------------------------------------------- conversion

def _material_definitions(model: dict, notes: list[str], piezo: bool) -> tuple[list[dict], bool]:
    materials = model.get("materials", [])
    ids = [m["id"] for m in materials]
    if len(set(ids)) != len(ids):
        raise UnsupportedModel("repeated material ids")
    defs: list[dict] = []
    needs_dry_line = False
    for m in materials:
        if m.get("model", "mohr_coulomb") != "mohr_coulomb":
            raise UnsupportedModel(f"material model {m.get('model')!r} is not mohr_coulomb")
        model_def: dict[str, Any] = {
            "kind": "mohr-coulomb",
            "unitWeight": float(m["unit_weight"]),
            "cohesion": float(m["cohesion"]),
            "frictionAngle": float(m["friction_angle"]),
        }
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

    polys = regions_of(model)
    outline = outline_of(polys)
    minx, miny, maxx, maxy = outline.bounds
    orientation = resolve_direction(model, outline)

    water = model.get("water") or {}
    piezo = water.get("piezometric_line") or None
    gamma_w = float(water.get("unit_weight", 9.81))
    materials, needs_dry_line = _material_definitions(model, notes, bool(piezo))
    if (piezo or any(m.get("unit_weight_sat") is not None for m in model.get("materials", []))) \
            and abs(gamma_w - CSLOPE_WATER_UNIT_WEIGHT) > 1e-12:
        notes.append(
            f"gamma_w={gamma_w} kN/m3 in OpenGeoSlide; cSlope 0.1.0 uses {CSLOPE_WATER_UNIT_WEIGHT} "
            "(waterUnitWeight is ignored by the installed engine)."
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
    elif float(analysis.get("min_m_alpha", 0.2)) != 0.2:
        notes.append("min_m_alpha has no cSlope equivalent; cSlope uses its own Bishop validity rule.")

    if kind == "fixed":
        surface = analysis.get("surface")
        if not surface:
            raise UnsupportedModel("kind 'fixed' but analysis.surface is missing")
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
