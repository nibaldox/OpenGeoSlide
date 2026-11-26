// Unidades de los campos de la v0.3 (F3.2, F3.3): Su y su límite como esfuerzo, la cota como longitud, el gradiente como esfuerzo por longitud
// y los puntos de la polilínea; los puntos de la función entre dovelas (ξ, f) no tienen unidades. El FS no cambia (motor nativo).
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import { simpleSlope, type SlopeInput } from '../app/newModel';
import type { ModelDoc } from '../types';
import { OGS_BIN, engineRun, haveEngine } from './engineRun.testutil';
import { UNIT_FACTORS, convertDocUnits } from './units';

const slope = (): SlopeInput => ({
  units: 'SI',
  height: 10,
  slope: { kind: 'angle', degrees: 30 },
  crownWidth: 10,
  toeWidth: 20,
  depth: 10,
  material: { name: 'Arcilla', unit_weight: 19, cohesion: 30, friction_angle: 28 },
  water: 'toe',
  lower: { material: { name: 'Roca', unit_weight: 23, cohesion: 60, friction_angle: 38 }, contact: { kind: 'depth', depth: 4 } },
});

const constant: Material = { id: 'su', name: 'Su', model: 'undrained', unit_weight: 19, undrained_strength: 40 };
const linear: Material = { ...constant, id: 'su2', unit_weight: 19, undrained_strength: 15, strength_datum: 10, strength_gradient: 2.5, strength_limit: 70 };

/** Talud simple con las dos capas no drenadas (perfil lineal con límite arriba, Su constante abajo), círculo fijo y métodos de la v0.2. */
function undrainedModel(): ModelDoc {
  const doc = simpleSlope(slope());
  const [m0, m1] = doc.materials as [Material, Material];
  doc.materials = [{ ...linear, id: m0.id, name: m0.name }, { ...constant, id: m1.id, name: m1.name, unit_weight: 23 }];
  doc.analysis = { ...doc.analysis, methods: ['bishop', 'spencer'], search: null, surface: { type: 'circle', xc: 22.1, yc: 17.4, r: 19.55 } };
  return doc;
}

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);

describe('convertDocUnits con material no drenado', () => {
  const si = undrainedModel();
  const imp = convertDocUnits(si, 'imperial');
  const [c1, c0] = imp.materials as [Material, Material]; // c1: perfil lineal; c0: Su constante

  it('Su y el límite como esfuerzo (1 kPa = 20,885434 psf), la cota como longitud y el gradiente como esfuerzo por longitud', () => {
    expect(c0.undrained_strength).toBeCloseTo(40 * 20.885434, 4);
    expect(c1.undrained_strength).toBeCloseTo(15 * 20.885434, 4);
    expect(c1.strength_limit).toBeCloseTo(70 * 20.885434, 4);
    expect(c1.strength_datum).toBeCloseTo(10 * 3.28084, 5);
    // 1 kPa/m = 6,365880 psf/ft (igual que 1 kN/m³ = 6,365880 pcf: es esfuerzo/longitud).
    expect(c1.strength_gradient).toBeCloseTo(2.5 * 6.36588, 4);
    expect(c0.unit_weight).toBeCloseTo(23 * 6.36588, 4);
  });

  it('no inventa campos: el material constante sigue sin cota, gradiente ni límite, y sin cohesión ni fricción', () => {
    expect(Object.keys(c0).sort()).toEqual(['id', 'model', 'name', 'undrained_strength', 'unit_weight']);
    expect(c0.model).toBe('undrained');
  });

  it('no toca el documento original ni la fricción de un material Mohr-Coulomb mezclado', () => {
    expect((si.materials[0] as Material).strength_gradient).toBe(2.5);
    const mixed = { ...si, materials: [si.materials[1] as Material, { id: 'mc', name: 'MC', model: 'mohr_coulomb', unit_weight: 20, cohesion: 5, friction_angle: 30 } as Material] };
    const out = convertDocUnits(mixed as ModelDoc, 'imperial').materials[1] as Material;
    expect(out.friction_angle).toBe(30);
    expect(out.cohesion).toBeCloseTo(5 * 20.885434, 4);
    expect(out.undrained_strength).toBeUndefined();
  });

  it('los puntos de la polilínea fija se convierten como longitud y la función entre dovelas no cambia', () => {
    const doc: ModelDoc = {
      ...si,
      analysis: {
        ...si.analysis,
        search: null,
        surface: { type: 'polyline', points: [[4, 2], [8, 1.5], [12, 3]] },
        methods: ['spencer', 'morgenstern_price'],
        interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] },
      },
    };
    const out = convertDocUnits(doc, 'imperial');
    const f = UNIT_FACTORS.length;
    expect(out.analysis.surface).toEqual({ type: 'polyline', points: [[4 * f, 2 * f], [8 * f, 1.5 * f], [12 * f, 3 * f]] });
    expect(out.analysis.interslice).toEqual({ function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] });
  });

  it('ida y vuelta SI → imperial → SI y imperial → SI → imperial: error relativo < 1e-9 en Su, límite, cota y gradiente', () => {
    const back = convertDocUnits(imp, 'SI');
    for (const [i, key] of [[1, 'undrained_strength'], [0, 'undrained_strength'], [0, 'strength_limit'], [0, 'strength_datum'], [0, 'strength_gradient']] as const) {
      const a = (si.materials[i] as Material)[key] as number;
      const b = (back.materials[i] as Material)[key] as number;
      expect(relErr(a, b), `${key} del material ${i}`).toBeLessThan(1e-9);
    }
    const there = convertDocUnits(back, 'imperial');
    expect(relErr((there.materials[0] as Material).strength_gradient as number, c1.strength_gradient as number)).toBeLessThan(1e-9);
  });
});

