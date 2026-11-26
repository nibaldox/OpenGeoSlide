# Genera los modelos de prueba de U6-G (imperiales con y sin γw, y un modelo completo con cargas, sismo, γsat, ru y piezométrica corta).
# Uso: env -u PYTHONPATH -u PYTHONHOME python3 make_fixtures.py <directorio de salida>
import copy, json, sys
from pathlib import Path

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
src = json.loads(Path(__file__).resolve().parents[4].joinpath('verification/cases/V047a.json').read_text())['model']
FT, PCF, PSF, LBF_FT = 1 / 0.3048, 6.365880, 20.885434, 68.521766

def imperial(model):
    m = copy.deepcopy(model)
    m['units'] = 'imperial'
    for r in m['regions']:
        r['polygon'] = [[x * FT, y * FT] for x, y in r['polygon']]
    for mat in m['materials']:
        mat['unit_weight'] *= PCF; mat['cohesion'] *= PSF
        if mat.get('unit_weight_sat'): mat['unit_weight_sat'] *= PCF
    return m

def with_piezo(m, gw=None, units=None):
    m = copy.deepcopy(m)
    xs = [p[0] for r in m['regions'] for p in r['polygon']]
    m['water'] = {'piezometric_line': [[min(xs), 24 * FT], [max(xs), 32 * FT]]}
    if gw is not None: m['water']['unit_weight'] = gw
    if units: m['units'] = units
    return m

base = imperial(src)
files = {
    'imp_nogw': with_piezo(base),
    'imp_gw98': with_piezo(base, 9.8),
    'imp_gw980665': with_piezo(base, 9.80665),
    'imp_gw981': with_piezo(base, 9.81),
    'imp_Imperial_gw981': with_piezo(base, 9.81, 'Imperial'),
    'imp_gw624': with_piezo(base, 62.4),
    'imp_gw640': with_piezo(base, 64.0),
    'imp_dry': base,
}
for name, m in files.items():
    (out / f'{name}.ogs.json').write_text(json.dumps(m, indent=1))

# Modelo completo (v0.2): dos materiales, γsat < γ en la arcilla, ru en la roca, piezométrica corta, cargas, sismo; imperial y SI.
def full(imp):
    m = copy.deepcopy(src); m['version'] = '0.2'; m['meta'] = {'id': 'U6G', 'title': 'U6-G talud con cargas y sismo'}
    m['regions'] = [
        {'material': 'arcilla', 'polygon': [[30, 25], [50, 35], [70, 35], [70, 25]]},
        {'material': 'roca', 'polygon': [[20, 20], [20, 25], [30, 25], [70, 25], [70, 20]]},
    ]
    m['materials'] = [
        {'id': 'arcilla', 'name': 'Arcilla', 'model': 'mohr_coulomb', 'unit_weight': 20.0, 'unit_weight_sat': 19.0, 'cohesion': 12.0, 'friction_angle': 30.0},
        {'id': 'roca', 'name': 'Roca', 'model': 'mohr_coulomb', 'unit_weight': 24.0, 'cohesion': 60.0, 'friction_angle': 40.0, 'ru': 0.1},
    ]
    m['water'] = {'unit_weight': 9.81, 'piezometric_line': [[30, 24], [60, 28]]}
    m['loads'] = [{'type': 'udl', 'id': 'q1', 'x1': 52, 'x2': 66, 'q': 20.0}, {'type': 'line', 'id': 'p1', 'x': 58, 'p': 50.0, 'angle': 10.0}]
    m['analysis']['seismic'] = {'kh': 0.1, 'kv': 0.05}
    m['analysis']['search'] = {'type': 'circular_entry_exit', 'n_entry': 14, 'n_exit': 14, 'n_radius': 12, 'max_radius_factor': 5.0, 'min_width': None, 'refine': True}
    if imp:
        m['units'] = 'imperial'
        for r in m['regions']: r['polygon'] = [[x * FT, y * FT] for x, y in r['polygon']]
        for mat in m['materials']:
            mat['unit_weight'] *= PCF; mat['cohesion'] *= PSF
            if mat.get('unit_weight_sat'): mat['unit_weight_sat'] *= PCF
        m['water']['unit_weight'] = 62.4
        m['water']['piezometric_line'] = [[x * FT, y * FT] for x, y in m['water']['piezometric_line']]
        m['loads'][0].update(x1=52 * FT, x2=66 * FT, q=20.0 * PSF)
        m['loads'][1].update(x=58 * FT, p=50.0 * LBF_FT)
    else:
        m['units'] = 'SI'
    return m
(out / 'imp_full.ogs.json').write_text(json.dumps(full(True), indent=1))
(out / 'si_full.ogs.json').write_text(json.dumps(full(False), indent=1))
print(sorted(p.name for p in out.iterdir()))

# Modelo cuyo Bishop no converge (una sola iteración): para ver la superficie evaluada sin convergencia en Casos.
nc = json.loads(Path(__file__).resolve().parents[4].joinpath('verification/cases/V047a.json').read_text())['model']
nc['analysis'].pop('search', None)
nc['analysis']['surface'] = {'type': 'circle', 'xc': 45.0, 'yc': 50.0, 'r': 27.0}
nc['analysis']['methods'] = ['bishop']
nc['analysis']['max_iterations'] = 1
nc['analysis']['tolerance'] = 1e-9
(out / 'nc.ogs.json').write_text(json.dumps(nc, indent=1))
