// F3-W1f: el editor guarda polilíneas de falla con `surface/set` y puede seleccionar sus vértices.
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { makeDoc } from '../canvas/fakeStore';
import { createInitialState, reduce } from './reducer';
import type { EditorCommand, UiAction } from '../types';

type EditorAction = EditorCommand | UiAction;

const poly: Point[] = [[10, 8], [20, 9], [35, 12]];

function stateWithPolyline() {
  const base = createInitialState(makeDoc());
  return reduce(base, { type: 'surface/set', surface: { type: 'polyline', points: poly } } as EditorAction);
}

describe('surface/set con polilínea (F3.3)', () => {
  it('acepta una polilínea de al menos 2 puntos finitos y la copia', () => {
    const s = stateWithPolyline();
    expect(s.doc.analysis.surface).toEqual({ type: 'polyline', points: poly });
    expect(s.doc.analysis.surface && 'points' in s.doc.analysis.surface && s.doc.analysis.surface.points).not.toBe(poly);
  });
  it('ignora la polilínea con menos de 2 puntos, con puntos no finitos o mal formados', () => {
    const base = createInitialState(makeDoc());
    for (const points of [[[1, 2]], [[1, 2], [Number.NaN, 3]], [[1, 2], [3]], 'x']) {
      const s = reduce(base, { type: 'surface/set', surface: { type: 'polyline', points } } as unknown as EditorAction);
      expect(s.doc).toBe(base.doc);
    }
  });
  it('no valida el orden de x: eso es de validateLocal, que lo explica al usuario', () => {
    const base = createInitialState(makeDoc());
    const s = reduce(base, { type: 'surface/set', surface: { type: 'polyline', points: [[5, 1], [4, 2]] } } as EditorAction);
    expect(s.doc.analysis.surface).toEqual({ type: 'polyline', points: [[5, 1], [4, 2]] });
  });
});

describe('selección de un vértice de la polilínea', () => {
  it('es válida solo con una polilínea y un índice existente', () => {
    const s = stateWithPolyline();
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'surface_vertex', index: 2 } } as EditorAction).ui.selection).toEqual({ kind: 'surface_vertex', index: 2 });
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'surface_vertex', index: 3 } } as EditorAction).ui.selection).toEqual({ kind: 'none' });
    const circle = createInitialState(makeDoc());
    expect(reduce(circle, { type: 'ui/select', selection: { kind: 'surface_vertex', index: 0 } } as EditorAction).ui.selection).toEqual({ kind: 'none' });
  });
  it('si la polilínea pierde puntos o cambia a círculo, la selección vuelve a ninguna', () => {
    let s = stateWithPolyline();
    s = reduce(s, { type: 'ui/select', selection: { kind: 'surface_vertex', index: 2 } } as EditorAction);
    const shorter = reduce(s, { type: 'surface/set', surface: { type: 'polyline', points: [[10, 8], [35, 12]] } } as EditorAction);
    expect(shorter.ui.selection).toEqual({ kind: 'none' });
    const circle = reduce(s, { type: 'surface/set', surface: { type: 'circle', xc: 1, yc: 2, r: 3 } } as EditorAction);
    expect(circle.ui.selection).toEqual({ kind: 'none' });
  });
});
