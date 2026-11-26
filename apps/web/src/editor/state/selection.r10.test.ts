// R10B-11: la selección es coherente con la forma de la superficie: «Círculo» ↔ `surface_circle`, «Polilínea» ↔ `surface_vertex`; los diagnósticos
// de polilínea (`/analysis/surface/points/k`) seleccionan el vértice k.
import { describe, expect, it } from 'vitest';
import { selectionForPath, surfaceShapeCommands } from '../panels/forms';
import type { EditorState, ModelDoc } from '../types';
import { createInitialState, isSelectionValid, reduce } from './reducer';
import { baseDoc } from './testFixtures';

const polyDoc = (): ModelDoc => ({ ...baseDoc(), version: '0.3', analysis: { ...baseDoc().analysis, methods: ['spencer'], surface: { type: 'polyline', points: [[2, 9], [5, 4], [8, 9]] } } }) as ModelDoc;

describe('isSelectionValid: la forma de la superficie', () => {
  it('surface_circle solo es válida con un círculo; surface_vertex, solo con una polilínea y un índice existente', () => {
    expect(isSelectionValid({ kind: 'surface_circle' }, baseDoc())).toBe(true);
    expect(isSelectionValid({ kind: 'surface_circle' }, polyDoc())).toBe(false);
    expect(isSelectionValid({ kind: 'surface_vertex', index: 2 }, polyDoc())).toBe(true);
    expect(isSelectionValid({ kind: 'surface_vertex', index: 3 }, polyDoc())).toBe(false);
    expect(isSelectionValid({ kind: 'surface_vertex', index: 0 }, baseDoc())).toBe(false);
  });
  it('ui/select rechaza surface_circle sobre una polilínea', () => {
    const s = createInitialState(polyDoc());
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'surface_circle' } })).toBe(s);
  });
});

describe('cambiar de forma de superficie deja la selección coherente', () => {
  const run = (state: EditorState, shape: 'circle' | 'polyline'): EditorState => {
    let out = state;
    for (const cmd of surfaceShapeCommands(out.doc, shape)) out = reduce(out, cmd);
    return out;
  };
  it('círculo seleccionado → polilínea: la selección pasa a none (antes quedaba surface_circle)', () => {
    let s = createInitialState(baseDoc());
    s = reduce(s, { type: 'ui/select', selection: { kind: 'surface_circle' } });
    expect(s.ui.selection).toEqual({ kind: 'surface_circle' });
    const next = run(s, 'polyline');
    expect(next.doc.analysis.surface?.type).toBe('polyline');
    expect(next.ui.selection).toEqual({ kind: 'none' });
  });
  it('vértice seleccionado → círculo: la selección pasa a none', () => {
    let s = createInitialState(polyDoc());
    s = reduce(s, { type: 'ui/select', selection: { kind: 'surface_vertex', index: 1 } });
    const next = run(s, 'circle');
    expect(next.doc.analysis.surface?.type).toBe('circle');
    expect(next.ui.selection).toEqual({ kind: 'none' });
  });
});

describe('selectionForPath con una superficie', () => {
  it('/analysis/surface/points/k con una polilínea selecciona el vértice k (si existe)', () => {
    expect(selectionForPath('/analysis/surface/points/1', polyDoc())).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(selectionForPath('/analysis/surface/points/1/0', polyDoc())).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(selectionForPath('/analysis/surface/points/7', polyDoc())).toEqual({ kind: 'none' });
  });
  it('/analysis/surface sin índice con una polilínea no selecciona un círculo inexistente', () => {
    expect(selectionForPath('/analysis/surface', polyDoc())).toEqual({ kind: 'none' });
    expect(selectionForPath('/analysis/surface/points', polyDoc())).toEqual({ kind: 'none' });
  });
  it('con un círculo (o sin superficie) sigue seleccionando el círculo', () => {
    expect(selectionForPath('/analysis/surface', baseDoc())).toEqual({ kind: 'surface_circle' });
    expect(selectionForPath('/analysis/surface/r', baseDoc())).toEqual({ kind: 'surface_circle' });
  });
});
