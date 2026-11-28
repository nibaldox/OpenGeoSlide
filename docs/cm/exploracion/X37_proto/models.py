"""X37: registro de modelos (pendientes, promovidos, sintéticos y barrido de 24 taludes).

Rutas: el repo se toma de la ubicación de este archivo; los casos externos, de $TMPDIR (variable de entorno).
"""
import copy
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", ".."))
TMP = os.environ.get("TMPDIR", "")
X32 = os.path.join(TMP, "cm-x32")


def _load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def pending_and_promoted():
    out = []
    pend = os.path.join(X32, "pending")
    for name in ("V036c", "V036d", "V039", "V041a", "V041b", "V051", "V053", "V098"):
        d = _load(os.path.join(pend, name + ".json"))
        out.append(dict(id=name, group="pendiente", model=d["model"], checks=d["checks"], src=f"$TMPDIR/cm-x32/pending/{name}.json"))
    d = _load(os.path.join(REPO, "verification", "pending", "F3B", "V002-nc.json"))
    out.append(dict(id="V002-nc", group="pendiente", model=d["model"], checks=d["checks"], src="verification/pending/F3B/V002-nc.json"))
    for name in ("V001-nc", "V026-nc", "V033-nc", "V034a-nc", "V034b-nc"):
        d = _load(os.path.join(REPO, "verification", "cases", name + ".json"))
        out.append(dict(id=name, group="promovido", model=d["model"], checks=d["checks"], src=f"verification/cases/{name}.json"))
    for name in ("S1", "S2"):
        m = _load(os.path.join(X32, "synthetic", name + ".json"))
        out.append(dict(id=name, group="sintetico", model=m, checks=[], src=f"$TMPDIR/cm-x32/synthetic/{name}.json"))
    return out


def talud(H: float, beta_deg: float, phi: float, c: float, gamma: float = 19.0):
    """Talud homogéneo: cresta plana de 2H a la izquierda, cara con β, pie y base de 4H; fondo en y = −H.
    Ventanas: entrada = cresta [−2H, 0]; salida = pie [xt, xt+4H]. Sin agua. direction auto."""
    xt = H / math.tan(math.radians(beta_deg))
    poly = [[-2 * H, H], [0.0, H], [xt, 0.0], [xt + 4 * H, 0.0], [xt + 4 * H, -H], [-2 * H, -H]]
    return {
        "format": "opengeoslide",
        "version": "0.6",
        "meta": {"id": f"TAL-H{int(H)}-b{int(beta_deg)}-f{int(phi)}-c{int(c)}", "title": "talud homogéneo (barrido X37)"},
        "units": "SI",
        "materials": [{"id": "soil", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": gamma,
                       "unit_weight_sat": None, "cohesion": c, "friction_angle": phi, "ru": None}],
        "regions": [{"material": "soil", "polygon": poly}],
        "slope": {"direction": "auto"},
        "analysis": {
            "methods": ["spencer"], "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
            "search": {"type": "circular_entry_exit", "entry": [-2 * H, 0.0], "exit": [xt, xt + 4 * H],
                       "n_entry": 20, "n_exit": 20, "n_radius": 20, "max_radius_factor": 5.0,
                       "min_width": None, "refine": True},
        },
    }


def sweep():
    out = []
    for H in (10.0, 30.0):
        for beta in (30.0, 45.0, 60.0):
            for phi in (20.0, 35.0):
                for c in (5.0, 30.0):
                    m = talud(H, beta, phi, c)
                    out.append(dict(id=m["meta"]["id"], group="barrido", model=m, checks=[],
                                    src="generado (talud(), X37_proto/models.py)"))
    return out


def with_nc(model: dict, nc: bool):
    m = copy.deepcopy(model)
    s = m["analysis"]["search"]
    if nc:
        s["non_circular"] = {"seeds": 3, "max_vertices": 33}
        m["version"] = "0.6"
    else:
        s.pop("non_circular", None)
    return m


def all_entries(with_sweep: bool = True):
    e = pending_and_promoted()
    if with_sweep:
        e += sweep()
    return e
