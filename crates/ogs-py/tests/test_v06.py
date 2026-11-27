"""Formato v0.6 en el wheel: Hoek-Brown, SHANSEP, búsqueda no circular, las combinaciones de F6.5 y el informe nuevo.

Cada test usa el wheel instalado (no el código fuente) y las filas de referencia del repositorio:

- Hoek-Brown: ``docs/fase3/exploracion/X28_filas/`` (círculo fijo; el producto contra el prototipo de la envolvente
  completa de ``reglas_coordinador.json`` a 0,1 % (F6.8) y contra cSlope solo como cota: nunca por encima, E16q);
- SHANSEP: ``docs/fase3/exploracion/X30_filas/`` (círculo fijo contra cSlope 0.1.0 a 0,1 %, F6.9);
- búsqueda no circular: ``verification/cases/`` (V001-nc, V050b, V093-nc y V103).

Las salidas que se comprueban son las de F6.6: ``results[i]["strength"]`` (``passes`` y, por dovela, ``law``,
``normal_stress``, ``vertical_stress`` y ``ocr``) y ``results[i]["search"]["non_circular"]`` (``seeds``, ``evaluated``,
``seed_fos`` y ``polyline_fos``).
"""

import copy
import json
import math
from functools import lru_cache
from pathlib import Path

import pytest
import opengeoslide

ROOT = Path(__file__).resolve().parents[3]
X28 = ROOT / 'docs/fase3/exploracion/X28_filas'
X30 = ROOT / 'docs/fase3/exploracion/X30_filas'
CASES = ROOT / 'verification/cases'

METHODS = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected']
HB_MODELS = {'X25': 'X28-F-X25', 'HAM1': 'X28-F-HAM1', 'SA': 'X28-F-SA', 'SB': 'X28-F-SB'}
TOLERANCE = 1e-3  # 0,1 %, la de F6.8 y F6.9


# ---------------------------------------------------------------------------------------------- utilidades


def load_row(directory, name):
    return json.loads((directory / f'{name}.json').read_text())


def hb_model(key='X28-F-SA', methods=None, constant=True):
    """Una fila de Hoek-Brown de X28. M-P va con la función constante (= Spencer), la del oráculo y del prototipo.

    ``analysis.interslice`` (versión 0.3) solo se escribe si M-P está entre los métodos; ``constant=False`` no lo escribe.
    """
    model = load_row(X28, key)['model']
    if methods is not None:
        model['analysis']['methods'] = list(methods)
    if constant and 'morgenstern_price' in model['analysis']['methods']:
        model['analysis']['interslice'] = {'function': 'constant'}
    return model


def shansep_model(**shansep):
    """V047a seco con SHANSEP; ``shansep`` reemplaza la fuente de OCR y los campos que se indiquen."""
    model = load_row(X30, 'X30-F-V047a-seco-ocr1.5')['model']
    spec = model['materials'][0]['shansep']
    if shansep:
        for source in ('ocr', 'pop', 'ocr_by_elevation'):
            spec.pop(source, None)
        spec.update(shansep)
    return model


def with_pile_ito_matsui(model):
    model = copy.deepcopy(model)
    model['reinforcements'] = [
        {
            'type': 'pile', 'id': 'p1', 'x1': 20.0, 'y1': 25.0, 'x2': 20.0, 'y2': 15.0, 'spacing': 3.0,
            'direction': 'perpendicular', 'application': 'passive',
            'lateral_pressure': {'model': 'ito_matsui', 'diameter': 0.5, 'location': 'centroid'},
        }
    ]
    return model


def by_method(report):
    return {result['method']: result for result in report['results']}


def error_of(model):
    with pytest.raises(ValueError) as exc:
        opengeoslide.analyze(model)
    return str(exc.value)


def mirrored(model):
    """El modelo reflejado en x (x → −x) con la dirección del talud invertida; el FS no cambia."""
    out = copy.deepcopy(model)
    for region in out['regions']:
        region['polygon'] = [[-x, y] for x, y in region['polygon']][::-1]
    surface = out['analysis']['surface']
    surface['xc'] = -surface['xc']
    out['slope']['direction'] = 'left_to_right'
    if 'water' in out:
        out['water']['piezometric_line'] = [[-x, y] for x, y in out['water']['piezometric_line']][::-1]
    return out


