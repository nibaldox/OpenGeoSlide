"""F3B inputs and execution plan: no v0.6 engine physics is run in B1."""
import json
from pathlib import Path

import jsonschema
import pytest
import build_f3b
from test_differential import run
from to_cslope import ogs_to_cslope

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def f3b_cases():
    return [{'id': m['meta']['id'], 'title': m['meta']['title'], 'model': m}
            for m in build_f3b.models()]


def test_f3b_inputs_are_reproducible_and_cover_the_requested_features():
    models = build_f3b.models()
    assert len(models) == 12
    for model in models:
        path = HERE / 'cases_f3b' / (model['meta']['id'] + '.ogs.json')
        assert json.loads(path.read_text(encoding='utf-8')) == model
    hb = models[:8]
    assert {m['materials'][0]['disturbance'] for m in hb} >= {0, 1}
    assert any('water' in m for m in hb) and any('water' not in m for m in hb)
    assert {m['materials'][0]['shansep'].get('ocr') for m in models[8:9]} == {1}
    assert any('pop' in x.get('shansep', {}) for x in models[9]['materials'])
    assert all('non_circular' in m['analysis']['search'] for m in models[10:])


def test_f3b_plan_has_every_search_and_fixed_check():
    plan = run.f3b_plan(f3b_cases())
    assert len(plan) == 42
    keys = {(case['id'], method, kind) for case, method, kind in plan}
    assert len(keys) == len(plan)
    assert ('F3B-HB-02', 'spencer', 'fixed') in keys     # explained by E16t, not left out
    assert ('F3B-NC-V001', 'spencer', 'search') in keys
    assert not any(kind == 'fixed' for case, _, kind in plan if case['id'].startswith('F3B-NC'))


def test_f3b_recorded_oracle_rows_match_the_plan():
    reference = json.loads((HERE / 'cases_f3b/oracle.json').read_text())
    rows = reference['rows']
    assert all(row['converged'] and 'error' not in row and row['fos'] > 0 for row in rows)
    recorded = {(row['id'], row['method'], row['kind']) for row in rows}
    no_solution = {(row['id'], row['method'], row['kind']) for row in reference['no_solution']}
    expected = {(case['id'], method, kind) for case, method, kind in run.f3b_plan(f3b_cases())}
    assert len(rows) == len(recorded) and recorded | no_solution == expected and not recorded & no_solution
    # E16t: the only check without a root in cSlope is SB with Spencer on its fixed circle.
    assert no_solution == {('F3B-HB-02', 'spencer', 'fixed')}


def test_f3b_fixed_circles_do_not_enter_nearly_vertical_except_sb():
    """The circle of SB enters at 84,5°, where cSlope has no Spencer solution; the other circles must not (X23 §4.2)."""
    import math
    import to_cslope
    for model in build_f3b.models():
        surface = model['analysis'].get('surface')
        if not surface or model['meta']['id'] in ('F3B-HB-02', 'F3B-HB-06'):
            continue
        outline = to_cslope.outline_of(to_cslope.regions_of(model))
        for x in to_cslope.arc_terrain_crossings(surface, outline):
            angle = math.degrees(math.atan2(abs(x - surface['xc']), abs(to_cslope.arc_y(surface, x) - surface['yc'])))
            assert angle < 75, (model['meta']['id'], x, angle)


def test_f3b_recorded_prototype_rows_reproduce_f68():
    reference = json.loads((HERE / 'cases_f3b/prototype.json').read_text())
    rows = {(r['id'], r['method']): r for r in reference['rows']}
    assert len(rows) == 16 and all(r['product_status'] == 'converged' for r in rows.values())
    # F6.8 table, SB circle: 2,067647 (Bishop) and 2,094657 (Spencer), complete envelope.
    assert rows[('F3B-HB-02', 'bishop')]['product'] == pytest.approx(2.067647, abs=1e-5)
    assert rows[('F3B-HB-02', 'spencer')]['product'] == pytest.approx(2.094657, abs=1e-5)
    # the prototype with the rule of cSlope reproduces the oracle (the compatibility rule of E16t) to 0,15 %
    oracle = {(r['id'], r['method']): r['fos'] for r in json.loads((HERE / 'cases_f3b/oracle.json').read_text())['rows']
              if r['kind'] == 'fixed'}
    for key, row in rows.items():
        if key in oracle:
            assert abs(row['compat'] - oracle[key]) / oracle[key] < 0.0015, key


