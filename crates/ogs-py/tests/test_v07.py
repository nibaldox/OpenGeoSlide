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