@lru_cache(maxsize=None)
def cached(key):
    """Informe de una fila X28 (``hb:<clave>``), X30 (``sh:<clave>``) o de un caso (``case:<id>``)."""
    kind, name = key.split(':', 1)
    if kind == 'hb':
        model = hb_model(name)
    elif kind == 'sh':
        model = load_row(X30, name)['model']
    else:
        model = json.loads((CASES / f'{name}.json').read_text())['model']
    return opengeoslide.analyze(model)


def relative(value, reference):
    return (value - reference) / reference


# ---------------------------------------------------------------------------------------------- puertas de versión


@pytest.mark.parametrize('version', ['0.1', '0.2', '0.3', '0.4', '0.5'])
def test_hoek_brown_requires_version_06(version):
    model = hb_model('X28-F-HAM1', ['bishop'], constant=False)
    model['version'] = version
    assert 'materials[0].model = "hoek_brown" requiere version "0.6"' in error_of(model)


@pytest.mark.parametrize('version', ['0.4', '0.5'])
def test_shansep_requires_version_06(version):
    model = shansep_model()
    model['version'] = version
    assert 'materials[0].model = "shansep" requiere version "0.6"' in error_of(model)


@pytest.mark.parametrize('version', ['0.4', '0.5'])
def test_non_circular_requires_version_06(version):
    model = json.loads((CASES / 'V001-nc.json').read_text())['model']
    model['version'] = version
    assert 'analysis.search.non_circular requiere version "0.6"' in error_of(model)


def test_unknown_version_names_supported_versions():
    model = hb_model('X28-F-HAM1', ['bishop'], constant=False)
    model['version'] = '0.7'
    message = error_of(model)
    for version in ('0.1', '0.2', '0.3', '0.4', '0.5', '0.6'):
        assert version in message


def test_version_06_changes_nothing_for_a_model_without_v06_fields():
    """F6.1: sin campos v0.6, declarar la 0.6 no cambia la salida."""
    model = json.loads((CASES / 'V037.json').read_text())['model']
    assert model['version'] == '0.4'
    model['analysis']['search'].update(n_entry=5, n_exit=5, n_radius=5, refine=False)
    old = opengeoslide.analyze(model)
    model['version'] = '0.6'
    new = opengeoslide.analyze(model)
    assert new == old
    for result in new['results']:
        assert 'strength' not in result
        assert 'non_circular' not in result['search']


# ---------------------------------------------------------------------------------------------- Hoek-Brown


@pytest.mark.parametrize('name', HB_MODELS)
def test_hoek_brown_matches_the_full_envelope_prototype(name):
    """F6.8: producto contra el prototipo de la envolvente completa (convergencia total), 0,1 % en los cinco métodos."""
    reference = json.loads((X28 / 'reglas_coordinador.json').read_text())[name]
    results = by_method(cached(f'hb:{HB_MODELS[name]}'))
    for method in METHODS:
        result = results[method]
        assert result['status'] == 'converged', (name, method, result['status'], result['warnings'])
        expected = reference[method]['cut/1e-08/w0.5'][0]
        assert abs(relative(result['fos'], expected)) <= TOLERANCE, (name, method, result['fos'], expected)


@pytest.mark.parametrize('name', HB_MODELS)
def test_hoek_brown_never_exceeds_the_cslope_oracle(name):
    """E16q: la envolvente completa nunca sobreestima la resistencia, así que el FS no queda sobre el de cSlope."""
    row = load_row(X28, HB_MODELS[name])
    results = by_method(cached(f'hb:{HB_MODELS[name]}'))
    for method in METHODS:
        assert relative(results[method]['fos'], row['oracle'][method]) <= TOLERANCE, (name, method)


