"""Byte-for-byte identity of the engine against a baseline binary (gate of every wave of the reinforcements block,
F4.1 and F4.14: a model without `reinforcements` gives the same output as v0.2.0).

    env -u PYTHONPATH -u PYTHONHOME python3 verification/tools/identity_vs_baseline.py \\
        --base $TMPDIR/f3r0-base-target/release/ogs --new target/release/ogs [--out DIR]

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
"""

from __future__ import annotations

import argparse
import copy
import glob
import json
import os
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


def run(binary: str, model: dict, path: str) -> tuple[int, bytes, bytes]:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(model, fh)
    proc = subprocess.run([binary, "analyze", path], capture_output=True, timeout=1200)
    return proc.returncode, proc.stdout, proc.stderr


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
    args = ap.parse_args()
    for exe in (args.base, args.new):
        if not os.path.isfile(exe):
            print(f"error: binario no encontrado: {exe}", file=sys.stderr)
            return 2
    os.makedirs(args.out, exist_ok=True)
    models = model_paths()
    print(f"{len(models)} modelos; variantes own, search, fixed, search@0.4 y fixed@0.4")
    diffs: list[tuple[str, str, str]] = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {n: pool.submit(check, n, p, args.base, args.new, args.out) for n, p in models.items()}
        for n, fut in futures.items():
            diffs += fut.result()
    for model, variant, what in diffs:
        print(f"DIFIERE {model} [{variant}]: {what}")
    for (variant, kind), n in sorted(STATS.items()):
        print(f"  {variant}: {n} comparaciones con salida {kind} del baseline")
    print(f"{len(diffs)} diferencias en {len(models)} modelos")
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
