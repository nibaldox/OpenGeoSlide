"""Corre prototipo y oráculo sobre todas las filas y escribe X21_filas/ (JSON de entrada + resultados). Uso (dos pasos):
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python make_report.py oracle   # cSlope sobre rows/*.json
  env -u PYTHONPATH -u PYTHONHOME python3 make_report.py proto                          # prototipo + tabla + X21_filas/"""
import glob, json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))
M = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]
step = sys.argv[1]
ids = sorted(os.path.basename(p)[:-5] for p in glob.glob(f"{OUT}/rows/*.json"))
if step == "oracle":
    import oracle
    res = {}
    for rid in ids:
        m = json.load(open(f"{OUT}/rows/{rid}.json"))
        poly = m["analysis"]["surface"]["type"] == "polyline"
        r = oracle.run_all(m, methods=tuple(M[1:] if poly else M))
        res[rid] = {k: {"fos": v["fos"], "error": v.get("error"), "warnings": v.get("warnings")} for k, v in r.items()}
    json.dump(res, open(f"{OUT}/results_oracle.json", "w"), indent=1)
    print("oráculo:", len(res), "filas")
else:
    import proto
    O = json.load(open(f"{OUT}/results_oracle.json"))
    res, table = {}, []
    dest = os.path.join(HERE, "..", "X21_filas")
    os.makedirs(dest, exist_ok=True)
    for rid in ids:
        m = json.load(open(f"{OUT}/rows/{rid}.json"))
        try:
            out, info = proto.analyze(m)
        except Exception as exc:                  # noqa: BLE001
            out, info = None, {"status": "ERROR " + repr(exc)[:150]}
        rec = {"proto": out, "info": {k: v for k, v in info.items() if k not in ("slices", "circle")}, "oraculo": {}}
        for k in M:
            if k in O[rid]:
                o = O[rid][k]["fos"]
                p = None if out is None else out.get(k)
                rec["oraculo"][k] = {"fos": o, "error": O[rid][k].get("error"), "proto": p,
                                     "dif_pct": None if (o is None or p is None) else (p - o) / o * 100}
        res[rid] = rec
        shutil.copy(f"{OUT}/rows/{rid}.json", os.path.join(dest, f"{rid}.json"))
    json.dump(res, open(os.path.join(dest, "resultados.json"), "w"), indent=1, default=str)
    print(len(res), "filas")
    for rid, rec in res.items():
        cells = []
        for k in M:
            d = rec["oraculo"].get(k)
            if d is None:
                continue
            cells.append(f"{k[:4]}{'' if k != 'janbu_simplified' else '-s'}{'' if k != 'janbu_corrected' else '-c'} {d['fos']:.6f} ({d['dif_pct']:+.3f}%)" if d["fos"] is not None and d["dif_pct"] is not None else f"{k[:4]} {d['error'] or 'sin FS'}"[:40])
        print(rid, " | ".join(cells))
