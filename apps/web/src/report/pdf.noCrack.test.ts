// E15n-4: la figura del PDF dibuja el mismo rótulo que el lienzo y Casos cuando el motor informa la grieta con `depth` 0: «Sin grieta (z = 0)» o,
// con `face_height` > 0, «Corte de la masa (cara de …) sin grieta de tracción» (E15m-15); con el mismo texto y la unidad del modelo, dentro de la
// página y sin encimarse con otro rótulo de la figura. Se espía `jsPDF.text` (sin leer el PDF binario ni requerir poppler).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildReportInput, type EngineRun } from '../editor/app/reportInput';
import { haveEngine, OGS_BIN } from '../editor/state/engineRun.testutil';
import type { ModelDoc } from '../editor/types';
import { openOgsJson, saveOgsJson } from '../io/ogsJson';
import type { AnalysisReport } from '../engine/types';
import type { MethodReport } from '../engine/types';
import { NO_CRACK_LABEL, cutNoCrackLabelText } from '../render/crack';
import { buildReportContent } from './content';
import { sampleInput } from './fixtures';
import { buildReportPdfWith, type FontLoader } from './pdf';
import { syntheticItoMatsuiInput } from './reinforcementFixtures';
import type { ReportInput } from './types';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

interface Call {
  text: string;
  x: number;
  y: number;
  w: number;
  page: number;
  halo: boolean;
}

// `text` es un método de instancia de jsPDF (no del prototipo): una subclase lo envuelve en el constructor y anota cada llamada.
const spy = vi.hoisted(() => ({ calls: [] as Call[] }));
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class SpyPdf extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      const text = this.text.bind(this) as (...a: unknown[]) => unknown;
      (this as unknown as { text: unknown }).text = (...a: unknown[]): unknown => {
        const [t, x, y, opts] = a as [string | string[], number, number, { align?: string; renderingMode?: string } | undefined];
        const str = Array.isArray(t) ? t.join(' ') : String(t);
        const w = this.getTextWidth(str);
        const left = opts?.align === 'center' ? x - w / 2 : opts?.align === 'right' ? x - w : x;
        spy.calls.push({ text: str, x: left, y, w, page: this.getCurrentPageInfo().pageNumber, halo: opts?.renderingMode === 'stroke' });
        return text(...a);
      };
    }
  }
  return { ...actual, jsPDF: SpyPdf };
});

/** Todos los `doc.text` de un PDF, con su posición (mm), ancho medido y página; `halo` marca los rótulos de la figura (modo trazo del halo). */
async function textCalls(input: ReportInput): Promise<Call[]> {
  spy.calls.length = 0;
  await buildReportPdfWith(input, { loadFont, compress: true });
  return spy.calls.slice();
}

const slice = (xl: number, xr: number, yl: number, yr: number) =>
  ({ x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl, alpha: 0.2, base_length: xr - xl, weight: 100, cohesion: 3, tan_phi: 0.35, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0 }) as never;
const withCrack = (input: ReportInput, crack: MethodReport['tension_crack']): ReportInput => ({
  ...input,
  model: { ...input.model, version: '0.5', analysis: { ...input.model.analysis, tension_crack: { depth: 'auto', water_fill: 1 } } },
  results: input.results.map((m) => ({ ...m, slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], tension_crack: crack })),
});
const figureLabels = (calls: Call[], text: string): Call[] => calls.filter((c) => c.halo && c.text === text);
const overlaps = (a: Call, b: Call): boolean => a.page === b.page && a.x < b.x + b.w - 0.2 && b.x < a.x + a.w - 0.2 && a.y - 2.6 < b.y + 0.8 && b.y - 2.6 < a.y + 0.8;

