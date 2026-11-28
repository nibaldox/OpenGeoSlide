// CM-W3A · informe y tablas tras la revisión adversarial (lente B, E17f): semilla exacta (RCM-B-01), superficie del método que rige (RCM-B-06),
// rótulos de carga dentro del recuadro y tabla global sin cortar «Morgenstern-Price» (RCM-B-12) y ganador de la tabla del refinamiento (RCM-B-13).
// La línea del HUD (RCM-B-07) está en `editor/app/resultSummary.global.test.ts`; el chip parcial (RCM-B-10), en `shellModel.test.ts`; la Ayuda y la
// leyenda de atajos (RCM-B-08 y 15), en `onboarding/helpContent.v07.test.ts`.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, GlobalStats, MethodReport } from '../engine/types';
import { ResultsTable } from '../ui/ResultsTable';
import { buildReportContent, buildSectionDrawing, primaryResult, type ReportBlock, type ReportSection } from './content';
import { GLOBAL_STATS_WINS, globalSearchFixture } from './globalFixtures';
import { MAX_LOAD_LABEL_ROWS, buildReportPdfWith, layoutLoadLabels, registerFonts, tableColumnWidths, type FontLoader } from './pdf';
import { sampleInput } from './fixtures';
import type { ReportInput } from './types';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

// Se espía `jsPDF.text` y `jsPDF.rect` (sin leer el PDF binario): los rótulos de la figura y su recuadro.
interface Call {
  text: string;
  x: number;
  y: number;
  w: number;
  page: number;
  halo: boolean;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  style: string;
}
const spy = vi.hoisted(() => ({ calls: [] as Call[], rects: [] as Rect[] }));
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
      const rect = this.rect.bind(this) as (...a: unknown[]) => unknown;
      (this as unknown as { rect: unknown }).rect = (...a: unknown[]): unknown => {
        const [x, y, w, h, style] = a as [number, number, number, number, string];
        spy.rects.push({ x, y, w, h, style, page: this.getCurrentPageInfo().pageNumber });
        return rect(...a);
      };
    }
  }
  return { ...actual, jsPDF: SpyPdf };
});

async function pdfCalls(input: ReportInput): Promise<{ calls: Call[]; rects: Rect[] }> {
  spy.calls.length = 0;
  spy.rects.length = 0;
  await buildReportPdfWith(input, { loadFont, compress: true });
  return { calls: spy.calls.slice(), rects: spy.rects.slice() };
}

const sec = (c: ReturnType<typeof buildReportContent>, id: string): ReportSection => {
  const found = c.sections.find((s) => s.id === id);
  if (!found) throw new Error(`falta la sección ${id}`);
  return found;
};
const kv = (s: ReportSection): Record<string, string> => {
  const b = s.blocks.find((x) => x.kind === 'kv');
  return b && b.kind === 'kv' ? Object.fromEntries(b.rows) : {};
};
const tables = (s: ReportSection) => s.blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');

/** El mismo informe con otro `global` y otros FS por método. */
function withGlobalSpec(global: NonNullable<NonNullable<NonNullable<ModelDoc['analysis']['search']>['non_circular']>['global']>): ReportInput {
  const { input } = globalSearchFixture();
  const model: ModelDoc = structuredClone(input.model);
  model.analysis.search!.non_circular!.global = global;
  return { ...input, model };
}