@pytest.mark.parametrize('name', HB_MODELS)
def test_hoek_brown_reports_the_loop_and_the_rock_slices(name):
    """F6.6: ``strength.passes`` (1 a 50) y una entrada por dovela de roca con su σ′n."""
    for method, result in by_method(cached(f'hb:{HB_MODELS[name]}')).items():
        strength = result['strength']
        assert isinstance(strength['passes'], int) and 1 <= strength['passes'] <= 50, (method, strength['passes'])
        entries = strength['slices']
        assert len(entries) == len(result['slices']), 'todas las dovelas son de roca en estos modelos'
        assert [entry['index'] for entry in entries] == list(range(len(result['slices'])))
        for entry in entries:
            assert entry['law'] == 'hoek_brown'
            assert math.isfinite(entry['normal_stress'])
            assert 'vertical_stress' not in entry and 'ocr' not in entry
        for slice_ in result['slices']:  # (c, tanφ) con los que se calculó: nunca negativos
            assert slice_['cohesion'] >= 0.0 and slice_['tan_phi'] >= 0.0


def test_hoek_brown_low_confinement_note_comes_once_per_method():
    """F6.7: en SA hay dovelas con σ′n bajo la regla de F6.8; la nota informativa sale una vez por método."""
    for result in cached('hb:X28-F-SA')['results']:
        assert result['warnings'].count('hoek_brown_low_confinement') == 1, result['method']


def test_hoek_brown_mirror_gives_the_same_fos():
    """F6.11: el modelo reflejado da el mismo FS y las mismas pasadas."""
    base = hb_model('X28-F-SA')
    original = by_method(opengeoslide.analyze(base))
    mirror = by_method(opengeoslide.analyze(mirrored(base)))
    for method in METHODS:
        assert mirror[method]['fos'] == pytest.approx(original[method]['fos'], rel=1e-9)
        assert mirror[method]['strength']['passes'] == original[method]['strength']['passes']


def test_hoek_brown_is_monotonic_in_gsi():
    """Más GSI, más resistencia: el FS sube en los cinco métodos."""
    previous = {}
    for gsi in (20.0, 25.0, 35.0):
        model = hb_model('X28-F-SA')
        model['materials'][0]['gsi'] = gsi
        results = by_method(opengeoslide.analyze(model))
        for method in METHODS:
            assert results[method]['status'] == 'converged'
            if method in previous:
                assert results[method]['fos'] > previous[method], (method, gsi)
            previous[method] = results[method]['fos']


def test_hoek_brown_seismic_enters_through_the_normal_stress():
    """F6.5: con sismo, Hoek-Brown no cambia de forma (el sismo entra por N′) y el FS baja."""
    quiet = by_method(opengeoslide.analyze(hb_model('X28-F-SA')))
    model = hb_model('X28-F-SA')
    model['analysis']['seismic'] = {'kh': 0.05, 'kv': 0.0}
    shaken = by_method(opengeoslide.analyze(model))
    for method in METHODS:
        assert shaken[method]['status'] == 'converged'
        assert shaken[method]['fos'] < quiet[method]['fos']


def test_hoek_brown_is_invariant_between_si_and_imperial():
    """El FS y las pasadas no dependen del sistema de unidades (longitud, peso unitario y UCS convertidos)."""
    m_to_ft, kn_m3_to_pcf, kpa_to_psf = 3.280839895013123, 6.365882, 20.885434233
    si = hb_model('X28-F-SA')
    imperial = copy.deepcopy(si)
    imperial['units'] = 'imperial'
    material = imperial['materials'][0]
    material['unit_weight'] *= kn_m3_to_pcf
    material['ucs'] *= kpa_to_psf
    for region in imperial['regions']:
        region['polygon'] = [[x * m_to_ft, y * m_to_ft] for x, y in region['polygon']]
    for key in ('xc', 'yc', 'r'):
        imperial['analysis']['surface'][key] *= m_to_ft
    a, b = by_method(opengeoslide.analyze(si)), by_method(opengeoslide.analyze(imperial))
    for method in METHODS:
        assert b[method]['fos'] == pytest.approx(a[method]['fos'], rel=1e-5)
        assert b[method]['strength']['passes'] == a[method]['strength']['passes']


def test_hoek_brown_without_a_fos_does_not_invent_one():
    """X28-R-SB-RU03 (ru = 0,3 sobre roca débil): un método sin raíz no devuelve FS «convergido» ni valores no finitos."""
    report = opengeoslide.analyze(load_row(X28, 'X28-R-SB-RU03')['model'])
    for result in report['results']:
        if result['status'] == 'converged':
            assert result['fos'] is not None and math.isfinite(result['fos']) and result['fos'] > 0
        else:
            assert result['status'] in ('invalid', 'not_converged')
            assert result['warnings']
    json.dumps(report, allow_nan=False)


