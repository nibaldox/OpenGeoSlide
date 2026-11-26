// Refuerzos de prueba compartidos por los tests de formato, reductor, validación local y panel (no se importa desde
// código de producción). Misma geometría que la tabla de acuerdo de `verification/tools/test_schema.py` (v0.4, F4.2).

import type { PileReinforcement, Reinforcement, SheetPileReinforcement, TensionReinforcement } from '../../engine/types';

export const anchor = (over: Partial<TensionReinforcement> = {}): TensionReinforcement => ({
  id: 'a1',
  type: 'anchor',
  x1: 44,
  y1: 12,
  x2: 30,
  y2: 8,
  application: 'active',
  tensile_capacity: 100,
  direction: 'axial',
  ...over,
});

export const pile = (over: Partial<PileReinforcement> = {}): PileReinforcement => ({
  id: 'p1',
  type: 'pile',
  x1: 40,
  y1: 12,
  x2: 40,
  y2: 2,
  application: 'passive',
  force: 60,
  spacing: 1.5,
  direction: 'angle',
  angle: 0,
  ...over,
});

export const sheet = (over: Partial<SheetPileReinforcement> = {}): SheetPileReinforcement => ({
  id: 's1',
  type: 'sheet_pile',
  x1: 40,
  y1: 12.5,
  x2: 40,
  y2: 0.5,
  application: 'active',
  force: 120,
  direction: 'perpendicular',
  ...over,
});

/** Los cinco tipos, uno de cada. */
export const FIVE: Reinforcement[] = [
  anchor({ pullout: { model: 'bond', strength: 30, bonded_length: 5 }, end1_capacity: 20 }),
  anchor({ id: 'n1', type: 'nail', application: 'passive', direction: 'tangent', spacing: 2.5, pullout: { model: 'development', length1: 3, length2: 4 } }),
  anchor({ id: 'g1', type: 'geosynthetic', application: 'passive', direction: 'bisector', pullout: { model: 'interface', adhesion: 10, friction_angle: 20, coverage: 0.8 } }),
  pile(),
  sheet(),
];
