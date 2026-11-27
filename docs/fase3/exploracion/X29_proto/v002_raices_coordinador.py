import json, os, cslope
T=os.environ["TMPDIR"]
data=json.load(open(T+"/cslope-src/packages/engine-rs/golden/verification.json"))
case={c["id"]:c for c in data["cases"]}["V002"]
opts={"method":"Morgenstern-Price","slices":50,"iterations":4000,"refinedIterations":2000,"tolerance":0.001,"intersliceFunction":"constant"}
eng=json.load(open(T+"/f3b-coord/v002k1_out.json"))["results"][0]
poly=eng["surface"]["points"]
def ev(extra, label):
    d=dict(case["definition"]); d.update(extra); d["customPlanesOnly"]=True
    r=cslope.analyse(d, opts)
    cs=r.get("criticalSurface") or {}
    print(label, "FS=", r.get("minFOS"), "lambda=", r.get("lambda", cs.get("lambda")), "warn=", [w.get("code") for w in (r.get("warnings") or [])][:6], "keys=", sorted(k for k in r.keys())[:12])
ev({"customSearchPlanes":[{"cx":25.052825961759563,"cy":42.15198626636139,"radius":28.89878928527152}]}, "circulo_motor")
ev({"customSurfaces":[{"points":poly}]}, "polilinea_motor")
oc=json.load(open(T+"/f3b-x29/oracle/V002__k1__completo.json"))
print("circulo_cslope", oc["c_circle"], "fos_c", oc["fos_c"])
