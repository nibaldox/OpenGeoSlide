import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { polygonsOverlap } from '../state/polygonChecks';
import { validateLocal } from '../state';
import type { ModelDoc } from '../types';
import { insertionCommands, sharedInsertions, splitMessage, splitRegion, withInsertions, type SplitResult } from './regionOps';

const area = (poly: readonly Point[]): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i] as Point;
    const q = poly[(i + 1) % poly.length] as Point;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

/** Talud de 15 m a 1,5H:1V: corona 10 m, pie en x = 32,5, hasta x = 60 y y = −10. */
const SLOPE: Point[] = [[0, -10], [60, -10], [60, 0], [32.5, 0], [10, 15], [0, 15]];

function ok(r: SplitResult): Extract<SplitResult, { ok: true }> {
  if (!r.ok) throw new Error(`se esperaba una división válida: ${r.reason}`);
  return r;
}

describe('splitRegion: casos válidos', () => {
  it('horizontal: el contacto y = −5 divide el talud en dos partes con vértices compartidos', () => {
    const r = ok(splitRegion(SLOPE, [[-5, -5], [65, -5]]));
    expect(r.entry.edge).toBe(5); // arista de cierre (0,15)→(0,−10)
    expect(r.entry.vertex).toBeNull();
    expect(r.entry.point).toEqual([0, -5]);
    expect(r.exit.point).toEqual([60, -5]);
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(SLOPE), 9);
    // la parte nueva es la de abajo (la franja −10…−5)
    expect(area(r.added)).toBeCloseTo(60 * 5, 9);
    expect(r.added.every((p) => p[1] <= -5 + 1e-12)).toBe(true);
    expect(r.kept.some((p) => p[0] === 0 && p[1] === -5)).toBe(true);
    expect(r.kept.some((p) => p[0] === 60 && p[1] === -5)).toBe(true);
    expect(r.added.filter((p) => p[1] === -5)).toHaveLength(2);
    expect(polygonsOverlap(r.kept, r.added, 1e-9)).toBe(false);
  });

  it('la línea puede empezar y terminar justo sobre el borde', () => {
    const r = ok(splitRegion(SLOPE, [[0, -5], [60, -5]]));
    expect(r.path).toEqual([[0, -5], [60, -5]]);
    expect(area(r.added)).toBeCloseTo(300, 9);
  });

  it('inclinada: una línea de (0, −2) a (60, −8) deja dos partes simples cuya suma es el área total', () => {
    const r = ok(splitRegion(SLOPE, [[-3, -1.7], [63, -8.3]]));
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(SLOPE), 8);
    expect(r.entry.point[0]).toBeCloseTo(0, 9);
    expect(r.entry.point[1]).toBeCloseTo(-2, 6);
    expect(r.exit.point[1]).toBeCloseTo(-8, 6);
    expect(polygonsOverlap(r.kept, r.added, 1e-9)).toBe(false);
  });

  it('polilínea con un quiebre interior: el quiebre es vértice de ambas partes', () => {
    const r = ok(splitRegion(SLOPE, [[-1, -4], [20, -6], [61, -4]]));
    expect(r.path).toHaveLength(3);
    expect(r.kept.filter((p) => p[0] === 20 && p[1] === -6)).toHaveLength(1);
    expect(r.added.filter((p) => p[0] === 20 && p[1] === -6)).toHaveLength(1);
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(SLOPE), 8);
  });

  it('pasa por un vértice: entrada en un vértice del polígono, sin duplicarlo', () => {
    // De la esquina (0, −10) hacia el interior y fuera por la arista derecha.
    const r = ok(splitRegion(SLOPE, [[0, -10], [40, -5], [61, -5]]));
    expect(r.entry.vertex).toBe(0);
    expect(r.entry.edge).toBeNull();
    expect(r.exit.point).toEqual([60, -5]);
    const count = [...r.kept, ...r.added].filter((p) => p[0] === 0 && p[1] === -10).length;
    expect(count).toBe(2); // una vez en cada parte, sin repetirse dentro de ninguna
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(SLOPE), 8);
  });

  it('salida en un vértice: de la arista izquierda al pie (32,5; 0)', () => {
    const r = ok(splitRegion(SLOPE, [[-2, -2], [32.5, 0]]));
    expect(r.exit.vertex).toBe(3);
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(SLOPE), 9);
  });

  it('vertical: dos mitades; la que se queda es la de la izquierda', () => {
    const r = ok(splitRegion([[0, 0], [10, 0], [10, 10], [0, 10]], [[5, -1], [5, 11]]));
    expect(area(r.kept)).toBeCloseTo(50, 9);
    expect(r.kept.every((p) => p[0] <= 5)).toBe(true);
    expect(r.added.every((p) => p[0] >= 5)).toBe(true);
  });

  it('región cóncava (en L): una línea que la cruza una vez la divide', () => {
    const L: Point[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    const r = ok(splitRegion(L, [[-1, 5], [21, 5]]));
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(L), 9);
    expect(area(r.added)).toBeCloseTo(100, 9);
    expect(polygonsOverlap(r.kept, r.added, 1e-9)).toBe(false);
    // la parte de arriba es cóncava (L) y sigue siendo un polígono simple de 6 vértices
    expect(r.kept).toHaveLength(6);
  });

  it('región cóncava: una línea que sale del borde del brazo y atraviesa el entrante', () => {
    const L: Point[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
    const r = ok(splitRegion(L, [[10, 15], [-1, 12]]));
    expect(r.entry.edge).toBe(3);
    expect(area(r.kept) + area(r.added)).toBeCloseTo(area(L), 9);
    expect(polygonsOverlap(r.kept, r.added, 1e-9)).toBe(false);
  });
});

