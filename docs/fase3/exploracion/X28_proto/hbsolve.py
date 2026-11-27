"""X28: punto fijo de Hoek-Brown sobre las dovelas del motor (lazo exterior de X27 §1.4, opción A).

Flujo por método (réplica del lazo de cSlope, solvers.rs:2050-2134, commit 0f07e7a):
  1. el motor (0.4.0, material MC de reemplazo con el mismo γ y ru) da geometría, pesos, u y agua por dovela;
  2. estado inicial: σ'n0 = γ·max(0, y_terreno − y_base)·cos²α (en el centro de la dovela), c y tanφ = tangente;
  3. pasada: el método resuelve F con (c, tanφ) de cada dovela; si |F − F_ant| <= tol·|F| -> convergido;
     si pasadas >= máx -> no convergido; si no, σ'n = N'/l con N' del método en su F (Janbu: F0), y
     c <- c + w(c_T − c), tanφ <- tanφ + w(tanφ_T − tanφ), con w = 0,5 (cSlope: promedio con el valor anterior).
Solo biblioteca estándar salvo `engine` (lanza ogs) y `solvers`/`equilibrium` (copias de X21_proto).
"""
from __future__ import annotations
import copy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, solvers, equilibrium, hb

METHODS = ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"]


def prepare(engine_slices):
    """Dovela del motor -> dict con los campos que usan solvers/equilibrium (V, H, Mb, Dx del motor)."""
    out = []
    for e in engine_slices:
        d = dict(e)
        d["V"], d["H"], d["Mb"], d["Dx"] = e.get("weight_extra", 0.0), e.get("h_force", 0.0), \
            e.get("h_moment_base", 0.0), e.get("driving_extra", 0.0)
        d["y_base_mid"] = 0.5 * (e["y_base_left"] + e["y_base_right"])
        d["raw"] = {"V": 0.0, "VM": 0.0, "H": 0.0, "HY": 0.0}
        out.append(d)
    return out


def engine_slices(doc, method="bishop"):
    """Lanza ogs analyze (documento MC de reemplazo) y devuelve las dovelas del motor de `method`."""
    res = engine.engine_results(doc)
    r = res.get(method) or next(iter(res.values()))
    return r["slices"], {k: v["fos"] for k, v in res.items()}


def gamma_of(doc):
    return float(doc["materials"][0]["unit_weight"])


def _Fof(sl, method):
    """Devuelve (F reportado, F para N', λ). Janbu corregido: F reportado = fc·F0, N' en F0 (como cSlope)."""
    if method == "bishop":
        f = solvers.bishop(sl)
        return f, f, None
    if method == "janbu_simplified":
        f0 = solvers.janbu_f0(sl)
        return (None, None, None) if f0 is None else (f0, f0, 0.0)
    if method == "janbu_corrected":
        f0 = solvers.janbu_f0(sl)
        if f0 is None:
            return None, None, None
        fc, _ = solvers.janbu_correction(sl)
        return fc * f0, f0, 0.0
    if method in ("spencer", "morgenstern_price"):
        import mpclosest                      # regla de par más cercano de cSlope (X28 §2)
        f, lam, _ = mpclosest.mp_closest(sl)
        return (None, None, None) if f is None else (f, f, lam)
    raise ValueError(method)


def nprime(sl, method, f, lam):
    """N' por dovela (kN/m) en el F del método. N' = N − u·l (equilibrium._forces, validado en X21)."""
    if method == "bishop":
        ns = equilibrium._forces(sl, f, 0.0, None, "bishop")
    else:
        e = solvers.interslice(sl, f, lam or 0.0)
        ns = equilibrium._forces(sl, f, lam or 0.0, e, "janbu")
    return [n - s["pore_pressure"] * s["base_length"] for (n, _), s in zip(ns, sl)]


def set_initial(sl, gamma, p, rule):
    for s in sl:
        dy = max(0.0, s["y_top_mid"] - s["y_base_mid"])
        sn0 = gamma * dy * math.cos(s["alpha"]) ** 2
        s["sn0"] = sn0
        s["cohesion"], s["tan_phi"] = hb.tangent(p, sn0, rule)


def solve(sl0, method, p, gamma, rule="cslope", tol=1e-4, max_pass=30, w=0.5, keep_hist=True, init=None):
    """Punto fijo para un método y una superficie fija. Devuelve dict con F, pasadas, estado y historia."""
    sl = copy.deepcopy(sl0)
    if init == "sn0_zero":                 # arranque sin estimación (σ'n0 = 0 en todas)
        for s in sl:
            s["cohesion"], s["tan_phi"] = hb.tangent(p, 0.0, rule)
    else:
        set_initial(sl, gamma, p, rule)
    hist = []
    last = None
    npass = 0
    status = None
    F = None
    while True:
        Frep, Fn, lam = _Fof(sl, method)
        if Frep is None:
            status = "no_solution"            # F = None: el método no da solución en esta pasada (no se reutiliza la anterior)
            F = None
            break
        F = Frep
        if keep_hist:
            hist.append({"F": Frep, "lam": lam})
        if last is not None and abs(Frep - last) <= tol * abs(Frep):
            status = "converged"
            break
        if npass >= max_pass:
            status = "not_converged"
            break
        last = Frep
        Np = nprime(sl, method, Fn, lam)
        for s, N in zip(sl, Np):
            sn = N / s["base_length"]
            s["sn_last"] = sn
            cT, tT = hb.tangent(p, sn, rule)
            s["cohesion"] = s["cohesion"] + w * (cT - s["cohesion"])
            s["tan_phi"] = s["tan_phi"] + w * (tT - s["tan_phi"])
        npass += 1
    return {"method": method, "F": F, "status": status, "passes": npass, "analyses": npass + 1,
            "lam": lam, "slices": sl, "hist": hist if keep_hist else None, "tol": tol, "w": w, "rule": rule}


def solve_all(sl0, gamma, p, rule="cslope", tol=1e-4, max_pass=30, w=0.5, methods=METHODS, **kw):
    return {m: solve(sl0, m, p, gamma, rule=rule, tol=tol, max_pass=max_pass, w=w, **kw) for m in methods}


def final_state_check(res, p, rule="cslope"):
    """Equilibrio global con las c y φ finales (equilibrium.check) y la regla del estado final."""
    sl = res["slices"]
    return equilibrium.check(sl, {res["method"]: res["F"], "lambda": res["lam"],
                                   "spencer": res["F"], "janbu_simplified": res["F"],
                                   "bishop": res["F"]}, -1, None)