@pytest.mark.parametrize('key', ['X28-R-X25-RU03', 'X28-W-SB-LINEA16'])
def test_hoek_brown_with_pore_pressure_converges_on_the_water_rows(key):
    """Filas con agua de X28 (``ru`` en X25, piezométrica en SB): convergen y quedan dentro de 5 % bajo cSlope."""
    row = load_row(X28, key)
    results = by_method(opengeoslide.analyze(row['model']))
    for method in ('bishop', 'janbu_simplified', 'janbu_corrected'):
        result = results[method]
        assert result['status'] == 'converged', (key, method, result['warnings'])
        assert result['strength']['passes'] >= 1
        assert -0.05 < relative(result['fos'], row['oracle'][method]) <= TOLERANCE, (key, method)


# ---------------------------------------------------------------------------------------------- SHANSEP


SHANSEP_ROWS = [
    'X30-F-V047a-seco-ocr1', 'X30-F-V047a-seco-ocr1.5', 'X30-F-V047a-seco-pop10', 'X30-F-V047a-seco-ocrbyelev',
    'X30-F-V047a-humedo-ocr1', 'X30-F-V047a-humedo-ocr1.5', 'X30-F-V047a-humedo-pop10',
    'X30-F-V047a-humedo-ocrbyelev', 'X30-F-carga-udl', 'X30-F-carga-line', 'X30-F-sismo-kh0.1',
    'X30-F-sismo-kv0.1', 'X30-S-V047a-profundo',
]


@pytest.mark.parametrize('name', SHANSEP_ROWS)
def test_shansep_matches_cslope_in_every_method_of_the_row(name):
    """F6.9: círculo fijo contra cSlope 0.1.0 a 0,1 % (medido ≤ 0,023 %), en los métodos que trae la fila."""
    row = load_row(X30, name)
    results = by_method(cached(f'sh:{name}'))
    checked = [method for method in METHODS if method in row['oracle']]
    assert checked, name
    for method in checked:
        assert results[method]['status'] == 'converged', (name, method)
        assert abs(relative(results[method]['fos'], row['oracle'][method])) <= TOLERANCE, (name, method)


def test_shansep_row_with_above_water_stays_outside_the_format():
    """X30-F-V105a usa ``aboveWater`` de cSlope: no es del formato v0.6 (F6.3) y el motor lo rechaza."""
    assert 'above_water' in error_of(load_row(X30, 'X30-F-V105a')['model'])


def test_shansep_report_has_the_stresses_and_no_loop_passes():
    """F6.6: una entrada por dovela con ``vertical_stress`` y ``ocr``; sin Hoek-Brown no hay ``passes``."""
    for result in cached('sh:X30-F-V047a-seco-ocr1.5')['results']:
        strength = result['strength']
        assert 'passes' not in strength
        assert len(strength['slices']) == len(result['slices'])
        for entry in strength['slices']:
            assert entry['law'] == 'shansep'
            assert 'normal_stress' not in entry
            assert entry['ocr'] == pytest.approx(1.5)
            assert math.isfinite(entry['vertical_stress']) and entry['vertical_stress'] > 0


def test_shansep_strength_is_su_with_zero_friction():
    """Su = S·σ′v·OCR^m por dovela, en ``slices`` como cohesión, con tanφ = 0."""
    result = by_method(cached('sh:X30-F-V047a-seco-ocr1.5'))['bishop']
    for entry in result['strength']['slices']:
        slice_ = result['slices'][entry['index']]
        assert slice_['tan_phi'] == 0.0
        assert slice_['cohesion'] == pytest.approx(0.25 * entry['vertical_stress'] * 1.5**0.8, rel=1e-9)


def test_shansep_exponent_defaults_to_0_8():
    explicit = opengeoslide.analyze(shansep_model())
    model = shansep_model()
    del model['materials'][0]['shansep']['exponent']
    assert opengeoslide.analyze(model)['results'] == explicit['results']


