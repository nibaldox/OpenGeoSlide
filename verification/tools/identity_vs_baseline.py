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

- **Declared exceptions (E15j-8, `identity_exceptions.json`).** A difference that is *only* in the JSON fields that a
  declared exception allows for that model and variant (today V019 `[search]` and `[search@0.4]`: the counters
  `search.evaluated` and `search.valid`) is reported apart («EXCEPCIÓN V019 [search]: E15j-8») and is not counted.
  Anything else still counts: another field, another model, another variant, a different status or stderr, an output
  that is not JSON. The file is `--exceptions PATH` (default: next to this tool); each entry is
  `{modelo, variante, campos, motivo, enmienda}`, with `campos` a list of dotted JSON paths (`*` matches one segment,
  a list index is a segment: `results.*.search.evaluated`).

The models with `analysis.tension_crack` are **skipped and counted apart** too (F3G): the baseline of v0.3.0 rejects
version 0.5. Their capability is compared with the oracle (`verification/differential`, F5.5), not with the baseline.

The models with a non-empty `reinforcements` list are **skipped and counted apart** (F3R-R2): the baseline cannot read
them (v0.2.0 rejects the field), so there is nothing to compare; the identity gate is the one of the models without
reinforcements.
"""

from __future__ import annotations

import argparse
import copy
import fnmatch
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


def has_tension_crack(model: dict) -> bool:
    """`True` when the model has `analysis.tension_crack` (version 0.5: the baseline of v0.3.0 cannot read it)."""
    return (model.get("analysis") or {}).get("tension_crack") is not None


def split_cracked(models: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    """Splits `models` into the ones the v0.3.0 baseline can run and the ones with a tension crack (skipped and counted
    apart: the baseline rejects version 0.5, so there is nothing to compare)."""
    rest: dict[str, str] = {}
    cracked: dict[str, str] = {}
    for name, path in models.items():
        (cracked if has_tension_crack(_load(path)) else rest)[name] = path
    return rest, cracked


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


# ------------------------------------------------------------------ declared exceptions to the identity (E15j-8)

EXCEPTIONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "identity_exceptions.json")
_EXCEPTION_KEYS = ("modelo", "variante", "campos", "motivo", "enmienda")


def load_exceptions(path: str | None = EXCEPTIONS_FILE) -> list[dict]:
    """Reads the declared exceptions (`[]` when `path` is `None`); raises `ValueError` on a malformed entry."""
    if not path:
        return []
    with open(path, encoding="utf-8") as fh:
        entries = json.load(fh)
    if not isinstance(entries, list):
        raise ValueError(f"{path}: se esperaba una lista de excepciones")
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict) or any(k not in entry for k in _EXCEPTION_KEYS):
            raise ValueError(f"{path}: la excepción {i} debe tener {', '.join(_EXCEPTION_KEYS)}")
        if not isinstance(entry["campos"], list) or not entry["campos"] or not all(isinstance(c, str) for c in entry["campos"]):
            raise ValueError(f"{path}: la excepción {i} necesita una lista no vacía de `campos`")
    return entries


def model_key(name: str) -> str:
    """`verification/cases/V019.json` → `V019`; `.../D01.ogs.json` → `D01`."""
    return os.path.basename(name).split(".")[0]


def json_diff_paths(a, b, prefix: str = "") -> list[str]:
    """Dotted paths of the leaves where two parsed JSON values differ (`results.3.search.evaluated`). A list of another
    length, a key present on one side only, or a different type is reported at the container."""
    here = prefix or "$"
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            return [here]
        return [p for k in a for p in json_diff_paths(a[k], b[k], f"{prefix}.{k}" if prefix else str(k))]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [here]
        return [p for i, (x, y) in enumerate(zip(a, b)) for p in json_diff_paths(x, y, f"{prefix}.{i}" if prefix else str(i))]
    # `1 == 1.0` in Python, but the bytes differ: compare type and value.
    return [] if type(a) is type(b) and a == b else [here]


def classify(name: str, variant: str, a: tuple, b: tuple, exceptions: list[dict]) -> tuple[str, str, dict | None]:
    """Compares the `(status, stdout, stderr)` of the baseline (`a`) and the new binary (`b`).

    Returns `("same", "", None)`, `("exception", "<paths>", entry)` when the **only** difference is in the fields that a
    declared exception allows for this model and variant, or `("diff", "<what differs>", None)`.
    """
    if a == b:
        return "same", "", None
    what = "+".join(n for n, x, y in zip(("status", "stdout", "stderr"), a, b) if x != y)
    if what != "stdout":  # a different status or stderr is never excepted
        return "diff", what, None
    key = model_key(name)
    candidates = [e for e in exceptions if e["modelo"] == key and e["variante"] == variant]
    if not candidates:
        return "diff", what, None
    try:
        paths = json_diff_paths(json.loads(a[1]), json.loads(b[1]))
    except ValueError:
        return "diff", what, None
    for entry in candidates:
        if paths and all(any(fnmatch.fnmatchcase(p, pat) for pat in entry["campos"]) for p in paths):
            return "exception", ", ".join(paths), entry
    return "diff", f"{what}: {', '.join(paths[:5])}" + (" …" if len(paths) > 5 else ""), None


STATS: dict[tuple[str, str], int] = {}


def check(name: str, path: str, base: str, new: str, tmp: str, exceptions: list[dict] | None = None,
          excepted: list[tuple[str, str, dict, str]] | None = None) -> list[tuple[str, str, str]]:
    """Runs every variant of one model; returns `(model, variant, what differs)` for each difference.

    A difference that a declared exception covers (`classify`) is appended to `excepted` as
    `(model, variant, entry, paths)` and is not returned.
    """
    model = _load(path)
    stem = os.path.join(tmp, name.replace("/", "__"))
    diffs: list[tuple[str, str, str]] = []

    def compare(variant: str, a: tuple, b: tuple) -> None:
        key = (variant, "ok" if a[0] == 0 else "error")
        STATS[key] = STATS.get(key, 0) + 1
        verdict, detail, entry = classify(name, variant, a, b, exceptions or [])
        if verdict == "exception" and entry is not None and excepted is not None:
            excepted.append((name, variant, entry, detail))
        elif verdict != "same":
            diffs.append((name, variant, detail))

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
    ap.add_argument("--exceptions", default=EXCEPTIONS_FILE,
                    help="declared exceptions to the identity (JSON; E15j-8); '' for none")
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
    try:
        exceptions = load_exceptions(args.exceptions)
    except (OSError, ValueError) as err:
        print(f"error: excepciones de identidad: {err}", file=sys.stderr)
        return 2
    os.makedirs(args.out, exist_ok=True)
    models, skipped = split_models(model_paths(), args.include_reinforced)
    models, cracked = split_cracked(models)
    models, ponded = split_ponded(models)
    print(f"{len(models)} modelos sin agua sobre el terreno; variantes own, search, fixed, search@0.4 y fixed@0.4"
          + (" (versión del motor normalizada)" if NORMALIZE else ""))
    print(f"{len(skipped)} modelos con refuerzos saltados aparte (el binario base no los lee)")
    print(f"{len(cracked)} modelos con tension_crack saltados aparte (el binario base no lee la versión 0.5)")
    print(f"{len(ponded)} modelos con la piezométrica sobre el terreno, aparte (excepción de F5.1: agua embalsada)")
    diffs: list[tuple[str, str, str]] = []
    exception: list[tuple[str, str, str]] = []
    excepted: list[tuple[str, str, dict, str]] = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {n: pool.submit(check, n, p, args.base, args.new, args.out, exceptions, excepted)
                   for n, p in {**models, **ponded}.items()}
        for n, fut in futures.items():
            (exception if n in ponded else diffs).extend(fut.result())
    for model, variant, what in diffs:
        print(f"DIFIERE {model} [{variant}]: {what}")
    for model, variant, entry, paths in sorted(excepted, key=lambda e: (e[0], e[1])):
        print(f"EXCEPCIÓN {model_key(model)} [{variant}]: {entry['enmienda']} (solo cambian {paths}; {entry['motivo']})")
    for (variant, kind), n in sorted(STATS.items()):
        print(f"  {variant}: {n} comparaciones con salida {kind} del baseline")
    print("Modelos con agua sobre el terreno (excepción de F5.1, no cuentan como diferencia):")
    for name in sorted(ponded):
        mine = sorted({v for m, v, _ in exception if m == name})
        reinforced = " [con refuerzos]" if has_reinforcements(_load(ponded[name])) else ""
        print(f"  AGUA {name}{reinforced}: " + (f"cambia en {', '.join(mine)}" if mine else "idéntico"))
    plain_ponded = [n for n, p in sorted(ponded.items()) if not has_reinforcements(_load(p))]
    print(f"{len(plain_ponded)} modelos con agua sobre el terreno y sin refuerzos: {', '.join(plain_ponded) or '(ninguno)'}")
    print(f"{len(diffs)} diferencias en {len(models)} modelos sin agua sobre el terreno ({len(skipped)} con refuerzos y "
          f"{len(cracked)} con tension_crack, saltados; {len(ponded)} con agua sobre el terreno, aparte)")
    print(f"{len(excepted)} excepciones declaradas informadas aparte, que no cuentan "
          f"(de {len(exceptions)} entradas en {os.path.basename(args.exceptions) or 'ninguna'})")
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
