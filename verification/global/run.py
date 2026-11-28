#!/usr/bin/env python3
"""Medición parcial reproducible de A2; las demás compuertas siguen pendientes.

Ejecutar con el entorno del oráculo: env -u PYTHONPATH -u PYTHONHOME \
    "$TMPDIR/oracle-venv/bin/python" verification/global/run.py --bin "$CARGO_TARGET_DIR/release/ogs"
"""
import argparse
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'verification/harness'))
import to_cslope  # noqa: E402
import cslope  # noqa: E402


def engine(binary, model):
    started = time.perf_counter()
    p = subprocess.run([str(binary), 'analyze', '/dev/stdin'], input=json.dumps(model),
                       text=True, capture_output=True, check=True)
    out = json.loads(p.stdout)
    return out['results'][0], time.perf_counter() - started


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bin', required=True, type=Path)
    args = parser.parse_args()
    base = json.loads((HERE / 'models/V053.json').read_text())
    base['version'] = '0.6'
    base['analysis']['search']['non_circular'] = {}
    results = {}
    for label, spec in [('refinement', None), ('default', {}), ('seed37', {'seed': 37}), ('seed0_n2000', {'generated': 2000})]:
        model = copy.deepcopy(base)
        if spec is not None:
            model['version'] = '0.7'
            model['analysis']['search']['non_circular']['global'] = spec
        result, elapsed = engine(args.bin, model)
        results[label] = {'fos': result['fos'], 'surface': result['surface'], 'warnings': result['warnings'],
                          'global': result['search']['non_circular'].get('global'), 'seconds': elapsed}
    model = copy.deepcopy(base)
    model['analysis'].pop('search')
    model['analysis']['surface'] = {'type': 'polyline', 'points': results['seed37']['surface']['points']}
    conv = to_cslope.ogs_to_cslope(model, {'method': 'spencer', 'kind': 'fixed', 'options': {'slices': 50}})
    oracle = cslope.analyse(conv.document)
    critical = oracle.get('criticalSurface') or {}
    results['seed37']['cslope_fos'] = oracle.get('minFOS')
    results['seed37']['cslope_converged'] = critical.get('converged')
    limit = 1.01 * 1.035
    passed = results['default']['fos'] <= limit
    doc = {'scope': 'A2 parcial: V053; otras compuertas no medidas', 'published': 1.01,
           'tolerance_relative': 0.035, 'upper_limit': limit, 'a2_passes_published_band': passed,
           'results': results}
    (HERE / 'REPORT.json').write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n')
    lines = ['# Medición parcial de A2: V053', '',
             'Las demás compuertas y el barrido completo están pendientes; este informe no certifica C1.', '',
             f"Banda superior publicada: {limit:.8f}. Resultado de `global: {{}}`: **{'PASA' if passed else 'NO PASA'}**.", '',
             '| Variante | FS | Generados | Evaluaciones globales | Ganador | Tiempo (s, una corrida) |',
             '|---|---:|---:|---:|---|---:|']
    for label, r in results.items():
        g = r['global'] or {}
        lines.append(f"| {label} | {r['fos']:.9f} | {g.get('generated', '—')} | {g.get('evaluated', '—')} | {g.get('winner', '—')} | {r['seconds']:.3f} |")
    lines += ['', f"cSlope en la superficie de seed37: {results['seed37']['cslope_fos']}; convergida: {results['seed37']['cslope_converged']}.",
              '', 'Los tiempos son informativos: no son las tres repeticiones exigidas por A7.']
    (HERE / 'REPORT.md').write_text('\n'.join(lines) + '\n')
    print('A2 banda:', 'PASA' if passed else 'NO PASA', '; límite', limit, '; FS', results['default']['fos'])
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
