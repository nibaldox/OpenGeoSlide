"""Diagnóstico por caso (D-1). Recalcula en Python, de forma independiente del solver, a partir de las dovelas que
emite el motor: marcha de E, cierre, momento respecto de dos puntos, N', m_alpha, curva de raíces."""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import gen_cases as g
import numpy as np

def slices_of(points, variant="two", method="spencer", extra=None):
    m = g.model(points, variant, (method,) if method != "morgenstern_price" else (method,))
    r = g.ogs_run(m)[0]
    return r

def march(S, F, lam):
    """E[0..n] con la recurrencia de Spencer (f=1), X=lam*E. S: lista de dovelas (dict)."""
    E = [0.0]
    for s in S:
        if s["weight"] == 0.0 and s["cohesion"] == 0 and s["tan_phi"] == 0:
            E.append(E[-1]); continue
        a = s["alpha"]; sn, cs = math.sin(a), math.cos(a); tp = s["tan_phi"]
        W = s["weight"] + s["weight_extra"]; l = s["base_length"]; U = s["pore_pressure"] * l
        D = (sn - lam * cs) * tp + (cs + lam * sn) * F
        R = (W * cs - U) * tp + s["cohesion"] * l
        E.append(E[-1] + (F * W * sn - R) / D)
    return E

def Nprime(S, F, lam, E):
    out = []
    for k, s in enumerate(S):
        a = s["alpha"]; sn, cs = math.sin(a), math.cos(a)
        W = s["weight"] + s["weight_extra"]; U = s["pore_pressure"] * s["base_length"]
        out.append(W * cs - U + (sn - lam * cs) * (E[k + 1] - E[k]))
    return out

def mom_residual(S, F, lam):
    E = march(S, F, lam)
    return sum(s["width"] * (E[k] + E[k + 1]) * (math.tan(s["alpha"]) - lam) for k, s in enumerate(S)), E

def f_root(S, lam, F0):
    """raíces F de E_n(F, lam)=0 en una malla geométrica; devuelve lista ascendente."""
    Fs = np.geomspace(0.05, 1000, 4000); vals = []
    for F in Fs:
        E = march(S, F, lam); vals.append(E[-1])
    roots = []
    for i in range(len(Fs) - 1):
        if np.isfinite(vals[i]) and np.isfinite(vals[i+1]) and vals[i] * vals[i+1] < 0:
            lo, hi = Fs[i], Fs[i+1]
            for _ in range(80):
                mid = 0.5*(lo+hi); em = march(S, mid, lam)[-1]
                if em * march(S, lo, lam)[-1] <= 0: hi = mid
                else: lo = mid
            roots.append(0.5*(lo+hi))
    return roots

def ground(x): return g.ground(x)

def thrust_line(S, E, lam):
    """Línea de empuje y_t en cada cara (cara k+1 = x_left de la dovela k, marco del modelo con la cresta a -x), por equilibrio de
    momentos de cada dovela respecto del punto medio de su base. Marco del contrato (cresta a +x): espejo x -> -x.
    (b/2)(X_k+X_{k+1}) - (yR-ym) E_{k+1} + (yL-ym) E_k - W d = 0, d = xc - xm en el marco espejado (peso a su centroide
    trapezoidal). E>0 tracción, X = lam*E. La cara 0 (pie) tiene E=0: sin posición."""
    n = len(S); X = [lam * e for e in E]; yt = [None] * (n + 1)
    for k, s in enumerate(S):
        b = s["width"]; ym = 0.5 * (s["y_base_left"] + s["y_base_right"])
        hl = ground(s["x_left"]) - s["y_base_left"]; hr = ground(s["x_right"]) - s["y_base_right"]
        d_model = b * (hr - hl) / (6 * (hr + hl)) if hr + hl > 1e-12 else 0.0
        W = s["weight"] + s["weight_extra"]
        if abs(E[k + 1]) < 1e-12: continue
        yL = yt[k] if (yt[k] is not None) else 0.0
        yt[k + 1] = ym + (0.5 * b * (X[k] + X[k + 1]) + (yL - ym) * E[k] + W * d_model) / E[k + 1]
    return yt

def face_geometry(S):
    """(y_base, y_ground) en cada cara 1..n (x_left de cada dovela)."""
    return [(s["y_base_left"], ground(s["x_left"])) for s in S]

def metrics(S, F, lam, emin=0.02, phi_c=None):
    E = march(S, F, lam); N = Nprime(S, F, lam, E); yt = thrust_line(S, E, lam)
    Emax = max(abs(e) for e in E); n = len(S)
    out = {"F": F, "lam": lam, "closure": E[-1], "Emax": Emax, "Ecomp": min(E), "Eten": max(E)}
    W = sum(s["weight"] for s in S); out["sumW"] = W
    out["Nneg"] = sum(-x for x in N if x < 0) / W
    # línea de empuje fuera de la masa
    viol = []; nviol = 0; ncheck = 0; maxexc = 0.0
    for k in range(n):
        y = yt[k + 1]
        if y is None or abs(E[k + 1]) < emin * Emax: continue
        yb = S[k]["y_base_left"]; yg = ground(S[k]["x_left"]); h = yg - yb
        if h < 1e-6: continue
        ncheck += 1
        exc = max(yb - y, y - yg, 0.0)
        if exc > 1e-6 * max(1.0, h): nviol += 1
        maxexc = max(maxexc, exc / h)
    out["thr_checked"] = ncheck; out["thr_out"] = nviol; out["thr_maxexc_rel"] = maxexc
    # utilización de la resistencia de la cara vertical (suelo homogéneo)
    if phi_c:
        c, tphi = phi_c; ut = 0.0
        for k in range(n):
            yb = S[k]["y_base_left"]; yg = ground(S[k]["x_left"]); h = max(yg - yb, 0.0)
            Ec = max(-E[k + 1], 0.0); cap = c * h + Ec * tphi
            if abs(E[k + 1]) < emin * Emax: continue
            ut = max(ut, abs(lam * E[k + 1]) / cap if cap > 0 else float("inf"))
        out["face_util_max"] = ut
    return out
