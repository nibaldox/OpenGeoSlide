// Comandos del reductor con los campos de la v0.3 (F3.2, F3.3, F3.4): material no drenado, superficie polilínea e interslice.
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import { applyCommand } from './reducer';
import { createEditorStore } from './store';
import { baseDoc } from './testFixtures';

const su: Material = { id: 'arcilla', name: 'Arcilla', model: 'undrained', unit_weight: 18, undrained_strength: 25 };

describe('material/upsert con el modelo no drenado', () => {
  it('acepta un material no drenado (sin cohesión ni fricción) y con perfil lineal', () => {
    const doc = baseDoc();
    const a = applyCommand(doc, { type: 'material/upsert', material: su });
    expect(a?.materials.find((m) => m.id === 'arcilla')).toEqual(su);
    const lineal: Material = { ...su, strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 };
    expect(applyCommand(doc, { type: 'material/upsert', material: lineal })?.materials.at(-1)).toEqual(lineal);
  });

  it('rechaza un no drenado sin Su o con un campo no finito, y un modelo desconocido', () => {
    const doc = baseDoc();
    const { undrained_strength: _su, ...sinSu } = su;
    void _su;
    expect(applyCommand(doc, { type: 'material/upsert', material: sinSu })).toBeNull();
    expect(applyCommand(doc, { type: 'material/upsert', material: { ...su, strength_gradient: Number.NaN } })).toBeNull();
    expect(applyCommand(doc, { type: 'material/upsert', material: { ...su, model: 'hoek_brown' as never } })).toBeNull();
  });

  it('Mohr-Coulomb sigue exigiendo cohesión y fricción', () => {
    const doc = baseDoc();
    expect(applyCommand(doc, { type: 'material/upsert', material: { id: 'x', name: 'x', model: 'mohr_coulomb', unit_weight: 18 } })).toBeNull();
  });

  it('cambiar el modelo de un material es un solo paso deshacible', () => {
    const store = createEditorStore(baseDoc(), null);
    const before = store.getState().doc;
    store.dispatch({ type: 'material/upsert', material: { id: 'm1', name: 'm1', model: 'undrained', unit_weight: 18, undrained_strength: 10 } });
    expect(store.getState().history.past).toEqual([before]);
    expect(store.getState().doc.materials[0]).toEqual({ id: 'm1', name: 'm1', model: 'undrained', unit_weight: 18, undrained_strength: 10 });
    store.undo();
    expect(store.getState().doc).toBe(before);
  });
});

describe('surface/set con una polilínea', () => {
  const polyline = { type: 'polyline' as const, points: [[2, 3], [5, 1], [9, 4]] as [number, number][] };

  it('acepta una polilínea y la copia', () => {
    const next = applyCommand(baseDoc(), { type: 'surface/set', surface: polyline });
    expect(next?.analysis.surface).toEqual(polyline);
    expect(next?.analysis.surface).not.toBe(polyline);
  });

  it('rechaza una polilínea con menos de 2 puntos o con coordenadas no finitas', () => {
    expect(applyCommand(baseDoc(), { type: 'surface/set', surface: { type: 'polyline', points: [[1, 1]] } })).toBeNull();
    expect(applyCommand(baseDoc(), { type: 'surface/set', surface: { type: 'polyline', points: [[1, 1], [Number.NaN, 2]] } })).toBeNull();
  });

  it('el círculo y null siguen igual', () => {
    expect(applyCommand(baseDoc(), { type: 'surface/set', surface: { type: 'circle', xc: 1, yc: 2, r: 3 } })?.analysis.surface).toEqual({ type: 'circle', xc: 1, yc: 2, r: 3 });
    expect(applyCommand(baseDoc(), { type: 'surface/set', surface: null })?.analysis.surface).toBeNull();
  });
});

describe('analysis/patch con interslice y métodos nuevos', () => {
  it('aplica interslice y lo quita con undefined', () => {
    const a = applyCommand(baseDoc(), { type: 'analysis/patch', patch: { methods: ['morgenstern_price'], interslice: { function: 'clipped_sine' } } });
    expect(a?.analysis.interslice).toEqual({ function: 'clipped_sine' });
    const b = applyCommand(a!, { type: 'analysis/patch', patch: { interslice: undefined } });
    expect('interslice' in (b?.analysis ?? {})).toBe(false);
  });
});
