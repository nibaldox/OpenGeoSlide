"""X37: exporta una fila por (modelo, configuración) a CSV desde una corrida de run_x37.py.

Uso: python export_csv.py <run> <salida.csv>
"""
import csv
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import models as M  # noqa: E402

CFG = [f"{g}-N{n}" for g in ("G1", "G2", "G3") for n in (500, 2000, 5000)]
PUB = {}
for e in M.all_entries(with_sweep=False):
    for c in e["checks"]:
        if c.get("method") == "spencer" and c.get("kind") == "search":
            PUB.setdefault(e["id"], (c["published"], c["tolerance"]))


def main(run, out):
    recs = []
    for f in sorted(os.listdir(run)):
        if f.endswith(".json") and not f.startswith("_"):
            with open(os.path.join(run, f), encoding="utf-8") as fh:
                recs.append(json.load(fh))
    cols = ["modelo", "grupo", "configuracion", "circ_motor", "nc_motor", "nc_replica_sin_pulido", "nc_replica_pulido",
            "cslope_nco", "publicado", "tolerancia", "FS_pipeline_pura", "FS_final_min_motor", "error_pub_final",
            "un_lado_final", "banda_final", "razon_cslope_final", "fuente_ganador", "evals_gen", "evals_refin",
            "evals_pulido", "evals_total", "t_python_s", "avisos_ganador", "cslope_superficie_ganador",
            "marca_lambda_cs_2pct", "menor_que_cslope_lambda", "monotona_vs_motor", "vertices_ganador"]
    rows = []
    viol = 0
    for r in recs:
        e = r["engine"]
        pc = r.get("proto_current", {})
        cs = (r.get("cslope") or {}).get("nco", {}).get("fos")
        pub = PUB.get(r["id"])
        for c in CFG:
            p = r.get("pipelines", {}).get(c, {})
            if "F_final_monotone" not in p:
                rows.append([r["id"], r["group"], c, e.get("circ_fos"), e.get("nc_fos"), pc.get("F_noPolish"),
                             pc.get("F_polish"), cs, pub[0] if pub else None, pub[1] if pub else None,
                             None, None, None, None, None, None, p.get("error", "sin pipeline"),
                             None, None, None, None, None, None, None, None, None, None, None])
                continue
            w = p["winner_engine_check"]
            warn = w.get("warnings") or []
            lam = any(x in ("negative_lambda", "negative_effective_normal_major") for x in warn)
            csw = p.get("winner_cslope_fixed_fos")
            flag = bool(lam and csw and w.get("fos") and csw > 1.02 * w["fos"])
            low = bool(lam and cs and p["F_final_monotone"] < 0.98 * cs)
            F = p["F_final_monotone"]
            if F > e["nc_fos"] + 1e-12:
                viol += 1
            tot = p["gen_evals"] + p["refine_evals"] + p.get("polish_evals", 0)
            err = razon = un = band = None
            if pub:
                err = F / pub[0] - 1
                un = F <= pub[0] * (1 + pub[1])
                band = abs(err) <= pub[1]
            razon = (F / cs) if cs else None
            rows.append([r["id"], r["group"], c, e.get("circ_fos"), e.get("nc_fos"), pc.get("F_noPolish"),
                         pc.get("F_polish"), cs, pub[0] if pub else None, pub[1] if pub else None,
                         p["F_final_pipeline"], F, err, un, band, razon, p["source"], p["gen_evals"],
                         p["refine_evals"], p.get("polish_evals", 0), tot, p.get("seconds"), ";".join(warn),
                         csw, flag, low, F <= e["nc_fos"] + 1e-12, p["winner_vertices"]])
    with open(out, "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(cols)
        for row in rows:
            wr.writerow(["" if v is None else (round(v, 6) if isinstance(v, float) else v) for v in row])
    print(json.dumps(dict(filas=len(rows), violaciones_monotonia_vs_motor=viol)))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
