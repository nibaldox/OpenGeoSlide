// Ayudas SOLO para tests: refuerzos v0.4 de prueba sobre el modelo de `fakeStore.ts` (talud de (20, 20) a (40, 10)).
// Se construyen sin `location` (E14m-3) y se asientan con un cast: el tipo de la base todavía lo exigía.

import type { Reinforcement, ReinforcementForce } from '../../engine/types';
import type { ModelDoc } from '../types';
import { makeDoc } from './fakeStore';

export const asReinforcement = (o: object): Reinforcement => o as unknown as Reinforcement;

export const ANCHOR = asReinforcement({
  id: 'anclaje-1', type: 'anchor', x1: 30, y1: 15, x2: 15, y2: 12, application: 'active', tensile_capacity: 150, end1_capacity: 150, spacing: 1, direction: 'axial',
});
export const NAIL = asReinforcement({
  id: 'clavo-1', type: 'nail', x1: 25, y1: 17.5, x2: 10, y2: 14, application: 'passive', tensile_capacity: 100, spacing: 1.5, direction: 'axial', pullout: { model: 'bond', strength: 30 },
});
export const GEO = asReinforcement({
  id: 'geosintetico-1', type: 'geosynthetic', x1: 35, y1: 12.5, x2: 55, y2: 12.5, application: 'passive', tensile_capacity: 40, spacing: 1, direction: 'axial',
});
export const PILE = asReinforcement({
  id: 'pilote-1', type: 'pile', x1: 45, y1: 10, x2: 45, y2: 2, application: 'passive', force: 60, spacing: 1.5, direction: 'angle', angle: 0,
});
export const SHEET = asReinforcement({
  id: 'tablestaca-1', type: 'sheet_pile', x1: 50, y1: 10, x2: 50, y2: 1, application: 'passive', force: 120, direction: 'angle', angle: 0,
});

export const ALL_TYPES: Reinforcement[] = [ANCHOR, NAIL, GEO, PILE, SHEET];

export function docWith(...list: Reinforcement[]): ModelDoc {
  return { ...makeDoc(), version: '0.4', reinforcements: list.map((r) => ({ ...r })) };
}

export function force(patch: Partial<ReinforcementForce> = {}): ReinforcementForce {
  return { id: 'anclaje-1', crossing: 0, x: 22, y: 13.5, station: 9, available: 150, fx: -150, fy: -30, application: 'active', status: 'applied', ...patch } as ReinforcementForce;
}
