"""Los 40 modelos de X37 (y los casos con búsqueda no circular que no están entre ellos).

Sin dependencias fuera de la biblioteca estándar: lo importan `run.py` (entorno de cSlope) y `a9_proto.py` (entorno del
wheel 0.5.1). Los modelos que vivían en `$TMPDIR` están copiados en `models/`; los 24 taludes se generan como en
`docs/cm/exploracion/X37_proto/models.py`.
"""
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

PUBLISHED = ("V036c", "V036d", "V039", "V041a", "V041b", "V051", "V053", "V098")
PROMOTED = ("V001-nc", "V026-nc", "V033-nc", "V034a-nc", "V034b-nc")


def _json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _sweep():
    spec = importlib.util.spec_from_file_location("x37models", ROOT / "docs/cm/exploracion/X37_proto/models.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.sweep()


def entries():
    """Los 40 modelos: 8 publicados, V002-nc y los 5 `-nc` promovidos, S1, S2 y los 24 taludes."""
    checks = _json(HERE / "models/checks.json")
    out = [dict(id=n, model=_json(HERE / "models" / f"{n}.json"), checks=checks[n], group="publicado") for n in PUBLISHED]
    d = _json(ROOT / "verification/pending/F3B/V002-nc.json")
    out.append(dict(id="V002-nc", model=d["model"], checks=d["checks"], group="publicado"))
    for n in PROMOTED:
        d = _json(ROOT / "verification/cases" / f"{n}.json")
        out.append(dict(id=n, model=d["model"], checks=d["checks"], group="promovido"))
    for n in ("S1", "S2"):
        out.append(dict(id=n, model=_json(HERE / "models" / f"{n}.json"), checks=[], group="sintetico"))
    out.extend(dict(e, group="talud") for e in _sweep())
    assert len(out) == 40 and len({e["id"] for e in out}) == 40
    return out


def extras(known):
    """Casos de `verification/cases` con búsqueda no circular que no están entre los 40 (para A5)."""
    out = []
    for path in sorted((ROOT / "verification/cases").glob("*.json")):
        d = _json(path)
        m = d.get("model") or {}
        if ((m.get("analysis") or {}).get("search") or {}).get("non_circular") is not None and path.stem not in known:
            out.append(dict(id=path.stem, model=m, checks=d.get("checks", []), group="otro caso"))
    return out


def variant(model, label, seed=None, generated=None):
    """`circular` (sin `non_circular`), `refinement` (v0.6) o `global` (v0.7 con `global: {}`)."""
    m = copy.deepcopy(model)
    s = m["analysis"]["search"]
    nc = s.get("non_circular") or {"seeds": 3, "max_vertices": 33}
    nc.pop("global", None)
    s.pop("non_circular", None)
    m["version"] = "0.6" if label != "global" else "0.7"
    if label != "circular":
        s["non_circular"] = nc
    if label == "global":
        g = {}
        if seed is not None:
            g["seed"] = seed
        if generated is not None:
            g["generated"] = generated
        nc["global"] = g
    return m
