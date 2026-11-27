"""X28: baterías del prototipo HB (python3). Salida: $X28_OUT/x28_summary.json y tablas por consola.

Secciones: A fijo 5 métodos (4 modelos) · B convergencia (tol, w, pasadas, ciclos, arranque) · C reglas σ'n<=0 (SB) ·
D agua (SB con línea que cruza la superficie; ru) · E identidades y monotonía · F costo · G vecinos de búsqueda.
"""
from __future__ import annotations
import json, math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models, hb, hbsolve, equilibrium, mpclosest, engine, solvers, proto_hb as P

OUT = os.environ.get("X28_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3b-x28"))
M5 = hbsolve.METHODS
WT_HI = [[-40.0, 16.0], [70.0, 16.0]]          # línea a 16 m: cruza la base de las dovelas de SB (X28 §5)
S = {}                                          # resumen


def setup_doc(doc, slices=40):
    ed = models.engine_doc(doc)
    eng, _ = hbsolve.engine_slices(ed)
    sl = hbsolve.prepare(eng)
    mat = doc["materials"][0]
    p = hb.params(mat["ucs"], mat["gsi"], mat["mi"], mat["disturbance"])
    return sl, p, float(mat["unit_weight"])


def cyc(hist):
    Fs = [h["F"] for h in hist]
    for k in range(2, len(Fs)):
        for j in range(k - 1):
            if abs(Fs[k] - Fs[j]) < 1e-9 * max(1.0, abs(Fs[k])):
                return True
    return False


def oracle_direct(tag, method):
    d = json.load(open(os.path.join(OUT, f"oracle_direct_{tag}.json")))["results"]
    return d[method]["fos"]


# ---------------- A: fijo 5 métodos -----------------------------------------------------
def secA():
    rows = {}
    for key in ["X25", "HAM1", "SA", "SB"]:
        circ = P.circle_of(key)
        doc = models.ogs_doc(key, circle=circ)
        sl, p, g = setup_doc(doc)
        t0 = time.perf_counter()
        res = hbsolve.solve_all(sl, g, p, rule="cslope", tol=1e-4, max_pass=30, w=0.5)
        dt = time.perf_counter() - t0
        orc = json.load(open(os.path.join(OUT, f"oracle_direct_{key}.json")))["results"]
        row = {}
        for m in M5:
            F = res[m]["F"]
            row[m] = {"proto": F, "oracle": orc[m]["fos"], "dif_pct": (F - orc[m]["fos"]) / orc[m]["fos"] * 100,
                      "status": res[m]["status"], "passes": res[m]["passes"], "lam": res[m]["lam"],
                      "n_slices_engine": len(sl), "n_slices_oracle": orc[m]["n_slices"]}
        row["t_s"] = dt
        rows[key] = row
        print(key, " ".join(f"{m[:6]}:{row[m]['dif_pct']:+.3f}%/{row[m]['passes']}p" for m in M5), f"n={len(sl)}/{orc['bishop']['n_slices']}")
    S["A_fijo"] = rows
    return rows


# ---------------- B: convergencia -------------------------------------------------------
def secB():
    out = {}
    for key in ["X25", "SB"]:
        circ = P.circle_of(key)
        doc = models.ogs_doc(key, circle=circ)
        sl, p, g = setup_doc(doc)
        for w in [0.5, 1.0, 0.3]:
            for tol in [1e-4, 1e-6, 1e-8]:
                r = hbsolve.solve_all(sl, g, p, rule="cslope", tol=tol, max_pass=300, w=w,
                                      methods=["bishop", "janbu_simplified"], keep_hist=True)
                rec = {m: {"F": r[m]["F"], "status": r[m]["status"], "passes": r[m]["passes"],
                           "cycle": cyc(r[m]["hist"])} for m in r}
                out[f"{key}|w{w}|tol{tol:g}"] = rec
                print(key, f"w={w} tol={tol:g}", {m: (round(v["F"], 6), v["status"][:4], v["passes"], "CYC" if v["cycle"] else "") for m, v in rec.items()})
        # arranque: σ'n0 = 0 (sin estimación del overburden)
        r0 = hbsolve.solve_all(sl, g, p, rule="cslope", tol=1e-8, max_pass=300, w=0.5, methods=["bishop", "janbu_simplified"], init="sn0_zero")
        print(key, "arranque sn=0 tol1e-8", {m: (round(r0[m]["F"], 6), r0[m]["passes"]) for m in r0})
        out[f"{key}|arranque_sn0_zero"] = {m: {"F": r0[m]["F"], "passes": r0[m]["passes"], "status": r0[m]["status"]} for m in r0}
    S["B_convergencia"] = out
    return out


