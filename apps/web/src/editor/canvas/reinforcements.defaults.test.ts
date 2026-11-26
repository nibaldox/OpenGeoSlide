// R11B-07 / E14o-12: un refuerzo nuevo trazado en un modelo imperial lleva `spacing` en pies (antes 1 o 1,5 «ft» con las capacidades en lbf: una
// fuerza por unidad de ancho 3,28 veces mayor que en SI). La resistencia por unidad de ancho debe ser la misma en los dos sistemas.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { OGS_BIN, engineRun, haveEngine } from '../state/engineRun.testutil';
import { UNIT_FACTORS, convertDocUnits } from '../state/units';
import type { ModelDoc } from '../types';
import { REINFORCEMENT_TYPES, newReinforcement } from './reinforcements';

type Flat = Record<string, number | undefined>;
const spacingOf = (r: Reinforcement): number => ((r as unknown as Flat).spacing ?? 1) as number;
/** Capacidad por elemento (o por metro de muro) entre el espaciamiento: la resistencia por unidad de ancho. */
const perWidth = (r: Reinforcement): number => {
  const f = r as unknown as Flat;
  if (r.type === 'sheet_pile') return f.force as number;
  return ((r.type === 'pile' ? f.force : f.tensile_capacity) as number) / spacingOf(r);
};

describe('refuerzo nuevo del lienzo en un modelo imperial (R11B-07)', () => {
  it.each(REINFORCEMENT_TYPES)('%s: spacing en pies y la misma resistencia por ancho que en SI (0,3 %)', (type) => {
    const si = newReinforcement(type, 'x', [10, 10], [10, 2], 'SI');
    const imp = newReinforcement(type, 'x', [10, 10], [10, 2], 'imperial');
    if (type === 'sheet_pile') {
      expect('spacing' in imp).toBe(false);
      expect(perWidth(imp) / (perWidth(si) * UNIT_FACTORS.lineForce)).toBeCloseTo(1, 2);
      return;
    }
    expect(spacingOf(imp) / (spacingOf(si) * UNIT_FACTORS.length), `${type}: spacing ${spacingOf(imp)} ft`).toBeCloseTo(1, 3);
    // Por metro de ancho en SI (kN/m) frente a lbf/ft: el mismo valor físico.
    expect(Math.abs(perWidth(imp) / UNIT_FACTORS.lineForce / perWidth(si) - 1), `${type}: ${perWidth(imp)} lbf/ft`).toBeLessThan(3e-3);
  });

  it('el espaciamiento en pies no coincide con el número de SI (la causa del +203 %)', () => {
    for (const type of ['anchor', 'nail', 'geosynthetic', 'pile'] as const) {
      expect(spacingOf(newReinforcement(type, 'x', [0, 0], [0, -1], 'imperial'))).toBeGreaterThan(3);
    }
  });
});

const BASE = (): ModelDoc =>
  ({
    format: 'opengeoslide',
    version: '0.4',
    meta: { id: 'defaults-imperial', title: 'Refuerzos nuevos del lienzo' },
    units: 'SI',
    materials: [{ id: 'clay', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 8, friction_angle: 23.04, ru: null }],
    regions: [{ material: 'clay', polygon: [[0, 0], [0, 5], [30, 5], [50, 15], [80, 15], [80, 0]] }],
    water: { unit_weight: 9.807, piezometric_line: [[0, 5], [30, 5], [45.5, 9], [70, 12], [80, 12]] },
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop', 'spencer'], slices: 50, tolerance: 1e-5, max_iterations: 500, min_m_alpha: 0.2, surface: { type: 'circle', xc: 35.4, yc: 25.467, r: 22.099 } },
  }) as unknown as ModelDoc;

const PLACE: Record<(typeof REINFORCEMENT_TYPES)[number], [[number, number], [number, number]]> = {
  anchor: [[32, 6], [52, 10]],
  nail: [[30, 5], [48, 6.5]],
  geosynthetic: [[28, 5], [50, 6]],
  pile: [[45, 12.5], [45, 1]],
  sheet_pile: [[40, 10], [40, 0.5]],
};

describe.skipIf(!haveEngine)(`el FS de un refuerzo nuevo del lienzo es el mismo en SI e imperial, con el motor real (${OGS_BIN})`, () => {
  it.each(REINFORCEMENT_TYPES)('%s: diferencia de FS menor que 0,5 % (tres cifras significativas de los valores)', (type) => {
    const [a, b] = PLACE[type];
    const siDoc = { ...BASE(), reinforcements: [newReinforcement(type, 'r', a, b, 'SI')] } as ModelDoc;
    const impBase = convertDocUnits(BASE(), 'imperial');
    const L = UNIT_FACTORS.length;
    const impDoc = { ...impBase, reinforcements: [newReinforcement(type, 'r', [a[0] * L, a[1] * L], [b[0] * L, b[1] * L], 'imperial')] } as ModelDoc;
    const x = engineRun(siDoc);
    const y = engineRun(impDoc);
    expect(x.code, x.out).toBe(0);
    expect(y.code, y.out).toBe(0);
    for (const m of ['bishop', 'spencer']) {
      const fx = x.results.find((r) => r.method === m)!.fos as number;
      const fy = y.results.find((r) => r.method === m)!.fos as number;
      expect(Math.abs(fy / fx - 1), `${type} ${m}: SI ${fx} vs imperial ${fy}`).toBeLessThan(5e-3);
    }
  });
});