def test_shansep_pop_gives_ocr_from_the_vertical_stress():
    """``pop``: OCR = (σ′v + pop)/σ′v."""
    result = opengeoslide.analyze(shansep_model(ratio=0.25, pop=10.0))['results'][0]
    for entry in result['strength']['slices']:
        assert entry['ocr'] == pytest.approx((entry['vertical_stress'] + 10.0) / entry['vertical_stress'], rel=1e-9)
        slice_ = result['slices'][entry['index']]
        assert slice_['cohesion'] == pytest.approx(0.25 * entry['vertical_stress'] * entry['ocr'] ** 0.8, rel=1e-9)


def test_shansep_ocr_by_elevation_interpolates_and_is_constant_outside_the_table():
    """Interpolación lineal en la cota del punto medio de la base y constante fuera de la tabla (F6.9)."""
    table = [[26.0, 1.2], [30.0, 1.8]]
    result = opengeoslide.analyze(shansep_model(ratio=0.25, ocr_by_elevation=table))['results'][0]
    seen = set()
    for entry in result['strength']['slices']:
        slice_ = result['slices'][entry['index']]
        y = (slice_['y_base_left'] + slice_['y_base_right']) / 2
        expected = 1.2 if y <= 26.0 else 1.8 if y >= 30.0 else 1.2 + 0.6 * (y - 26.0) / 4.0
        assert entry['ocr'] == pytest.approx(expected, rel=1e-9), y
        seen.add('below' if y <= 26.0 else 'above' if y >= 30.0 else 'inside')
    assert seen == {'below', 'inside', 'above'}, f'la tabla no se ejerció en los tres tramos: {seen}'


@pytest.mark.parametrize('name', ['X30-F-sismo-kh0.1', 'X30-F-sismo-kv0.1'])
def test_shansep_seismic_does_not_enter_the_vertical_stress(name):
    """E16o: con kh o kv, σ′v, OCR y Su son los mismos dovela por dovela; el sismo solo actúa en las fuerzas."""
    model = load_row(X30, name)['model']
    quiet = copy.deepcopy(model)
    del quiet['analysis']['seismic']
    shaken, still = opengeoslide.analyze(model)['results'][0], opengeoslide.analyze(quiet)['results'][0]
    assert shaken['fos'] != still['fos'], 'el sismo sí actúa en las fuerzas'
    assert shaken['strength']['slices'] == still['strength']['slices']
    assert [s['cohesion'] for s in shaken['slices']] == [s['cohesion'] for s in still['slices']]


def test_shansep_nonpositive_stress_gives_zero_su_and_the_note():
    """F6.9 y F6.7: bajo el agua con γ < γw y sin ``unit_weight_sat`` hay σ′v ≤ 0, Su = 0 y una nota por método."""
    model = load_row(X30, 'X30-F-V047a-humedo-ocr1')['model']
    material = model['materials'][0]
    material['unit_weight'] = 8.0
    material.pop('unit_weight_sat', None)
    for result in opengeoslide.analyze(model)['results']:
        assert result['warnings'].count('shansep_nonpositive_stress') == 1, result['method']
        zero = [e for e in result['strength']['slices'] if result['slices'][e['index']]['cohesion'] == 0.0]
        assert zero, 'alguna dovela queda con Su = 0'


def test_shansep_mirror_gives_the_same_fos():
    base = load_row(X30, 'X30-F-V047a-seco-ocrbyelev')['model']
    original = by_method(opengeoslide.analyze(base))
    mirror = by_method(opengeoslide.analyze(mirrored(base)))
    for method in METHODS:
        assert mirror[method]['fos'] == pytest.approx(original[method]['fos'], rel=1e-9)


def test_shansep_is_monotonic_in_ratio_and_ocr():
    fos = [opengeoslide.analyze(shansep_model(ratio=ratio, ocr=1.5))['results'][0]['fos'] for ratio in (0.2, 0.25, 0.3)]
    assert fos == sorted(fos) and len(set(fos)) == 3
    fos = [opengeoslide.analyze(shansep_model(ratio=0.25, ocr=ocr))['results'][0]['fos'] for ocr in (1.0, 1.5, 3.0)]
    assert fos == sorted(fos) and len(set(fos)) == 3


# ---------------------------------------------------------------------------------------------- validación v0.6


