"""Byte-for-byte identity of the engine against a baseline binary (gate of every wave of the reinforcements block,
F4.1 and F4.14: a model without `reinforcements` gives the same output as v0.2.0; and of the crack and ponded water
block, F5.1 and F5.5-1: a model without `tension_crack` and without water over the ground gives the same output as
v0.3.0, except for the engine version number).

    env -u PYTHONPATH -u PYTHONHOME python3 verification/tools/identity_vs_baseline.py \\
        --base $TMPDIR/f3r0-base-target/release/ogs --new target/release/ogs [--out DIR]
    env -u PYTHONPATH -u PYTHONHOME python3 verification/tools/identity_vs_baseline.py --normalize-version \\
        --base $TMPDIR/f3g-base-target/release/ogs --new target/release/ogs

- `--normalize-version` replaces the engine version in stdout and stderr (`ogs-core 0.3.0` → `ogs-core <VERSION>`)
  before comparing, so that a baseline and a new binary of different versions can be compared.
- `--include-reinforced` also runs the models with `reinforcements` (a baseline of v0.3.0 or later reads them; the
  default skips them, as the baseline of v0.2.0 cannot).
- **Ponded water (F5.1, exception documented).** The models whose piezometric line passes over the ground at some point
  (`water_above_ground` today) change by design: the ponded water now has weight and thrust (a correction of the same
  kind as V065 in E14o-11). They are **separated and reported by name**, with the variants that differ, and they are not
  counted as a failure and not hidden: the gate reads «0 differences» for everything else. The list of models with
  water over the ground and no reinforcements is printed apart because the contract expects it to be empty for them.

Build the baseline from a detached worktree of the release commit (`git worktree add --detach $TMPDIR/base bf1655c`,
`CARGO_TARGET_DIR=$TMPDIR/base-target cargo build --release -p ogs-cli`), and rebuild `--new` first
(`cargo test` does NOT rebuild `target/release/ogs`).

The models are the cases of `verification/cases`, the models of `verification/pending`, the battery
`verification/differential/cases*` and `examples/`. Each one runs in the variants

- `own`: the file as it is (its methods, its surface or search);
- `search`: the five methods and a circular search (its own, or a 10x10x10 grid), version "0.3" at least;
- `fixed`: the five methods on a fixed circle (its own, or the critical circle that the baseline found in `search`);
- `search@0.4` and `fixed@0.4`: the same documents with `version: "0.4"`, run by the **new** binary only and compared
  with the baseline output of `search` and `fixed` (the engine of v0.2.0 does not know `"0.4"`).

The output compared is stdout, stderr and the exit status of `ogs analyze`, so an error (a polyline with Bishop, an
undrained material that does not converge) must also be the same. Exit status 1 when any variant differs.

The models with a non-empty `reinforcements` list are **skipped and counted apart** (F3R-R2): the baseline cannot read
them (v0.2.0 rejects the field), so there is nothing to compare; the identity gate is the one of the models without
reinforcements.
"""

from __future__ import annotations

import argparse
import copy
import glob
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FIVE = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
DEFAULT_SEARCH = {"type": "circular_entry_exit", "n_entry": 10, "n_exit": 10, "n_radius": 10}


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    return doc["model"] if "model" in doc and "materials" not in doc else doc


def model_paths() -> dict[str, str]:
    patterns = [
        "verification/cases/V*.json",
        "verification/pending/**/*.json",
        "verification/differential/cases*/D*.ogs.json",
        "examples/*.ogs.json",
    ]
    out: dict[str, str] = {}
    for pattern in patterns:
        for path in sorted(glob.glob(os.path.join(ROOT, pattern), recursive=True)):
            try:
                model = _load(path)
            except (ValueError, OSError):
                continue
            if isinstance(model, dict) and model.get("format") == "opengeoslide":
                out[os.path.relpath(path, ROOT)] = path
    return out


def has_reinforcements(model: dict) -> bool:
    """`True` when the model has at least one reinforcement (the v0.2.0 baseline cannot read it)."""
    return bool(model.get("reinforcements"))


def split_models(paths: dict[str, str], include_reinforced: bool = False) -> tuple[dict[str, str], dict[str, str]]:
    """Splits `paths` into the models the baseline can run and the ones with reinforcements (skipped, unless the
    baseline reads them: `include_reinforced`)."""
    plain: dict[str, str] = {}
    skipped: dict[str, str] = {}
    for name, path in paths.items():
        (skipped if has_reinforcements(_load(path)) and not include_reinforced else plain)[name] = path
    return plain, skipped


