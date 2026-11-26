"""Tabla markdown de las filas de aceptación a partir de X21_filas/resultados.json."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rows_def
D = json.load(open(os.path.join(HERE, "..", "X21_filas", "resultados.json")))
DESC = {rid: m["desc"] for rid, m in rows_def.META.items()}
DESC.update({
    "X21-CP-V009a": "V009a (Baker-Leshchinsky), círculo fijo, ltr: embalse + grieta seca de 5 m (las dos juntas)",
    "X21-CP-V009b": "V009b, superficie no circular fija de Baker (polilínea), embalse + grieta seca de 5 m",
    "X21-CP-V023": "V023 (LASH), círculo fijo, agua embalsada (dirección auto)",
    "X21-CP-V024": "V024, presa sobre cimiento con presión artesiana, agua embalsada",
    "X21-CP-V042": "V042, presa de núcleo grueso, embalse de 57 m",
    "X21-CP-V061": "V061 (Clarence Cannon), círculo fijo, embalse (opciones del primer check)",
    "X21-CP-V087": "V087 (USACE fig. 4-3), círculo fijo, embalse",
    "X21-CP-V089": "V089 (USACE fig. 4-2), círculo fijo, embalse al pie",
    "X21-CP-V091": "V091 (USACE E-2), arcillas no drenadas, embalse",
    "X21-CP-V092": "V092 (USACE F-6), embalse",
    "X21-CP-V072a": "V072a (Pockoski-Duncan), círculo fijo, grieta seca 1,676 m",
    "X21-CP-V082a": "V082a (Sharma), círculo fijo, grieta seca 3,353 m (sin la opción phreatic-correction)",
    "X21-CP-V088": "V088 (USACE), círculo fijo, grieta seca 2,134 m con línea de agua",
    "X21-CP-V096c": "V096c (Zhu-Lee), círculo fijo, grieta seca 1,015 m, 4 capas",
    "X21-CP-V079-w000": "V079 (Priest), plano fijo, grieta seca de 15 m",
    "X21-CP-V079-w000-sincrack": "V079 sin grieta (control)",
    "X21-CP-V079-w025": "V079, grieta de 15 m con agua al 25 %",
    "X21-CP-V079-w050": "V079, grieta de 15 m con agua al 50 %",
    "X21-CP-V079-w100": "V079, grieta de 15 m llena",
    "X21-CP-V079-d05": "V079, grieta seca de 5 m", "X21-CP-V079-d10": "V079, grieta seca de 10 m",
    "X21-CP-V080": "V080 (Priest, cara de 60°), plano fijo, grieta de 15 m al 25 %",
    "X21-S-V048-fija": "V048/0: círculo crítico de la búsqueda de cSlope (grieta 4 m llena), fijo",
    "X21-S-V086b-fija": "V086b/0: círculo crítico de la búsqueda (grieta 2 m llena, φ = 0), fijo",
    "X21-S-V086b-auto": "V086b/1: círculo crítico de la búsqueda con grieta automática y llena, fijo",
    "X21-S-V096a-fija": "V096a/0: círculo crítico de la búsqueda (grieta seca 1,015 m), fijo"})
print("| id | descripción | Bishop | Spencer = M-P `constant` | Janbu simpl. | Janbu corr. | máx. \\|Δ\\| % |")
print("|---|---|---:|---:|---:|---:|---:|")
for rid in sorted(D):
    o = D[rid]["oraculo"]
    def f(k):
        d = o.get(k)
        if d is None:
            return "—"
        return f"{d['fos']:.6f}" if d["fos"] is not None else "sin FS (descartada)"
    dif = [abs(d["dif_pct"]) for d in o.values() if d["dif_pct"] is not None]
    print(f"| {rid} | {DESC.get(rid, '')} | {f('bishop')} | {f('spencer')} | {f('janbu_simplified')} | {f('janbu_corrected')} | {('%.3f' % max(dif)) if dif else '—'} |")
