// R2-I2: la conversión de unidades de los refuerzos (`units/convert`) con el motor real (OGS_BIN): el FS no cambia al pasar de SI a
// imperial y de vuelta, a 1e-9, en los cinco métodos; las fuerzas por cruce se escalan con el factor de su magnitud.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { OGS_BIN, engineRun, haveEngine, type EngineMethodResult } from './engineRun.testutil';
import { UNIT_FACTORS, convertDocUnits } from './units';
import type { ModelDoc } from '../types';

const METHODS = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'] as const;

/** V097a (talud en arcilla con piezométrica y sobrecarga, círculo fijo) con los cinco tipos y los tres modelos de arrancamiento; todos cruzan la superficie. */
const REINFORCEMENTS: Reinforcement[] = [
  { type: 'sheet_pile', id: 'tabl', x1: 40, y1: 10, x2: 40, y2: 0.5, application: 'active', force: 80, direction: 'perpendicular' },
  { type: 'anchor', id: 'anc', x1: 32, y1: 6, x2: 52, y2: 10, application: 'active', tensile_capacity: 150, end1_capacity: 150, spacing: 2.5, direction: 'axial', pullout: { model: 'bond', strength: 40, bonded_length: 10 } },
  { type: 'nail', id: 'clavo', x1: 30, y1: 5, x2: 48, y2: 6.5, application: 'passive', tensile_capacity: 120, spacing: 1.5, direction: 'axial', pullout: { model: 'bond', strength: 35 } },
  { type: 'geosynthetic', id: 'geo', x1: 28, y1: 5, x2: 50, y2: 6, application: 'passive', tensile_capacity: 60, end2_capacity: 10, spacing: 1, direction: 'tangent', pullout: { model: 'interface', adhesion: 4, friction_angle: 22, coverage: 0.8 } },
  { type: 'geosynthetic', id: 'geo2', x1: 29, y1: 5.5, x2: 50, y2: 7, application: 'passive', tensile_capacity: 60, spacing: 1, direction: 'bisector', pullout: { model: 'development', length1: 3, length2: 4 } },
  { type: 'pile', id: 'pil', x1: 45, y1: 12.5, x2: 45, y2: 1, application: 'passive', force: 50, spacing: 1.5, direction: 'angle', angle: 0 },
];

const model = (): ModelDoc =>
  ({
    format: 'opengeoslide',
    version: '0.4',
    meta: { id: 'units-reinforcements', title: 'Refuerzos: unidades' },
    units: 'SI',
    materials: [{ id: 'clay', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 8, friction_angle: 23.04, ru: null }],
    regions: [{ material: 'clay', polygon: [[0, 0], [0, 5], [30, 5], [50, 15], [80, 15], [80, 0]] }],
    water: { unit_weight: 9.807, piezometric_line: [[0, 5], [30, 5], [45.5, 9], [70, 12], [80, 12]] },
    loads: [{ type: 'udl', id: 'u1', x1: 52, x2: 62, q: 35 }],
    reinforcements: REINFORCEMENTS,
    slope: { direction: 'auto' },
    analysis: { methods: [...METHODS], slices: 50, tolerance: 1e-5, max_iterations: 500, min_m_alpha: 0.2, surface: { type: 'circle', xc: 35.4, yc: 25.467, r: 22.099 } },
  }) as unknown as ModelDoc;

describe.skipIf(!haveEngine)(`conversión de unidades de refuerzos con el motor real (${OGS_BIN})`, () => {
  const run = (doc: ModelDoc): Map<string, EngineMethodResult> => {
    const r = engineRun(doc);
    expect(r.code, r.out).toBe(0);
    return new Map(r.results.map((x) => [x.method, x]));
  };
  // Perezosos: el cuerpo de `describe.skipIf` se ejecuta aunque no haya motor (OGS_BIN sin definir).
  const memo = <T,>(f: () => T): (() => T) => {
    let v: T | undefined;
    return () => (v === undefined ? (v = f()) : v);
  };
  const imp = memo(() => convertDocUnits(model(), 'imperial'));
  const A = memo(() => run(model()));
  const B = memo(() => run(imp()));

  it('el modelo trae los cinco tipos y los tres modelos de arrancamiento, y todos aplican fuerza', () => {
    const forces = A().get('bishop')?.reinforcement_forces ?? [];
    expect(forces.map((f) => f.id).sort()).toEqual(['anc', 'clavo', 'geo', 'geo2', 'pil', 'tabl']);
    expect(forces.every((f) => f.status === 'applied')).toBe(true);
    expect(new Set(REINFORCEMENTS.map((r) => r.type)).size).toBe(5);
  });

  it.each(METHODS)('%s: el FS es el mismo en SI y en imperial (1e-9)', (method) => {
    const x = A().get(method);
    const y = B().get(method);
    expect(x?.status).toBe('converged');
    expect(y?.status).toBe('converged');
    expect(Math.abs((x!.fos as number) - (y!.fos as number)), `${method}: SI ${x!.fos} vs imperial ${y!.fos}`).toBeLessThan(1e-9);
  });

  it('las fuerzas por cruce se escalan: fx, fy y available por metro (kN/m → lbf/ft), x e y en pies', () => {
    const fa = A().get('spencer')!.reinforcement_forces!;
    const fb = B().get('spencer')!.reinforcement_forces!;
    expect(fb.map((f) => f.id)).toEqual(fa.map((f) => f.id));
    fa.forEach((f, i) => {
      const g = fb[i]!;
      expect(g.status).toBe(f.status);
      expect(Math.abs(g.x - f.x * UNIT_FACTORS.length) / Math.max(1, Math.abs(g.x))).toBeLessThan(1e-9);
      expect(Math.abs(g.y - f.y * UNIT_FACTORS.length) / Math.max(1, Math.abs(g.y))).toBeLessThan(1e-9);
      for (const k of ['available', 'fx', 'fy'] as const) expect(Math.abs(g[k] - f[k] * UNIT_FACTORS.lineForce) / Math.max(1, Math.abs(g[k])), `${f.id}.${k}`).toBeLessThan(1e-9);
    });
  });

  it('ida y vuelta SI → imperial → SI: el mismo FS en los cinco métodos', () => {
    const a = A();
    const c = run(convertDocUnits(imp(), 'SI'));
    for (const m of METHODS) expect(Math.abs((a.get(m)!.fos as number) - (c.get(m)!.fos as number)), m).toBeLessThan(1e-9);
  });
});
