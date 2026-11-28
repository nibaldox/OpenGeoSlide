"""Contract F7.1: the wheel validates the global-search format."""
import copy
import json
from pathlib import Path

import opengeoslide
import pytest

ROOT = Path(__file__).resolve().parents[3]


def model(version, global_spec):
    doc = json.loads((ROOT / 'verification/cases/V001-nc.json').read_text())['model']
    doc['version'] = version
    doc['analysis']['search']['non_circular']['global'] = copy.deepcopy(global_spec)
    return doc


def test_v07_global_shape():
    assert opengeoslide.analyze(model('0.7', {}))
    with pytest.raises(ValueError, match='analysis.search.non_circular.global requiere version'):
        opengeoslide.analyze(model('0.6', {}))
    for spec in ({'generated': 49}, {'generated': 2001}, {'seed': 9007199254740992}, {'algorithm': 'path'}, {'typo': 1}):
        with pytest.raises(ValueError):
            opengeoslide.analyze(model('0.7', spec))


def test_global_is_an_object_and_range_messages_name_the_value():
    """E17e §5 and §8: an array is not a `global`, and the range messages say what was written."""
    for spec in ([], ['block', 60, 0, False], 'block', 7):
        with pytest.raises(ValueError, match='InvalidModel'):
            opengeoslide.analyze(model('0.7', spec))
    with pytest.raises(ValueError, match=r'generated debe estar en \[50, 2000\], no 49'):
        opengeoslide.analyze(model('0.7', {'generated': 49}))
    with pytest.raises(ValueError, match=r'seed debe estar en \[0, 9007199254740991\], no 9007199254740992'):
        opengeoslide.analyze(model('0.7', {'seed': 9007199254740992}))
    doc = model('0.7', {})
    doc['analysis']['search']['non_circular'] = [3, 33]
    with pytest.raises(ValueError, match='InvalidModel'):
        opengeoslide.analyze(doc)


def test_global_respects_max_vertices():
    """E17e §3: the global stage stops at `max_vertices`, like the refinement."""
    doc = json.loads((ROOT / 'verification/global/repro/repro_02_max_vertices_9.ogs.json').read_text())
    report = opengeoslide.analyze(doc)
    assert len(report['results'][0]['surface']['points']) <= 9
