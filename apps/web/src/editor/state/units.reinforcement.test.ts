// Conversión de unidades de los refuerzos (v0.4): longitudes, fuerzas por elemento, fuerzas por metro y esfuerzos; los ángulos no cambian.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { FIVE, anchor, pile, sheet } from './reinforcementFixtures';
import type { ModelDoc } from '../types';
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

  it('los opcionales ausentes siguen ausentes (salvo spacing, que se escribe explícito) y los tipos no se tocan', () => {
    const out = convertDocUnits(withR([anchor()]), 'imperial').reinforcements?.[0] as Reinforcement;
    expect('end1_capacity' in out).toBe(false);
    // E14o-12 (R11B-01): el `spacing` omitido (1 en la unidad del modelo) se escribe siempre explícito y convertido: 1 m → 3,28084 ft.
    expect((out as { spacing?: number }).spacing).toBeCloseTo(UNIT_FACTORS.length, 12);
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

describe('spacing omitido en la conversión (E14o-12, R11B-01)', () => {
  const noSpacing = (): Reinforcement[] => [
    { type: 'anchor', id: 'a', x1: 0, y1: 0, x2: 1, y2: 0, application: 'active', tensile_capacity: 100, direction: 'axial' },
    { type: 'nail', id: 'n', x1: 0, y1: 0, x2: 1, y2: 0, application: 'passive', tensile_capacity: 100, direction: 'axial' },
    { type: 'geosynthetic', id: 'g', x1: 0, y1: 0, x2: 1, y2: 0, application: 'passive', tensile_capacity: 40, direction: 'tangent' },
    { type: 'pile', id: 'p', x1: 0, y1: 0, x2: 0, y2: -1, application: 'passive', force: 60, direction: 'angle', angle: 0 },
    { type: 'sheet_pile', id: 's', x1: 0, y1: 0, x2: 0, y2: -1, application: 'passive', force: 120, direction: 'angle', angle: 0 },
  ];
  const sp = (r: Reinforcement): number | undefined => (r as { spacing?: number }).spacing;

  it('SI → imperial: cada tipo con espaciamiento escribe 3,28084 ft (1 m) y la tablestaca no lleva spacing', () => {
    const out = convertDocUnits(withR(noSpacing()), 'imperial').reinforcements ?? [];
    for (const r of out.filter((x) => x.type !== 'sheet_pile')) expect(sp(r), r.id).toBeCloseTo(UNIT_FACTORS.length, 12);
    expect('spacing' in (out[4] as object)).toBe(false);
  });

  it('imperial → SI: el spacing omitido (1 ft) pasa a 0,3048 m', () => {
    const imp = { ...withR(noSpacing()), units: 'imperial' } as ModelDoc;
    const out = convertDocUnits(imp, 'SI').reinforcements ?? [];
    for (const r of out.filter((x) => x.type !== 'sheet_pile')) expect(sp(r), r.id).toBeCloseTo(0.3048, 12);
  });

  it('un spacing nulo se trata como omitido', () => {
    const list = noSpacing().map((r) => (r.type === 'sheet_pile' ? r : ({ ...r, spacing: null } as unknown as Reinforcement)));
    const out = convertDocUnits(withR(list), 'imperial').reinforcements ?? [];
    expect(sp(out[0] as Reinforcement)).toBeCloseTo(UNIT_FACTORS.length, 12);
  });
});
