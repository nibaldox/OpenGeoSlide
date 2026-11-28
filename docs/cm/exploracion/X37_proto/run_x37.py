"""X37: corrida completa por modelo (motor 0.5.1 como evaluador, cSlope como oracle).

Uso: python run_x37.py <outdir> [--workers N] [--only ID,ID] [--no-sweep]
Escribe <outdir>/<id>.json por modelo (incremental) y <outdir>/_run.json con el resumen de la corrida.
Determinismo: PRNG SplitMix64 de semilla 37 por configuración, serie, desempates (FS, índice).
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import sys
import time
import traceback
from multiprocessing import Pool

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", ".."))
HARN = os.path.join(REPO, "verification", "harness")

import opengeoslide as og  # noqa: E402
import models as M  # noqa: E402
import nc as X  # noqa: E402

_spec = importlib.util.spec_from_file_location("x37global", os.path.join(HERE, "global.py"))
G = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(G)

SEED = 37
NS = (500, 2000, 5000)
GENS = ("G1", "G2", "G3")


def _cs():
    sys.path.insert(0, HARN)
    import to_cslope as T  # noqa: E402
    import cslope as cs  # noqa: E402
    return T, cs


def cs_run(T, cs, model, check):
    try:
        conv = T.ogs_to_cslope(model, check)
        r = cs.analyse(conv.document)
        cr = r.get("criticalSurface") or {}
        fos = r.get("minFOS", cr.get("fos"))
        pts = cr.get("points")
        return dict(fos=float(fos), error=None, points=[list(map(float, p)) for p in pts] if pts else None)
    except Exception as exc:  # noqa: BLE001
        return dict(fos=None, error=f"{type(exc).__name__}: {str(exc)[:160]}", points=None)


def engine_run(model):
    t = time.time()
    try:
        r = og.analyze(model)
        res = r["results"][0]
        return dict(fos=res.get("fos"), status=res.get("status"), warnings=res.get("warnings", []),
                    surface=res.get("surface"), search=r.get("search") or res.get("search"), seconds=time.time() - t, error=None)
    except Exception as exc:  # noqa: BLE001
        return dict(fos=None, status="error", warnings=[], surface=None, search=None, seconds=time.time() - t,
                    error=f"{type(exc).__name__}: {str(exc)[:200]}")


def fixed_polyline_engine(model_nc_base, P):
    m = dict(model_nc_base)
    a = dict(m["analysis"])
    a.pop("search", None)
    a["surface"] = {"type": "polyline", "points": [[float(x), float(y)] for x, y in P]}
    m["analysis"] = a
    return engine_run(m)


def run_model(entry: dict, outdir: str):
    T, cs = _cs()
    mid = entry["id"]
    rec = dict(id=mid, group=entry["group"], src=entry.get("src"), errors=[])
    m_circ = M.with_nc(entry["model"], nc=False)
    m_nc = M.with_nc(entry["model"], nc=True)
    site = G.site_of(m_circ)
    wl, wr, ltr = G.sliding_windows(m_circ, site)
    H = G.model_height(site)
    mrf = float(m_circ["analysis"]["search"].get("max_radius_factor", 5.0))
    rec.update(H=H, win_left=wl, win_right=wr, ltr=ltr, n_regions=len(m_circ["regions"]),
               n_materials=len(m_circ["materials"]), W=site.W)

    # ---- motor: circular y refinamiento actual (nativo)
    ec = engine_run(m_circ)
    en = engine_run(m_nc)
    rec["engine"] = dict(circ_fos=ec["fos"], circ_surface=ec["surface"], circ_evaluated=(ec["search"] or {}).get("evaluated"),
                         circ_seconds=ec["seconds"], circ_error=ec["error"],
                         nc_fos=en["fos"], nc_status=en["status"], nc_warnings=en["warnings"],
                         nc_search=(en["search"] or {}).get("non_circular") if isinstance(en["search"], dict) else None,
                         nc_seconds=en["seconds"], nc_error=en["error"])
    if ec["fos"] is None or en["fos"] is None:
        rec["errors"].append(f"engine: {ec['error']} / {en['error']}")
        _dump(rec, outdir, mid)
        return rec

    # ---- cSlope (oráculo): nco y circular, con el primer check de búsqueda (spencer) o uno sintético
    chk = next((c for c in entry.get("checks", []) if c.get("method") == "spencer" and c.get("kind") == "search"),
               dict(method="spencer", kind="search", options={"slices": 50}))
    rec["cslope"] = dict(nco=cs_run(T, cs, m_nc, chk), circ=cs_run(T, cs, m_circ, chk))

    # ---- prototipo: evaluador Spencer, refinamiento actual replicado y pulido
    eng = X.Eng(m_circ, X.METHOD_SP)
    t0 = time.time()
    e0 = eng.calls
    grid = X.grid_circles(site, eng, [wl, wr], 20, 20, 20, mrf)
    picks = X.pick_seeds(grid, [wl, wr])
    grid_cost = dict(evals=eng.calls - e0, seconds=time.time() - t0)
    circ_surface = ec["surface"]
    P_eng = G.circle_polyline9(site, circ_surface) if circ_surface and "xc" in circ_surface else None
    seeds_c = []
    if P_eng is not None:
        seeds_c.append(("engine_circle", P_eng))
    for p in picks:
        if len(seeds_c) >= 3:
            break
        Pp = G.circle_polyline9(site, p)
        if Pp is not None:
            seeds_c.append(("grid_pick", Pp))
    # refinamiento actual replicado (sin generador): semillas circulares, 9->17->33, luego pulido
    t0 = time.time()
    e1 = eng.calls
    circ_res = []
    for name, P in seeds_c:
        r = G.refine(eng, site, [wl, wr], P)
        circ_res.append(dict(seed=name, F=r["F"], P=r["P"], gain=r["gain"], nc=r["nc"], stages=r["stages"]))
    circ_refine_cost = dict(evals=eng.calls - e1, seconds=time.time() - t0)
    ok = [c for c in circ_res if c["F"] is not None]
    rec["errors"] += [] if ok else ["circ seeds not evaluable"]
    if ok:
        circ_best = min(ok, key=lambda c: c["F"])
        t0 = time.time()
        e2 = eng.calls
        circ_pol = G.polish(circ_best, site)
        circ_polish_cost = dict(evals=eng.calls - e2, seconds=time.time() - t0)
    else:
        circ_best = None
        circ_pol = None
        circ_polish_cost = dict(evals=0, seconds=0.0)
    rec["proto_current"] = dict(
        seeds=[dict(seed=c["seed"], F=c["F"], used=c["nc"].used if c["nc"] is not None else 0,
                    gain=c["gain"]) for c in circ_res],
        best_seed=circ_best["seed"] if circ_best else None,
        F_noPolish=circ_best["F"] if circ_best else None,
        F_polish=circ_pol["F"] if circ_pol else None,
        polish_cycles=circ_pol["cycles"] if circ_pol else None,
        refine_cost=circ_refine_cost, polish_cost=circ_polish_cost, grid_cost=grid_cost,
    )

    layers, linfo = G.contact_layers(m_circ, site)
    rec["layers"] = dict(info=linfo, n=len(layers))

    # ---- tuberías
    rec["pipelines"] = {}
    for gen in GENS:
        for N in NS:
            key = f"{gen}-N{N}"
            try:
                rec["pipelines"][key] = pipeline(gen, N, eng, site, wl, wr, ltr, H, layers, circ_best, circ_pol,
                                                 P_eng, en["fos"], m_nc, mid, T, cs, chk,
                                                 starts=[p for _, p in seeds_c])
            except Exception as exc:  # noqa: BLE001
                rec["errors"].append(f"{key}: {type(exc).__name__}: {exc}")
                rec["pipelines"][key] = dict(error=traceback.format_exc()[-800:])
    _dump(rec, outdir, mid)
    return rec


def pipeline(gen, N, eng, site, wl, wr, ltr, H, layers, circ_best, circ_pol, P_eng, nc_engine_fos, m_nc, mid, T, cs, chk,
             starts=()):
    rng = G.SplitMix64(SEED)
    t_all = time.time()
    e0 = eng.calls
    st0 = dict(getattr(eng, "stat", {}))
    gst = {}
    if gen == "G1":
        geo, gst = G.gen_path(site, wl, wr, ltr, rng, N, H)
        cands = _evaluate(eng, geo)
    elif gen == "G2":
        geo, gst = G.gen_block(site, layers, wl, wr, rng, N, H)
        cands = _evaluate(eng, geo)
    else:
        starts = list(starts) or ([P_eng] if P_eng is not None else [])
        P_start, F0 = None, None
        for Ps in starts:  # círculo del motor; si no es evaluable, la primera semilla circular que sí lo sea
            f0 = eng.fos({"type": "polyline", "points": Ps})[0]
            if f0 is not None:
                P_start, F0 = Ps, f0
                break
        if P_start is None:
            return dict(error="G3: ninguna polilínea circular de partida es evaluable")
        cands, gst = G.gen_sa(eng, site, wl, wr, P_start, F0, rng, N, H)
    gen_evals = eng.calls - e0
    n_valid = sum(1 for c in cands if c[0] is not None)
    seeds = G.pick_distinct([c for c in cands if c[0] is not None], [wl, wr], 3)
    t_gen = time.time() - t_all
    e1 = eng.calls
    refined = []
    for f, idx, P in seeds:
        r = G.refine(eng, site, [wl, wr], P)
        refined.append(dict(gen_idx=idx, gen_F=f, F=r["F"], P=r["P"], gain=r["gain"], nc=r["nc"]))
    ref_evals = eng.calls - e1
    gen_ok = [r for r in refined if r["F"] is not None]
    out = dict(gen=gen, N=N, candidates_generated=len(cands), candidates_evaluated=n_valid,
               gen_stats=gst, gen_evals=gen_evals, gen_seconds=round(t_gen, 3),
               n_seeds=len(seeds), seeds=[dict(gen_idx=r["gen_idx"], gen_F=r["gen_F"], refined_F=r["F"]) for r in refined],
               refine_evals=ref_evals)
    if gen_ok:
        gbest = min(gen_ok, key=lambda r: r["F"])
    else:
        gbest = None
    use_gen = gbest is not None and (circ_best is None or gbest["F"] < circ_best["F"])
    if use_gen:
        e2 = eng.calls
        pol = G.polish(gbest, site)
        B_F, B_P = pol["F"], pol["P"]
        pol_evals = eng.calls - e2
        pol_cycles = pol["cycles"]
        source = "gen"
    elif circ_pol is not None:
        B_F, B_P = circ_pol["F"], circ_pol["P"]
        pol_evals = 0
        pol_cycles = circ_pol["cycles"]
        source = "circ(cacheado)"
    else:
        return dict(error="ni semillas circulares ni generador evaluables", gen=gen, N=N, candidates_generated=len(cands),
                    candidates_evaluated=n_valid, gen_evals=gen_evals, refine_evals=ref_evals, gen_stats=gst)
    out.update(source=source, F_pre_polish=min([r["F"] for r in gen_ok] + ([circ_best["F"]] if circ_best else [])),
               F_final_pipeline=B_F, polish_evals=pol_evals, polish_cycles=pol_cycles,
               total_evals_new=eng.calls - e0, seconds=round(time.time() - t_all, 3))
    out["F_final_monotone"] = min(B_F, nc_engine_fos)
    out["monotone_ok"] = B_F <= nc_engine_fos + 1e-12
    # verificación del ganador con el motor (avisos) y cSlope como superficie fija
    fx = fixed_polyline_engine(m_nc, B_P)
    out["winner_engine_check"] = dict(fos=fx["fos"], warnings=fx["warnings"], error=fx["error"])
    Tm = T
    cs_fixed = cs_run(Tm, cs, _with_surface(m_nc, B_P), dict(chk, kind="fixed"))
    out["winner_cslope_fixed_fos"] = cs_fixed["fos"]
    out["winner_cslope_error"] = cs_fixed["error"]
    out["winner_points"] = [[round(x, 9), round(y, 9)] for x, y in B_P]
    out["winner_vertices"] = len(B_P)
    st1 = dict(getattr(eng, "stat", {}))
    out["engine_status_delta"] = {k: st1.get(k, 0) - st0.get(k, 0) for k in st1 if st1.get(k, 0) - st0.get(k, 0)}
    return out


def _with_surface(m_nc, P):
    m = dict(m_nc)
    a = dict(m["analysis"])
    a.pop("search", None)
    a["surface"] = {"type": "polyline", "points": [[float(x), float(y)] for x, y in P]}
    m["analysis"] = a
    return m


def _evaluate(eng, polys):
    out = []
    for i, Q in enumerate(polys):
        f, _ = eng.fos({"type": "polyline", "points": Q})
        out.append((f, i, Q))
    return out


def _dump(rec, outdir, mid):
    os.makedirs(outdir, exist_ok=True)
    tmp = os.path.join(outdir, mid + ".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, sort_keys=True, default=str)
    os.replace(tmp, os.path.join(outdir, mid + ".json"))


def _job(args):
    entry, outdir = args
    try:
        r = run_model(entry, outdir)
        return (entry["id"], "ok", None)
    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        return (entry["id"], "error", f"{type(exc).__name__}: {exc}\n{tb[-1200:]}")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--only", default="")
    ap.add_argument("--no-sweep", action="store_true")
    a = ap.parse_args(argv)
    entries = M.all_entries(with_sweep=not a.no_sweep)
    if a.only:
        want = set(a.only.split(","))
        entries = [e for e in entries if e["id"] in want]
    os.makedirs(a.outdir, exist_ok=True)
    t0 = time.time()
    with Pool(a.workers) as pool:
        res = pool.map(_job, [(e, a.outdir) for e in entries], chunksize=1)
    summary = dict(n=len(entries), ok=sum(1 for r in res if r[1] == "ok"),
                   errors=[dict(id=r[0], msg=r[2]) for r in res if r[1] != "ok"], seconds=round(time.time() - t0, 1))
    with open(os.path.join(a.outdir, "_run.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