def _ogs(fos):
    return {'fos': fos, 'status': 'converged', 'error': None}


def _cslope(fos, status='converged'):
    return {'fos': fos, 'status': status, 'error': None}


def test_f3b_verdicts():
    case = {'id': 'X'}
    proto = {'product': 2.0}
    # within 0,5 % of cSlope and 0,1 % of the prototype: plain match
    assert run.f3b_evaluate(case, 'bishop', 'fixed', _ogs(2.0), _cslope(2.001), proto)[0] == 'OK'
    # cSlope 2 % above: the prototype explains it (F6.8)
    assert run.f3b_evaluate(case, 'bishop', 'fixed', _ogs(2.001), _cslope(2.04), proto)[0] == run.VERDICT_F68
    # ogs off the prototype by more than 0,1 % fails even when cSlope agrees
    assert run.f3b_evaluate(case, 'bishop', 'fixed', _ogs(2.01), _cslope(2.01), proto)[0] == 'FALLA'
    # cSlope without root for Spencer: explained, never compared with cSlope
    verdict, reason = run.f3b_evaluate(case, 'spencer', 'fixed', _ogs(2.5), _cslope(2.1, 'not_converged'), proto)
    assert verdict == run.VERDICT_E16T and '2.000000' in reason
    assert run.f3b_evaluate(case, 'spencer', 'fixed', {'fos': None, 'status': 'not_converged', 'error': None},
                            _cslope(2.1, 'not_converged'), proto)[0] == 'FALLA'
    # an execution error of ogs (a stub panic, a crash) is never a verdict on the physics
    assert run.f3b_evaluate(case, 'spencer', 'fixed', {'fos': None, 'status': None, 'error': 'exit 101'},
                            _cslope(2.1, 'not_converged'), proto)[0] == 'sin dato'
    # without a prototype row (search, SHANSEP, non circular) the E9b rules stand
    assert run.f3b_evaluate(case, 'bishop', 'search', _ogs(2.0), _cslope(2.0), None)[0] == 'OK'
    assert run.f3b_evaluate(case, 'bishop', 'search', _ogs(2.1), _cslope(2.0), None)[0] == 'FALLA'
    assert run.f3b_evaluate(case, 'bishop', 'fixed', _ogs(2.1), _cslope(2.0), None)[0] == 'FALLA'



def test_f3b_malpha_explains_only_an_inadmissible_steep_circle():
    steep = ['steep-entry-tension: The surface enters the slope at 87°']
    invalid = {'fos': None, 'status': 'invalid', 'error': None, 'warnings': ['truncated_mass', 'm_alpha']}
    assert run.f3b_malpha_explains(invalid, steep)
    # cSlope without its own warning, ogs converging on the circle, another invalid reason or an ogs error: no
    assert not run.f3b_malpha_explains(invalid, ['negative-effective-normal: 3 slices'])
    assert not run.f3b_malpha_explains({**invalid, 'status': 'converged', 'fos': 0.5}, steep)
    assert not run.f3b_malpha_explains({**invalid, 'warnings': ['no_driving']}, steep)
    assert not run.f3b_malpha_explains({**invalid, 'error': 'exit 101'}, steep)
    assert run.VERDICT_MALPHA in run.PASS_VERDICTS_F3B
    rows = [{'verdict': run.VERDICT_MALPHA, 'kind': 'search'}, {'verdict': run.VERDICT_E16T, 'kind': 'fixed'}]
    assert run.summarize_f3b(rows)['explicado'] == 2

def test_f3b_block_is_skipped_without_the_option(monkeypatch):
    """The engine of B1 has no v0.6 physics: F3B runs only on request (B2 activates it)."""
    enabled = lambda *argv: run.f3b_enabled(run.parse_args(list(argv)))
    monkeypatch.delenv('OGS_DIFFERENTIAL_F3B', raising=False)
    assert not enabled()
    assert enabled('--include-f3b') and enabled('--require-f3b')
    monkeypatch.setenv('OGS_DIFFERENTIAL_F3B', '1')
    assert enabled()


