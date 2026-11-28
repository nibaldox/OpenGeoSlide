// CM-C1W · F7.1: rangos de `analysis.search.non_circular.global` en `validateLocal` (mismo patrón y rutas que el motor).
import { describe, expect, it } from 'vitest';
import { makeDoc } from '../canvas/fakeStore';
import type { ModelDoc } from '../types';
import { validateLocal } from './validateLocal';

const docWith = (global: unknown, version: ModelDoc['version'] = '0.7'): ModelDoc => {
  const d = structuredClone(makeDoc()) as unknown as ModelDoc;
  d.version = version;
  d.analysis = { methods: ['spencer'], search: { type: 'circular_entry_exit', non_circular: { global: global as never } } };
  return d;
};
const globalErrors = (d: ModelDoc) => validateLocal(d).filter((i) => i.severity === 'error' && i.path?.startsWith('/analysis/search/non_circular/global'));

describe('validateLocal: rangos de global (F7.1)', () => {
  it('global ausente, null, vacío y con los valores extremos no da errores', () => {
    expect(globalErrors(docWith(undefined))).toEqual([]);
    expect(globalErrors(docWith(null))).toEqual([]);
    expect(globalErrors(docWith({}))).toEqual([]);
    expect(globalErrors(docWith({ algorithm: 'auto', generated: 50, seed: 0, polish: true }))).toEqual([]);
    expect(globalErrors(docWith({ algorithm: 'annealing', generated: 2000, seed: 9007199254740991, polish: false }))).toEqual([]);
    expect(globalErrors(docWith({ algorithm: null, generated: null, seed: null, polish: null }))).toEqual([]);
  });

  it.each([
    [{ generated: 49 }, '/generated', 'analysis.search.non_circular.global.generated debe estar en [50, 2000], no 49'],
    [{ generated: 2001 }, '/generated', 'analysis.search.non_circular.global.generated debe estar en [50, 2000], no 2001'],
    [{ generated: 100.5 }, '/generated', 'analysis.search.non_circular.global.generated debe estar en [50, 2000], no 100.5'],
    [{ seed: -1 }, '/seed', 'analysis.search.non_circular.global.seed debe estar en [0, 2^53 - 1], no -1'],
    [{ seed: 9007199254740992 }, '/seed', 'analysis.search.non_circular.global.seed debe estar en [0, 2^53 - 1], no 9007199254740992'],
    [{ seed: 1.5 }, '/seed', 'analysis.search.non_circular.global.seed debe estar en [0, 2^53 - 1], no 1.5'],
    [{ algorithm: 'path' }, '/algorithm', 'analysis.search.non_circular.global.algorithm debe ser "auto", "block" o "annealing", no "path"'],
  ])('%j → error con su ruta', (g, field, text) => {
    const errs = globalErrors(docWith(g));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ code: 'editor.out_of_range', path: `/analysis/search/non_circular/global${field}`, text });
  });

  it('con la versión 0.6 el error de la puerta 0.7 va en /version y no tapa los rangos', () => {
    const errs = validateLocal(docWith({ generated: 10 }, '0.6')).filter((i) => i.severity === 'error');
    expect(errs.find((e) => e.path === '/version')?.text).toBe('analysis.search.non_circular.global requiere version "0.7"');
    expect(errs.some((e) => e.path === '/analysis/search/non_circular/global/generated')).toBe(true);
  });

  it('Bishop con global sigue siendo un error de la lista de métodos', () => {
    const d = docWith({});
    d.analysis = { ...d.analysis, methods: ['bishop'] };
    expect(validateLocal(d).some((i) => i.severity === 'error' && i.path === '/analysis/methods')).toBe(true);
  });
});
