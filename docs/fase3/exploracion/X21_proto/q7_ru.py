"""Preguntas 6 y 7: sismo sobre el agua y ru con agua embalsada. Necesita cslope:
  env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python q7_ru.py"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oracle, proto, rows_def
import cslope as cs

M = ("bishop", "spencer", "janbu_simplified", "janbu_corrected")


def oracle_ru(model, ru):
    """cSlope suma ru·σv a la presión de la línea de agua del material (la línea es el nivel del embalse)."""
    out = {}
    for meth in M:
        doc = oracle.build_doc(model, meth)
        doc["definition"]["materials"][0]["model"]["ru"] = ru
        out[meth] = cs.analyse(doc)["minFOS"]
    return out


def proto_ru(model, ru, conv):
    def hook(sl):
        for d in sl:
            v = d.get("raw", {}).get("V", 0.0)
            if conv == "cslope":          # u = u_piezométrica + ru·W/b (W solo suelo)
                d["pore_pressure"] += ru * d["weight"] / d["width"]
            elif conv == "slide2":        # ru reemplaza a la piezométrica, σv = suelo + agua embalsada
                d["pore_pressure"] = ru * (d["weight"] + v) / d["width"]
            elif conv == "motor":         # ru reemplaza a la piezométrica, σv = solo suelo (E14o-4 hoy)
                d["pore_pressure"] = ru * d["weight"] / d["width"]
    out, _ = proto.analyze(model, equilibrium_check=False, slice_hook=hook)
    return {k: out[k] for k in M}


res = {}
for level in (27.0, 30.0):
    for ru in (0.2,):
        m = rows_def.pond(level)
        o = oracle_ru(m, ru)
        row = {"oraculo_cslope(u=piezo+ru·W/b)": o}
        for conv in ("cslope", "slide2", "motor"):
            row[f"proto_{conv}"] = proto_ru(m, ru, conv)
        res[f"nivel{level}_ru{ru}"] = row
        print(f"nivel {level} ru {ru}")
        for k, v in row.items():
            print("  ", k, {a: round(b, 6) for a, b in v.items()})
        for meth in M:
            print("   dif proto_cslope vs oráculo %s: %+.4f %%" % (meth, (row["proto_cslope"][meth] / o[meth] - 1) * 100),
                  "| slide2 vs motor: %+.2f %%" % ((row["proto_slide2"][meth] / row["proto_motor"][meth] - 1) * 100))
# sismo sobre el agua: kh/kv multiplicando el agua (alternativa) frente al oráculo (P04..P06)
def alt_seismic(rid):
    m = rows_def.ROWS[rid]
    kh = m["analysis"]["seismic"]["kh"]
    kv = m["analysis"]["seismic"]["kv"]
    def hook(sl):
        for d in sl:
            v = d.get("raw", {}).get("V", 0.0)
            d["V"] += kv * v
            d["H"] += kh * v
            d["Mb"] += kh * v * 0.0
    out, _ = proto.analyze(m, equilibrium_check=False, slice_hook=hook)
    return out
sres = {}
for rid in ("X21-P04", "X21-P05", "X21-P06"):
    o = {k: oracle.run(rows_def.ROWS[rid], k)["fos"] for k in M}
    base, _ = proto.analyze(rows_def.ROWS[rid], equilibrium_check=False)
    alt = alt_seismic(rid)
    sres[rid] = {"oraculo": o, "proto_sin_sismo_en_agua": {k: base[k] for k in M}, "proto_sismo_multiplica_agua": {k: alt[k] for k in M}}
    print(rid, "oráculo", {k: round(v, 5) for k, v in o.items()})
    print("     proto (agua sin sismo)", {k: round(base[k], 5) for k in M}, "\n     proto (kh·V, kv·V sobre el agua)", {k: round(alt[k], 5) for k in M})
json.dump({"ru": res, "sismo": sres}, open(os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21", "q7_ru.json"), "w"), indent=1)
