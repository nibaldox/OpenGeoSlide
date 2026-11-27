#!/usr/bin/env python3
"""Generate F3B input models; only files in cases_f3b/ are written."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def read_model(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))["model"]


# Piezometric lines of the wet Hoek-Brown models: 2 m under the ground at every vertex of its profile, over the whole
# width of the model. The line of X23 §4 (from -2 to 8 m) is under every critical surface: cSlope and ogs give the same FS
# with and without it (X23 §4.2, X28 §5), so it would not exercise the water at all. These lines wet the bases.
PIEZOMETRIC = {
    'SA': [[-40, -2], [0, -2], [5.7735, 8], [10.7735, 8], [16.547, 18], [21.547, 18], [27.3205, 28],
           [32.3205, 28], [72.3205, 28]],
    'SB': [[-40, -2], [0, -2], [3.6397, 8], [8.6397, 8], [12.2794, 18], [17.2794, 18], [57.2794, 18]],
}

# The circle of SB (X23 §4.2) enters the terrain at 84,5° from the horizontal. cSlope declares Spencer without solution on
# a nearly vertical entry ("No valid slip surface was found ... enters the slope at 85°: cohesion along a nearly vertical
# base can only hold it with tension at the base") and flags the Bishop FS as unreliable (steep-entry-tension). It is
# a badly chosen circle for a differential check, not a limit of the product: models 07 and 08 use instead the circle
# that cSlope finds with Bishop in a search over the same model, which enters at 68,8° and 68,6° and has a solution
# with every method. Model 06 keeps the circle of SB (Bishop and Spencer converge in cSlope). Model 02 keeps it too, as
# the row of F6.8, with Spencer explained by E16t.
CIRCLES = {7: (-17.081603792975912, 33.65278020556687, 37.739522331730406),
           8: (-17.635179996821776, 33.97019760716269, 38.274719955832644)}


def models() -> list[dict]:
    rows = []
    # Original X23 geometries and their exact circles, plus six independent parameter sets.
    for i, (shape, ucs, gsi, mi, disturbance, wet) in enumerate([
        ("SA", 12000, 25, 8, 0.7, False),
        ("SB", 15000, 40, 10, 0.5, True),
        ("SA", 8000, 20, 6, 1.0, False),
        ("SA", 20000, 35, 10, 0.0, True),
        ("SA", 18000, 30, 9, 0.3, False),
        ("SB", 10000, 30, 8, 0.8, True),
        ("SB", 18000, 38, 10, 0.0, False),
        ("SB", 25000, 45, 10, 1.0, True),
    ], 1):
        model = read_model(f"docs/fase3/exploracion/X28_filas/X28-F-{shape}.json")
        model['meta'] = {'id': f'F3B-HB-{i:02d}', 'title': f'Rajo {shape}, Hoek-Brown {i}'}
        model['materials'][0].update(ucs=ucs, gsi=gsi, mi=mi, disturbance=disturbance)
        model['analysis']['methods'] = ['bishop', 'spencer']
        model['analysis']['search'] = {'type': 'circular_entry_exit'}
        if i in CIRCLES:
            xc, yc, radius = CIRCLES[i]
            model['analysis']['surface'] = {'type': 'circle', 'xc': xc, 'yc': yc, 'r': radius}
        if wet and i == 2:
            # SB exactly as in X23 §4.2, with its own line (no effect on any surface: X23, X28 §5).
            model['water'] = {'unit_weight': 9.807, 'piezometric_line': [[-40, -2], [0, -2], [15, 5], [30, 8], [50, 8]]}
        elif wet:
            model['materials'][0]['unit_weight_sat'] = model['materials'][0]['unit_weight']
            model['water'] = {'unit_weight': 9.807, 'piezometric_line': PIEZOMETRIC[shape]}
        rows.append(model)
    for suffix, src in (('OCR1', 'seco-ocr1'), ('POP', 'seco-pop10')):
        model = read_model(f'docs/fase3/exploracion/X30_filas/X30-F-V047a-{src}.json')
        model['meta'] = {'id': f'F3B-SH-{suffix}', 'title': f'V047a SHANSEP {suffix}'}
        model['analysis']['methods'] = ['bishop', 'spencer']
        model['analysis']['search'] = {'type': 'circular_entry_exit'}
        rows.append(model)
    for cid, idx in (('V001', 4), ('V034a', 2)):
        model = read_model(f'docs/fase3/exploracion/X29_filas/{cid}-k{idx}.json')
        model['meta'] = {'id': f'F3B-NC-{cid}', 'title': f'{cid}, búsqueda no circular'}
        model['analysis']['methods'] = ['spencer']
        # E16z: `analysis.interslice` requires morgenstern_price in the methods; the CLI refuses it with only Spencer
        # (cSlope's Spencer is its constant function anyway, see to_cslope.py). The row carried it from the X29 model.
        model['analysis'].pop('interslice', None)
        rows.append(model)
    return rows


def main():
    directory = HERE / 'cases_f3b'
    directory.mkdir(exist_ok=True)
    for model in models():
        (directory / (model['meta']['id'] + '.ogs.json')).write_text(
            json.dumps(model, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{len(models())} modelos F3B')


if __name__ == '__main__':
    main()