@pytest.mark.parametrize(
    ('edit', 'message'),
    [
        (lambda m: m.update(cohesion=10.0), "no admite el campo 'cohesion'"),
        (lambda m: m.update(friction_angle=30.0), "no admite el campo 'friction_angle'"),
        (lambda m: m.update(undrained_strength=10.0), "no admite el campo 'undrained_strength'"),
        (lambda m: m.update(shansep={'ratio': 0.2, 'ocr': 1.0}), "no admite el campo 'shansep'"),
        (lambda m: m.update(gsi=101.0), "el GSI del material 'roca' debe estar en [0, 100]"),
        (lambda m: m.update(gsi=-1.0), "el GSI del material 'roca' debe estar en [0, 100]"),
        (lambda m: m.update(mi=0.0), "el mi del material 'roca' debe ser finito y > 0"),
        (lambda m: m.update(ucs=0.0), "el ucs del material 'roca' debe ser finito y > 0"),
        (lambda m: m.update(disturbance=1.5), "el disturbance del material 'roca' debe estar en [0, 1]"),
        (lambda m: m.pop('ucs'), "requiere el campo 'ucs'"),
        (lambda m: m.pop('gsi'), "requiere el campo 'gsi'"),
        (lambda m: m.pop('mi'), "requiere el campo 'mi'"),
        (lambda m: m.pop('disturbance'), "requiere el campo 'disturbance'"),
    ],
)
def test_hoek_brown_rejects_bad_materials(edit, message):
    model = hb_model('X28-F-SA', ['bishop'])
    edit(model['materials'][0])
    assert message in error_of(model)


@pytest.mark.parametrize('field', ['ucs', 'gsi', 'mi', 'disturbance'])
def test_hoek_brown_fields_are_forbidden_in_the_other_models(field):
    model = hb_model('X28-F-SA', ['bishop'])
    material = model['materials'][0]
    material.update(model='mohr_coulomb', cohesion=10.0, friction_angle=30.0)
    for name in ('ucs', 'gsi', 'mi', 'disturbance'):
        if name != field:
            material.pop(name)
    assert f"no admite el campo '{field}'" in error_of(model)


@pytest.mark.parametrize(
    ('edit', 'message'),
    [
        (lambda s: s.pop('ocr'), 'exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation'),
        (lambda s: s.update(pop=5.0), 'exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation'),
        (lambda s: s.update(ratio=0.0), 'shansep.ratio del material'),
        (lambda s: s.update(ocr=0.9), 'shansep.ocr del material'),
        (lambda s: s.update(exponent=1.5), 'shansep.exponent del material'),
        (lambda s: (s.pop('ocr'), s.update(pop=-1.0)), 'shansep.pop del material'),
        (lambda s: (s.pop('ocr'), s.update(ocr_by_elevation=[[20.0, 1.0]])), 'necesita al menos 2 filas'),
        (
            lambda s: (s.pop('ocr'), s.update(ocr_by_elevation=[[30.0, 1.0], [20.0, 2.0]])),
            'y estrictamente creciente',
        ),
        (lambda s: s.update(su_min=1.0), 'unknown field `su_min`'),
    ],
)
def test_shansep_rejects_bad_specs(edit, message):
    model = shansep_model()
    edit(model['materials'][0]['shansep'])
    assert message in error_of(model)


@pytest.mark.parametrize(('field', 'value'), [('cohesion', 5.0), ('gsi', 50.0)])
def test_shansep_rejects_the_fields_of_the_other_models(field, value):
    model = shansep_model()
    model['materials'][0][field] = value
    assert f"no admite el campo '{field}'" in error_of(model)


# ---------------------------------------------------------------------------------------------- combinaciones F6.5


@pytest.mark.parametrize('kind', ['hoek_brown', 'shansep'])
def test_auto_depth_tension_crack_is_rejected_with_hoek_brown_and_shansep(kind):
    model = hb_model('X28-F-SA', ['bishop']) if kind == 'hoek_brown' else shansep_model()
    model['analysis']['tension_crack'] = {'depth': 'auto', 'water_fill': 0.0}
    message = error_of(model)
    assert 'analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep' in message
    assert 'use una profundidad fija' in message


