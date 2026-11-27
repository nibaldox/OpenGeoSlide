"""X28: filas de aceptación (formato v0.6 provisional), resultados.json y costo. Solo python3 + JSON del oráculo.

Escribe $X28_FILAS (= ../X28_filas) con <id>.json por fila y resultados.json; mide costo en X28_proto/costo.json.
"""
from __future__ import annotations
import copy, json, math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models, hb, hbsolve, proto_hb as P, x28_run as R

OUT = R.OUT
FILAS = os.path.join(HERE, "..", "X28_filas")
os.makedirs(FILAS, exist_ok=True)
M5 = hbsolve.METHODS
TOL_F = 0.001        # 0,1 % relativo (propuesta)
ORC_CFG = {"cslope": "cslope 0.1.0, to_cslope.ogs_to_cslope o cslope_direct (X28_proto/models.py), círculo fijo, "
                     "slices 40, tolerance 1e-5, maxIterations 1000, método Bishop/Morgenstern-Price constant/Janbu "
                     "(janbuCorrection false/true)"}


def v06(key, circle, ru=None, wt=None, extra_id=None):
    doc = models.ogs_doc(key, circle=circle, ru=ru, wt=wt, slices=40)
    doc["version"] = "0.6"
    doc["meta"] = {"id": extra_id or key, "title": models.MODELS[key]["note"]}
    doc["materials"][0] = {k: v for k, v in doc["materials"][0].items() if v is not None or k == "ru"}
    doc["materials"][0]["model"] = "hoek_brown"
    doc["materials"][0]["disturbance"] = models.MODELS[key]["hb"]["disturbance"]
    doc["analysis"]["surface"] = {"type": "circle", "xc": circle[0], "yc": circle[1], "r": circle[2]}
    return doc


def row_fixed(rid, key, desc, grp, oracle_tag, ru=None, wt=None, nota=""):
    circ = P.circle_of(key)
    doc = v06(key, circ, ru=ru, wt=wt, extra_id=rid)
    sl, p, g = R.setup_doc(doc)
    res = hbsolve.solve_all(sl, g, p, rule="cslope", tol=1e-4, max_pass=30, w=0.5)
    orc = json.load(open(os.path.join(OUT, f"oracle_{oracle_tag}.json")))
    orc = orc.get("results", orc)
    rec = {"id": rid, "descripcion": desc, "grupo": grp, "model": doc,
           "oracle": {}, "proto": {}, "tolerancia": TOL_F, "nota": nota}
    for m in M5:
        o = orc[m]["fos"] if m in orc else None
        rec["oracle"][m] = None if o is None else round(float(o), 6)
        rec["proto"][m] = None if res[m]["F"] is None else round(res[m]["F"], 6)
    rec["oracle"]["config"] = ORC_CFG["cslope"] + (" + waterTable via to_cslope" if wt else "") + (f" + ru={ru}" if ru else "")
    rec["proto_passes"] = {m: res[m]["passes"] for m in M5}
    rec["proto_status"] = {m: res[m]["status"] for m in M5}
    return rec


def write(rec):
    p = os.path.join(FILAS, rec["id"] + ".json")
    json.dump(rec, open(p, "w"), indent=1, ensure_ascii=False)
    return p


