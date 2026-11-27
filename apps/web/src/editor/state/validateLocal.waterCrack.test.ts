// E15l-14: un γw en kN/m³ en un modelo imperial es un error también cuando el agua entra solo por la grieta (sin piezométrica).
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

const doc = (units: string, unit_weight: number | undefined, water_fill: number): ModelDoc => {
  const d = baseDoc();
  return {
    ...d,
    version: '0.5',
    units,
    water: unit_weight === undefined ? {} : { unit_weight },
    analysis: { ...d.analysis, tension_crack: { depth: 2, water_fill } },
  } as ModelDoc;
};
const gw = (d: ModelDoc) => validateLocal(d).filter((i) => i.code === 'editor.water_unit_weight');

describe('γw con agua solo en la grieta (E15l-14)', () => {
  it('imperial, γw = 9,81 y water_fill > 0, sin piezométrica: error con puntero /water/unit_weight', () => {
    const issues = gw(doc('imperial', 9.81, 1));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', path: '/water/unit_weight' });
  });
  it('sin error con γw en pcf, con water_fill = 0, en SI o sin γw (el motor usa el valor de su sistema, E15l-6)', () => {
    expect(gw(doc('imperial', 62.4, 1))).toEqual([]);
    expect(gw(doc('imperial', 9.81, 0))).toEqual([]);
    expect(gw(doc('SI', 9.81, 1))).toEqual([]);
    expect(gw(doc('imperial', undefined, 1))).toEqual([]);
  });
});