describe.skipIf(!haveEngine)(`el FS de un modelo no drenado con círculo no cambia al convertir (motor: ${OGS_BIN})`, () => {
  const fos = (doc: ModelDoc): Record<string, number> => {
    const r = engineRun(doc);
    expect(r.code, r.out).toBe(0);
    for (const x of r.results) expect(x.status, `${x.method} debe converger`).toBe('converged');
    return Object.fromEntries(r.results.map((x) => [x.method, x.fos as number]));
  };

  it.each([
    ['Su constante y lineal con límite', undrainedModel],
    [
      'gradiente negativo con límite (mínimo)',
      () => {
        const d = undrainedModel();
        d.materials[0] = { ...(d.materials[0] as Material), undrained_strength: 50, strength_gradient: -0.5, strength_limit: 20 };
        return d;
      },
    ],
    [
      'con piezométrica y sismo',
      () => {
        const d = undrainedModel();
        d.analysis = { ...d.analysis, seismic: { kh: 0.1, kv: 0 } };
        return d;
      },
    ],
  ])('Bishop y Spencer dan el mismo FS en SI y en imperial (%s)', (_name, make) => {
    const si = make();
    const imp = convertDocUnits(si, 'imperial');
    const a = fos(si);
    const b = fos(imp);
    for (const method of ['bishop', 'spencer']) {
      expect(Number.isFinite(a[method]), `${method} SI`).toBe(true);
      expect(Math.abs((a[method] as number) - (b[method] as number)), `${method}: SI ${a[method]} vs imperial ${b[method]}`).toBeLessThan(1e-6);
    }
  });

  it('el FS sí responde a Su (control de que la prueba mide algo): duplicar Su sube el FS', () => {
    const base = undrainedModel();
    const doubled = undrainedModel();
    doubled.materials = doubled.materials.map((m) => ({ ...m, undrained_strength: (m.undrained_strength as number) * 2, strength_limit: m.strength_limit === undefined ? undefined : (m.strength_limit as number) * 2 }));
    expect(fos(doubled).bishop as number).toBeGreaterThan(fos(base).bishop as number);
  });

  it('sin convertir el gradiente (el defecto que evita esta conversión) el FS cambia', () => {
    const si = undrainedModel();
    const imp = convertDocUnits(si, 'imperial');
    const wrong: ModelDoc = { ...imp, materials: imp.materials.map((m, i) => (i === 0 ? { ...m, strength_gradient: si.materials[0]!.strength_gradient } : m)) };
    expect(Math.abs(fos(si).bishop! - fos(wrong).bishop!)).toBeGreaterThan(1e-3);
  });
});
