// Comandos de refuerzos del reductor (v0.4, F4.11, E14k): `reinforcement/upsert` y `reinforcement/remove`.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import type { EditorCommand, Selection } from '../types';
import { applyCommand, isSelectionValid } from './reducer';
import { FIVE, anchor, pile, sheet } from './reinforcementFixtures';
import { createEditorStore } from './store';
import { baseDoc } from './testFixtures';

const upsert = (reinforcement: Reinforcement, index: number | null = null): EditorCommand => ({ type: 'reinforcement/upsert', index, reinforcement });

describe('reinforcement/upsert', () => {
  it('agrega con index null y sube la versión a 0.4 desde 0.1, 0.2 y 0.3', () => {
    for (const version of ['0.1', '0.2', '0.3'] as const) {
      const doc = { ...baseDoc(), version };
      const next = applyCommand(doc, upsert(anchor()));
      expect(next?.reinforcements).toEqual([anchor()]);
      expect(next?.version, version).toBe('0.4');
    }
  });

  it('agrega al final y no reordena', () => {
    let doc = baseDoc();
    for (const r of FIVE) doc = applyCommand(doc, upsert(r)) ?? doc;
    expect(doc.reinforcements).toEqual(FIVE);
  });

  it('reemplaza el elemento de `index` y deja los demás', () => {
    const doc = applyCommand(applyCommand(baseDoc(), upsert(anchor())) ?? baseDoc(), upsert(pile())) ?? baseDoc();
    const next = applyCommand(doc, upsert(anchor({ tensile_capacity: 250 }), 0));
    expect(next?.reinforcements).toEqual([anchor({ tensile_capacity: 250 }), pile()]);
  });

  it('un índice fuera de rango o no entero es inválido', () => {
    const doc = applyCommand(baseDoc(), upsert(anchor())) ?? baseDoc();
    expect(applyCommand(doc, upsert(anchor(), 1))).toBeNull();
    expect(applyCommand(doc, upsert(anchor(), -1))).toBeNull();
    expect(applyCommand(doc, upsert(anchor(), 0.5))).toBeNull();
    expect(applyCommand(baseDoc(), upsert(anchor(), 0))).toBeNull();
  });

  it('rechaza lo que no tiene la forma de un refuerzo', () => {
    const doc = baseDoc();
    const bad: unknown[] = [
      null,
      'a',
      { ...anchor(), type: 'strut' },
      { ...anchor(), id: 3 },
      { ...anchor(), x1: Number.NaN },
      { ...anchor(), y2: Number.POSITIVE_INFINITY },
      { ...anchor(), x2: '30' },
      { ...anchor(), application: 'both' },
      { ...anchor(), application: undefined },
      { ...anchor(), direction: 'angle' },
      { ...anchor(), tensile_capacity: undefined },
      { ...anchor(), tensile_capacity: Number.NaN },
      { ...anchor(), spacing: Number.NaN },
      { ...anchor(), pullout: { model: 'grout' } },
      { ...anchor(), pullout: { model: 'bond' } },
      { ...anchor(), pullout: { model: 'bond', strength: Number.NaN } },
      { ...anchor(), pullout: { model: 'interface', adhesion: 1, friction_angle: 2 } },
      { ...anchor(), pullout: { model: 'development', length1: 1, length2: Number.NaN } },
      { ...pile(), direction: 'axial' },
      { ...pile(), force: undefined },
      { ...pile(), angle: Number.NaN },
      { ...sheet(), force: Number.NaN },
      { ...pile(), location: 'slip_surface' },
      { ...anchor(), force: 5 },
      { ...sheet(), spacing: 1 },
    ];
    for (const r of bad) expect(applyCommand(doc, upsert(r as Reinforcement)), JSON.stringify(r)).toBeNull();
  });

  it('acepta valores fuera de rango (los señala validateLocal): capacidad negativa, tablestaca inclinada, id vacío', () => {
    const doc = baseDoc();
    for (const r of [anchor({ tensile_capacity: -1 }), sheet({ x2: 41 }), anchor({ id: '' }), anchor({ x2: 44, y2: 12 })]) {
      expect(applyCommand(doc, upsert(r))?.reinforcements).toEqual([r]);
    }
  });

  it('los opcionales nulos o indefinidos no se guardan', () => {
    const r = { ...anchor(), end1_capacity: null, spacing: undefined, pullout: null } as Reinforcement;
    expect(applyCommand(baseDoc(), upsert(r))?.reinforcements).toEqual([anchor()]);
    expect(Object.keys(applyCommand(baseDoc(), upsert(r))?.reinforcements?.[0] ?? {})).not.toContain('spacing');
  });

  it('no muta el documento ni el refuerzo recibido', () => {
    const doc = baseDoc();
    const r = anchor();
    const frozen = JSON.stringify(doc);
    const next = applyCommand(doc, upsert(r));
    expect(JSON.stringify(doc)).toBe(frozen);
    expect(next?.reinforcements?.[0]).not.toBe(r);
  });

  it('con un pullout, copia también el objeto anidado', () => {
    const r = anchor({ pullout: { model: 'bond', strength: 30, bonded_length: 5 } });
    const next = applyCommand(baseDoc(), upsert(r));
    expect(next?.reinforcements?.[0]).toEqual(r);
    expect((next?.reinforcements?.[0] as typeof r).pullout).not.toBe(r.pullout);
  });
});