describe('RCM-B-01: la semilla y los candidatos del informe se escriben con String, no con fmtParam', () => {
  it('Number.MAX_SAFE_INTEGER sale entero («9007199254740991»), no «9007200000000000»', () => {
    const rows = kv(sec(buildReportContent(withGlobalSpec({ algorithm: 'block', generated: 2000, seed: Number.MAX_SAFE_INTEGER, polish: true })), 'model'));
    expect(rows['Semilla global']).toBe('9007199254740991');
    expect(rows['Candidatos globales']).toBe('2000');
    expect(rows['Semilla global']).not.toContain('9007200000000000');
  });

  it('una semilla de siete cifras tampoco se redondea a seis (1234567, no 1234570)', () => {
    expect(kv(sec(buildReportContent(withGlobalSpec({ seed: 1234567 })), 'model'))['Semilla global']).toBe('1234567');
  });

  it('sin la semilla en el documento: «0 (por defecto)» y 500 (por defecto) como siempre', () => {
    const rows = kv(sec(buildReportContent(withGlobalSpec({})), 'model'));
    expect(rows['Semilla global']).toBe('0 (por defecto)');
    expect(rows['Candidatos globales']).toBe('500 (por defecto)');
  });

  it('el PDF real lleva los 16 dígitos', async () => {
    const { calls } = await pdfCalls(withGlobalSpec({ seed: Number.MAX_SAFE_INTEGER }));
    expect(calls.some((c) => c.text.includes('9007199254740991'))).toBe(true);
    expect(calls.some((c) => c.text.includes('9007200000000000'))).toBe(false);
  });
});

describe('RCM-B-06: el informe dibuja la superficie del método que rige (E17f §2)', () => {
  /** Dos métodos con superficies distintas: el primero (Spencer) con FS mayor, el segundo (M-P) con el mínimo. */
  function twoMethods(fosSpencer: number, fosMp: number): { model: ModelDoc; results: MethodReport[] } {
    const { input } = globalSearchFixture();
    const [spencer, mp] = input.results as [MethodReport, MethodReport];
    const shift = (r: MethodReport, dx: number): MethodReport => ({ ...r, slices: r.slices.map((s) => ({ ...s, x_left: s.x_left + dx, x_right: s.x_right + dx })) });
    return { model: input.model, results: [shift({ ...spencer, fos: fosSpencer }, 0), shift({ ...mp, fos: fosMp }, 0.3)] };
  }

  it('con Spencer 1,010 y Morgenstern-Price 0,992 la figura es la de Morgenstern-Price (V053)', () => {
    const { model, results } = twoMethods(1.01, 0.992);
    expect(primaryResult(results)?.method).toBe('morgenstern_price');
    const d = buildSectionDrawing(model, results);
    expect(d.surface?.method).toBe('morgenstern_price');
    // La leyenda de la figura nombra el mismo método.
    expect(d.legend.find((l) => l.kind === 'surface')?.label).toContain('Morgenstern-Price');
  });

  it('con el mínimo en el primer método, el primero (como siempre)', () => {
    const { model, results } = twoMethods(0.9, 1.1);
    expect(buildSectionDrawing(model, results).surface?.method).toBe('spencer');
  });

  it('un empate al mostrar tres decimales: el primero de los que empatan, como `pickShownMethod`', () => {
    const { results } = twoMethods(1.0004, 1.0001);
    expect(primaryResult(results)?.method).toBe('spencer');
  });

  it('un método que no convergió no rige, aunque su FS sea menor', () => {
    const { results } = twoMethods(1.2, 0.5);
    results[1] = { ...results[1]!, status: 'not_converged' };
    expect(primaryResult(results)?.method).toBe('spencer');
  });

  it('sin ningún método convergido, el primero con dovelas (la regla de siempre)', () => {
    const { results } = twoMethods(1.2, 0.5);
    const failed = results.map((r) => ({ ...r, status: 'not_converged' as const }));
    expect(primaryResult(failed)?.method).toBe('spencer');
  });
});

