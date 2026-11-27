"""X28: prototipo HB sobre las dovelas del motor, en círculo fijo, cinco métodos. Solo python3 (sin oráculo).

Uso: python3 proto_hb.py KEY [--rule cslope|c0|cut] [--tol 1e-4] [--w 0.5] [--max-pass 30] [--wt 0|1] [--ru X] [--tag T]
Círculo: circles_direct.json (búsqueda del oráculo, X28 §8). Salida: $X28_OUT/proto_<tag>.json.
"""
from __future__ import annotations
import argparse, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models, hb, hbsolve

OUT = os.environ.get("X28_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3b-x28"))
os.makedirs(OUT, exist_ok=True)


def circle_of(key):
    d = json.load(open(os.path.join(OUT, "circles_direct.json")))[key]
    return [d["cx"], d["cy"], d["r"]]


def run(key, rule="cslope", tol=1e-4, w=0.5, max_pass=30, wt=False, ru=None, circle=None, slices=40,
        methods=hbsolve.METHODS, keep_hist=True, init=None):
    circle = circle or circle_of(key)
    doc = models.ogs_doc(key, circle=circle, ru=ru, wt=(models.MODELS[key].get("wt") if wt else None), slices=slices)
    ed = models.engine_doc(doc)
    t0 = time.perf_counter()
    eng, eng_fos = hbsolve.engine_slices(ed)
    t_eng = time.perf_counter() - t0
    sl = hbsolve.prepare(eng)
    mat = doc["materials"][0]
    p = hb.params(mat["ucs"], mat["gsi"], mat["mi"], mat["disturbance"])
    gamma = float(mat["unit_weight"])
    t0 = time.perf_counter()
    res = hbsolve.solve_all(sl, gamma, p, rule=rule, tol=tol, max_pass=max_pass, w=w, methods=methods,
                            keep_hist=keep_hist, init=init)
    t_hb = time.perf_counter() - t0
    out = {"key": key, "circle": circle, "rule": rule, "tol": tol, "w": w, "max_pass": max_pass, "wt": wt, "ru": ru,
           "n_slices": len(sl), "engine_fos_mc_placeholder": eng_fos, "t_engine_s": t_eng, "t_hb_s": t_hb,
           "params": p, "gamma": gamma, "methods": {}}
    for m, r in res.items():
        out["methods"][m] = {"F": r["F"], "status": r["status"], "passes": r["passes"], "analyses": r["analyses"],
                             "lam": r["lam"], "hist": r["hist"]}
        r_slices = r["slices"]
        out["methods"][m]["c_final"] = [s["cohesion"] for s in r_slices]
        out["methods"][m]["tan_final"] = [s["tan_phi"] for s in r_slices]
        out["methods"][m]["sn_last"] = [s.get("sn_last") for s in r_slices]
        out["methods"][m]["sn0"] = [s["sn0"] for s in r_slices]
    out["_res"] = res   # no se serializa
    return out


def serial(o):
    o = dict(o)
    o.pop("_res", None)
    return o


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--rule", default="cslope")
    ap.add_argument("--tol", type=float, default=1e-4)
    ap.add_argument("--w", type=float, default=0.5)
    ap.add_argument("--max-pass", type=int, default=30)
    ap.add_argument("--wt", type=int, default=0)
    ap.add_argument("--ru", type=float, default=None)
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    o = run(a.key, rule=a.rule, tol=a.tol, w=a.w, max_pass=a.max_pass, wt=bool(a.wt), ru=a.ru)
    tag = a.tag or f"{a.key}_{a.rule}_t{a.tol:g}_w{a.w:g}_p{a.max_pass}" + ("_wt" if a.wt else "") + (f"_ru{a.ru:g}" if a.ru is not None else "")
    for m, r in o["methods"].items():
        print(f"{a.key} {m:20s} F={r['F']:.6f} {r['status']} pasadas={r['passes']} analisis={r['analyses']} lam={r['lam']}")
    print("t_engine", round(o["t_engine_s"], 4), "t_hb", round(o["t_hb_s"], 4))
    models.dump(serial(o), os.path.join(OUT, f"proto_{tag}.json"))
