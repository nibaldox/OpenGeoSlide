#!/usr/bin/env python3
"""X29: pipeline de búsqueda no circular sobre el motor (wheel 0.4.0) y filas de aceptación.

Uso (Python del evaluador):
    env -u PYTHONPATH -u PYTHONHOME $TMPDIR/f3b-x29/venv/bin/python run_x29.py V001 V034a V036a
Lee los modelos de verification/cases/<caso>.json y los resultados del oráculo de
$TMPDIR/f3b-x29/oracle/ (oracle_x29.py). Escribe:
- $TMPDIR/f3b-x29/proto/<caso>__k<k>__<metodo>.json  (salida completa del prototipo y de sus variantes);
- docs/fase3/exploracion/X29_filas/<caso>-k<k>.json  (filas de aceptación, formato v0.6 provisional);
- docs/fase3/exploracion/X29_filas/resultados.json   (tabla con todas las filas).
"""
import copy
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
from pathlib import Path
REPO = str(Path(__file__).resolve().parents[4])
TMP = os.environ["TMPDIR"]
sys.path.insert(0, HERE)
import nc  # noqa: E402
import opengeoslide as og  # noqa: E402

ORC = os.path.join(TMP, "f3b-x29/oracle")
PRO = os.path.join(TMP, "f3b-x29/proto")
FIL = os.path.join(REPO, "docs/fase3/exploracion/X29_filas")
os.makedirs(PRO, exist_ok=True)
os.makedirs(FIL, exist_ok=True)

METHODS = {"MP": nc.METHOD_MP, "SP": nc.METHOD_SP}
CASE_CACHE = {}


def load_case(cid):
    """Caso del repo. Si es v0.1/v0.2 se eleva a 0.3: el motor exige 0.3 para morgenstern_price e
    interslice (`analysis.methods = \"morgenstern_price\" requiere version \"0.3\"`). Sin campos nuevos, la
    versión no cambia ningún número (identidad de v0.3; nota en la fila)."""
    if cid not in CASE_CACHE:
        c = json.load(open(f"{REPO}/verification/cases/{cid}.json"))
        c["version_original"] = c["model"]["version"]
        if c["model"]["version"] in ("0.1", "0.2"):
            c["model"]["version"] = "0.3"
        CASE_CACHE[cid] = c
    return CASE_CACHE[cid]


def engine_circular(case_model, method):
    """Búsqueda circular del motor (la que hoy devuelve solo el mejor círculo)."""
    m = copy.deepcopy(case_model)
    m["analysis"]["methods"] = [method]
    if method == nc.METHOD_MP:
        m["analysis"]["interslice"] = {"function": "constant"}
    else:
        m["analysis"].pop("interslice", None)
    t0 = time.perf_counter()
    r = og.analyze(m)["results"][0]
    dt = time.perf_counter() - t0
    return dict(fos=r.get("fos"), status=r.get("status"), surface=r.get("surface"), search=r.get("search"),
                warnings=r.get("warnings"), seconds=dt)


def pipeline(case_model, method_key, budget=nc.BUDGET, polish=False):
    """Semillas (malla de círculos fijos) + variación alterna en cada semilla. Devuelve un dict serializable."""
    method = METHODS[method_key]
    site = nc.Site(case_model)
    win = nc.window(case_model, site)
    s = case_model["analysis"]["search"]
    eng = nc.Eng(case_model, method)
    t0 = time.perf_counter()
    rows = nc.grid_circles(site, eng, win, s["n_entry"], s["n_exit"], s["n_radius"], s["max_radius_factor"])
    t_grid = time.perf_counter() - t0
    n_grid_valid = sum(1 for r in rows if r["fos"] is not None)
    seeds = nc.pick_seeds(rows, win)
    seed_out = []
    t1 = time.perf_counter()
    for idx, sd in enumerate(seeds):
        P = nc.circle_to_polyline(site, sd)
        ncs = nc.NC(site, eng, win, budget)
        res = ncs.run(P, polish=polish)
        seed_out.append(dict(
            idx=idx, circle=dict(xc=sd["xc"], yc=sd["yc"], r=sd["r"], xe=sd["xe"], xs=sd["xs"], fos=sd["fos"]),
            fos_seed_poly=res.get("fos0"), fos=res["fos"], used=res["used"], rej_adm=res.get("rej_adm"),
            rej_eng=res.get("rej_eng"), stages=res.get("stages"), polish=res.get("polish"),
            points=res["points"]))
    t_nc = time.perf_counter() - t1
    ok = [x for x in seed_out if x["fos"] is not None]
    best = min(ok, key=lambda x: (x["fos"], x["idx"])) if ok else None
    return dict(method=method_key, budget=budget, polish=polish, grid=dict(
        n=[s["n_entry"], s["n_exit"], s["n_radius"]], mrf=s["max_radius_factor"], rows=len(rows),
        valid=n_grid_valid, evals=eng.calls, errors=eng.errors, seconds=t_grid),
        window=win, seeds=seed_out, best_idx=None if best is None else best["idx"],
        fos=None if best is None else best["fos"], points=None if best is None else best["points"],
        evals_nc=sum(x["used"] for x in seed_out), seconds_nc=t_nc, seconds_total=t_grid + t_nc,
        _eng_calls=eng.calls, _site_W=site.W)