describe('RCM-B-12: rótulos de carga dentro del recuadro de la sección', () => {
  const anchor = (cx: number) => ({ cx, half: 8 });

  it('layoutLoadLabels: el reparto de siempre (primera fila libre en su sitio) mientras no pasa del tope', () => {
    const slots = layoutLoadLabels([anchor(60), anchor(100), anchor(64), anchor(62)], 20, 160);
    expect(slots.map((s) => s.row)).toEqual([0, 0, 1, 2]);
    expect(slots.map((s) => s.cx)).toEqual([60, 100, 64, 62]);
  });

  it('layoutLoadLabels: con más de MAX_LOAD_LABEL_ROWS encimados, nunca pasa del tope y reparte en horizontal sin salir del dibujo', () => {
    const anchors = Array.from({ length: 16 }, (_, i) => anchor(100 + i * 0.5));
    const slots = layoutLoadLabels(anchors, 20, 160);
    expect(Math.max(...slots.map((s) => s.row))).toBeLessThan(MAX_LOAD_LABEL_ROWS);
    for (const s of slots) {
      expect(s.cx - 8).toBeGreaterThanOrEqual(20 + 1 - 1e-9);
      expect(s.cx + 8).toBeLessThanOrEqual(20 + 160 - 1 + 1e-9);
    }
    // Ningún par de rótulos de la misma fila se pisa.
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (slots[i]!.row === slots[j]!.row) expect(Math.abs(slots[i]!.cx - slots[j]!.cx), `${i}-${j}`).toBeGreaterThanOrEqual(16);
      }
    }
  });

  /** V051: una sobrecarga ancha y una escalera de 14 cargas contiguas de 0,5 m en la cresta, cada una con su `q`. */
  function stackedLoads(): ReportInput {
    const input = sampleInput();
    const xs = input.model.regions.flatMap((r) => r.polygon.map((p) => p[0]));
    const xmax = Math.max(...xs);
    const loads = Array.from({ length: 14 }, (_, i) => ({ type: 'udl' as const, id: `u${i}`, x1: xmax - 7 + i * 0.5, x2: xmax - 6.5 + i * 0.5, q: 20.5 + i }));
    return { ...input, model: { ...input.model, loads } };
  }

  it('el PDF de la escalera de cargas: ningún rótulo `q = … kPa` sale por arriba del recuadro de la sección', async () => {
    const { calls, rects } = await pdfCalls(stackedLoads());
    const labels = calls.filter((c) => c.halo && /^q = /.test(c.text));
    expect(labels.length).toBe(14);
    const frame = rects.find((r) => r.style === 'S' && r.w > 60 && r.h > 30)!;
    expect(frame).toBeDefined();
    for (const l of labels) {
      // Texto de 7,5 pt: unos 2,6 mm sobre la línea base.
      expect(l.y - 2.6, l.text).toBeGreaterThanOrEqual(frame.y - 1e-6);
      expect(l.page).toBe(frame.page);
      expect(l.x).toBeGreaterThanOrEqual(frame.x - 1e-6);
      expect(l.x + l.w).toBeLessThanOrEqual(frame.x + frame.w + 1e-6);
    }
  });

  it('con una sola sobrecarga la figura es la de siempre (misma franja)', async () => {
    const input = sampleInput();
    const xs = input.model.regions.flatMap((r) => r.polygon.map((p) => p[0]));
    const one: ReportInput = { ...input, model: { ...input.model, loads: [{ type: 'udl', id: 'u1', x1: Math.max(...xs) - 6, x2: Math.max(...xs) - 1, q: 20 }] } };
    const { calls, rects } = await pdfCalls(one);
    const frame = rects.find((r) => r.style === 'S' && r.w > 60 && r.h > 30)!;
    const label = calls.find((c) => c.halo && c.text === 'q = 20 kPa')!;
    expect(label.y - 2.6).toBeGreaterThanOrEqual(frame.y);
  });

  it('la tabla «Búsqueda global» no parte «Morgenstern-Price» en la primera columna', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    registerFonts(doc, await loadFont('DejaVuSans.ttf'), await loadFont('DejaVuSans-Bold.ttf'));
    const input = globalSearchFixture().input;
    // Con Morgenstern-Price y Spencer en la tabla (el escenario de V051).
    const content = buildReportContent(input);
    const t = tables(sec(content, 'results')).find((x) => x.title === 'Búsqueda global');
    const table = t ?? content.sections.flatMap((s) => tables(s)).find((x) => x.title === 'Búsqueda global')!;
    expect(table.rows.map((r) => r[0])).toContain('Morgenstern-Price');
    expect(table.keepWholeChars).toBeGreaterThanOrEqual('Morgenstern-Price'.length);
    const widths = tableColumnWidths(doc, table.header, table.rows, 8.5, undefined, table.keepWholeChars);
    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(8.5);
    expect(doc.getTextWidth('Morgenstern-Price') + 2).toBeLessThanOrEqual(widths[0]!);
    // Y sin la corrección, no cabía: el ancho por defecto partía la palabra.
    const before = tableColumnWidths(doc, table.header, table.rows, 8.5);
    expect(before[0]!).toBeLessThan(widths[0]!);
  });

  it('el PDF no parte «Morgenstern-Price» en dos líneas dentro de la tabla «Búsqueda global»', async () => {
    const { calls } = await pdfCalls(globalSearchFixture().input);
    expect(calls.some((c) => c.text === 'Morgenstern')).toBe(false);
    expect(calls.some((c) => c.text === '-Price')).toBe(false);
  });
});

