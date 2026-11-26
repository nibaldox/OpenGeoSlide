// R10B-02: la polilínea inicial es admisible también contra la base del modelo. Barrido con el motor real (OGS_BIN) sobre los 93 casos
// publicados y por las dos rutas del panel Superficie:
//   A. con el círculo crítico fijo (el que halla el motor en la búsqueda de cada caso) → «Polilínea»;
//   B. Búsqueda → «Fija» (círculo de partida `defaultCircle`) → «Polilínea».
// Spencer y Morgenstern-Price deben converger o, como mínimo, no dar `NoValidSurface` ni `polyline_*` (las pocas excepciones de convergencia
// están nombradas y justificadas abajo: dependen de la física del caso, no de la propuesta).

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CircleSurfaceSpec, VerificationCase } from '../../engine/types';
import { openOgsJson } from '../../io/ogsJson';
import { simpleSlope, slopeFormDefaults, slopeFromForm } from '../app/newModel';
import { engineRun, haveEngine } from '../state/engineRun.testutil';
import { checkPolylineAgainstModel } from '../state/polylineGround';
import { applyCommand } from '../state/reducer';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc } from '../types';
import { defaultSearch, fallbackPolyline, initialPolyline, surfaceModeCommands, surfaceShapeCommands } from './forms';