def split_ponded(models: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    """Splits `models` into the ones without water over the ground (the identity gate) and the ones with it (the
    documented exception of F5.1, reported by name)."""
    dry: dict[str, str] = {}
    ponded: dict[str, str] = {}
    for name, path in models.items():
        (ponded if water_over_ground(_load(path)) else dry)[name] = path
    return dry, ponded


_VERSION_RE = re.compile(rb"(ogs(?:-core|-cli|-wasm|-py)?[ /@-])v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?")
NORMALIZE = False


def normalize_version(data: bytes) -> bytes:
    """Replaces the version of the engine (`ogs-core 0.3.0`, `ogs-cli 0.4.0-rc.1`) by `<name> <VERSION>`."""
    return _VERSION_RE.sub(rb"\1<VERSION>", data)


def run(binary: str, model: dict, path: str) -> tuple[int, bytes, bytes]:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(model, fh)
    proc = subprocess.run([binary, "analyze", path], capture_output=True, timeout=1200)
    if NORMALIZE:
        return proc.returncode, normalize_version(proc.stdout), normalize_version(proc.stderr)
    return proc.returncode, proc.stdout, proc.stderr


def _top(polygon: list, x: float) -> float | None:
    """Highest `y` of the boundary of `polygon` at abscissa `x` (the vertical edges count with both ends)."""
    ys: list[float] = []
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1]):
        if x1 == x2:
            if x == x1:
                ys += [y1, y2]
        elif min(x1, x2) <= x <= max(x1, x2):
            ys.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    return max(ys) if ys else None


def _piezo(line: list, x: float) -> float:
    """The piezometric line at `x`, horizontal beyond its ends (as in the engine)."""
    if x <= line[0][0]:
        return line[0][1]
    if x >= line[-1][0]:
        return line[-1][1]
    for (x1, y1), (x2, y2) in zip(line, line[1:]):
        if x1 <= x <= x2:
            return y1 + (y2 - y1) * (x - x1) / (x2 - x1) if x2 > x1 else max(y1, y2)
    return line[-1][1]


def water_over_ground(model: dict, tol: float = 1e-9) -> bool:
    """`True` when the piezometric line is over the ground (more than `tol` times the model scale) somewhere.

    Both are piecewise linear, so the difference is extreme at a vertex of either one or at the ends of the model: it is
    evaluated there. This is the water that the engine of v0.3.0 reports as `water_above_ground` (and that v0.4.0
    includes as ponded water, F5.1).
    """
    line = (model.get("water") or {}).get("piezometric_line")
    if not line or not model.get("regions"):
        return False
    polygons = [r["polygon"] for r in model["regions"]]
    xs = sorted({p[0] for poly in polygons for p in poly} | {p[0] for p in line})
    scale = max(xs[-1] - xs[0], max(p[1] for poly in polygons for p in poly) - min(p[1] for poly in polygons for p in poly))
    for x in xs:
        tops = [t for t in (_top(poly, x) for poly in polygons) if t is not None]
        if tops and _piezo(line, x) > max(tops) + tol * scale:
            return True
    return False


def at_least_v03(model: dict) -> dict:
    model = copy.deepcopy(model)
    if model.get("version") in ("0.1", "0.2"):
        model["version"] = "0.3"
    return model


def critical_circle(stdout: bytes) -> dict | None:
    try:
        surface = json.loads(stdout)["results"][0]["surface"]
    except (ValueError, KeyError, IndexError):
        return None
    return {"type": "circle", **surface} if {"xc", "yc", "r"} <= set(surface) else None


STATS: dict[tuple[str, str], int] = {}