def test_f3b_cases_convert_and_validate_without_running_ogs():
    cslope = pytest.importorskip('cslope')
    schema = json.loads((ROOT / 'schema/ogs-0.6.schema.json').read_text())
    validator = jsonschema.Draft202012Validator(schema)
    for case, method, kind in run.f3b_plan(f3b_cases()):
        model = run.harness_run.model_for_check(case['model'], {'method': method, 'kind': kind})
        assert not list(validator.iter_errors(model)), (case['id'], method, kind)
        converted = ogs_to_cslope(case['model'], {'method': method, 'kind': kind}).document
        errors = [issue for issue in cslope.validate(converted) if issue.get('severity') == 'error']
        assert not errors, (case['id'], method, kind, errors)


def test_malpha_verdict_has_an_upper_bound(monkeypatch):
    """E16z (R15A-09): `explicado (§4.2: m_α)` needs FS_ogs <= 1,05·FS_cSlope; above that it is a FALLA."""
    assert run.MALPHA_MAX_FACTOR == 1.05
    case = {'id': 'F3B-HB-06', 'model': {}}
    steep = ['steep-entry-tension: The surface enters the slope at 87°']
    circle = {'type': 'circle', 'xc': 1.0, 'yc': 2.0, 'r': 3.0}
    invalid = {'fos': None, 'status': 'invalid', 'error': None, 'warnings': ['m_alpha']}

    def verdict(ogs_fos):
        monkeypatch.setattr(run, 'run_check', lambda *a: {
            'ogs': {'fos': ogs_fos, 'status': 'converged', 'error': None, 'warnings': []},
            'cslope': {'fos': 1.0, 'status': 'converged', 'error': None, 'warnings': steep}})
        monkeypatch.setattr(run, 'f3b_evaluate', lambda *a: ('FALLA', 'search above cSlope'))
        monkeypatch.setattr(run, 'f3b_search_explanation', lambda *a: {
            'cslope_circle': circle, 'ogs_on_cslope_circle': invalid})
        return run.f3b_check(None, 'ogs', case, 'bishop', 'search', {})['verdict']

    assert verdict(1.0178) == run.VERDICT_MALPHA        # the measured F3B-HB-06 case, +1,785 %
    assert verdict(1.05) == run.VERDICT_MALPHA          # the bound itself
    assert verdict(1.0501) == 'FALLA'
    assert verdict(2.0) == 'FALLA'                      # a regression of the search no longer hides


def test_informative_notes_are_one_list():
    """E16z: the informative notes of run.py are the ones of acceptance.rs (one source, compared)."""
    import re
    text = (ROOT / 'crates/ogs-core/tests/acceptance.rs').read_text(encoding='utf-8')
    block = re.search(r'const INFORMATIVE_WARNINGS: &\[&str\] = &\[(.*?)\];', text, re.S).group(1)
    codes = re.findall(r'"([a-z_]+)"', block)
    assert len(codes) == len(set(codes)) >= 15
    assert set(run.OGS_INFORMATIVE_WARNINGS) == set(codes)
    assert len(run.OGS_INFORMATIVE_WARNINGS) == len(set(run.OGS_INFORMATIVE_WARNINGS))
    for code in ('non_circular_not_refined', 'non_circular_large_change', 'hoek_brown_low_confinement',
                 'shansep_nonpositive_stress'):
        assert code in codes


def test_f3b_nc_inputs_have_no_interslice_without_morgenstern_price():
    """E16z (R15A-05): `analysis.interslice` needs morgenstern_price in the methods, and the CLI refuses it otherwise."""
    for model in build_f3b.models():
        analysis = model['analysis']
        if 'interslice' in analysis:
            assert 'morgenstern_price' in analysis['methods'], model['meta']['id']
    for cid in ('F3B-NC-V001', 'F3B-NC-V034a'):
        path = HERE / 'cases_f3b' / (cid + '.ogs.json')
        assert 'interslice' not in json.loads(path.read_text(encoding='utf-8'))['analysis']