# ---------------- C: reglas σ'n <= 0 (SB) ------------------------------------------------
def secC():
    out = {}
    circ = P.circle_of("SB")
    doc = models.ogs_doc("SB", circle=circ)
    sl, p, g = setup_doc(doc)
    st = hb.sigma_t(p)
    sn0 = hb.sn_zero(p)
    neg = []
    for rule in ["cslope", "c0", "cut"]:
        r = hbsolve.solve_all(sl, g, p, rule=rule, tol=1e-4, max_pass=30, w=0.5)
        out[rule] = {}
        for m in M5:
            out[rule][m] = {"F": r[m]["F"], "passes": r[m]["passes"], "status": r[m]["status"]}
            if rule == "cslope" and m == "bishop":
                neg = [(round(s["x_left"], 2), round(s["sn_last"], 3)) for s in r[m]["slices"] if s.get("sn_last", 0) < 0]
        print(rule, {m: (round(out[rule][m]["F"], 5) if out[rule][m]["F"] else None, out[rule][m]["status"][:4]) for m in M5})
    orc = json.load(open(os.path.join(OUT, "oracle_direct_SB.json")))["results"]
    out["oracle_cslope"] = {m: orc[m]["fos"] for m in M5}
    out["sigma_t"] = st
    out["sn0"] = sn0
    out["dovelas_sn_negativo_bishop_cslope"] = neg
    print("sigma_t", round(st, 3), "sn(0)", round(sn0, 3), "dovelas sn<0:", neg)
    S["C_reglas_SB"] = out
    return out


# ---------------- D: agua -------------------------------------------------------------
def secD():
    out = {}
    for tag, doc in [("SB_WT_HI", models.ogs_doc("SB", circle=P.circle_of("SB"), wt=WT_HI)),
                     ("SB_ru03", models.ogs_doc("SB", circle=P.circle_of("SB"), ru=0.3)),
                     ("X25_ru03", models.ogs_doc("X25", circle=P.circle_of("X25"), ru=0.3))]:
        sl, p, g = setup_doc(doc)
        r = hbsolve.solve_all(sl, g, p, rule="cslope", tol=1e-4, max_pass=30, w=0.5)
        out[tag] = {m: {"proto": r[m]["F"], "passes": r[m]["passes"], "status": r[m]["status"]} for m in M5}
        out[tag]["u_max_kPa"] = max(s["pore_pressure"] for s in sl)
        out[tag]["n_pore_pos"] = sum(1 for s in sl if s["pore_pressure"] > 0)
        out[tag]["n_ponded"] = sum(1 for s in sl if abs(s.get("V", 0.0)) > 1e-9)
        print(tag, {m: round(r[m]["F"], 5) if r[m]["F"] else None for m in M5}, "u_max", round(out[tag]["u_max_kPa"], 2), "n_u>0", out[tag]["n_pore_pos"], "n_V!=0", out[tag]["n_ponded"])
    # oráculo con la misma línea (to_cslope) y ru
    S["D_agua"] = out
    return out


if __name__ == "__main__":
    sec = sys.argv[1:] or ["A", "B", "C", "D"]
    for s in sec:
        globals()["sec" + s]()
    models.dump(S, os.path.join(OUT, "x28_summary_" + "".join(sec) + ".json"))
    print("ok")