def check(name: str, path: str, base: str, new: str, tmp: str) -> list[tuple[str, str, str]]:
    """Runs every variant of one model; returns `(model, variant, what differs)` for each difference."""
    model = _load(path)
    stem = os.path.join(tmp, name.replace("/", "__"))
    diffs: list[tuple[str, str, str]] = []

    def compare(variant: str, a: tuple, b: tuple) -> None:
        key = (variant, "ok" if a[0] == 0 else "error")
        STATS[key] = STATS.get(key, 0) + 1
        if a != b:
            what = [n for n, x, y in zip(("status", "stdout", "stderr"), a, b) if x != y]
            diffs.append((name, variant, "+".join(what)))

    # own
    compare("own", run(base, model, stem + ".own.base.json"), run(new, model, stem + ".own.new.json"))

    # search
    searched = at_least_v03(model)
    searched["analysis"]["methods"] = list(FIVE)
    searched["analysis"].setdefault("search", None)
    if not searched["analysis"].get("search"):
        searched["analysis"]["search"] = dict(DEFAULT_SEARCH)
    base_search = run(base, searched, stem + ".search.base.json")
    compare("search", base_search, run(new, searched, stem + ".search.new.json"))
    as_v04 = copy.deepcopy(searched)
    as_v04["version"] = "0.4"
    compare("search@0.4", base_search, run(new, as_v04, stem + ".search04.new.json"))

    # fixed
    fixed = copy.deepcopy(searched)
    own = model["analysis"].get("surface")
    circle = own if own and own.get("type") == "circle" else critical_circle(base_search[1])
    if own and own.get("type") == "polyline":
        fixed["analysis"]["surface"] = own
        fixed["analysis"]["methods"] = [m for m in FIVE if m != "bishop"]
        circle = own
    if circle is not None:
        fixed["analysis"]["surface"] = circle
        fixed["analysis"]["search"] = None
        base_fixed = run(base, fixed, stem + ".fixed.base.json")
        compare("fixed", base_fixed, run(new, fixed, stem + ".fixed.new.json"))
        fixed04 = copy.deepcopy(fixed)
        fixed04["version"] = "0.4"
        compare("fixed@0.4", base_fixed, run(new, fixed04, stem + ".fixed04.new.json"))
    return diffs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, help="baseline binary (the release commit)")
    ap.add_argument("--new", default=os.path.join(ROOT, "target", "release", "ogs"), help="binary under test")
    ap.add_argument("--out", default=os.path.join(os.environ.get("TMPDIR", "/tmp"), "identity"), help="scratch dir")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--normalize-version", action="store_true",
                    help="replace the engine version in stdout and stderr before comparing")
    ap.add_argument("--include-reinforced", action="store_true",
                    help="also run the models with reinforcements (the baseline must read version 0.4)")
    args = ap.parse_args()
    global NORMALIZE
    NORMALIZE = args.normalize_version
    for exe in (args.base, args.new):
        if not os.path.isfile(exe):
            print(f"error: binario no encontrado: {exe}", file=sys.stderr)
            return 2
    os.makedirs(args.out, exist_ok=True)
    models, skipped = split_models(model_paths(), args.include_reinforced)
    models, ponded = split_ponded(models)
    print(f"{len(models)} modelos sin agua sobre el terreno; variantes own, search, fixed, search@0.4 y fixed@0.4"
          + (" (versión del motor normalizada)" if NORMALIZE else ""))
    print(f"{len(skipped)} modelos con refuerzos saltados aparte (el binario base no los lee)")
    print(f"{len(ponded)} modelos con la piezométrica sobre el terreno, aparte (excepción de F5.1: agua embalsada)")
    diffs: list[tuple[str, str, str]] = []
    exception: list[tuple[str, str, str]] = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {n: pool.submit(check, n, p, args.base, args.new, args.out) for n, p in {**models, **ponded}.items()}
        for n, fut in futures.items():
            (exception if n in ponded else diffs).extend(fut.result())
    for model, variant, what in diffs:
        print(f"DIFIERE {model} [{variant}]: {what}")
    for (variant, kind), n in sorted(STATS.items()):
        print(f"  {variant}: {n} comparaciones con salida {kind} del baseline")
    print("Modelos con agua sobre el terreno (excepción de F5.1, no cuentan como diferencia):")
    for name in sorted(ponded):
        mine = sorted({v for m, v, _ in exception if m == name})
        reinforced = " [con refuerzos]" if has_reinforcements(_load(ponded[name])) else ""
        print(f"  AGUA {name}{reinforced}: " + (f"cambia en {', '.join(mine)}" if mine else "idéntico"))
    plain_ponded = [n for n, p in sorted(ponded.items()) if not has_reinforcements(_load(p))]
    print(f"{len(plain_ponded)} modelos con agua sobre el terreno y sin refuerzos: {', '.join(plain_ponded) or '(ninguno)'}")
    print(f"{len(diffs)} diferencias en {len(models)} modelos sin agua sobre el terreno ({len(skipped)} con refuerzos, saltados;"
          f" {len(ponded)} con agua sobre el terreno, aparte)")
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