def strip(p):
    """Quita campos internos y tiempos (los tiempos no son deterministas): compara resultados, no cronómetros."""
    def clean(x):
        if isinstance(x, dict):
            return {k: clean(v) for k, v in x.items() if not k.startswith("_") and not k.startswith("seconds")}
        if isinstance(x, list):
            return [clean(v) for v in x]
        return x
    return clean(p)


def oracle_seeds(allc, win):
    """Semillas de cSlope: mismo criterio (FS, luego índice; 5 % del span) sobre allSurfaces."""
    span = nc.span_of(win)
    lst = sorted(range(len(allc)), key=lambda i: (allc[i][0], i))
    seeds = []
    for i in lst:
        if len(seeds) >= nc.SEEDS:
            break
        fos, e, x2, r, cx, cy = allc[i]
        xe, xs = min(e, x2), max(e, x2)  # cSlope nombra entrada y salida por su orden, no por x
        if all(abs(s[1] - xe) > nc.SEED_SPAN_REL * span or abs(s[2] - xs) > nc.SEED_SPAN_REL * span for s in seeds):
            seeds.append([fos, xe, xs, r, cx, cy])
    return seeds


def eval_polyline(case_model, points, method_key):
    """Polilínea de cSlope al motor. cSlope puede listarla de salida a entrada (x decreciente, V001 y V036a):
    el motor exige x estrictamente creciente (InvalidModel), así que se invierte el orden; la geometría no cambia."""
    pts = [list(p) for p in points]
    if pts[0][0] > pts[-1][0]:
        pts = pts[::-1]
    eng = nc.Eng(case_model, METHODS[method_key])
    f, r = eng.fos({"type": "polyline", "points": pts})
    return f, r.get("status"), r.get("warnings")


def admissible_report(case_model, points):
    site = nc.Site(case_model)
    win = nc.window(case_model, site)
    ncs = nc.NC(site, nc.Eng(case_model, nc.METHOD_MP), win, 0)
    return ncs.admissible([list(p) for p in points])


def variant_runs(case_model, cid):
    """Parámetros: qué cambia el resultado (X29 §4)."""
    out = {}
    saved = dict(ROUNDS=nc.ROUNDS, DELTA_REL=nc.DELTA_REL, STAGES=nc.STAGES, CONCAVITY_DEG=nc.CONCAVITY_DEG)
    variants = {
        "base": {},
        "presupuesto_3000": dict(budget=3000),
        "sin_33_(9_17)": dict(stages=(9, 17)),
        "rondas_3": dict(ROUNDS=3),
        "delta0_0.05": dict(DELTA_REL=0.05),
        "sin_concavidad": dict(CONCAVITY_DEG=180.0),
        "pulido_4x3000": dict(polish=True),
        "spencer": dict(method="SP"),
    }
    for name, v in variants.items():
        try:
            nc.ROUNDS = v.get("ROUNDS", saved["ROUNDS"])
            nc.DELTA_REL = v.get("DELTA_REL", saved["DELTA_REL"])
            nc.STAGES = v.get("stages", saved["STAGES"])
            nc.CONCAVITY_DEG = v.get("CONCAVITY_DEG", saved["CONCAVITY_DEG"])
            p = pipeline(case_model, v.get("method", "MP"), budget=v.get("budget", nc.BUDGET),
                         polish=v.get("polish", False))
            out[name] = dict(fos=p["fos"], evals_nc=p["evals_nc"], vertices=len(p["points"]) if p["points"] else None,
                             seconds=p["seconds_total"], best_idx=p["best_idx"])
        finally:
            nc.ROUNDS, nc.DELTA_REL = saved["ROUNDS"], saved["DELTA_REL"]
            nc.STAGES, nc.CONCAVITY_DEG = saved["STAGES"], saved["CONCAVITY_DEG"]
    return out


