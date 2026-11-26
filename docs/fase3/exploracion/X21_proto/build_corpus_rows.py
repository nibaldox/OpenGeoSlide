"""Construye las filas del corpus (casos V0xx de cSlope, ya medidos en X18) como documentos ogs con los campos de v0.5.

Necesita shapely: env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python build_corpus_rows.py"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import from_cslope as fc

OUT = os.environ.get("X21_OUT", os.path.join(os.environ.get("TMPDIR", "/tmp"), "f3g-x21"))
os.makedirs(f"{OUT}/rows", exist_ok=True)
ROWS = {}


def put(rid, case, check=0, mutate=None, slices=50):
    m = fc.convert(fc.load_case(case), check=check, slices=slices)
    if mutate:
        mutate(m)
    m["meta"]["id"] = rid
    ROWS[rid] = m


def crack_water(w):
    def f(m):
        m["analysis"]["tension_crack"]["water"] = w
    return f


def no_crack(m):
    m["analysis"].pop("tension_crack", None)


def no_free(m):
    (m.get("water") or {}).pop("free_water", None)


# agua embalsada (sin grieta), círculos fijos del corpus
for cid in ("V089", "V091", "V023", "V024", "V042", "V061", "V087", "V092"):
    try:
        put(f"X21-CP-{cid}", cid, 0)
    except Exception as e:             # noqa: BLE001
        print("sin fila", cid, repr(e)[:100])
# grieta de tracción
for w in (0.0, 0.25, 0.5, 1.0):
    put(f"X21-CP-V079-w{int(w*100):03d}", "V079", 0, crack_water(w))
put("X21-CP-V079-w000-sincrack", "V079", 0, no_crack)


def depth(d):
    def f(m):
        m["analysis"]["tension_crack"]["depth"] = d
        m["analysis"]["tension_crack"]["water"] = 0.0
    return f


put("X21-CP-V079-d05", "V079", 0, depth(5.0))
put("X21-CP-V079-d10", "V079", 0, depth(10.0))
put("X21-CP-V080", "V080", 0)
put("X21-CP-V096c", "V096c", 1)
put("X21-CP-V088", "V088", 0)
put("X21-CP-V072a", "V072a", 0)
put("X21-CP-V082a", "V082a", 0)
# grieta y agua embalsada juntas
put("X21-CP-V009a", "V009a", 0)
put("X21-CP-V009b", "V009b", 0)
for rid, m in ROWS.items():
    json.dump(m, open(f"{OUT}/rows/{rid}.json", "w"), indent=1)
print(len(ROWS), "filas", sorted(ROWS))
