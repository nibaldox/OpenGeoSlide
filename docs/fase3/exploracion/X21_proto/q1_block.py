"""Pregunta 1: qué se quita con la grieta y si el peso del bloque entre la cara y el arco se conserva. Stdlib + engine + oráculo ya
calculado (resultados.json). Alternativa medida: el bloque quitado se deja como sobrecarga vertical sobre la dovela de la cara."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import proto, rows_def
D = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "X21_filas", "resultados.json")))
for rid, fn in (("X21-C20", None), ("X21-C30", None), ("X21-W100", None)):
    m = rows_def.ROWS[rid]
    out, info = proto.analyze(m, equilibrium_check=False)
    rem = info["removed_slices"]
    wrem = info["removed_weight"]
    def hook(sl, w=wrem):
        sl[-1]["V"] += w                     # alternativa: el peso del bloque quitado pesa sobre la dovela de la cara
    alt, _ = proto.analyze(m, equilibrium_check=False, slice_hook=hook)
    o = D[rid]["oraculo"]
    print(rid, f"x_cara = {info['crack_x']:.4f}, profundidad {info['crack_depth']}, dovelas quitadas {info['n_removed']} (de {info['n_removed'] + info['n_slices']}),",
          f"peso quitado {wrem:.3f} kN/m, ancho {sum(d['width'] for d in rem):.3f} m")
    print("   FS Spencer: oráculo %.6f | prototipo (bloque quitado) %.6f | alternativa (peso conservado como carga) %.6f (%+.1f %%)" % (
        o["spencer"]["fos"], out["spencer"], alt["spencer"], (alt["spencer"] / o["spencer"]["fos"] - 1) * 100))