describe('PDF: rótulo de la figura sin grieta de tracción (E15n-4)', () => {
  it('el contenido lleva la grieta sin profundidad y sus dovelas en `drawing.noCrack`, y null con grieta o sin informe', () => {
    const none = buildReportContent(withCrack(sampleInput(), { x: 32, depth: 0, water_force: 0 }));
    const drawing = (c: typeof none) => c.sections.flatMap((s) => s.blocks).find((b) => b.kind === 'drawing');
    const d0 = drawing(none);
    expect(d0?.kind === 'drawing' && d0.drawing.noCrack?.crack).toEqual({ x: 32, depth: 0, water_force: 0 });
    expect(d0?.kind === 'drawing' && d0.drawing.noCrack?.slices.length).toBe(2);
    expect(d0?.kind === 'drawing' && d0.drawing.crack).toBeNull();
    const real = drawing(buildReportContent(withCrack(sampleInput(), { x: 47, depth: 2.4, water_force: 28.2 })));
    expect(real?.kind === 'drawing' && real.drawing.noCrack).toBeNull();
    expect(real?.kind === 'drawing' && real.drawing.crack).not.toBeNull();
    const absent = drawing(buildReportContent(withCrack(sampleInput(), undefined)));
    expect(absent?.kind === 'drawing' && absent.drawing.noCrack).toBeNull();
  });

  it('sin grieta (z = 0): la figura rotula «Sin grieta (z = 0)» una vez, con el texto del lienzo, dentro de la página', async () => {
    const calls = await textCalls(withCrack(sampleInput(), { x: 32.1245, depth: 0, water_force: 0 }));
    const fig = figureLabels(calls, NO_CRACK_LABEL);
    expect(fig).toHaveLength(1);
    expect(fig[0]!.x).toBeGreaterThanOrEqual(14);
    expect(fig[0]!.x + fig[0]!.w).toBeLessThanOrEqual(210 - 14);
    // La tabla de la grieta conserva el mismo texto (no se quitó) y el corte no aparece.
    expect(calls.filter((c) => !c.halo && c.text.includes(NO_CRACK_LABEL)).length).toBeGreaterThan(0);
    expect(calls.some((c) => /^Corte de la masa \(cara de/.test(c.text))).toBe(false);
  });

  it('corte de la masa: la figura rotula «Corte de la masa (cara de … m) sin grieta de tracción», no «Sin grieta», con la unidad del modelo', async () => {
    const calls = await textCalls(withCrack(sampleInput(), { x: 32.1245, depth: 0, water_force: 0, face_height: 1.7827 }));
    const fig = figureLabels(calls, cutNoCrackLabelText(1.7827, 'SI'));
    expect(fig).toHaveLength(1);
    expect(fig[0]!.text).toBe('Corte de la masa (cara de 1,78 m) sin grieta de tracción');
    expect(figureLabels(calls, NO_CRACK_LABEL)).toHaveLength(0);
    expect(fig[0]!.x).toBeGreaterThanOrEqual(14);
    expect(fig[0]!.x + fig[0]!.w).toBeLessThanOrEqual(210 - 14);
  });

  it('en unidades imperiales la cara va en pies, como el lienzo', async () => {
    const input = withCrack(sampleInput(), { x: 32.1245, depth: 0, water_force: 0, face_height: 5.85 });
    const calls = await textCalls({ ...input, model: { ...input.model, units: 'imperial' } });
    expect(figureLabels(calls, cutNoCrackLabelText(5.85, 'imperial')).map((c) => c.text)).toEqual(['Corte de la masa (cara de 5,85 ft) sin grieta de tracción']);
  });

  it('con una grieta con profundidad no hay rótulo de «sin grieta» en la figura', async () => {
    const calls = await textCalls(withCrack(sampleInput(), { x: 47, depth: 2.4, water_force: 28.2 }));
    expect(figureLabels(calls, NO_CRACK_LABEL)).toHaveLength(0);
    expect(calls.some((c) => c.halo && /^Corte de la masa \(cara de/.test(c.text))).toBe(false);
  });

  it('no se encima con los demás rótulos de la figura (refuerzos y fuerzas), con ninguna ancla de x_c', async () => {
    const base = syntheticItoMatsuiInput();
    const xs = base.results[0]!.slices.flatMap((s) => [s.x_left, s.x_right]);
    // Anclas repartidas por todo el ancho de las dovelas: el rótulo se desplaza en vertical hasta no pisar a otro.
    for (const x of [xs[0]!, xs[Math.floor(xs.length / 4)]!, xs[Math.floor(xs.length / 2)]!, xs[Math.floor((3 * xs.length) / 4)]!, xs[xs.length - 1]!]) {
      const input: ReportInput = { ...base, results: base.results.map((m) => ({ ...m, tension_crack: { x, depth: 0, water_force: 0, face_height: 1.7827 } })) };
      const calls = await textCalls(input);
      const label = cutNoCrackLabelText(1.7827, 'SI');
      const mine = figureLabels(calls, label);
      expect(mine, `x_c = ${x}`).toHaveLength(1);
      const others = calls.filter((c) => c.halo && c.text !== label);
      expect(others.length).toBeGreaterThan(0);
      expect(others.filter((o) => overlaps(mine[0]!, o)).map((o) => o.text), `x_c = ${x}`).toEqual([]);
    }
  });
});

// Con el motor real (OGS_BIN): a04_udl (corte de la masa bajo una sobrecarga) y un modelo con grieta automática y c = 0 (sin grieta). El cálculo va
// en `beforeAll`, que no corre cuando el bloque se omite (sin OGS_BIN `pnpm test` da 0 fallas).
describe.skipIf(!haveEngine)('PDF con el motor real: rótulo de la figura sin grieta de tracción (E15n-4)', () => {
  const A04 = new URL('../../../../docs/fase3/r12/repro/a04_udl.json', import.meta.url);
  const runInput = (json: string): ReportInput => {
    const dir = mkdtempSync(join(tmpdir(), 'ogs-e15n4-'));
    try {
      const doc = openOgsJson(json).doc as ModelDoc;
      const file = join(dir, 'm.ogs.json');
      const saved = saveOgsJson(doc);
      writeFileSync(file, saved);
      const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error(`${r.stderr}${r.stdout}`);
      const run: EngineRun = { revision: 1, doc, json: saved, sha256: 'a'.repeat(64), report: JSON.parse(r.stdout) as AnalysisReport, elapsedMs: 5, checkedAt: '2026-11-26T12:00:00.000Z' };
      return buildReportInput(run, new Date('2026-11-26T12:00:00.000Z'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  let udl: ReportInput;
  let c0: ReportInput;
  beforeAll(() => {
    const raw = readFileSync(A04, 'utf8');
    udl = runInput(raw);
    const m = JSON.parse(raw) as { materials: { cohesion: number; friction_angle: number }[]; loads?: unknown };
    m.materials[0]!.cohesion = 0;
    m.materials[0]!.friction_angle = 30;
    delete m.loads;
    c0 = runInput(JSON.stringify(m));
  });

  it('a04_udl (corte con cara): el motor informa depth 0 y face_height, y el PDF rotula el corte en la figura, sin encimarse', async () => {
    const tc = udl.results[0]!.tension_crack!;
    expect(tc.depth).toBe(0);
    expect(tc.face_height).toBeGreaterThan(0);
    const label = cutNoCrackLabelText(tc.face_height as number, 'SI');
    const calls = await textCalls(udl);
    const mine = figureLabels(calls, label);
    expect(mine).toHaveLength(1);
    expect(label).toMatch(/^Corte de la masa \(cara de 1,78 m\) sin grieta de tracción$/);
    expect(figureLabels(calls, NO_CRACK_LABEL)).toHaveLength(0);
    expect(mine[0]!.x).toBeGreaterThanOrEqual(14);
    expect(mine[0]!.x + mine[0]!.w).toBeLessThanOrEqual(210 - 14);
    expect(calls.filter((c) => c.halo && c !== mine[0] && overlaps(mine[0]!, c))).toEqual([]);
  });

  it('grieta automática con c = 0 (sin grieta, sin cara): el PDF rotula «Sin grieta (z = 0)» en la figura', async () => {
    const tc = c0.results[0]!.tension_crack!;
    expect(tc.depth).toBe(0);
    expect(tc.face_height).toBeUndefined();
    const calls = await textCalls(c0);
    const mine = figureLabels(calls, NO_CRACK_LABEL);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.x).toBeGreaterThanOrEqual(14);
    expect(mine[0]!.x + mine[0]!.w).toBeLessThanOrEqual(210 - 14);
    expect(calls.filter((c) => c.halo && c !== mine[0] && overlaps(mine[0]!, c))).toEqual([]);
    expect(calls.some((c) => c.halo && /^Corte de la masa/.test(c.text))).toBe(false);
  });
});
