"""D-1: criterio candidato de admisibilidad estática de Spencer/M-P, medido sobre el reporte del motor (post-proceso, no toca el motor).
Criterio (d) de Zhu, Lee y Jiang (2003, Géotechnique 53(4):377-395, ecs. 59-61) = restricción de Chen y Morgenstern (1983, Can. Geotech.
J. 20(1):104-119, ec. 5): el FS local de la cara vertical entre dovelas no debe ser menor que el de la base,
    F_v = (E' tan(phi_v) + c_v h) / |X|  >= F      <=>   r_v = |X|·F / (c_v h + max(E',0) tan(phi_v))  <= 1.
E' = E_total - P_w es la fuerza normal efectiva (compresión >0); h es la altura de la cara (base -> terreno); c_v, tan(phi_v) son los
medios en altura de los materiales que cruza la cara; P_w es la resultante del agua sobre la cara. Se evalúa en las caras con |E| >= EMIN·max|E|.
Uso: admiss.py MODELO.json [método]  (MODELO = .ogs.json o caso con 'model')."""
import sys, os, json, math, subprocess, copy
from shapely.geometry import Polygon, Point as SP, LineString
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
EMIN = 0.02; NS = 40
OGS = os.environ.get("OGS", "target/release/ogs")

def ogs_run(model):
    import tempfile
    p = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, dir=os.environ["TMPDIR"]); json.dump(model, p); p.close()
    r = subprocess.run([OGS, "analyze", p.name], capture_output=True, text=True); os.remove(p.name)
    return json.loads(r.stdout)["results"]

class Geo:
    def __init__(self, model):
        self.m = model; self.regs = [(Polygon(r["polygon"]), r["material"]) for r in model["regions"]]
        self.mats = {m["id"]: m for m in model["materials"]}
        self.gw = (model.get("water") or {}).get("unit_weight", 9.81); self.piezo = (model.get("water") or {}).get("piezometric_line")
        xs = [p[0] for r in model["regions"] for p in r["polygon"]]; self.x0, self.x1 = min(xs), max(xs)
    def top(self, x, below=None):
        x = min(max(x, self.x0 + 1e-9), self.x1 - 1e-9); ys = []
        for poly, _ in self.regs:
            c = LineString([(x, -1e6), (x, 1e6)]).intersection(poly)
            if not c.is_empty: ys.append(c.bounds[3])
        return max(ys)
    def mat_at(self, x, y):
        x = min(max(x, self.x0 + 1e-9), self.x1 - 1e-9)
        for poly, mid in self.regs:
            if poly.buffer(1e-9).contains(SP(x, y)): return self.mats[mid]
        return None
    def piezo_y(self, x):
        pz = self.piezo
        if not pz: return None
        pts = [(p[0], p[1]) for p in pz]
        if x <= pts[0][0]: return pts[0][1]
        if x >= pts[-1][0]: return pts[-1][1]
        for a, b in zip(pts, pts[1:]):
            if a[0] <= x <= b[0]: return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]) if b[0] > a[0] else a[1]
    def su(self, m, y):
        v = m["undrained_strength"] + (m.get("strength_datum", 0) - y) * m.get("strength_gradient", 0.0) if "strength_gradient" in m else m["undrained_strength"]
        v = max(0.0, v)
        if m.get("strength_limit") is not None: v = min(v, m["strength_limit"]) if m.get("strength_gradient", 0) >= 0 else max(v, m["strength_limit"])
        return v

def face_props(geo, x, yb, yt):
    """(h, ∫c dy, tanφ medio, P_w) de la cara vertical en x entre yb e yt."""
    h = max(yt - yb, 0.0)
    if h < 1e-9: return 0.0, 0.0, 0.0, 0.0
    cs = ts = pw = 0.0; n = 0
    for i in range(NS):
        y = yb + (i + 0.5) * h / NS; m = geo.mat_at(x, y)
        if m is None: continue
        if m["model"] == "undrained": c, t = geo.su(m, y), 0.0
        else: c, t = m["cohesion"], math.tan(math.radians(m["friction_angle"]))
        cs += c * h / NS; ts += t; n += 1
        if m.get("ru") is not None:
            sv = 0.0; yy = y
            # tensión vertical a esa cota: peso de la columna sobre el punto
            for j in range(NS):
                y2 = y + (j + 0.5) * (yt - y) / NS; m2 = geo.mat_at(x, y2)
                sv += (m2["unit_weight"] if m2 else 0.0) * (yt - y) / NS
            pw += m["ru"] * sv * h / NS
        else:
            z = geo.piezo_y(x)
            if z is not None and y < z: pw += geo.gw * (z - y) * h / NS
    return h, cs, (ts / n if n else 0.0), pw

def pole(s, F, lf):
    sn, cs = math.sin(s["alpha"]), math.cos(s["alpha"])
    return (sn - lf * cs) * s["tan_phi"] + (cs + lf * sn) * F

