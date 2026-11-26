// La polilínea inicial que propone la web al pasar de círculo a polilínea es admisible por construcción (F3.3): lo comprueba la regla
// del motor portada a TS (`fitPolylineToGround`) y, con OGS_BIN, el motor real: Spencer y Morgenstern-Price convergen de inmediato.
// Antes, la cuerda del círculo crítico pasaba sobre el vértice del pie y el motor daba `polyline_outside_ground`.

import { describe, expect, it } from 'vitest';
import { loadPublishedDoc } from '../../report/fixtures';
import { simpleSlope, slopeFormDefaults, slopeFromForm } from '../app/newModel';
import { engineRun, haveEngine } from '../state/engineRun.testutil';
import { fitPolylineToGround } from '../state/polylineGround';
import { applyCommand } from '../state/reducer';
import type { CircleSurfaceSpec, Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { initialPolyline, surfaceShapeCommands } from './forms';

function talud(lowerOn: boolean): ModelDoc {
  const out = slopeFromForm({ ...slopeFormDefaults('SI'), lowerOn, lowerContact: '3' });
  if (!out.ok) throw new Error('formulario de talud inválido');
  return simpleSlope(out.value);
}

interface Example {
  name: string;
  doc: ModelDoc;
  /** Círculo crítico de Bishop (búsqueda del motor) del modelo: lo que el usuario fija antes de pasar a polilínea. */
  circle: CircleSurfaceSpec;
}

const circle = (xc: number, yc: number, r: number): CircleSurfaceSpec => ({ type: 'circle', xc, yc, r });
const EXAMPLES: Example[] = [
  { name: 'Talud simple sin estrato', doc: talud(false), circle: circle(23.582609285714295, 16.58249518161915, 16.96508028673504) },
  { name: 'Talud simple con estrato inferior (contacto a 3 m bajo el pie)', doc: talud(true), circle: circle(23.582609285714295, 16.58249518161915, 16.96508028673504) },
  { name: 'V047a (ACADS 1(a))', doc: loadPublishedDoc('V047a'), circle: circle(29.54334963719809, 53.63784815923435, 28.641487934160704) },
  { name: 'V020 (talud con bancos)', doc: loadPublishedDoc('V020'), circle: circle(18.21669214356242, 24.326524489972456, 9.915208788104747) },
  { name: 'V040 (dique con berma)', doc: loadPublishedDoc('V040'), circle: circle(85.42769803935137, 119.41098000785419, 113.89722519042294) },
  { name: 'V049 (tres estratos)', doc: loadPublishedDoc('V049'), circle: circle(34.44680165309326, 42.77051231043567, 18.401033309711625) },
];

/** El documento con el círculo fijo (sin búsqueda), como queda tras «Fija» en el panel Superficie. */
const fixed = (doc: ModelDoc, c: CircleSurfaceSpec): ModelDoc => ({ ...doc, analysis: { ...doc.analysis, surface: c, search: undefined } }) as ModelDoc;

/** Lo que hace el panel al pasar a «Polilínea»: los comandos de `surfaceShapeCommands`, con Bishop fuera. */
function toPolyline(doc: ModelDoc): ModelDoc {
  let out = doc;
  for (const cmd of surfaceShapeCommands(doc, 'polyline')) out = applyCommand(out, cmd) ?? out;
  return out;
}

describe('polilínea inicial admisible por construcción', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.name}: la propuesta cumple la regla del motor (círculo crítico fijo)`, () => {
      const pts = initialPolyline(fixed(ex.doc, ex.circle));
      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < pts.length; i += 1) expect(pts[i]![0]).toBeGreaterThan(pts[i - 1]![0]);
      const fit = fitPolylineToGround(ex.doc.regions, pts);
      expect(fit).toMatchObject({ ok: true });
    });

    it(`${ex.name}: sin círculo fijo (círculo de partida) también es admisible`, () => {
      const pts = initialPolyline({ ...ex.doc, analysis: { ...ex.doc.analysis, surface: null } } as ModelDoc);
      expect(fitPolylineToGround(ex.doc.regions, pts)).toMatchObject({ ok: true });
    });

    it.skipIf(!haveEngine)(`${ex.name}: pasar a polilínea y calcular de inmediato con Spencer y M-P converge (motor real)`, () => {
      const doc = toPolyline(fixed(ex.doc, ex.circle));
      expect(doc.analysis.surface?.type).toBe('polyline');
      const run = engineRun({ ...doc, analysis: { ...doc.analysis, methods: ['spencer', 'morgenstern_price', 'janbu_corrected'] } } as ModelDoc);
      expect(run.code).toBe(0);
      expect(run.results.map((r) => [r.method, r.status])).toEqual([
        ['spencer', 'converged'],
        ['morgenstern_price', 'converged'],
        ['janbu_corrected', 'converged'],
      ]);
      for (const r of run.results) expect(r.fos).toBeGreaterThan(0);
    });
  }

  it('barrido de círculos: toda propuesta de un talud con berma y de un talud con estrato es admisible', () => {
    let n = 0;
    for (const ex of [EXAMPLES[1]!, EXAMPLES[4]!, EXAMPLES[3]!]) {
      const { xc, yc, r } = ex.circle;
      for (const dx of [-0.3, -0.1, 0, 0.1, 0.3]) {
        for (const dy of [-0.4, -0.2, 0, 0.2, 0.4]) {
          for (const k of [0.7, 0.85, 1, 1.15]) {
            const c = circle(xc + dx * r, yc + dy * r, r * k);
            const doc = fixed(ex.doc, c);
            const pts = initialPolyline(doc);
            // Se omiten los círculos que no cruzan el terreno dentro del modelo (sin cruces: recta de dos puntos; o salen por una pared lateral,
            // donde ninguna polilínea tiene un cruce con el terreno que prolongar).
            const [x0, x1] = [pts[0]![0], pts[pts.length - 1]![0]];
            const [xMin, xMax] = [Math.min(...ex.doc.regions.flatMap((q) => q.polygon.map((v) => v[0]))), Math.max(...ex.doc.regions.flatMap((q) => q.polygon.map((v) => v[0])))];
            if (pts.length < 3 || x0 <= xMin + 1e-6 || x1 >= xMax - 1e-6) continue;
            n += 1;
            expect(fitPolylineToGround(ex.doc.regions, pts), `${ex.name} ${JSON.stringify(c)}`).toMatchObject({ ok: true });
          }
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('añade un punto en cada vértice del terreno que cae dentro del arco, bajo el terreno', () => {
    const doc = fixed(EXAMPLES[1]!.doc, EXAMPLES[1]!.circle);
    const pts = initialPolyline(doc);
    // El pie del terreno está en x = 20 (y = 0) y el codo de la corona en x = 10 (y = 10): hay un punto en cada uno, bajo el terreno.
    const at = (x: number): Point | undefined => pts.find((p) => Math.abs(p[0] - x) < 1e-9);
    expect(at(20)).toBeDefined();
    expect(at(20)![1]).toBeLessThan(0);
    expect(at(10)).toBeDefined();
    expect(at(10)![1]).toBeLessThan(10);
  });
});

describe('fitPolylineToGround: la misma regla que el motor', () => {
  const doc = talud(true);
  it('una cuerda que pasa sobre el vértice del pie es polyline_outside_ground', () => {
    const fit = fitPolylineToGround(doc.regions, [[8, 9], [19.96, 0.009], [22.4, -0.339], [27, 0]]);
    expect(fit).toEqual({ ok: false, reason: 'polyline_outside_ground' });
  });
  it('un vértice interior sobre el terreno es polyline_outside_ground; una prolongación que sale del modelo, polyline_no_ground_crossing', () => {
    expect(fitPolylineToGround(doc.regions, [[2, 9.9], [8, 9.5], [15, 20], [27, 0]])).toEqual({ ok: false, reason: 'polyline_outside_ground' });
    expect(fitPolylineToGround(doc.regions, [[5, -1], [10, -1.5]])).toEqual({ ok: false, reason: 'polyline_no_ground_crossing' });
  });
  it('prolonga los extremos al terreno y conserva los vértices', () => {
    const fit = fitPolylineToGround(doc.regions, [[8, 5], [15, -1], [25, -1], [30, -0.5]]);
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.fitted).toHaveLength(6);
      expect(fit.fitted[0]![1]).toBeCloseTo(10 - 0, 6); // sale al terreno de la corona (y = 10) o de la cara
      expect(fit.fitted[5]![1]).toBeCloseTo(0, 6);
    }
  });

  it.skipIf(!haveEngine)('coincide con el motor real en 120 polilíneas aleatorias (semilla fija): mismo veredicto polyline_*', () => {
    let seed = 20261126;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let ok = 0;
    let bad = 0;
    for (let k = 0; k < 120; k += 1) {
      const n = 3 + Math.floor(rnd() * 4);
      const xs = Array.from({ length: n }, () => 2 + rnd() * 36).sort((a, b) => a - b);
      const pts: Point[] = xs.map((x, i) => [Math.round(x * 100) / 100 + i * 0.01, Math.round((-7 + rnd() * 18) * 100) / 100]);
      const fit = fitPolylineToGround(doc.regions, pts);
      const run = engineRun({ ...doc, analysis: { ...doc.analysis, search: undefined, surface: { type: 'polyline', points: pts }, methods: ['spencer'] } } as ModelDoc);
      const reason = run.results[0]?.warnings?.find((w) => w.startsWith('polyline_')) ?? null;
      expect(run.code, JSON.stringify(pts)).toBe(0);
      expect(fit.ok ? null : fit.reason, JSON.stringify(pts)).toBe(reason);
      if (fit.ok) ok += 1;
      else bad += 1;
    }
    expect(ok).toBeGreaterThan(10);
    expect(bad).toBeGreaterThan(10);
  });
});
