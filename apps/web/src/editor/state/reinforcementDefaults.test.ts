// R11B-07 / E14o-16: el botón «Agregar» del panel y la herramienta «Dibujar refuerzo» del lienzo comparten UNA fuente de ids y de valores
// por omisión (`reinforcementDefaults`). Estas pruebas fijan que no vuelvan a divergir.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { reinforcePlace } from '../canvas/reinforce';
import { EMPTY_DRAFT } from '../canvas/draw';
import { REINFORCEMENT_TYPES, newReinforcement } from '../canvas/reinforcements';
import { defaultReinforcement } from '../panels/reinforcementForm';
import type { ModelDoc } from '../types';
import { nextReinforcementId, reinforcementDefaults } from './reinforcementDefaults';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

const doc = (units: 'SI' | 'imperial', reinforcements: Reinforcement[] = []): ModelDoc =>
  ({
    ...baseDoc(),
    version: '0.4',
    units,
    materials: [{ id: 'm1', name: 'm1', model: 'mohr_coulomb', unit_weight: 18, cohesion: 10, friction_angle: 25 }],
    regions: [{ material: 'm1', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }],
    water: null,
    slope: { direction: 'auto' },
    reinforcements,
  }) as unknown as ModelDoc;

/** Solo lo que el lienzo y el panel deben compartir: todo menos la geometría. */
const withoutGeometry = (r: Reinforcement): Record<string, unknown> => {
  const { id: _id, x1: _x1, y1: _y1, x2: _x2, y2: _y2, ...rest } = r as unknown as Record<string, unknown>;
  return rest;
};

describe('valores por omisión compartidos entre el lienzo y el panel', () => {
  it.each(REINFORCEMENT_TYPES)('%s: la herramienta del lienzo y «Agregar» crean los mismos valores, con el mismo id, en SI', (type) => {
    const d = doc('SI');
    const panel = defaultReinforcement(type, d) as Reinforcement;
    const canvas = newReinforcement(type, nextReinforcementId([], type), [3, 10], [3, 5], 'SI');
    expect(withoutGeometry(canvas)).toEqual(withoutGeometry(panel));
    expect(canvas.id).toBe(panel.id);
    expect(canvas.id).toMatch(/^[anpgs]1$/);
  });

  it.each(REINFORCEMENT_TYPES)('%s: lo mismo en imperial (valores convertidos una sola vez)', (type) => {
    const d = doc('imperial');
    const panel = defaultReinforcement(type, d) as Reinforcement;
    const canvas = newReinforcement(type, nextReinforcementId([], type), [3, 10], [3, 5], 'imperial');
    expect(withoutGeometry(canvas)).toEqual(withoutGeometry(panel));
  });

  it.each(REINFORCEMENT_TYPES)('%s: la herramienta del lienzo (dos clics) numera como el panel y numeran igual dos altas seguidas', (type) => {
    const place = (d: ModelDoc, p1: [number, number], p2: [number, number]): Reinforcement => {
      const ctx = { doc: d, ui: { tool: 'draw_reinforcement' } } as never;
      const first = reinforcePlace(type, EMPTY_DRAFT, ctx, p1);
      const second = reinforcePlace(type, first.draft, ctx, p2);
      return (second.actions[0] as { reinforcement: Reinforcement }).reinforcement;
    };
    const one = place(doc('SI'), [3, 10], [2, 6]);
    const two = place(doc('SI', [one]), [4, 9], [3, 5]);
    const panelTwo = defaultReinforcement(type, doc('SI', [one])) as Reinforcement;
    expect(one.id).toBe(`${{ anchor: 'a', nail: 'n', geosynthetic: 'g', pile: 'p', sheet_pile: 's' }[type]}1`);
    expect(two.id).toBe(panelTwo.id);
    expect(two.id.endsWith('2')).toBe(true);
    expect(withoutGeometry(two)).toEqual(withoutGeometry(one));
  });

  it('el id salta los ya usados, sea cual sea su origen (panel, lienzo o archivo)', () => {
    const used = [
      { ...(reinforcementDefaults('anchor', 'SI') as object), id: 'a1', x1: 1, y1: 1, x2: 2, y2: 2 },
      { ...(reinforcementDefaults('anchor', 'SI') as object), id: 'a2', x1: 1, y1: 1, x2: 2, y2: 2 },
      { ...(reinforcementDefaults('anchor', 'SI') as object), id: 'a4', x1: 1, y1: 1, x2: 2, y2: 2 },
    ] as Reinforcement[];
    expect(nextReinforcementId(used, 'anchor')).toBe('a3');
    expect(nextReinforcementId(used, 'sheet_pile')).toBe('s1');
    expect(nextReinforcementId([], 'geosynthetic')).toBe('g1');
  });

  it('el pilote y la tablestaca: pasivos, fuerza tangente a la superficie, sin angle; la tablestaca sin spacing', () => {
    for (const type of ['pile', 'sheet_pile'] as const) {
      const d = reinforcementDefaults(type, 'SI') as unknown as Record<string, unknown>;
      expect(d).toMatchObject({ type, application: 'passive', direction: 'tangent' });
      expect('angle' in d).toBe(false);
    }
    expect('spacing' in (reinforcementDefaults('sheet_pile', 'SI') as object)).toBe(false);
  });

  it('el anclaje es activo con end1_capacity = tensile_capacity y el clavo lleva adherencia', () => {
    const a = reinforcementDefaults('anchor', 'SI') as unknown as { application: string; tensile_capacity: number; end1_capacity: number };
    expect(a.application).toBe('active');
    expect(a.end1_capacity).toBe(a.tensile_capacity);
    expect(reinforcementDefaults('nail', 'SI')).toMatchObject({ pullout: { model: 'bond', strength: 50 } });
  });

  it('en imperial el spacing va en pies y las capacidades en lbf (misma resistencia por ancho que en SI)', () => {
    for (const type of REINFORCEMENT_TYPES) {
      const si = reinforcementDefaults(type, 'SI') as unknown as Record<string, number | undefined>;
      const imp = reinforcementDefaults(type, 'imperial') as unknown as Record<string, number | undefined>;
      const force = (r: Record<string, number | undefined>): number => (r.force ?? r.tensile_capacity) as number;
      const width = (r: Record<string, number | undefined>): number => (type === 'sheet_pile' ? 1 : (r.spacing as number));
      const perWidth = (r: Record<string, number | undefined>): number => force(r) / width(r);
      const factor = type === 'sheet_pile' ? 68.5218 : 224.809 / 3.28084;
      expect(Math.abs(perWidth(imp) / (perWidth(si) * factor) - 1), `${type}`).toBeLessThan(5e-3);
    }
  });

  it.each(REINFORCEMENT_TYPES)('%s: lo que crea el lienzo es válido para validateLocal', (type) => {
    const d = doc('SI');
    const r = newReinforcement(type, nextReinforcementId([], type), [3, 10], [3, 4], 'SI');
    const errors = validateLocal({ ...d, reinforcements: [r] }).filter((i) => i.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
  });
});