describe('RCM-B-13: «Superficie ganadora» de la tabla del refinamiento nombra al ganador del refinamiento', () => {
  /** scenario_max_seed: FS círculo (semilla) 1,092, FS polilínea 1,093, FS global 1,015, gana la global. */
  const withNc = (patch: { seed_fos: number; polyline_fos?: number; winner?: GlobalStats['winner'] | null }): ReportInput => {
    const { input } = globalSearchFixture();
    const results = input.results.map((r) => {
      const nc = { ...r.search!.non_circular!, seed_fos: patch.seed_fos } as NonNullable<NonNullable<MethodReport['search']>['non_circular']>;
      if (patch.polyline_fos === undefined) delete nc.polyline_fos;
      else nc.polyline_fos = patch.polyline_fos;
      if (patch.winner === null) delete nc.global;
      else if (patch.winner) nc.global = { ...(nc.global ?? GLOBAL_STATS_WINS), winner: patch.winner };
      return { ...r, search: { ...r.search!, non_circular: nc } };
    });
    return { ...input, results };
  };
  const winnerCol = (input: ReportInput): string[] => {
    const t = buildReportContent(input).sections.flatMap((s) => tables(s)).find((x) => x.title === 'Búsqueda no circular (refinamiento de semillas)')!;
    return t.rows.map((r) => r[r.length - 1]!);
  };
  const html = (input: ReportInput): string =>
    renderToStaticMarkup(createElement(ResultsTable, { report: { engine: 'ogs-core 0.7.0', results: input.results } as AnalysisReport, elapsedMs: 5, shownMethod: 'spencer', onShowMethod: () => undefined, lengthUnit: 'm' }));
  const htmlWinners = (input: ReportInput): string[] => {
    const block = html(input);
    const nc = block.slice(block.indexOf('data-testid="non-circular-summary"'), block.indexOf('data-testid="global-summary"'));
    return [...nc.matchAll(/<tr><td>[^<]*<\/td>(?:<td[^>]*>[^<]*<\/td>)*?<td>([^<]*)<\/td><\/tr>/g)].map((m) => m[1]!);
  };

  it('gana la global con polilínea 1,093 > círculo 1,092: «Polilínea (global)», no «Polilínea» a secas', () => {
    const input = withNc({ seed_fos: 1.092, polyline_fos: 1.093, winner: 'global' });
    expect(winnerCol(input)).toEqual(['Polilínea (global)', 'Polilínea (global)']);
    expect(htmlWinners(input)).toEqual(['Polilínea (global)', 'Polilínea (global)']);
  });

  it('gana el refinamiento: se compara polyline_fos con seed_fos', () => {
    expect(winnerCol(withNc({ seed_fos: 1.402, polyline_fos: 1.384, winner: 'refinement' }))).toEqual(['Polilínea', 'Polilínea']);
    expect(winnerCol(withNc({ seed_fos: 1.402, polyline_fos: 1.41, winner: 'refinement' }))).toEqual(['Círculo', 'Círculo']);
    expect(htmlWinners(withNc({ seed_fos: 1.402, polyline_fos: 1.41, winner: 'refinement' }))).toEqual(['Círculo', 'Círculo']);
  });

  it('sin búsqueda global la columna es la de siempre', () => {
    expect(winnerCol(withNc({ seed_fos: 1.402, polyline_fos: 1.384, winner: null }))).toEqual(['Polilínea', 'Polilínea']);
  });
});
