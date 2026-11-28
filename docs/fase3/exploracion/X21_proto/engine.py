"""Lanza `ogs analyze` y devuelve las dovelas del motor (sin tocar el motor)."""
from __future__ import annotations
import copy, json, os, subprocess, tempfile

from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
OGS = os.environ.get("OGS_BIN", str(ROOT / "target/release/ogs"))
METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
X21_KEYS = ("tension_crack", "free_water", "x21")


def clean_model(model, extra_nodes=(), methods=METHODS, interslice="constant", drop_water_line=False):
    """Modelo v0.4 limpio para el motor: sin campos X21, con los cinco métodos y M-P `constant`.

    `extra_nodes`: x donde se quiere un corte de dovela (carga de línea de 1e-9, el truco de E12f usado por X17)."""
    m = copy.deepcopy(model)
    a = m.setdefault("analysis", {})
    m["version"] = "0.4"          # el motor v0.3.0 no conoce 0.5; los campos X21 se quitan abajo
    for k in X21_KEYS:
        a.pop(k, None)
    w = m.get("water")
    if w:
        for k in X21_KEYS:
            w.pop(k, None)
        if drop_water_line:
            m.pop("water", None)
    if (a.get("surface") or {}).get("type") == "polyline":
        methods = [x for x in methods if x != "bishop"]       # Bishop no se ofrece en polilínea (F3.6)
    a["methods"] = list(methods)
    a.pop("search", None)
    if interslice and "morgenstern_price" in methods:
        a["interslice"] = {"function": interslice}
    loads = list(m.get("loads", []))
    for i, x in enumerate(extra_nodes):
        loads.append({"type": "line", "id": f"x21n{i}", "x": float(x), "p": 1e-9, "angle": 0.0})
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
    if p.returncode not in (0, 1, 2) and not p.stdout:
        raise RuntimeError(p.stderr[:500])
    try:
        return json.loads(p.stdout)
    except Exception:
        raise RuntimeError("ogs: " + (p.stderr or p.stdout)[:600])


def engine_results(model, **kw):
    out = run_ogs(clean_model(model, **kw))
    return {r["method"]: r for r in out["results"]}