def main():
    rows = []
    # (a) fijos, círculo crítico del oráculo (X28 §1 y §8)
    for rid, key, desc, tag in [
        ("X28-F-X25", "X25", "Talud 20 m 1H:1V, roca simple (X25 §4.1), círculo fijo", "direct_X25"),
        ("X28-F-HAM1", "HAM1", "Hammah et al. 2005 ej. 1 (geometría X23 §3.2), seco, círculo fijo", "direct_HAM1"),
        ("X28-F-SA", "SA", "Sintético SA (X23 §4.1), roca débil, seco, círculo fijo", "direct_SA"),
        ("X28-F-SB", "SB", "Sintético SB (X23 §4.2), roca media, seco, círculo fijo", "direct_SB")]:
        nota = ""
        if key == "SB":
            nota = "Morgenstern-Price (= Spencer): no hay cruce Fm=Ff en el estado HB; par más cercano (X28 §2). Diferencia > 0,1 %."
        if key == "HAM1":
            nota = "Publicado (Hammah 2005, geometría reconstruida): Bishop 1,153, Spencer 1,152 (no es esta superficie)."
        rec = row_fixed(rid, key, desc, "fijo", tag, nota=nota)
        rows.append(rec)
    # (b) agua
    rows.append(row_fixed("X28-W-SB-LINEA16", "SB", "SB con piezométrica a 16 m (cruza las bases; to_cslope)", "agua",
                          "tocslope_SB_WT_HI", wt=models.SB_WT if False else [[-40.0, 16.0], [70.0, 16.0]],
                          nota="Oráculo por to_cslope (freeWater true, followBoundary false). Con la línea de X23 (bajo la superficie) el FS no cambia: la línea no toca ninguna base [verificado]."))
    # (c) ru
    rows.append(row_fixed("X28-R-SB-RU03", "SB", "SB seco con ru = 0,3", "ru", "direct_SB_ru03", ru=0.3,
                          nota="MP/Spencer: ver proto_status."))
    rows.append(row_fixed("X28-R-X25-RU03", "X25", "X25 con ru = 0,3", "ru", "direct_X25_ru03", ru=0.3,
                          nota="Spencer/MP: el prototipo no encuentra solución en la pasada 2 (ver proto_status); no es comparable."))
    for rec in rows:
        write(rec)
    table = []
    for rec in rows:
        for m in M5:
            o, pr = rec["oracle"].get(m), rec["proto"].get(m)
            table.append({"id": rec["id"], "metodo": m, "oracle": o, "proto": pr,
                          "dif_pct": None if (o is None or pr is None) else round((pr - o) / o * 100, 4),
                          "dentro": None if (o is None or pr is None) else abs(pr - o) / o <= TOL_F,
                          "pasadas": rec["proto_passes"][m], "estado": rec["proto_status"][m]})
    json.dump({"tolerancia_relativa": TOL_F, "filas": table}, open(os.path.join(FILAS, "resultados.json"), "w"),
              indent=1, ensure_ascii=False)
    for t in table:
        print(t["id"], t["metodo"], t["oracle"], t["proto"], t["dif_pct"], t["dentro"], t["pasadas"], t["estado"])
    return rows, table


def costo():
    out = {}
    for key in ["X25", "SB"]:
        circ = P.circle_of(key)
        doc = models.ogs_doc(key, circle=circ)
        sl, p, g = R.setup_doc(doc)
        t_hb, passes, t_mc = {}, {}, {}
        for m in M5:
            t0 = time.perf_counter()
            r = hbsolve.solve(sl, m, p, g, rule="cslope", tol=1e-4, max_pass=30, w=0.5, keep_hist=False)
            t_hb[m] = time.perf_counter() - t0
            passes[m] = r["analyses"]
            t0 = time.perf_counter()
            for _ in range(3):
                hbsolve._Fof(sl, m)
            t_mc[m] = (time.perf_counter() - t0) / 3
        out[key] = {"t_hb_s": t_hb, "analisis_hb": passes, "t_un_analisis_s": t_mc,
                    "multiplicador_por_metodo": {m: t_hb[m] / (passes[m] * t_mc[m]) for m in M5},
                    "multiplicador_total_vs_MC_una_pasada": sum(t_hb.values()) / sum(t_mc.values()),
                    "analisis_total_hb": sum(passes.values())}
        # vecinos de búsqueda: 6 círculos ±0,5 m en cx, cy, r (Bishop, HB)
        vec = []
        for dx, dy, dr in [(0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0, -0.5, 0), (0, 0, 0.5), (0, 0, -0.5)]:
            c2 = [circ[0] + dx, circ[1] + dy, circ[2] + dr]
            d2 = models.ogs_doc(key, circle=c2)
            try:
                s2, p2, g2 = R.setup_doc(d2)
            except RuntimeError as e:          # arco fuera del modelo (NoValidSurface del motor)
                vec.append({"c": [round(v, 3) for v in c2], "F": None, "pasadas": None, "estado": "motor: " + str(e)[:80]})
                continue
            r = hbsolve.solve(s2, "bishop", p2, g2, rule="cslope", tol=1e-4, max_pass=30, w=0.5, keep_hist=False)
            vec.append({"c": [round(v, 3) for v in c2], "F": r["F"], "pasadas": r["passes"], "estado": r["status"]})
        out[key]["vecinos_bishop"] = vec
        out[key]["pasadas_media_vecinos"] = sum(v["pasadas"] for v in vec if v["pasadas"]) / max(1, sum(1 for v in vec if v["pasadas"]))
    json.dump(out, open(os.path.join(HERE, "costo.json"), "w"), indent=1)
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk in ("multiplicador_total_vs_MC_una_pasada", "analisis_total_hb", "pasadas_media_vecinos")} for k, v in out.items()}, indent=1))
    return out


if __name__ == "__main__":
    main()
    costo()
