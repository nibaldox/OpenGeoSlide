"""Generador de polilíneas admisibles de D-1 (talud simple de dos estratos de C-M, `poly_rand.py`), con semilla fija.
Uso: gen_cases.py SEED N VARIANT OUT.json  -> lista de {points, ogs:{método:(fos,status,lambda,warnings)}}"""
import json, random, subprocess, os, sys, concurrent.futures as cf
OGS = os.environ.get("OGS", "target/release/ogs"); T = os.environ["TMPDIR"]
def ground(x): return 10.0 if x <= 10 else (10 - (x - 10) if x <= 20 else 0.0)
def model(points, variant="two", methods=("spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected")):
    mats = [{"id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20, "cohesion": 10, "friction_angle": 30},
            {"id": "e2", "name": "Roca", "model": "undrained", "unit_weight": 24, "undrained_strength": 30, "strength_datum": -3, "strength_gradient": 2.5, "strength_limit": 90}]
    regs = [{"material": "suelo", "polygon": [[0, -3], [40, -3], [40, 0], [20, 0], [10, 10], [0, 10]]},
            {"material": "e2", "polygon": [[0, -10], [40, -10], [40, -3], [0, -3]]}]
    if variant == "mc":
        mats = [mats[0]]; regs = [{"material": "suelo", "polygon": [[0, -10], [40, -10], [40, 0], [20, 0], [10, 10], [0, 10]]}]
    d = {"format": "opengeoslide", "version": "0.3", "meta": {"id": "rand", "title": "rand"}, "units": "SI", "materials": mats, "regions": regs,
         "slope": {"direction": "left_to_right"},
         "analysis": {"methods": list(methods), "slices": 50, "tolerance": 1e-5, "max_iterations": 500, "min_m_alpha": 0.2,
                      "surface": {"type": "polyline", "points": points}}}
    if "morgenstern_price" in methods: d["analysis"]["interslice"] = {"function": "constant"}
    return d
def rand_poly(rng):
    n = rng.randint(3, 8)
    x0 = rng.uniform(1, 14); x1 = rng.uniform(20, 39)
    xs = sorted([x0, x1] + [rng.uniform(x0, x1) for _ in range(n - 2)])
    dmax = rng.uniform(2, 9); pts = []
    for i, x in enumerate(xs):
        t = (x - x0) / (x1 - x0)
        depth = dmax * 4 * t * (1 - t) * rng.uniform(0.5, 1.3) + (0.05 if i in (0, n - 1) else rng.uniform(0.05, 0.5))
        pts.append([round(x, 3), round(max(ground(x) - depth, -9.5), 3)])
    return pts
def ogs_run(m):
    p = f"{T}/_g{os.getpid()}_{id(m)}.json"; json.dump(m, open(p, "w"))
    r = subprocess.run([OGS, "analyze", p], capture_output=True, text=True); os.remove(p)
    try: return json.loads(r.stdout)["results"]
    except Exception: return None
if __name__ == "__main__":
    seed, N, variant, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
    rng = random.Random(seed); cands = [rand_poly(rng) for _ in range(N)]
    def one(pts):
        r = ogs_run(model(pts, variant))
        return {"points": pts, "ogs": None if r is None else {x["method"]: [x["fos"], x["status"], x.get("lambda"), x["warnings"]] for x in r}}
    with cf.ThreadPoolExecutor(8) as ex: rows = list(ex.map(one, cands))
    json.dump(rows, open(out, "w")); print(len(rows), "polilíneas ->", out)
