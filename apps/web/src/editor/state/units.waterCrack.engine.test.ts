// R12 B-01 / E15l-14: γw al convertir unidades cuando el agua solo entra por la grieta (`water_fill > 0`, sin piezométrica ni `water`).
//
// Antes, `convertDocUnits` solo escribía γw con piezométrica: sin ella el motor usaba 9,81 «pcf» (6,37 veces menor) y el FS cambiaba
// +4 % al pasar a imperial. Los tests con el motor real (OGS_BIN) comparan el FS en SI y en imperial (1e-9).
import { describe, expect, it } from 'vitest';
import type { TensionCrack } from '../../engine/types';
import { OGS_BIN, engineRun, haveEngine } from './engineRun.testutil';
import { UNIT_FACTORS, convertDocUnits } from './units';
import type { ModelDoc } from '../types';

const METHODS = ['bishop', 'spencer'] as const;

/** Talud de ACADS 1(a) (c = 5, φ = 20°, γ = 19,5) con una grieta fija de 2 m y sin ninguna clave `water`. */
const model = (crack: TensionCrack, water?: ModelDoc['water']): ModelDoc =>
  ({
    format: 'opengeoslide',
    version: '0.5',
    meta: { id: 'water-crack', title: 'Agua solo en la grieta' },
    units: 'SI',
    materials: [{ id: 'm', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 19.5, cohesion: 5, friction_angle: 20 }],
    regions: [{ material: 'm', polygon: [[0, 0], [0, 10], [20, 10], [50, 20], [70, 20], [70, 0]] }],
    ...(water ? { water } : {}),
    slope: { direction: 'auto' },
    analysis: { methods: [...METHODS], slices: 50, tolerance: 1e-5, max_iterations: 500, min_m_alpha: 0.2, surface: { type: 'circle', xc: 30, yc: 30, r: 25 }, tension_crack: crack },
  }) as unknown as ModelDoc;

const GW_IMPERIAL = 9.81 * UNIT_FACTORS.unitWeight;

describe('E15l-14: convertDocUnits escribe γw cuando la grieta lleva agua', () => {
  it('SI → imperial sin `water` y con water_fill > 0: crea water.unit_weight = 9,81·factor', () => {
    const imp = convertDocUnits(model({ depth: 2, water_fill: 1 }), 'imperial');
    expect(imp.water?.unit_weight).toBeCloseTo(GW_IMPERIAL, 9);
    expect(imp.water?.piezometric_line ?? null).toBeNull();
  });

  it('SI → imperial con `water` sin γw ni piezométrica y water_fill > 0: lo completa', () => {
    const imp = convertDocUnits(model({ depth: 'auto', water_fill: 0.5 }, {}), 'imperial');
    expect(imp.water?.unit_weight).toBeCloseTo(GW_IMPERIAL, 9);
  });

  it('con water_fill = 0 y sin piezométrica no hay uso del agua: no crea `water`', () => {
    const imp = convertDocUnits(model({ depth: 2, water_fill: 0 }), 'imperial');
    expect(imp.water).toBeUndefined();
  });

  it('un γw explícito se convierte y no se pisa', () => {
    const imp = convertDocUnits(model({ depth: 2, water_fill: 1 }, { unit_weight: 10 }), 'imperial');
    expect(imp.water?.unit_weight).toBeCloseTo(10 * UNIT_FACTORS.unitWeight, 9);
  });

  it('imperial → SI sin γw: no inventa nada (el motor usa 9,81 en SI)', () => {
    const imp = convertDocUnits(model({ depth: 2, water_fill: 1 }), 'imperial');
    const noW = { ...imp, water: undefined } as ModelDoc;
    expect(convertDocUnits(noW, 'SI').water).toBeUndefined();
  });
});

describe.skipIf(!haveEngine)(`E15l-14: invariancia SI ⇄ imperial con agua solo en la grieta, motor real (${OGS_BIN})`, () => {
  const cases: Array<[string, TensionCrack]> = [
    ['grieta fija, llena', { depth: 2, water_fill: 1 }],
    ['grieta automática, medio llena', { depth: 'auto', water_fill: 0.5 }],
  ];
  for (const [title, crack] of cases) {
    it.each(METHODS)(`${title}: %s da el mismo FS en SI y en imperial (1e-9)`, (method) => {
      const si = engineRun(model(crack));
      const imp = engineRun(convertDocUnits(model(crack), 'imperial'));
      expect(si.code, si.out).toBe(0);
      expect(imp.code, imp.out).toBe(0);
      const a = si.results.find((r) => r.method === method);
      const b = imp.results.find((r) => r.method === method);
      expect(a?.status).toBe('converged');
      expect(Math.abs((a!.fos as number) - (b!.fos as number)), `${method}: SI ${a!.fos} vs imperial ${b!.fos}`).toBeLessThan(1e-9);
    });
  }
});
