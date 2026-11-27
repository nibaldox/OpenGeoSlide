#!/usr/bin/env python3
"""Oráculo de X29: cSlope 0.1.0 sobre los checks no circulares del corpus (golden, commit 0f07e7a).

Se ejecuta con el Python del oráculo:
    env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python oracle_x29.py V001 V034a V036a
Escribe $TMPDIR/f3b-x29/oracle/<caso>__k<k>__<variante>.json con:
- FS no circular (nonCircularOptimization true) y circular (false) con las mismas opciones del check;
- la polilínea final de cSlope (criticalSurface.points) y su FS;
- todas las superficies circulares de la búsqueda circular (allSurfaces) en forma compacta, para las semillas;
- la variante `sin_pph` quita `porePressureHead` de las opciones (el motor 0.4.0 no lo tiene; X23 §1.4).
Solo lectura de la clonación de cSlope.
"""
import json
import os
import sys
import time

import cslope

TMP = os.environ["TMPDIR"]
GOLDEN = os.path.join(TMP, "cslope-src/packages/engine-rs/golden/verification.json")
OUT = os.path.join(TMP, "f3b-x29/oracle")
os.makedirs(OUT, exist_ok=True)


def run(cid: str, k: int | None = None):
    data = json.load(open(GOLDEN))
    case = {c["id"]: c for c in data["cases"]}[cid]
    checks = case["checks"]
    idxs = [k] if k is not None else [i for i, c in enumerate(checks) if c["options"].get("nonCircularOptimization")]
    res = []
    for i in idxs:
        chk = checks[i]
        if not chk["options"].get("nonCircularOptimization"):
            continue
        for variant in ("completo", "sin_pph"):
            base = {kk: v for kk, v in chk["options"].items() if kk != "nonCircularOptimization"}
            if variant == "sin_pph":
                if "porePressureHead" not in base:
                    continue
                base.pop("porePressureHead")
            t0 = time.perf_counter()
            r_nc = cslope.analyse(case["definition"], dict(base, nonCircularOptimization=True))
            t_nc = time.perf_counter() - t0
            t0 = time.perf_counter()
            r_c = cslope.analyse(case["definition"], dict(base, nonCircularOptimization=False))
            t_c = time.perf_counter() - t0
            cs = r_nc.get("criticalSurface") or {}
            cc = r_c.get("criticalSurface") or {}
            allc = [[s["fos"], s["entryPoint"][0], s["exitPoint"][0], s["radius"], s["cx"], s["cy"]]
                    for s in r_c.get("allSurfaces", []) if s.get("fos") is not None and s.get("radius")]
            out = dict(
                caso=cid, k=i, variante=variant, metodo=chk["method"], publicado=chk["published"],
                publicado_por=chk["publishedBy"], tolerancia=chk["tolerance"], opciones=base,
                fos_nc=r_nc["minFOS"], fos_c=r_c["minFOS"],
                nc_points=cs.get("points"), nc_vertices=len(cs.get("points") or []),
                nc_entry=cs.get("entryPoint"), nc_exit=cs.get("exitPoint"),
                c_circle=dict(cx=cc.get("cx"), cy=cc.get("cy"), r=cc.get("radius"), entry=cc.get("entryPoint"),
                              exit=cc.get("exitPoint")),
                allSurfaces_circ=allc,
                ms_nc=t_nc * 1000, ms_c=t_c * 1000,
                warnings_nc=[w.get("code") for w in (r_nc.get("warnings") or [])],
                planes_nc=len(r_nc.get("allSurfaces", [])), planes_c=len(r_c.get("allSurfaces", [])),
                definicion=case["definition"],
            )
            path = os.path.join(OUT, f"{cid}__k{i}__{variant}.json")
            json.dump(out, open(path, "w"))
            print(cid, "k", i, variant, "FS_nc=%.6f FS_c=%.6f" % (out["fos_nc"], out["fos_c"]),
                  "vert", out["nc_vertices"], "ms", round(t_nc * 1000), round(t_c * 1000), path)
            res.append(path)
    return res


if __name__ == "__main__":
    for cid in sys.argv[1:]:
        run(cid)
