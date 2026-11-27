#!/usr/bin/env python3
"""Construye las filas de aceptación de X29 (formato v0.6 provisional) y la tabla resultados.json.

Lee $TMPDIR/f3b-x29/proto/*.json (salida de run_x29.py) y $TMPDIR/f3b-x29/oracle/*.json (oracle_x29.py).
Escribe docs/fase3/exploracion/X29_filas/<caso>-k<k>.json (búsqueda) y X29_filas/evaluador-<caso>.json
(polilínea final de cSlope como superficie fija), y X29_filas/resultados.json.
Ejecutar con el Python del evaluador (solo usa la librería estándar y los ficheros anteriores).
"""
import copy
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/home/xodla/archivos/opengeoslide"
TMP = os.environ["TMPDIR"]
PRO = os.path.join(TMP, "f3b-x29/proto")
ORC = os.path.join(TMP, "f3b-x29/oracle")
FIL = os.path.join(REPO, "docs/fase3/exploracion/X29_filas")
os.makedirs(FIL, exist_ok=True)

TOL_A2 = 0.01          # |FS_ogs − FS_cSlope| / FS_cSlope ≤ 1 % (X24 A2; plan §3)
TOL_EV = 0.001         # evaluador: |FS_motor(polilínea cSlope) − FS_cSlope| / FS_cSlope ≤ 0,1 %
MAX_VERT = 33          # A4
SEC_TIME_RATIO = 4.0   # A7 (medido en Python; ver nota)
DELTA_MAX = 0.15       # A8


def r6(x):
    return None if x is None else round(float(x), 6)


def rel(a, b):
    return None if a is None or b is None else (a - b) / b


def model_v06(case_model):
    m = copy.deepcopy(case_model)
    m["version"] = "0.6"
    a = m["analysis"]
    s = dict(a.get("search") or {})
    s["non_circular"] = {"seeds": 3, "max_vertices": 33}
    a["search"] = s
    a["methods"] = ["morgenstern_price"]
    a["interslice"] = {"function": "constant"}
    return m


def case_model(cid):
    c = json.load(open(f"{REPO}/verification/cases/{cid}.json"))
    m = c["model"]
    return c, m


rows, table = [], []
for path in sorted(glob.glob(os.path.join(PRO, "*__k*__mp.json"))):
    rec = json.load(open(path))
    cid, k = rec["caso"], rec["k"]
    c, m = case_model(cid)
    o, p, e = rec["oraculo"], rec["proto"]["mp"], rec["evaluador_sobre_cslope"]
    best = p["best_idx"]
    seed_best = p["seeds"][best] if best is not None else None
    fos = p["fos"]
    pub, tol = rec["publicado"], rec["tolerancia"]
    circ_seed_fos = seed_best["circle"]["fos"] if seed_best else None
    row_id = f"X29-{cid}-k{k}"
    a2 = rel(fos, o["fos_nc"])
    a3 = abs(fos - pub) <= tol if fos is not None else False
    a1 = (fos is not None and circ_seed_fos is not None and fos <= circ_seed_fos + 1e-12)
    a4 = (len(p["points"]) <= MAX_VERT) if p["points"] else False
    a5 = bool(rec["admisible_final_ogs"]) and p["points"] is not None
    a6 = bool(rec["proto"]["mp_determinismo_identico"])
    a7 = (p["seconds_total"] / rec["motor"]["circ_seconds"]) if rec["motor"]["circ_seconds"] else None
    a8 = abs(rel(fos, rec["motor"]["fos_circular"]) or 0.0) <= DELTA_MAX
    ev_rel = rel(e["fos_mp"], o["fos_nc"])
    grupo = "busqueda-no-circular/morgenstern_price-constante"
    row = dict(
        id=row_id,
        descripcion=(f"{cid} ({rec['publicado_por']}), check {k} (MP constante = Spencer en cSlope): búsqueda no "
                     f"circular X29 con semillas de la malla de círculos y variación alterna 9→17→33, "
                     f"presupuesto 1500 por semilla, evaluada con wheel 0.4.0"),
        grupo=grupo,
        model=model_v06(m),
        oracle=dict(
            fos={"morgenstern_price_constante": r6(o["fos_nc"])},
            config=("cslope 0.1.0 (oracle-venv), definición de golden/verification.json de " + cid + ", opciones: "
                    + json.dumps(o["opciones"], sort_keys=True) + ", nonCircularOptimization=true"),
            fos_circular={"morgenstern_price_constante": r6(o["fos_c"])},
            publicado=dict(valor=pub, por=rec["publicado_por"], tolerancia_abs=tol),
            vertices=o["vertices"] if "vertices" in o else o.get("nc_vertices"),
            polilinea_cslope=o["nc_points"],
        ),
        proto=dict(
            fos={"morgenstern_price_constante": r6(fos), "spencer": r6(rec["proto"]["spencer"]["fos"])},
            fos_circular_motor={"morgenstern_price_constante": r6(rec["motor"]["fos_circular"])},
            semilla_mejor=dict(idx=best, circulo=seed_best["circle"] if seed_best else None),
            vertices=len(p["points"]) if p["points"] else None,
            evaluaciones_nc=p["evals_nc"],
            evaluaciones_malla=p["grid"]["evals"],
            tiempo_s=round(p["seconds_total"], 3),
            tiempo_circular_motor_s=round(rec["motor"]["circ_seconds"], 4),
            determinismo_identico=a6,
            polilinea_final=p["points"],
        ),
        tolerancia=dict(relativa_A2=TOL_A2, publicado_abs=tol),
        nota=("Semillas: 3 mejores de una malla gruesa 20×20×20 con círculos fijos (no refinada). "
              "Entrada y salida de cSlope pueden venir invertidas; el prototipo ordena x creciente."),
    )
    rows.append((row_id, path, row))
    rowres = dict(
        id=row_id, caso=cid, k=k, metodo_check=rec["metodo_check"], FS_cslope_NC=r6(o["fos_nc"]),
        FS_ogs_NC=r6(fos), rel_A2=r6(a2), FS_motor_circular=r6(rec["motor"]["fos_circular"]),
        FS_cslope_circular=r6(o["fos_c"]), rel_circular_motor_vs_cslope=r6(rel(rec["motor"]["fos_circular"], o["fos_c"])),
        publicado=pub, tol_publicado=tol, A1_FS_le_semilla_circular=a1, A2_ok=(abs(a2) <= TOL_A2),
        A3_publicado_ok=a3, A4_vertices=len(p["points"]) if p["points"] else None, A4_ok=a4, A5_ok=a5, A6_det_ok=a6,
        A7_ratio_tiempo_py=r6(a7), A8_ok=a8, evaluaciones_nc=p["evals_nc"], evaluaciones_malla=p["grid"]["evals"],
        tiempo_s=round(p["seconds_total"], 3), rechazos_adm=sum(s["rej_adm"] or 0 for s in p["seeds"]),
        rechazos_motor=sum(s["rej_eng"] or 0 for s in p["seeds"]),
        semillas_ogs=[[r6(s["circle"]["fos"]), round(s["circle"]["xe"], 3), round(s["circle"]["xs"], 3)] for s in p["seeds"]],
        semillas_cslope=[[r6(s[0]), round(s[1], 3), round(s[2], 3)] for s in rec["semillas"]["oraculo"]],
        evaluador_fos_motor_sobre_polilinea_cslope_MP=r6(e["fos_mp"]),
        evaluador_rel_vs_cslope=r6(ev_rel),
        variantes=rec.get("variantes"),
    )
    table.append(rowres)