def test_fixed_depth_tension_crack_works_with_hoek_brown():
    plain = by_method(opengeoslide.analyze(hb_model('X28-F-SA', ['bishop'])))['bishop']
    model = hb_model('X28-F-SA', ['bishop'])
    model['analysis']['tension_crack'] = {'depth': 2.0, 'water_fill': 0.0}
    result = opengeoslide.analyze(model)['results'][0]
    assert result['tension_crack']['depth'] == 2.0
    assert result['status'] == 'converged' and result['strength']['passes'] >= 1
    assert result['fos'] != plain['fos']


def test_fixed_depth_tension_crack_works_with_shansep():
    model = shansep_model()
    model['analysis']['tension_crack'] = {'depth': 2.0, 'water_fill': 0.5}
    result = opengeoslide.analyze(model)['results'][0]
    assert result['status'] == 'converged' and result['tension_crack']['depth'] == 2.0
    assert result['strength']['slices']


@pytest.mark.parametrize('kind', ['hoek_brown', 'shansep'])
def test_ito_matsui_is_rejected_with_hoek_brown_and_shansep(kind):
    model = hb_model('X28-F-SA', ['bishop']) if kind == 'hoek_brown' else shansep_model()
    message = error_of(with_pile_ito_matsui(model))
    assert 'lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep' in message


def test_a_pile_with_a_given_force_works_with_hoek_brown():
    """La fuerza dada de un ``pile`` sigue permitida: F6.5 solo rechaza Ito-Matsui."""
    model = hb_model('X28-F-SA', ['bishop'])
    model['reinforcements'] = [
        {
            'type': 'pile', 'id': 'p1', 'x1': 20.0, 'y1': 25.0, 'x2': 20.0, 'y2': 15.0, 'spacing': 3.0,
            'direction': 'perpendicular', 'application': 'passive', 'force': 50.0,
        }
    ]
    result = opengeoslide.analyze(model)['results'][0]
    assert result['status'] == 'converged' and result['reinforcement_forces']


# ---------------------------------------------------------------------------------------------- búsqueda no circular


def nc_model(**non_circular):
    """V001-nc con una malla chica (rápida) y ``non_circular`` a medida."""
    model = json.loads((CASES / 'V001-nc.json').read_text())['model']
    search = model['analysis']['search']
    for key in ('n_entry', 'n_exit', 'n_radius'):
        search[key] = 6
    search['non_circular'] = non_circular
    return model


def non_circular_of(result):
    return result['search']['non_circular']


def test_v001_nc_reproduces_the_published_value():
    """V001-nc: Spencer con búsqueda no circular contra el publicado (1,386) dentro de la tolerancia del caso."""
    case = json.loads((CASES / 'V001-nc.json').read_text())
    (check,) = case['checks']
    result = by_method(cached('case:V001-nc'))[check['method']]
    assert result['status'] == 'converged'
    assert abs(relative(result['fos'], check['published'])) <= check['tolerance']


def test_non_circular_report_has_the_four_figures_and_a_polyline():
    result = cached('case:V001-nc')['results'][0]
    stats = non_circular_of(result)
    assert set(stats) == {'seeds', 'evaluated', 'seed_fos', 'polyline_fos'}
    assert stats['seeds'] == 3 and stats['evaluated'] > 0
    assert result['fos'] == pytest.approx(stats['polyline_fos'], rel=1e-12)
    assert stats['polyline_fos'] <= stats['seed_fos'], 'la polilínea refinada no sube sobre la semilla circular'
    assert set(result['surface']) == {'points'}
    assert 3 <= len(result['surface']['points']) <= 33


def test_non_circular_defaults_and_empty_object():
    """``{}`` es válido: 3 semillas y 33 vértices por defecto, y es lo mismo que decirlos."""
    empty = opengeoslide.analyze(nc_model())['results'][0]
    explicit = opengeoslide.analyze(nc_model(seeds=3, max_vertices=33))['results'][0]
    assert non_circular_of(empty)['seeds'] == 3
    assert empty == explicit


def test_non_circular_is_deterministic():
    model = nc_model(seeds=2, max_vertices=17)
    assert opengeoslide.analyze(model) == opengeoslide.analyze(copy.deepcopy(model))


