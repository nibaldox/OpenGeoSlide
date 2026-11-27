#!/usr/bin/env python3
"""E15l-10 (A-11): qué casos de `verification/cases/` ejercitan de verdad el agua embalsada en la superficie de su check.

Uso (desde la raíz del repositorio, con el binario `ogs` ya construido):

    env -u PYTHONPATH -u PYTHONHOME python3 docs/fase3/r12/p-medir_agua_embalsada.py target/release/ogs

Para cada caso cuyo modelo tiene la piezométrica sobre el terreno (la misma prueba que usa
`verification/tools/identity_vs_baseline.py`) y para cada uno de sus checks:

1. corre el check tal como lo hace `crates/ogs-core/tests/acceptance.rs` (un método, `fixed` o `search`, con
   `options.slices`) y toma la superficie final y el FS;
2. mide `Σ|weight_extra|` y `Σ|h_force|` de las dovelas de **esa** superficie, que son los términos que suman el peso y el
   empuje del agua embalsada (y, en un modelo con cargas, sismo o grieta con agua, también esos términos);
3. repite la corrida con la superficie fija, **sin** `loads`, sin `seismic`, sin refuerzos y con `water_fill = 0` en la
   grieta (la grieta sigue truncando la masa): lo que queda de `weight_extra` y `h_force` es solo agua embalsada. Esa es
   la columna que decide si el check ejercita el agua embalsada.

Escribe una tabla en Markdown por la salida estándar y el detalle en JSON si se pasa `--json RUTA`.
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "verification" / "tools"))
from identity_vs_baseline import water_over_ground  # noqa: E402

# un check ejercita el agua embalsada si, solo con ella, Σ|weight_extra| o Σ|h_force| llegan a esta fracción de Σ weight
UMBRAL = 1e-3


def analyze(binary: str, model: dict) -> dict | None:
    with tempfile.NamedTemporaryFile("w", suffix=".ogs.json", delete=False) as fh:
        json.dump(model, fh)
        path = fh.name
    try:
        proc = subprocess.run([binary, "analyze", path], capture_output=True, text=True, timeout=1200)
    finally:
        Path(path).unlink(missing_ok=True)
    return json.loads(proc.stdout) if proc.returncode == 0 else None


def sums(result: dict) -> tuple[float, float, float]:
    """`(Σ|weight_extra|, Σ|h_force|, Σ weight)` de las dovelas del resultado."""
    slices = result.get("slices") or []
    return (
        sum(abs(s.get("weight_extra", 0.0)) for s in slices),
        sum(abs(s.get("h_force", 0.0)) for s in slices),
        sum(s.get("weight", 0.0) for s in slices),
    )


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    binary = args[0]
    out_json = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    rows = []
    for path in sorted((ROOT / "verification" / "cases").glob("V*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        base = case["model"]
        if not water_over_ground(base):
            continue
        for check in case["checks"]:
            model = copy.deepcopy(base)
            model["analysis"]["methods"] = [check["method"]]
            if check["method"] != "morgenstern_price":
                model["analysis"].pop("interslice", None)
            if check["kind"] == "fixed":
                model["analysis"].pop("search", None)
            if (check.get("options") or {}).get("slices"):
                model["analysis"]["slices"] = check["options"]["slices"]
            report = analyze(binary, model)
            result = report["results"][0] if report else None
            row = {"caso": case["id"], "metodo": check["method"], "tipo": check["kind"], "publicado": check["published"]}
            if not result or result.get("fos") is None:
                row.update(fos=None, sum_weight_extra=None, sum_h_force=None, solo_agua_weight=None, solo_agua_h=None)
                rows.append(row)
                continue
            w_all, h_all, weight = sums(result)
            # el informe trae la superficie sin `type`: {xc, yc, r} (círculo) o {points} (polilínea)
            probe = copy.deepcopy(model)
            probe["analysis"]["surface"] = {"type": "polyline" if "points" in result["surface"] else "circle", **result["surface"]}
            probe["analysis"].pop("search", None)
            probe["analysis"].pop("seismic", None)
            probe.pop("loads", None)
            probe.pop("reinforcements", None)
            if probe["analysis"].get("tension_crack"):
                probe["analysis"]["tension_crack"]["water_fill"] = 0.0
            probe_report = analyze(binary, probe)
            if not probe_report or not probe_report["results"]:
                raise SystemExit(f"{case['id']} {check['method']}: la corrida de control falló")
            w_p, h_p, _ = sums(probe_report["results"][0])
            row.update(fos=result["fos"], weight=weight, sum_weight_extra=w_all, sum_h_force=h_all,
                       solo_agua_weight=w_p, solo_agua_h=h_p)
            rows.append(row)
    if out_json:
        Path(out_json).write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8")
    print_table(rows)
    return 0


def print_table(rows: list[dict]) -> None:
    """Una fila por caso: el rango de las sumas sobre todos sus checks (los de búsqueda cambian un poco con el método)."""
    cases: dict[str, list[dict]] = {}
    for r in rows:
        cases.setdefault(r["caso"], []).append(r)
    print("| Caso | Checks (método, tipo) | Σ\\|weight_extra\\| | Σ\\|h_force\\| | Σ\\|weight_extra\\| / Σ peso | Ejercita el agua embalsada |")
    print("|---|---|---:|---:|---:|---|")
    for caso, rs in cases.items():
        rs = [r for r in rs if r["fos"] is not None]
        checks = ", ".join(sorted({f"{r['metodo']} {r['tipo']}" for r in rs}))
        w = [r["solo_agua_weight"] for r in rs]
        h = [r["solo_agua_h"] for r in rs]
        ratio = max(r["solo_agua_weight"] / r["weight"] for r in rs)
        ratio_h = max(r["solo_agua_h"] / r["weight"] for r in rs)
        veredicto = "sí" if max(ratio, ratio_h) >= UMBRAL else ("no" if max(w + h) == 0.0 else "marginal")
        rango = lambda v: f"{min(v):.4g}" if f"{min(v):.4g}" == f"{max(v):.4g}" else f"{min(v):.4g} a {max(v):.4g}"  # noqa: E731
        print(f"| {caso} | {checks} | {rango(w)} | {rango(h)} | {ratio:.2e} | {veredicto} |")


if __name__ == "__main__":
    raise SystemExit(main())