const casesDir = new URL('../../../../../verification/cases/', import.meta.url);
const IDS = readdirSync(casesDir)
  .filter((f) => /^V.*\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const withDoc = (doc: ModelDoc, a: Record<string, unknown>): ModelDoc => ({ ...doc, analysis: { ...doc.analysis, ...a } }) as ModelDoc;
const loadModel = (id: string): ModelDoc => {
  const parsed = JSON.parse(readFileSync(new URL(`${id}.json`, casesDir), 'utf8')) as VerificationCase;
  return openOgsJson(JSON.stringify(parsed.model)).doc as ModelDoc;
};

/** Lo que hace el panel al pasar a «Polilínea»: los comandos de `surfaceShapeCommands` (con Bishop fuera). */
function toPolyline(doc: ModelDoc): ModelDoc {
  let out = doc;
  for (const cmd of surfaceShapeCommands(doc, 'polyline')) out = applyCommand(out, cmd) ?? out;
  return out;
}

/** Ruta A: el círculo crítico de Bishop del propio caso (búsqueda del motor; si el caso ya trae círculo fijo, ese). */
function criticalCircle(doc: ModelDoc): CircleSurfaceSpec | null {
  const s = doc.analysis.surface;
  if (s && s.type === 'circle') return s;
  const base = withDoc(doc, { methods: ['bishop'], surface: null, search: doc.analysis.search ?? defaultSearch(), interslice: undefined });
  const r = engineRun(base).results[0];
  return r?.surface ? { type: 'circle', xc: r.surface.xc, yc: r.surface.yc, r: r.surface.r } : null;
}

/** Ruta B: Búsqueda → Fija (círculo de partida) → Polilínea. */
function routeB(doc: ModelDoc): ModelDoc {
  let out = withDoc(doc, { surface: null, search: defaultSearch() });
  for (const cmd of surfaceModeCommands(out, 'fixed')) out = applyCommand(out, cmd) ?? out;
  return toPolyline(out);
}

const METHODS = ['spencer', 'morgenstern_price'] as const;

interface Verdict {
  id: string;
  route: string;
  bad: string | null;
  statuses: string;
}

function judge(id: string, route: string, doc: ModelDoc): Verdict {
  // La comprobación local (terreno + base) debe dar el mismo veredicto admisible que el motor.
  const surface = doc.analysis.surface;
  const localBad = surface && surface.type === 'polyline' ? checkPolylineAgainstModel(doc.regions, surface.points) : null;
  const localIssue = validateLocal(doc).find((i) => i.code.startsWith('editor.polyline_'));
  if (localBad && !localBad.ok) return { id, route, bad: `local: ${localBad.reason}`, statuses: '' };
  if (localIssue) return { id, route, bad: `validateLocal: ${localIssue.code}`, statuses: '' };
  const run = engineRun(withDoc(doc, { methods: [...METHODS], search: undefined }));
  const bad =
    run.code !== 0
      ? `código ${run.code}: ${run.out.split('\n')[0]}`
      : run.results.flatMap((r) => (r.warnings ?? []).filter((w) => w.startsWith('polyline_')).map((w) => `${r.method}:${w}`))[0] ?? null;
  return { id, route, bad, statuses: run.results.map((r) => `${r.method}=${r.status}`).join(',') };
}

describe.skipIf(!haveEngine)('R10B-02: polilínea inicial admisible (93 casos × 2 rutas, motor real)', () => {
  it('hay 93 casos publicados', () => {
    expect(IDS.length).toBe(93);
  });
  const verdicts: Verdict[] = [];

  it('ruta A (círculo crítico fijo): nunca NoValidSurface ni polyline_*', { timeout: 600_000 }, () => {
    for (const id of IDS) {
      const doc = loadModel(id);
      const c = criticalCircle(doc);
      if (!c) {
        verdicts.push({ id, route: 'A', bad: 'sin círculo crítico', statuses: '' });
        continue;
      }
      verdicts.push(judge(id, 'A', toPolyline(withDoc(doc, { surface: c, search: undefined }))));
    }
    const bad = verdicts.filter((v) => v.route === 'A' && v.bad);
    expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
  });

  it('ruta B (Búsqueda → Fija → Polilínea): nunca NoValidSurface ni polyline_*', { timeout: 600_000 }, () => {
    for (const id of IDS) verdicts.push(judge(id, 'B', routeB(loadModel(id))));
    const bad = verdicts.filter((v) => v.route === 'B' && v.bad);
    expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
  });

  it('ruta C (círculos perturbados del crítico, 5 por caso): nunca NoValidSurface ni polyline_*', { timeout: 600_000 }, () => {
    const shifts: Array<[number, number, number]> = [[0.3, 0, 1], [-0.3, 0.2, 0.8], [0.1, -0.3, 1.3], [-0.2, -0.1, 0.7], [0, 0.4, 1.15]];
    const bad: Verdict[] = [];
    let n = 0;
    for (const id of IDS) {
      const doc = loadModel(id);
      const c = criticalCircle(doc);
      if (!c) continue;
      for (const [dx, dy, k] of shifts) {
        const p = { type: 'circle' as const, xc: c.xc + dx * c.r, yc: c.yc + dy * c.r, r: c.r * k };
        const v = judge(id, 'C', toPolyline(withDoc(doc, { surface: p, search: undefined })));
        n += 1;
        if (v.bad) bad.push(v);
      }
    }
    expect(n).toBe(465);
    expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
  });

  it('el respaldo (V o paralela al terreno) es admisible en los 93 casos, con el motor real', { timeout: 600_000 }, () => {
    const bad: Verdict[] = [];
    let converged = 0;
    for (const id of IDS) {
      const doc = loadModel(id);
      const pts = fallbackPolyline(doc);
      const v = judge(id, 'F', withDoc(doc, { surface: { type: 'polyline', points: pts }, search: undefined }));
      if (v.bad) bad.push(v);
      else if (/spencer=converged/.test(v.statuses) && /morgenstern_price=converged/.test(v.statuses)) converged += 1;
    }
    console.log(`R10B-02 respaldo: ${converged}/93 con ambos convergidos`);
    expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
  });

  it('informa cuántas convergen (para el reporte)', () => {
    const n = (route: string): number => verdicts.filter((v) => v.route === route && /spencer=converged/.test(v.statuses) && /morgenstern_price=converged/.test(v.statuses)).length;
    console.log(`R10B-02 barrido: ruta A ${n('A')}/93 con ambos convergidos; ruta B ${n('B')}/93`);
    for (const v of verdicts.filter((q) => !/spencer=converged/.test(q.statuses) || !/morgenstern_price=converged/.test(q.statuses))) console.log(`  no converge: ${v.route} ${v.id} ${v.statuses}`);
    expect(verdicts.length).toBe(186);
    // Medido: A 89/93 y B 75/93. Los que no convergen no son de admisibilidad: modelos simétricos con el círculo de partida centrado (la masa
    // simétrica no tiene fuerza motriz: `no_driving`) y V018, V027, V028, V032b, V056, V078 (`no_lambda_root` / no convergencia de la física del caso).
    expect(n('A')).toBeGreaterThanOrEqual(85);
    expect(n('B')).toBeGreaterThanOrEqual(70);
  });
});

describe('R10B-02: acads1a y talud simple nuevo', () => {
  const talud = (): ModelDoc => {
    const out = slopeFromForm({ ...slopeFormDefaults('SI'), lowerOn: false });
    if (!out.ok) throw new Error('formulario inválido');
    return simpleSlope(out.value);
  };
  it.skipIf(!haveEngine)('V047a (acads1a) y el talud simple nuevo convergen con Spencer y M-P por la ruta B', () => {
    for (const doc of [loadModel('V047a'), talud()]) {
      const pts = initialPolyline(routeBBase(doc));
      expect(pts.length).toBeGreaterThanOrEqual(2);
      const v = judge('x', 'B', routeB(doc));
      expect(v.bad).toBeNull();
      expect(v.statuses).toBe('spencer=converged,morgenstern_price=converged');
    }
  });
});

function routeBBase(doc: ModelDoc): ModelDoc {
  return withDoc(doc, { surface: null, search: defaultSearch() });
}