def test_non_circular_respects_seeds_and_max_vertices():
    result = opengeoslide.analyze(nc_model(seeds=1, max_vertices=9))['results'][0]
    assert non_circular_of(result)['seeds'] == 1
    assert len(result['surface']['points']) <= 9


@pytest.mark.parametrize(
    ('non_circular', 'message'),
    [
        ({'seeds': 0}, 'analysis.search.non_circular.seeds debe estar en [1, 10], no 0'),
        ({'seeds': 11}, 'analysis.search.non_circular.seeds debe estar en [1, 10], no 11'),
        ({'max_vertices': 10}, 'analysis.search.non_circular.max_vertices debe ser 9, 17 o 33, no 10'),
        ({'foo': 1}, 'unknown field `foo`'),
    ],
)
def test_non_circular_rejects_bad_values(non_circular, message):
    assert message in error_of(nc_model(**non_circular))


@pytest.mark.parametrize('methods', [['bishop'], ['spencer', 'bishop'], None])
def test_non_circular_does_not_admit_bishop(methods):
    """F6.4: con ``non_circular`` Bishop es ``InvalidModel``, también por defecto (sin ``analysis.methods``)."""
    model = nc_model()
    if methods is None:
        del model['analysis']['methods']
    else:
        model['analysis']['methods'] = methods
    assert 'el método bishop no se admite con analysis.search.non_circular' in error_of(model)


def test_non_circular_large_change_note_appears_only_above_15_percent():
    """V050b: el FS cae más de 15 % respecto del círculo semilla y sale ``non_circular_large_change``; solo entonces."""
    for case in ('V050b', 'V001-nc'):
        for result in cached(f'case:{case}')['results']:
            stats = non_circular_of(result)
            change = (stats['seed_fos'] - result['fos']) / stats['seed_fos']
            assert ('non_circular_large_change' in result['warnings']) == (change > 0.15), (case, change)
    assert 'non_circular_large_change' in cached('case:V050b')['results'][0]['warnings']


def test_non_circular_without_an_admissible_polyline_keeps_the_seed():
    """E16p: sin polilínea admisible, ``polyline_fos`` se omite y el resultado es el del círculo semilla (V103)."""
    result = cached('case:V103')['results'][0]
    stats = non_circular_of(result)
    assert 'polyline_fos' not in stats and stats['evaluated'] == 0
    assert result['fos'] == pytest.approx(stats['seed_fos'], rel=1e-12)
    assert set(result['surface']) == {'xc', 'yc', 'r'}


def test_non_circular_gives_each_method_its_own_search_summary():
    """V093-nc (Spencer y Janbu simplificado): cada método trae su resumen y su polilínea."""
    results = by_method(cached('case:V093-nc'))
    assert set(results) == {'spencer', 'janbu_simplified'}
    for result in results.values():
        stats = non_circular_of(result)
        assert result['fos'] == pytest.approx(stats['polyline_fos'], rel=1e-12)
        assert 'points' in result['surface']


def test_non_circular_with_hoek_brown_reports_both_blocks():
    """Combinación de F6.10 con F6.8: la búsqueda y la semilla usan el lazo de Hoek-Brown."""
    model = hb_model('X28-F-SA', ['spencer'])
    model['analysis'].pop('surface')
    model['analysis']['search'] = {
        'type': 'circular_entry_exit', 'entry': [0.0, 20.0], 'exit': [10.0, 60.0], 'n_entry': 5, 'n_exit': 5,
        'n_radius': 5, 'max_radius_factor': 5.0, 'refine': False, 'non_circular': {'seeds': 2, 'max_vertices': 9},
    }
    result = opengeoslide.analyze(model)['results'][0]
    stats = non_circular_of(result)
    assert result['status'] == 'converged' and result['strength']['passes'] >= 1
    assert stats['seeds'] == 2 and stats['seed_fos'] > 0
    if 'polyline_fos' in stats:  # con polilínea admisible, la superficie crítica es la polilínea
        assert result['fos'] == pytest.approx(stats['polyline_fos'], rel=1e-12)
        assert 'points' in result['surface']
    else:  # sin ella, el círculo semilla (E16p)
        assert result['fos'] == pytest.approx(stats['seed_fos'], rel=1e-12)
        assert set(result['surface']) == {'xc', 'yc', 'r'}
