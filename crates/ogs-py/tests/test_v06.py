"""Puertas v0.6 del wheel durante B1; la física sigue en stubs."""

import json
from pathlib import Path

import pytest
import opengeoslide

ROOT = Path(__file__).resolve().parents[3]


def hb_model():
    model = json.loads((ROOT / 'docs/fase3/exploracion/X28_filas/X28-F-HAM1.json').read_text())['model']
    model['analysis']['methods'] = ['bishop']
    return model


def test_v06_reaches_hoek_brown_stub():
    with pytest.raises(RuntimeError, match='F3B-M-HB'):
        opengeoslide.analyze(hb_model())


@pytest.mark.parametrize('version', ['0.1', '0.2', '0.3', '0.4', '0.5'])
def test_hoek_brown_requires_version_06(version):
    model = hb_model()
    model['version'] = version
    with pytest.raises(ValueError, match='requiere version "0.6"'):
        opengeoslide.analyze(model)


def test_unknown_version_names_supported_versions():
    model = hb_model()
    model['version'] = '0.7'
    with pytest.raises(ValueError) as exc:
        opengeoslide.analyze(model)
    for version in ('0.1', '0.2', '0.3', '0.4', '0.5', '0.6'):
        assert version in str(exc.value)
