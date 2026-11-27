// E15l-14: `crackEditCommands` escribe γw explícito al activar el agua de la grieta en imperial; en SI no.
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { baseDoc } from '../state/testFixtures';
import { applyCommand } from '../state/reducer';
import { UNIT_FACTORS } from '../state/units';
import { crackEditCommands } from './crackWater';

const doc = (units: string, water?: ModelDoc['water']): ModelDoc => {
  const { water: _omit, ...rest } = baseDoc();
  return { ...rest, units, ...(water ? { water } : {}) } as ModelDoc;
};
const GW = 9.81 * UNIT_FACTORS.unitWeight;

describe('crackEditCommands (E15l-14)', () => {
  it('imperial, sin γw y water_fill > 0: grieta + water/setUnitWeight(62,45)', () => {
    const cmds = crackEditCommands(doc('imperial'), { depth: 6, water_fill: 1 });
    expect(cmds.map((c) => c.type)).toEqual(['analysis/patch', 'water/setUnitWeight']);
    expect((cmds[1] as { value: number }).value).toBeCloseTo(GW, 9);
  });

  it('aplicados al documento dejan water.unit_weight ≈ 62,449', () => {
    let d = doc('imperial');
    for (const c of crackEditCommands(d, { depth: 'auto', water_fill: 0.5 })) d = applyCommand(d, c) ?? d;
    expect(d.water?.unit_weight).toBeCloseTo(62.4493, 3);
    expect(d.analysis.tension_crack).toEqual({ depth: 'auto', water_fill: 0.5 });
  });

  it('no pisa un γw explícito ni escribe con water_fill = 0, en SI o sin grieta', () => {
    expect(crackEditCommands(doc('imperial', { unit_weight: 62.3 }), { depth: 6, water_fill: 1 }).map((c) => c.type)).toEqual(['analysis/patch']);
    expect(crackEditCommands(doc('imperial'), { depth: 6, water_fill: 0 }).map((c) => c.type)).toEqual(['analysis/patch']);
    expect(crackEditCommands(doc('SI'), { depth: 2, water_fill: 1 }).map((c) => c.type)).toEqual(['analysis/patch']);
    expect(crackEditCommands(doc('imperial'), null)).toEqual([]);
  });
});
