// E15l-20 (R12 A-13, interfaz): nota informativa `editor.crack_fixed_search` con una grieta de profundidad fija y búsqueda.
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { baseDoc } from './testFixtures';
import { CRACK_FIXED_SEARCH_TEXT, validateLocal } from './validateLocal';

const SEARCH = { type: 'circular_entry_exit', entry: [0, 3], exit: [10, 3], n_entry: 5, n_exit: 5, n_radius: 5 } as unknown;
const doc = (crack: unknown, search: unknown): ModelDoc => {
  const d = baseDoc();
  const analysis = { ...d.analysis, tension_crack: crack, search } as ModelDoc['analysis'];
  delete (analysis as { surface?: unknown }).surface;
  return { ...d, version: '0.5', analysis } as ModelDoc;
};
const notes = (d: ModelDoc) => validateLocal(d).filter((i) => i.code === 'editor.crack_fixed_search');

describe('E15l-20: nota de grieta fija con búsqueda', () => {
  it('profundidad fija + búsqueda: una nota informativa con el texto del contrato', () => {
    const n = notes(doc({ depth: 2, water_fill: 1 }, SEARCH));
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ source: 'local', severity: 'nota', text: CRACK_FIXED_SEARCH_TEXT });
    expect(CRACK_FIXED_SEARCH_TEXT).toBe('Una grieta de profundidad fija descarta las superficies más someras que su profundidad; compare con un análisis sin grieta.');
  });
  it('no hay nota con grieta automática, sin grieta, sin búsqueda o con depth ≤ 0', () => {
    expect(notes(doc({ depth: 'auto', water_fill: 1 }, SEARCH))).toEqual([]);
    expect(notes(doc(undefined, SEARCH))).toEqual([]);
    expect(notes(doc({ depth: 2, water_fill: 1 }, undefined))).toEqual([]);
    expect(notes(doc({ depth: 0, water_fill: 1 }, SEARCH))).toEqual([]);
  });
  it('la nota no cuenta como error ni como aviso', () => {
    const sev = validateLocal(doc({ depth: 2, water_fill: 1 }, SEARCH)).filter((i) => i.code === 'editor.crack_fixed_search').map((i) => i.severity);
    expect(sev).toEqual(['nota']);
  });
});
