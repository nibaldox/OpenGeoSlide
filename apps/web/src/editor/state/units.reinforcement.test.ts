// Conversión de unidades de los refuerzos (v0.4): longitudes, fuerzas por elemento, fuerzas por metro y esfuerzos; los ángulos no cambian.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { FIVE, anchor, pile, sheet } from './reinforcementFixtures';
import { baseDoc } from './testFixtures';
import { UNIT_FACTORS, convertDocUnits } from './units';

const withR = (list: Reinforcement[], units = 'SI') => ({ ...baseDoc(), version: '0.4' as const, units, reinforcements: list });
const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('convertDocUnits con refuerzos', () => {
  it('la fuerza por elemento usa kN → lbf y es coherente con la carga lineal', () => {
    expect(UNIT_FACTORS.force).toBeCloseTo(224.808943, 5); // 1 kN en lbf
    expect(relErr(UNIT_FACTORS.lineForce, UNIT_FACTORS.force / UNIT_FACTORS.length)).toBeLessThan(1e-15);
  });

  it('SI → imperial convierte cada campo con su factor y deja los ángulos', () => {
    const r = anchor({
      end1_capacity: 20,
      end2_capacity: 10,
      spacing: 2.5,
      pullout: { model: 'interface', adhesion: 10, friction_angle: 20, coverage: 0.8 },
    });
    const out = convertDocUnits(withR([r, pile({ angle: 15 }), sheet(), anchor({ id: 'b', pullout: { model: 'bond', strength: 30, bonded_length: 5 } }), anchor({ id: 'd', pullout: { model: 'development', length1: 3, length2: 4 } })]), 'imperial').reinforcements ?? [];
    const [a, p, s, b, d] = out;
    const L = UNIT_FACTORS.length;
    if (a?.type !== 'anchor' || p?.type !== 'pile' || s?.type !== 'sheet_pile' || b?.type !== 'anchor' || d?.type !== 'anchor') throw new Error('tipos');
    expect([a.x1, a.y1, a.x2, a.y2]).toEqual([44 * L, 12 * L, 30 * L, 8 * L]);
    expect(a.tensile_capacity).toBeCloseTo(100 * UNIT_FACTORS.force, 9);
    expect(a.end1_capacity).toBeCloseTo(20 * UNIT_FACTORS.force, 9);
    expect(a.end2_capacity).toBeCloseTo(10 * UNIT_FACTORS.force, 9);
    expect(a.spacing).toBeCloseTo(2.5 * L, 12);
    expect(a.pullout).toEqual({ model: 'interface', adhesion: 10 * UNIT_FACTORS.stress, friction_angle: 20, coverage: 0.8 });
    expect(p.force).toBeCloseTo(60 * UNIT_FACTORS.force, 9);
    expect(p.spacing).toBeCloseTo(1.5 * L, 12);
    expect(p.angle).toBe(15);
    expect(s.force).toBeCloseTo(120 * UNIT_FACTORS.lineForce, 9);
    expect(s.x1).toBe(s.x2);
    expect(b.pullout).toEqual({ model: 'bond', strength: 30 * UNIT_FACTORS.lineForce, bonded_length: 5 * L });
    expect(d.pullout).toEqual({ model: 'development', length1: 3 * L, length2: 4 * L });
  });

  it('ida y vuelta SI → imperial → SI da los mismos números', () => {
    const doc = withR(FIVE);
    const back = convertDocUnits(convertDocUnits(doc, 'imperial'), 'SI').reinforcements ?? [];
    expect(back).toHaveLength(FIVE.length);
    back.forEach((r, i) => {
      const o = FIVE[i] as Reinforcement;
      for (const [key, value] of Object.entries(o)) {
        const got = (r as unknown as Record<string, unknown>)[key];
        if (typeof value === 'number') expect(relErr(got as number, value) < 1e-12 || got === value, `${o.id}.${key}`).toBe(true);
        else if (key !== 'pullout') expect(got, `${o.id}.${key}`).toEqual(value);
      }
    });
  });

  it('los opcionales ausentes siguen ausentes y los tipos no se tocan', () => {
    const out = convertDocUnits(withR([anchor()]), 'imperial').reinforcements?.[0] as Reinforcement;
    expect('end1_capacity' in out).toBe(false);
    expect('spacing' in out).toBe(false);
    expect('pullout' in out).toBe(false);
    expect(out.type).toBe('anchor');
    expect(out.direction).toBe('axial');
    expect(out.application).toBe('active');
  });

  it('un documento sin refuerzos no gana la clave', () => {
    expect('reinforcements' in convertDocUnits(baseDoc(), 'imperial')).toBe(false);
  });

  it('no muta el documento original', () => {
    const doc = withR(FIVE);
    const frozen = JSON.stringify(doc);
    convertDocUnits(doc, 'imperial');
    expect(JSON.stringify(doc)).toBe(frozen);
  });
});
