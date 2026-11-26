// R10B-08: `ensureV02` solo sube desde 0.1; el documento nunca queda con una versión menor que la que piden sus campos (0.3), y
// `validateLocal` detecta la versión insuficiente igual que el motor (`<campo> requiere version "0.3"`).

import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import type { ModelDoc } from '../types';
import { applyCommand } from './reducer';
import { baseDoc, mat } from './testFixtures';
import { validateLocal } from './validateLocal';

const undrained = (): Material => ({ id: 'u', name: 'u', model: 'undrained', unit_weight: 18, undrained_strength: 50 }) as Material;

function v03Doc(): ModelDoc {
  const doc = baseDoc();
  return {
    ...doc,
    version: '0.3',
    materials: [mat('m1'), undrained()],
    regions: [{ material: 'm1', polygon: doc.regions[0]!.polygon }, { material: 'u', polygon: doc.regions[1]!.polygon }],
    analysis: { ...doc.analysis, methods: ['spencer'], surface: { type: 'polyline', points: [[2, 9], [5, 4], [8, 9]] } },
  } as ModelDoc;
}

describe('R10B-08: la versión del documento', () => {
  it('seismic/set y load/upsert sobre un documento 0.3 lo dejan en 0.3 (antes lo bajaban a 0.2)', () => {
    const a = applyCommand(v03Doc(), { type: 'seismic/set', seismic: { kh: 0.1, kv: 0 } });
    expect(a?.version).toBe('0.3');
    const b = applyCommand(v03Doc(), { type: 'load/upsert', index: null, load: { type: 'udl', x1: 1, x2: 2, q: 5 } });
    expect(b?.version).toBe('0.3');
    const c = applyCommand(v03Doc(), { type: 'loads/set', loads: [{ type: 'udl', x1: 1, x2: 2, q: 5 }] });
    expect(c?.version).toBe('0.3');
    const d = applyCommand(v03Doc(), { type: 'analysis/patch', patch: { seismic: { kh: 0.1, kv: 0 } } });
    expect(d?.version).toBe('0.3');
  });

  it('desde 0.1 sigue subiendo a 0.2 con sismo o cargas', () => {
    const doc = { ...baseDoc(), version: '0.1' } as ModelDoc;
    expect(applyCommand(doc, { type: 'seismic/set', seismic: { kh: 0.1, kv: 0 } })?.version).toBe('0.2');
    expect(applyCommand(doc, { type: 'load/upsert', index: null, load: { type: 'udl', x1: 1, x2: 2, q: 5 } })?.version).toBe('0.2');
  });

  it('un comando que añade un campo de 0.3 sube la versión a 0.3 (el documento y el motor no discrepan)', () => {
    const doc = baseDoc();
    expect(applyCommand(doc, { type: 'surface/set', surface: { type: 'polyline', points: [[2, 9], [5, 4], [8, 9]] } })?.version).toBe('0.3');
    expect(applyCommand(doc, { type: 'analysis/patch', patch: { methods: ['spencer', 'morgenstern_price'] } })?.version).toBe('0.3');
    expect(applyCommand(doc, { type: 'material/upsert', material: undrained() })?.version).toBe('0.3');
    // Sin campos de 0.3 la versión no cambia.
    expect(applyCommand(doc, { type: 'analysis/patch', patch: { slices: 60 } })?.version).toBe('0.2');
  });
});

describe('R10B-08: validateLocal detecta los campos de 0.3 con una versión insuficiente', () => {
  it.each(['0.1', '0.2'] as const)('versión %s con polilínea, no drenado y Spencer: error en /version, igual que el motor', (version) => {
    const issues = validateLocal({ ...v03Doc(), version } as ModelDoc);
    const v = issues.filter((i) => i.path === '/version');
    expect(v).toHaveLength(1);
    expect(v[0]!.severity).toBe('error');
    expect(v[0]!.text).toMatch(/0\.3/);
  });

  it('la versión 0.3 no da la incidencia; tampoco un modelo 0.2 sin campos de 0.3', () => {
    expect(validateLocal(v03Doc()).filter((i) => i.path === '/version')).toEqual([]);
    expect(validateLocal(baseDoc()).filter((i) => i.path === '/version')).toEqual([]);
  });
});
