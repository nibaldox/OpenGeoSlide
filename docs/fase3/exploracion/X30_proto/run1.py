"""X30: corrida principal. Escribe $TMPDIR/f3b-x30/run1.json. Uso: env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python run1.py"""
import copy, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import x30, x30_oracle as xo
OUT = os.path.join(os.environ['TMPDIR'], 'f3b-x30', 'run1.json')
M = x30.METHODS
OMETH = {m: m for m in M}
res = {}


def pct(a, b):
    return None if (a is None or b is None or b == 0) else (a - b) / b * 100


def table(label, model):
    t0 = time.time()
    pr = x30.proto_fos(model)
    row = {"proto": {}, "oracle": {}, "dif_pct": {}}
    for m in M:
        o = xo.oracle_run(model, OMETH[m])
        row["oracle"][m] = o["fos"]
        row["proto"][m] = pr.get(m)
        row["dif_pct"][m] = pct(pr.get(m), o["fos"])
    row["t_s"] = round(time.time() - t0, 2)
    res[label] = row
    print(label, {k: (round(v, 6) if v else v) for k, v in row["oracle"].items()}, '| dif%', {k: (round(v, 4) if v is not None else None) for k, v in row["dif_pct"].items()}, flush=True)


ocr_cases = {
    "ocr1": {"ocr": 1.0},
    "ocr1.5": {"ocr": 1.5},
    "pop10": {"pop": 10.0},
    "ocr_by_elev": {"ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]]},
}
for wet in (False, True):
    for k, spec in ocr_cases.items():
        table(f"V047a_{'wet' if wet else 'dry'}_{k}", xo.v047a(spec, wet=wet))

# V105a: prototipo sobre el motor y oráculo (golden)
m105, df105, case105 = xo.v105a()
pr = x30.proto_fos(m105)
fos_o = {}
for name, opt in [("bishop", "Bishop"), ("spencer", "MP_const"), ("janbu_simplified", "Janbu_s"), ("janbu_corrected", "Janbu_c")]:
    fos_o[name] = None
oracle_v105 = {}
for mth, opts in [("Bishop", {}), ("Morgenstern-Price", {"intersliceFunction": "constant"}),
                  ("Janbu", {"janbuCorrection": True}), ("Janbu", {"janbuCorrection": False})]:
    o = xo.oracle_v105a(mth) if not opts else None
    key = mth + ("" if not opts else ("_const" if "intersliceFunction" in opts else ("_corr" if opts.get("janbuCorrection") else "_simpl")))
    import cslope as cs
    doc = {"format": "cslope-analysis", "formatVersion": 1, "definition": case105["definition"],
           "options": {"method": mth, "slices": 50, "iterations": 1000, "refinedIterations": 1000, "tolerance": 0.001, **opts}}
    r = cs.analyse(doc)
    oracle_v105[key] = {"fos": r.get("minFOS"), "warnings": [w.get("code") for w in r.get("warnings") or []]}
# el mismo oráculo sobre la conversión (shansep en el modelo v0.6) para comparar
conv_o = xo.oracle_run(m105, "bishop")
res["V105a"] = {"proto": pr, "oracle_golden": oracle_v105, "oracle_converted_bishop": conv_o["fos"],
                "published_bishop": 1.285, "tolerance_bishop": 0.01038910505836576}
print("V105a proto", {k: (round(v, 6) if v else v) for k, v in pr.items()}, flush=True)
print("V105a oracle golden", {k: round(v["fos"], 6) for k, v in oracle_v105.items()}, "conv bishop", conv_o["fos"], flush=True)
_, sl105 = x30.proto_fos(m105, return_slices=True, methods=["bishop"])
res["V105a"]["n_above_water_slices"] = sum(1 for d in sl105 if d.get("above_water_used"))
res["V105a"]["n_sv_le0"] = sum(1 for d in sl105 if d.get("sv", 1) <= 0)

json.dump(res, open(OUT, "w"), indent=1, default=str)
print("escrito", OUT)
