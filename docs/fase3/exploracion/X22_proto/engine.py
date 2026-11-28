"""Lanza `ogs analyze` y devuelve las dovelas del motor (sin tocarlo). Copia adaptada de X21_proto/engine.py."""
from __future__ import annotations
import copy, json, os, subprocess, tempfile

from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
OGS = os.environ.get("OGS_BIN", str(ROOT / "target/release/ogs"))
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


def clean_model(model, extra_nodes=(), methods=METHODS, keep_forces=False, width=None):
    """Modelo v0.4 limpio para el motor. Los pilotes con `lateral_pressure` (propuesta v0.5) se quitan; los pilotes con
    `force` se conservan solo si `keep_forces` (para la referencia del motor con fuerza dada).

    `extra_nodes`: x donde se quiere un corte de dovela (carga de línea de 1e-9, el truco de E12f usado por X17/X21)."""
    m = copy.deepcopy(model)
    m["version"] = "0.4"
    a = m.setdefault("analysis", {})
    a["methods"] = list(methods)
    a.pop("search", None)
    if "morgenstern_price" in methods:
        a["interslice"] = {"function": "constant"}
    items = []
    for r in m.get("reinforcements", []):
        if keep_forces and r.get("force") is not None and "lateral_pressure" not in r:
            r = {k: v for k, v in r.items() if k != "lateral_pressure"}
            items.append(r)
    if items:
        m["reinforcements"] = items
    else:
        m.pop("reinforcements", None)
    loads = list(m.get("loads", []))
    for i, x in enumerate(extra_nodes):
        loads.append({"type": "line", "id": f"x22n{i}", "x": float(x), "p": 1e-9, "angle": 0.0})
    if loads:
        m["loads"] = loads
        if m.get("version") in ("0.1", None):
            m["version"] = "0.2"
    return m


def run_ogs(model):
    with tempfile.NamedTemporaryFile("w", suffix=".ogs.json", delete=False, dir=os.environ.get("TMPDIR")) as f:
        json.dump(model, f)
        path = f.name
    try:
        p = subprocess.run([OGS, "analyze", path], capture_output=True, text=True, timeout=120)
    finally:
        os.unlink(path)
    try:
        return json.loads(p.stdout)
    except Exception:
        raise RuntimeError("ogs: " + (p.stderr or p.stdout)[:600])


def engine_results(model, **kw):
    out = run_ogs(clean_model(model, **kw))
    return {r["method"]: r for r in out["results"]}