def inert(s): return s["weight"] == 0.0 and s["cohesion"] == 0.0 and s["tan_phi"] == 0.0 and s["weight_extra"] == 0.0 and s["h_force"] == 0.0

def interslice_f(S, faces, F, lam):
    E = [0.0]
    for k, s in enumerate(S):
        if inert(s): E.append(E[-1]); continue
        sn, cs = math.sin(s["alpha"]), math.cos(s["alpha"])
        W = s["weight"] + s["weight_extra"]; U = s["pore_pressure"] * s["base_length"]
        q = F * W * sn - ((W * cs - U) * s["tan_phi"] + s["cohesion"] * s["base_length"] - s["h_force"] * sn * s["tan_phi"]) + 0.0
        q = F * (W * sn + s["h_force"] * cs) - ((W * cs - U) * s["tan_phi"] + s["cohesion"] * s["base_length"] - s["h_force"] * sn * s["tan_phi"])
        d = pole(s, F, lam * faces[k + 1])
        if faces[k] == faces[k + 1]: E.append(E[-1] + q / d)
        else: E.append(E[-1] + ((pole(s, F, lam * faces[k]) - d) * E[-1] + q) / d)
    return E

def faces_of(model, meth, S):
    n = len(S)
    if meth != "morgenstern_price": return [1.0] * (n + 1)
    spec = (model["analysis"].get("interslice") or {"function": "half_sine"}); fn = spec["function"]
    x0 = min(s["x_left"] for s in S); x1 = max(s["x_right"] for s in S)
    ltr = n > 1 and abs(S[0]["x_left"] - S[1]["x_right"]) < 1e-9
    xf = [S[0]["x_right"] if ltr else S[0]["x_left"]] + [(s["x_left"] if ltr else s["x_right"]) for s in S]
    def f(xi):
        if xi < 0 or xi > 1: return 0.0
        if fn == "constant": return 1.0
        if fn == "half_sine": return math.sin(math.pi * xi)
        if fn == "clipped_sine": return max(0.35, math.sin(math.pi * xi))
        if fn == "trapezoidal": return xi / 0.2 if xi < 0.2 else (1.0 if xi <= 0.8 else (1 - xi) / 0.2)
        if fn == "data_points":
            pts = spec["points"]
            for a, b in zip(pts, pts[1:]):
                if a[0] <= xi <= b[0]: return a[1] + (xi - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
        return 1.0
    return [f((x - x0) / (x1 - x0)) for x in xf]

def evaluate(model, meth, res, geo=None):
    """Devuelve dict con rv_max (con F), rv1_max (sin F), caras evaluadas, E tracción, etc. para un resultado convergido."""
    S = res["slices"]; F = res["fos"]; lam = res["lambda"]; n = len(S)
    geo = geo or Geo(model); faces = faces_of(model, meth, S)
    E = interslice_f(S, faces, F, lam); Emax = max(abs(e) for e in E) or 1.0
    ltr = n > 1 and abs(S[0]["x_left"] - S[1]["x_right"]) < 1e-9
    out = {"F": F, "lam": lam, "closure": E[-1] / max(sum(s["weight"] for s in S), 1e-12), "rv_max": 0.0, "rv1_max": 0.0, "faces": 0, "worst_x": None}
    for k in range(n - 1):
        e = E[k + 1]
        if abs(e) < EMIN * Emax: continue
        s = S[k]; x = s["x_left"] if ltr else s["x_right"]; yb = s["y_base_left"] if ltr else s["y_base_right"]
        h, cs, tp, pw = face_props(geo, x, yb, geo.top(x))
        Ec = -e - pw; cap = cs + max(Ec, 0.0) * tp; X = abs(lam * faces[k + 1] * e)
        if X < 1e-12: continue
        if Ec <= 0.0:  # cara en tracción efectiva: es el criterio (c) de Zhu et al., no el (d); se cuenta aparte
            out["tension_faces"] = out.get("tension_faces", 0) + 1; continue
        out["faces"] += 1
        rv1 = X / cap if cap > 0 else float("inf")
        if rv1 * F > out["rv_max"]: out["rv_max"] = rv1 * F; out["worst_x"] = x
        out["rv1_max"] = max(out["rv1_max"], rv1)
    return out

def load_model(path):
    d = json.load(open(path)); return d["model"] if "model" in d else d

if __name__ == "__main__":
    model = load_model(sys.argv[1]); only = sys.argv[2:] or None
    res = ogs_run(model); geo = Geo(model)
    for r in res:
        if only and r["method"] not in only: continue
        if r["method"] in ("spencer", "morgenstern_price") and r["status"] == "converged":
            print(r["method"], json.dumps({k: (round(v, 6) if isinstance(v, float) else v) for k, v in evaluate(model, r["method"], r, geo).items()}))
