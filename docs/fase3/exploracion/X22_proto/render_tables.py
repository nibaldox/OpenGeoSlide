"""Tablas Markdown de X22.md a partir de ../X22_filas/resultados.json y circles.json (python3 render_tables.py)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, "..", "X22_filas", "resultados.json")))
c = json.load(open(os.path.join(HERE, "circles.json")))
print("### oráculo contra publicado (búsqueda Bishop de cSlope, location centroid)\n")
print("| caso | publicado (Prog. A / Cai-Ugai) | oráculo | Δ % | círculo (xc, yc, r) | fuerza/m en el cruce |\n|---|---|---:|---:|---|---:|")
pub = {"V013b": (1.54, 1.54), "V013c": (1.43, 1.37), "V013d": (1.33, 1.31), "V013e": (1.25, 1.25)}
for k, (a, b) in pub.items():
    x = c[k + "/centroid"]
    f = x["forces"][0]["force"] if x["forces"] else None
    print(f"| {k} | {a} / {b} | {x['fos']:.6f} | {100*(x['fos']-a)/a:+.2f} | ({x['xc']:.4f}; {x['yc']:.4f}; {x['r']:.4f}) | {'—' if f is None else format(f, '.4f')} |")
print("\n### filas: cifras del oráculo (B = Bishop, S = Spencer = M-P constante, JS = Janbu simplificado, JC = Janbu corregido) y diferencia del prototipo\n")
print("| fila | B | S = M-P | JS | JC | F/m oráculo | F/m proto | máx \\|Δ\\| % | equilibrio S |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|")
for rid, r in d["filas"].items():
    m = r["metodos"]
    mx = max(abs(v["diff_pct"]) for v in m.values())
    f = r["fuerza_por_metro"]
    fo = "—" if not f or f["oracle"] is None else f"{f['oracle']:.4f}"
    fp = "—" if not f or f["proto"] is None else f"{f['proto']:.4f}"
    eq = r["equilibrio_global"].get("spencer")
    print(f"| {rid} | {m['bishop']['oracle']:.6f} | {m['spencer']['oracle']:.6f} | {m['janbu_simplified']['oracle']:.6f} | {m['janbu_corrected']['oracle']:.6f} | {fo} | {fp} | {mx:.4f} | {eq:.1e} |")