describe('splitRegion: casos inválidos con mensaje accionable', () => {
  const reason = (line: Point[], polygon: Point[] = SLOPE): string => {
    const r = splitRegion(polygon, line);
    if (r.ok) throw new Error('se esperaba un rechazo');
    expect(r.message).toBe(splitMessage(r.reason));
    expect(r.message.length).toBeGreaterThan(20);
    return r.reason;
  };

  it('una línea de un solo punto', () => expect(reason([[0, 0]])).toBe('too_short'));
  it('una línea que no toca la región', () => expect(reason([[-5, 40], [70, 40]])).toBe('few_hits'));
  it('una línea que empieza dentro y no sale', () => expect(reason([[20, -5], [40, -5]])).toBe('few_hits'));
  it('una línea que solo entra por un lado', () => expect(reason([[-5, -5], [30, -5]])).toBe('few_hits'));
  it('una línea que va pegada al borde', () => expect(reason([[0, -3], [0, -8]])).toBe('on_boundary'));
  it('la línea sobre una arista entera', () => expect(reason([[-1, -10], [61, -10]])).toBe('on_boundary'));
  it('una línea que se autointersecta (en lazo) dentro de la región', () => {
    expect(reason([[-1, -3], [20, -3], [20, -8], [10, -8], [10, -2], [30, -2], [61, -6]])).toBe('self_intersect');
  });
  it('una línea que cruza el borde cuatro veces (región cóncava)', () => {
    const U: Point[] = [[0, 0], [30, 0], [30, 20], [20, 20], [20, 10], [10, 10], [10, 20], [0, 20]];
    expect(reason([[-1, 15], [31, 15]], U)).toBe('many_hits');
  });
  it('una línea casi pegada al borde (dentro de la tolerancia) cuenta como borde', () => {
    expect(reason([[-1, -9.99999999], [61, -9.99999999]])).toBe('on_boundary');
  });
  it('región con menos de 3 vértices', () => {
    expect(splitRegion([[0, 0], [1, 1]], [[0, 0], [1, 1]]).ok).toBe(false);
  });
});

function twoStrata(): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { id: 'x', title: 'x', notes: null },
    units: 'SI',
    materials: [{ id: 'a', name: 'A', model: 'mohr_coulomb', unit_weight: 18, cohesion: 10, friction_angle: 25, unit_weight_sat: null, ru: null }],
    regions: [{ material: 'a', polygon: [[0, 0], [20, 0], [20, 10], [0, 10]] }],
    water: null,
    loads: [],
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'] },
  } as unknown as ModelDoc;
}

describe('vértices compartidos con las regiones vecinas', () => {
  it('un punto en medio de una arista se inserta en la región vecina; los vértices existentes no', () => {
    const doc = twoStrata();
    const ins = sharedInsertions(doc, [[5, 0], [0, 0], [20, -5]]);
    expect(ins).toHaveLength(1);
    expect(ins[0]).toMatchObject({ regionIndex: 0, afterIndex: 0, at: [5, 0] });
    expect(ins[0]!.t).toBeCloseTo(0.25, 12);
  });

  it('varios puntos en la misma arista se insertan de mayor a menor t para no desplazar índices', () => {
    const doc = twoStrata();
    const ins = sharedInsertions(doc, [[5, 0], [15, 0]]);
    const cmds = insertionCommands(ins);
    expect(cmds.map((c) => (c.type === 'vertex/insert' ? c.at[0] : null))).toEqual([15, 5]);
    const merged = withInsertions(doc, ins);
    expect(merged.regions[0]!.polygon).toEqual([[0, 0], [5, 0], [15, 0], [20, 0], [20, 10], [0, 10]]);
  });

  it('la región que se divide (skip) no recibe inserciones', () => {
    expect(sharedInsertions(twoStrata(), [[5, 0]], 0)).toEqual([]);
  });

  it('el estrato nuevo con el límite compartido valida sin errores locales', () => {
    const doc = twoStrata();
    const lower: Point[] = [[0, 0], [5, 0], [20, 0], [20, -8], [0, -8]];
    const trial = withInsertions({ ...doc, regions: [...doc.regions, { material: 'a', polygon: lower }] }, sharedInsertions(doc, lower));
    expect(validateLocal(trial).filter((i) => i.severity === 'error' && i.code !== 'editor.no_surface')).toEqual([]);
  });
});
