#!/usr/bin/env python3
"""A9, lado del prototipo: el mejor candidato de `X37_proto/global.py` antes de refinar, con el wheel 0.5.1 como evaluador.

Se corre con el Python del entorno del wheel (`$TMPDIR/cm-x37/venv`). Salida: una línea JSON por modelo y generador.

- `annealing`: `gen_sa` tal cual, con la semilla del argumento y N candidatos, sin la guarda de F7.4 y contando como
  candidato solo a los que el motor resuelve.
- `annealing_aligned`: el mismo bucle con las dos reglas del contrato: un candidato que la guarda rechaza (o que no
  converge) cuenta como generado y adelanta el enfriamiento, y la guarda de F7.4 (`negative_lambda`,
  `negative_effective_normal_major`) lo deja fuera. Es la explicación de las diferencias de `annealing` con Rust.
- `block`: `gen_block` del prototipo (ángulos U(90°, 135°) y U(45°, 90°), F7.3.2 original). El bloque cambió en E17c y
  no tiene prototipo: esta cifra solo se informa.

El punto de partida del recocido es la polilínea que eligió Rust (`--starts`, un JSON {id: polilínea|null}); sin él,
el círculo crítico del motor. Así la comparación aísla el generador de la elección de la semilla.

Uso: a9_proto.py ID[,ID...]|all [--seed 0] [--generated 500] [--starts starts.json]
"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROTO = HERE.parents[1] / "docs/cm/exploracion/X37_proto"
sys.dont_write_bytecode = True
sys.path.insert(0, str(PROTO))
sys.path.insert(0, str(HERE))
import entries as E  # noqa: E402
import nc as X  # noqa: E402
import opengeoslide as og  # noqa: E402

spec = importlib.util.spec_from_file_location("x37global", PROTO / "global.py")
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)

TENSION = {"negative_lambda", "negative_effective_normal_major"}


class Guarded(X.Eng):
    """El evaluador con la guarda de tracción de F7.4."""

    def fos(self, surface):
        f, r = super().fos(surface)
        if f is not None and TENSION & set(r.get("warnings") or []):
            self.rejected = getattr(self, "rejected", 0) + 1
            return None, r
        return f, r


def gen_sa_aligned(eng, site, wl, wr, P0, F0, rng, N, H):
    """`gen_sa` con las reglas del contrato (el mismo recocido de `global.rs`): `generated` cuenta los admisibles evaluados."""
    T0, Tfin = 0.02, 5e-4
    cur, Fcur = [list(map(float, p)) for p in P0], F0
    cands, att, generated = [], 0, 0
    while generated < N and att < 20 * N:
        att += 1
        k = generated
        Tk = T0 * (Tfin / T0) ** (k / max(N - 1, 1))
        sig = max(0.2 * H * (Tk / T0), 0.005 * H)
        i = 1 + rng.below(7)
        u = rng.unif(-1.0, 1.0)
        Q = [list(p) for p in cur]
        Q[i][1] = cur[i][1] + sig * u
        if not G.admissible(site, Q):
            continue
        generated += 1
        f, _ = eng.fos({"type": "polyline", "points": Q})
        if f is None:
            continue
        cands.append((f, k, Q))
        dF = f - Fcur
        if dF <= 0 or rng.unif(0.0, 1.0) < math.exp(-dF / Tk):
            cur, Fcur = Q, f
    return cands, dict(attempts=att, generated=generated)


def best_of(cands):
    return min(((f, k) for f, k, _ in cands), default=None)


def run(entry, seed, n, starts):
    m = E.variant(entry["model"], "circular")
    site = G.site_of(m)
    wl, wr, _ = G.sliding_windows(m, site)
    height = G.model_height(site)
    plain, guarded = X.Eng(m, X.METHOD_SP), Guarded(m, X.METHOD_SP)
    out = []
    if starts is not None:
        start = starts.get(entry["id"])
    else:
        surface = og.analyze(m)["results"][0]["surface"]
        start = G.circle_polyline9(site, surface) if surface and "xc" in surface else None
    for kind, eng, gen in (("annealing", plain, G.gen_sa), ("annealing_aligned", guarded, gen_sa_aligned)):
        f0 = eng.fos({"type": "polyline", "points": start})[0] if start else None
        if f0 is None:
            out.append(dict(id=entry["id"], kind=kind, n=0, best=None, index=None, start_fos=None))
            continue
        cands, st = gen(eng, site, wl, wr, start, f0, G.SplitMix64(seed), n, height)
        best = best_of(cands)
        out.append(dict(id=entry["id"], kind=kind, n=len(cands), best=best[0] if best else None,
                        index=best[1] if best else None, start_fos=f0, stats=st,
                        rejected=getattr(eng, "rejected", 0)))
    layers, info = G.contact_layers(m, site)
    if info["rule"] == "contacto":
        geo, st = G.gen_block(site, layers, wl, wr, G.SplitMix64(seed), n, height)
        fs = [(plain.fos({"type": "polyline", "points": p})[0], i) for i, p in enumerate(geo)]
        best = min((x for x in fs if x[0] is not None), default=None)
        out.append(dict(id=entry["id"], kind="block", n=sum(x[0] is not None for x in fs),
                        best=best[0] if best else None, index=best[1] if best else None, stats=st))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--generated", type=int, default=500)
    ap.add_argument("--starts", type=Path)
    a = ap.parse_args()
    wanted = a.ids.split(",") if a.ids != "all" else None
    starts = json.loads(a.starts.read_text()) if a.starts else None
    for e in E.entries():
        if wanted is None or e["id"] in wanted:
            for row in run(e, a.seed, a.generated, starts):
                print(json.dumps(row), flush=True)


if __name__ == "__main__":
    main()
