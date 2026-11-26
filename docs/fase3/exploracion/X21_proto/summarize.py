import json, os, sys
D = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "X21_filas", "resultados.json")))
M = ["bishop", "spencer", "janbu_simplified", "janbu_corrected"]
worst = {}
for rid, r in D.items():
    for k, d in r["oraculo"].items():
        if d["dif_pct"] is not None:
            worst.setdefault(rid, []).append(abs(d["dif_pct"]))
mx = sorted(((max(v), rid) for rid, v in worst.items()), reverse=True)
print("peor fila:", mx[:6], "| nº filas con oráculo:", len(worst), "| filas > 0,1 %:", [x for x in mx if x[0] > 0.1])
print("sin FS en el oráculo:", [rid for rid, r in D.items() if all(d["fos"] is None for d in r["oraculo"].values())])
# neutralidad
for rid in ("X21-N01", "X21-N02", "X21-N03"):
    r = D[rid]
    eng = r["proto"]["engine_fos"]
    print(rid, "neutralidad |proto-motor|:", {k: "%.1e" % abs(r["proto"][k] - eng[k]) for k in ("bishop", "spencer", "janbu_simplified", "janbu_corrected")},
          "dovelas modificadas: n_removed", r["info"].get("n_removed"))
# equilibrio
eq = {}
for rid, r in D.items():
    e = r["info"].get("equilibrium")
    if not e or "nota" in e:
        continue
    for k in ("bishop", "janbu_simplified", "spencer"):
        if k in e:
            eq.setdefault(k, []).append((abs(e[k]), rid))
for k, v in eq.items():
    v.sort(reverse=True)
    print("equilibrio", k, "máx", "%.2e" % v[0][0], v[0][1], "| mediana %.1e" % sorted(x[0] for x in v)[len(v)//2], "| n", len(v))
# Bishop sin términos nuevos vs con ellos
print("bishop N01 (sin términos):", "%.2e" % abs(D["X21-N01"]["info"]["equilibrium"]["bishop"]))
# espejos
for a, b in (("X21-P01", "X21-P03"), ("X21-W100", "X21-W100m"), ("X21-D01", "X21-D03"), ("X21-D02", "X21-D04")):
    pa, pb = D[a]["proto"], D[b]["proto"]
    oa, ob = D[a]["oraculo"], D[b]["oraculo"]
    print("espejo", a, b, "proto max|Δ|", "%.1e" % max(abs(pa[k] - pb[k]) for k in ("bishop", "spencer", "janbu_simplified", "janbu_corrected")),
          "oráculo max|Δ|", "%.1e" % max(abs(oa[k]["fos"] - ob[k]["fos"]) for k in ("bishop", "spencer", "janbu_simplified", "janbu_corrected")))
# monotonía
def fs(rid, k="spencer"):
    return D[rid]["oraculo"][k]["fos"]
print("grieta con agua V047a Spencer (0, .25, .5, 1):", [round(fs(r), 5) for r in ("X21-C20", "X21-W025", "X21-W050", "X21-W100")])
print("grieta seca V047a Spencer (0 sin grieta, 1, 2, 3 m):", [round(D['X21-N01']['oraculo']['spencer']['fos'], 5)] + [round(fs(r), 5) for r in ("X21-C10", "X21-C20", "X21-C30")])
print("V079 seca profundidad (0, 5, 10, 15):", [round(fs(r), 5) for r in ("X21-CP-V079-w000-sincrack", "X21-CP-V079-d05", "X21-CP-V079-d10", "X21-CP-V079-w000")])
print("V079 fracción (0, .25, .5, 1):", [round(fs(r), 5) for r in ("X21-CP-V079-w000", "X21-CP-V079-w025", "X21-CP-V079-w050", "X21-CP-V079-w100")])
print("pond nivel (26,27,30,33) Spencer oráculo:", [round(fs(r), 5) for r in ("X21-P07", "X21-P01", "X21-P02", "X21-P08")])
