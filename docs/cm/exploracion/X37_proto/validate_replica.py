"""Validación de la réplica (X37 brief, paso 1): nc.py + global.refine frente al motor 0.5.1 en V001-nc y V034a-nc."""
import importlib.util
import json
import os
import sys
import time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import opengeoslide as og  # noqa: E402
import models as M  # noqa: E402
import nc as X  # noqa: E402

spec = importlib.util.spec_from_file_location("x37global", os.path.join(HERE, "global.py"))
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)


def engine(model):
    t = time.time()
    r = og.analyze(model)
    return r, time.time() - t


def run_one(entry_id, want_entry=None):
    ent = [e for e in M.all_entries(with_sweep=False) if e["id"] == entry_id][0]
    m = M.with_nc(ent["model"], nc=False)
    site = G.site_of(m)
    wl, wr, ltr = G.sliding_windows(m, site)
    mrf = m["analysis"]["search"]["max_radius_factor"]
    r_circ, t_circ = engine(M.with_nc(ent["model"], nc=False))
    r_nc, t_nc = engine(M.with_nc(ent["model"], nc=True))
    eng = X.Eng(M.with_nc(ent["model"], nc=False), X.METHOD_SP)
    t0 = time.time()
    n0 = eng.calls
    grid = X.grid_circles(site, eng, [wl, wr], 20, 20, 20, mrf)
    seeds = X.pick_seeds(grid, [wl, wr])
    t_grid = time.time() - t0
    best = None
    for s in seeds:
        P = X.circle_to_polyline(site, s)
        res = G.refine(eng, site, [wl, wr], P)
        if best is None or (res["F"] is not None and res["F"] < best["F"]):
            best = res
    out = dict(
        id=entry_id, ltr=ltr, win_left=wl, win_right=wr,
        engine_circ=r_circ["results"][0]["fos"], engine_nc=r_nc["results"][0]["fos"],
        engine_nc_stats=r_nc.get("search", {}).get("non_circular") if isinstance(r_nc.get("search"), dict) else None,
        engine_nc_warnings=r_nc["results"][0].get("warnings"),
        proto_seeds=[dict(xe=s["xe"], xs=s["xs"], fos=s["fos"]) for s in seeds],
        proto_refine_F=best["F"], proto_refine_seed_stages=best["stages"],
        grid_evals=eng.calls - n0, grid_seconds=round(t_grid, 3),
        engine_nc_seconds=round(t_nc, 3), engine_circ_seconds=round(t_circ, 3),
        proto_refine_used=best["nc"].used, proto_refine_rej=best["nc"].rej_adm,
        circ_engine_surface=r_circ["results"][0].get("surface"),
    )
    return out


if __name__ == "__main__":
    res = [run_one(i) for i in sys.argv[1:]]
    print(json.dumps(res, indent=1, default=str))