describe('reinforcement/remove', () => {
  const three = (): ReturnType<typeof baseDoc> => ({ ...baseDoc(), version: '0.4', reinforcements: [anchor(), pile(), sheet()] });

  it('quita el elemento de `index`', () => {
    expect(applyCommand(three(), { type: 'reinforcement/remove', index: 1 })?.reinforcements).toEqual([anchor(), sheet()]);
  });

  it('un índice inválido o sin refuerzos es inválido', () => {
    expect(applyCommand(three(), { type: 'reinforcement/remove', index: 3 })).toBeNull();
    expect(applyCommand(three(), { type: 'reinforcement/remove', index: -1 })).toBeNull();
    expect(applyCommand(baseDoc(), { type: 'reinforcement/remove', index: 0 })).toBeNull();
  });

  it('al quitar el último deja la lista vacía y no baja la versión del documento', () => {
    const one = applyCommand(baseDoc(), upsert(anchor())) ?? baseDoc();
    const next = applyCommand(one, { type: 'reinforcement/remove', index: 0 });
    expect(next?.reinforcements).toEqual([]);
    expect(next?.version).toBe('0.4');
  });
});

describe('selección y versión', () => {
  const store = () => createEditorStore({ ...baseDoc(), version: '0.4', reinforcements: [anchor(), pile(), sheet()] }, null);
  const select = (s: ReturnType<typeof store>, selection: Selection): void => s.dispatch({ type: 'ui/select', selection });

  it('quitar un refuerzo reindexa la selección: el mismo pasa a none y los posteriores bajan uno', () => {
    const s = store();
    select(s, { kind: 'reinforcement', index: 1 });
    s.dispatch({ type: 'reinforcement/remove', index: 1 });
    expect(s.getState().ui.selection).toEqual({ kind: 'none' });
    select(s, { kind: 'reinforcement', index: 1 });
    s.dispatch({ type: 'reinforcement/remove', index: 0 });
    expect(s.getState().ui.selection).toEqual({ kind: 'reinforcement', index: 0 });
  });

  it('un tirador seleccionado también se reindexa', () => {
    const s = store();
    select(s, { kind: 'reinforcement_end', index: 2, end: 2 });
    s.dispatch({ type: 'reinforcement/remove', index: 0 });
    expect(s.getState().ui.selection).toEqual({ kind: 'reinforcement_end', index: 1, end: 2 });
    s.dispatch({ type: 'reinforcement/remove', index: 1 });
    expect(s.getState().ui.selection).toEqual({ kind: 'none' });
  });

  it('isSelectionValid comprueba el índice', () => {
    const doc = { ...baseDoc(), reinforcements: [anchor()] };
    expect(isSelectionValid({ kind: 'reinforcement', index: 0 }, doc)).toBe(true);
    expect(isSelectionValid({ kind: 'reinforcement', index: 1 }, doc)).toBe(false);
    expect(isSelectionValid({ kind: 'reinforcement_end', index: 0, end: 1 }, baseDoc())).toBe(false);
  });

  it('alta, edición y baja son un solo paso deshacible cada una', () => {
    const s = createEditorStore(baseDoc(), null);
    const before = s.getState().doc;
    s.dispatch(upsert(anchor()));
    expect(s.getState().history.past).toEqual([before]);
    expect(s.getState().doc.version).toBe('0.4');
    s.dispatch(upsert(anchor({ tensile_capacity: 5 }), 0));
    expect(s.getState().history.past).toHaveLength(2);
    s.dispatch({ type: 'reinforcement/remove', index: 0 });
    expect(s.getState().history.past).toHaveLength(3);
    s.undo();
    expect(s.getState().doc.reinforcements).toEqual([anchor({ tensile_capacity: 5 })]);
    s.undo();
    expect(s.getState().doc.reinforcements).toEqual([anchor()]);
    s.undo();
    expect(s.getState().doc).toBe(before);
    expect(s.getState().doc.version).toBe('0.2');
    s.redo();
    expect(s.getState().doc.version).toBe('0.4');
  });

  it('un comando inválido no toca el estado, el historial ni la revisión', () => {
    const s = createEditorStore(baseDoc(), null);
    const state = s.getState();
    s.dispatch(upsert({ ...anchor(), x1: Number.NaN }));
    s.dispatch({ type: 'reinforcement/remove', index: 0 });
    expect(s.getState()).toBe(state);
  });

  it('doc/load de un documento con refuerzos y versión menor la sube a 0.4', () => {
    const doc = { ...baseDoc(), reinforcements: [anchor()] };
    expect(applyCommand(baseDoc(), { type: 'doc/replace', doc, fileName: null })?.version).toBe('0.4');
  });
});