def process(cid, oracle_path, k, variants=False):
    case = load_case(cid)
    model = case["model"]
    orc = json.load(open(oracle_path))
    if orc["metodo"] != "Morgenstern-Price" or orc["opciones"].get("intersliceFunction", "constant") != "constant":
        return None
    ec = engine_circular(model, nc.METHOD_MP)
    p1 = pipeline(model, "MP")
    p2 = pipeline(model, "MP")  # determinismo
    det = json.dumps(strip(p1), sort_keys=True) == json.dumps(strip(p2), sort_keys=True)
    sp = pipeline(model, "SP")
    # polilínea final de cSlope pasada al motor como superficie fija (error del evaluador)
    cs_pts = orc["nc_points"]
    f_cs_mp, st_mp, w_mp = eval_polyline(model, cs_pts, "MP")
    f_cs_sp, st_sp, w_sp = eval_polyline(model, cs_pts, "SP")
    site = nc.Site(model)
    win = nc.window(model, site)
    seeds_or = oracle_seeds(orc["allSurfaces_circ"], win)
    seeds_ogs = [[x["circle"]["fos"], x["circle"]["xe"], x["circle"]["xs"], x["circle"]["r"]] for x in p1["seeds"]]
    rec = dict(caso=cid, k=k, metodo_check=orc["metodo"], publicado=orc["publicado"],
               publicado_por=orc["publicado_por"], tolerancia=orc["tolerancia"], oraculo=dict(
                   fos_nc=orc["fos_nc"], fos_c=orc["fos_c"], vertices=orc["nc_vertices"], nc_points=cs_pts,
                   c_circle=orc["c_circle"], seeds_top3=seeds_or, ms_nc=orc["ms_nc"], ms_c=orc["ms_c"],
                   warnings_nc=orc["warnings_nc"], opciones=orc["opciones"], variante=orc["variante"]),
               motor=dict(fos_circular=ec["fos"], status_circular=ec["status"], circ_surface=ec["surface"],
                          circ_search=ec["search"], circ_seconds=ec["seconds"]),
               proto=dict(mp=p1, mp_determinismo_identico=det, spencer=sp),
               evaluador_sobre_cslope=dict(fos_mp=f_cs_mp, status_mp=st_mp, warnings_mp=w_mp,
                                           fos_sp=f_cs_sp, status_sp=st_sp, warnings_sp=w_sp),
               semillas=dict(oraculo=seeds_or, ogs=seeds_ogs),
               admisible_final_ogs=admissible_report(model, p1["points"]) if p1["points"] else None)
    if variants:
        rec["variantes"] = variant_runs(model, cid)
    path = os.path.join(PRO, f"{cid}__k{k}__mp.json")
    json.dump(rec, open(path, "w"), indent=1)
    return rec


def model_v06(case_model, method_key):
    m = copy.deepcopy(case_model)
    m["version"] = "0.6"
    a = m["analysis"]
    s = dict(a.get("search") or {})
    s["non_circular"] = {"seeds": 3, "max_vertices": 33}
    a["search"] = s
    a["methods"] = [METHODS[method_key]]
    if method_key == "MP":
        a["interslice"] = {"function": "constant"}
    else:
        a.pop("interslice", None)
    return m


if __name__ == "__main__":
    import glob
    cids = sys.argv[1:]
    table = []
    for cid in cids:
        for oracle_path in sorted(glob.glob(os.path.join(ORC, f"{cid}__k*__completo.json"))):
            k = int(os.path.basename(oracle_path).split("__k")[1].split("__")[0])
            rec = process(cid, oracle_path, k, variants=cid in ("V001", "V034a", "V036a"))
            if rec is None:
                print(cid, "k", k, "omitido (no MP constante)")
                continue
            o = rec["oraculo"]
            pr = rec["proto"]["mp"]
            print(cid, "k", k, "FS_cSlope_NC=%.6f" % o["fos_nc"], "FS_ogs_NC=%s" % (
                None if pr["fos"] is None else "%.6f" % pr["fos"]),
                "FS_motor_circ=%.6f" % rec["motor"]["fos_circular"], "FS_cSlope_circ=%.6f" % o["fos_c"],
                "det", rec["proto"]["mp_determinismo_identico"], "evals", pr["evals_nc"],
                "t", round(pr["seconds_total"], 2), "vert", len(pr["points"]) if pr["points"] else None)
            table.append(rec)
    json.dump(table, open(os.path.join(PRO, "tabla_" + "_".join(cids) + ".json"), "w"), indent=1)