for row_id, path, row in rows:
    json.dump(row, open(os.path.join(FIL, row_id.replace("X29-", "") + ".json"), "w"), indent=1, ensure_ascii=False)

# filas del evaluador: polilínea final de cSlope pasada al motor como superficie fija
ev_rows = []
for t in table:
    rec = json.load(open(os.path.join(PRO, f"{t['caso']}__k{t['k']}__mp.json")))
    e = rec["evaluador_sobre_cslope"]
    o = rec["oraculo"]
    ok = e["fos_mp"] is not None and abs(rel(e["fos_mp"], o["fos_nc"])) <= TOL_EV
    ev = dict(
        id=f"X29-EV-{t['caso']}-k{t['k']}", descripcion=(f"Polilínea final de cSlope ({t['caso']} k{t['k']}) como "
                                                         "superficie fija en el motor 0.4.0 (aislar el evaluador)"),
        grupo="evaluador-superficie-fija", model=model_v06(case_model(t["caso"])[1]),
        oracle=dict(fos={"morgenstern_price_constante": r6(o["fos_nc"])}, config="cslope 0.1.0, polilínea "
                    "criticalSurface de la búsqueda NC del check"),
        proto=dict(fos={"morgenstern_price_constante": r6(e["fos_mp"]), "spencer": r6(e["fos_sp"])},
                   nota="Si cSlope da x decreciente, se invierte el orden (el motor exige x creciente)."),
        tolerancia=dict(relativa=TOL_EV), nota="Error del evaluador: " + str(r6(t["evaluador_rel_vs_cslope"])),
    )
    # la superficie fija debe llevar `surface` polilínea: se pone en el modelo, sin search
    m = ev["model"]
    m["analysis"].pop("search", None)
    m["analysis"]["surface"] = {"type": "polyline", "points": o["nc_points"][::-1] if o["nc_points"][0][0] > o["nc_points"][-1][0] else o["nc_points"]}
    m["analysis"].pop("non_circular", None)
    json.dump(ev, open(os.path.join(FIL, f"evaluador-{t['caso']}-k{t['k']}.json"), "w"), indent=1, ensure_ascii=False)
    ev_rows.append(dict(id=ev["id"], fos_cslope=r6(o["fos_nc"]), fos_motor_MP=r6(e["fos_mp"]), rel=r6(t["evaluador_rel_vs_cslope"]),
                        ok=ok))

json.dump(dict(criterios=dict(A2_relativo=TOL_A2, evaluador_relativo=TOL_EV, A4_vertices_max=MAX_VERT,
                              A7_ratio_max=SEC_TIME_RATIO, A8_alerta=DELTA_MAX),
               busqueda=table, evaluador=ev_rows), open(os.path.join(FIL, "resultados.json"), "w"),
          indent=1, ensure_ascii=False)
for t in table:
    print(t["caso"], t["k"], "cs=%.6f ogs=%.6f rel=%+.3f%%" % (t["FS_cslope_NC"], t["FS_ogs_NC"], 100 * t["rel_A2"]),
          "pub=%s±%.4f ok=%s" % (t["publicado"], t["tol_publicado"], t["A3_publicado_ok"]),
          "A1=%s A2=%s A4=%s A6=%s A7=%.1f A8=%s" % (t["A1_FS_le_semilla_circular"], t["A2_ok"], t["A4_ok"],
                                                    t["A6_det_ok"], t["A7_ratio_tiempo_py"], t["A8_ok"]),
          "circ_motor=%.6f circ_cs=%.6f" % (t["FS_motor_circular"], t["FS_cslope_circular"]),
          "ev_rel=%s" % t["evaluador_rel_vs_cslope"], "rechazos adm/motor=%d/%d" % (t["rechazos_adm"], t["rechazos_motor"]))
