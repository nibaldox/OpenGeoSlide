// CM-C1W · F7.2 y F7.5: la salida de la búsqueda global en la tabla de resultados, el CSV, el contenido del informe y el PDF, el resumen
// de la superficie y la etiqueta del análisis. Con informes escritos a mano (`report/globalFixtures.ts`); y la identidad: sin `global`,
// la salida es la de siempre.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describeAnalysis } from '../App';
import { stepStates } from '../editor/app/shellModel';
import { resultsCsv } from '../editor/app/reportInput';
import type { ModelDoc } from '../editor/types';
import { ResultsTable } from '../ui/ResultsTable';
import { resultsToCsv } from '../io/csv';
import { buildReportContent, type ReportBlock, type ReportSection } from './content';
import { nonCircularCircleWinsFixture, nonCircularPolylineWinsFixture } from './f3bFixtures';
import { GLOBAL_STATS_REFINEMENT, GLOBAL_STATS_WINS, globalSearchFixture } from './globalFixtures';
import { CELL_PAD, buildReportPdfWith, registerFonts, tableColumnWidths, type FontLoader } from './pdf';
import { decodeText } from './pdfText.testutil';

const sec = (c: ReturnType<typeof buildReportContent>, id: string): ReportSection => {
  const found = c.sections.find((s) => s.id === id);
  if (!found) throw new Error(`falta la sección ${id}`);
  return found;
};
const tables = (s: ReportSection) => s.blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');
const kv = (s: ReportSection): Record<string, string> => {
  const b = s.blocks.find((x) => x.kind === 'kv');
  return b && b.kind === 'kv' ? Object.fromEntries(b.rows) : {};
};

describe('F7.5: tabla de resultados con búsqueda global', () => {
  const render = (report: Parameters<typeof resultsCsv>[0]): string =>
    renderToStaticMarkup(createElement(ResultsTable, { report, elapsedMs: 12.5, shownMethod: 'spencer', onShowMethod: () => undefined, lengthUnit: 'm' }));

  it('un bloque «Búsqueda global» por método: algoritmo, generados, elegibles, rechazados por tracción, FS global y ganador', () => {
    const { report } = globalSearchFixture();
    const html = render(report);
    expect(html).toContain('data-testid="global-summary"');
    expect(html).toContain('<caption>Búsqueda global</caption>');
    for (const head of ['Método', 'Algoritmo', 'Generados', 'Elegibles', 'Rechazados por tracción', 'FS global', 'Ganador']) {
      expect(html, head).toContain(`<th scope="col">${head}</th>`);
    }
    const block = html.slice(html.indexOf('data-testid="global-summary"'));
    const rows = [...block.matchAll(/<tr><td>(.*?)<\/tr>/g)].map((m) => m[1]!.replace(/<\/?td[^>]*>/g, '|').replace(/\|+/g, '|'));
    expect(rows).toEqual([
      'Spencer|Bloque sobre capas débiles|300|241|55|1,041|búsqueda global|',
      'Morgenstern-Price|Recocido|300|0|0|Sin superficie elegible|refinamiento|',
    ]);
    // La tabla del refinamiento de siempre sigue ahí.
    expect(html).toContain('Búsqueda no circular (refinamiento de semillas)');
  });

  it('sin global no hay bloque (identidad de la tabla v0.6)', () => {
    const { report } = nonCircularPolylineWinsFixture(false);
    const html = render(report);
    expect(html).not.toContain('global-summary');
    expect(html).not.toContain('Búsqueda global');
  });
});

describe('F7.5: CSV con búsqueda global', () => {
  it('agrega las seis columnas global_* al final y deja vacías las celdas de un método sin global', () => {
    const { report } = globalSearchFixture();
    const lines = resultsToCsv(report.results, { units: 'SI' }).split('\r\n');
    expect(lines[0]).toBe(
      'metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,superficie,funcion_interslice,semillas_nc,evaluadas_nc,fs_semilla,fs_polilinea,global_algoritmo,global_generados,global_elegibles,global_rechazados_traccion,global_fs,global_ganador',
    );
    expect(lines[1]!.split(',').slice(-6)).toEqual(['block', '300', '241', '55', '1.0412', 'global']);
    // Sin candidatos elegibles: `global_fs` queda vacío y gana el refinamiento.
    expect(lines[2]!.split(',').slice(-6)).toEqual(['annealing', '300', '0', '0', '', 'refinement']);
    expect(resultsCsv(report, 'SI').split('\r\n')[0]).toContain(',global_algoritmo,');
  });

  it('un método sin global entre otros con global lleva celdas vacías en las seis columnas', () => {
    const { report } = globalSearchFixture();
    const mixed = [report.results[0]!, { ...report.results[1]!, search: { ...report.results[1]!.search!, non_circular: { ...report.results[1]!.search!.non_circular!, global: undefined } } }];
    const row = resultsToCsv(mixed as never, { units: 'SI' }).split('\r\n')[2]!;
    expect(row.split(',').slice(-6)).toEqual(['', '', '', '', '', '']);
  });

  it('identidad: sin global, el CSV es el mismo byte a byte (cabecera y filas de F6)', () => {
    const { report } = nonCircularPolylineWinsFixture(true);
    const csv = resultsToCsv(report.results, { units: 'SI' });
    expect(csv.split('\r\n')[0]).toBe(
      'metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,superficie,funcion_interslice,semillas_nc,evaluadas_nc,fs_semilla,fs_polilinea',
    );
    expect(csv).not.toContain('global');
    const circle = nonCircularCircleWinsFixture(false).report;
    expect(resultsToCsv(circle.results, { units: 'SI' })).not.toContain('global');
  });
});

describe('F7.5: informe (contenido y PDF) con búsqueda global', () => {
  it('parámetros: algoritmo, candidatos, semilla y pulido, con «(por defecto)» donde el documento no los escribe', () => {
    const rows = kv(sec(buildReportContent(globalSearchFixture().input), 'model'));
    expect(rows['Búsqueda global']).toContain('Sí');
    expect(rows['Algoritmo global']).toBe('Bloque sobre capas débiles');
    expect(rows['Candidatos globales']).toBe('300');
    expect(rows['Semilla global']).toBe('0 (por defecto)');
    expect(rows['Pulido global']).toBe('No');
    // global: {} → todo por defecto
    const input = globalSearchFixture().input;
    input.model.analysis.search!.non_circular = { global: {} };
    const dflt = kv(sec(buildReportContent(input), 'model'));
    expect(dflt['Algoritmo global']).toBe('Automático (por defecto)');
    expect(dflt['Candidatos globales']).toBe('500 (por defecto)');
    expect(dflt['Semilla global']).toBe('0 (por defecto)');
    expect(dflt['Pulido global']).toBe('Sí (por defecto)');
  });

  it('tabla de estadísticas «Búsqueda global» por método, después de la del refinamiento', () => {
    const res = sec(buildReportContent(globalSearchFixture().input), 'results');
    const titles = tables(res).map((t) => t.title);
    expect(titles.indexOf('Búsqueda global')).toBe(titles.indexOf('Búsqueda no circular (refinamiento de semillas)') + 1);
    const t = tables(res).find((x) => x.title === 'Búsqueda global')!;
    expect(t.header).toEqual(['Método', 'Algoritmo', 'Generados', 'Elegibles', 'Rechazados por tracción', 'Evaluaciones', 'FS global', 'Superficie ganadora']);
    expect(t.rows).toEqual([
      ['Spencer', 'Bloque sobre capas débiles', '300', '241', '55', '7415', '1,041', 'búsqueda global'],
      ['Morgenstern-Price', 'Recocido', '300', '0', '0', '300', 'Sin superficie elegible', 'refinamiento'],
    ]);
  });

  it('los dos avisos nuevos salen en la lista de avisos con su texto', () => {
    const content = buildReportContent(globalSearchFixture().input);
    const w = content.sections.find((s) => s.id === 'warnings')!;
    const list = w.blocks[0]!;
    expect(list.kind).toBe('list');
    const text = JSON.stringify(list);
    expect(text).toContain('rama con tracción');
    expect(text).toContain('no dio ninguna superficie elegible');
  });

  it('sin global, el contenido no agrega filas ni tablas de la búsqueda global', () => {
    const content = buildReportContent(nonCircularPolylineWinsFixture(true).input);
    expect(JSON.stringify(content)).not.toMatch(/global/i);
  });

  const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

  it('el PDF real se genera con global y contiene los parámetros, la tabla y los dos avisos', async () => {
    const blob = await buildReportPdfWith(globalSearchFixture().input, { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    for (const needle of [
      'Búsqueda global',
      'Algoritmo global',
      'Bloque sobre capas débiles',
      'Candidatos globales',
      'Semilla global',
      'Pulido global',
      'Rechazados por tracción',
      'Sin superficie elegible',
      'rama con tracción',
      'no dio ninguna superficie elegible',
    ]) {
      expect(text, needle).toContain(needle);
    }
  });

  it('B-07: ninguna palabra de la cabecera de la tabla nueva queda más ancha que su columna en DejaVu Sans', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    registerFonts(doc, await loadFont('DejaVuSans.ttf'), await loadFont('DejaVuSans-Bold.ttf'));
    const content = buildReportContent(globalSearchFixture().input);
    const t = content.sections.flatMap((s) => tables(s)).find((x) => x.title === 'Búsqueda global')!;
    const size = t.header.length >= 11 ? 7 : 8.5;
    const widths = tableColumnWidths(doc, t.header, t.rows, size);
    doc.setFont('DejaVuSans', 'bold');
    doc.setFontSize(size);
    t.header.forEach((h, c) => {
      for (const word of h.split(/\s+/)) {
        expect(doc.getTextWidth(word) + CELL_PAD, `${h} → ${word}`).toBeLessThanOrEqual((widths[c] as number) + 1e-6);
      }
    });
  });
});

describe('F7.5: resumen y etiqueta «no circular, global»', () => {
  const miniDoc = (nc: unknown): ModelDoc =>
    ({
      format: 'opengeoslide',
      version: '0.7',
      meta: {},
      units: 'SI',
      materials: [{ id: 'a', name: 'a', model: 'mohr_coulomb', unit_weight: 18, cohesion: 5, friction_angle: 30 }],
      regions: [{ material: 'a', polygon: [[0, 0], [10, 0], [10, 5], [0, 5]] }],
      analysis: { methods: ['spencer'], search: { type: 'circular_entry_exit', ...(nc === undefined ? {} : { non_circular: nc }) } },
    }) as unknown as ModelDoc;

  it('describeAnalysis y el resumen de la superficie distinguen las cuatro búsquedas', () => {
    expect(describeAnalysis(miniDoc(undefined) as never)).toContain('búsqueda de superficie crítica ·');
    expect(describeAnalysis(miniDoc({}) as never)).toContain('búsqueda de superficie crítica (no circular) ·');
    expect(describeAnalysis(miniDoc({ global: {} }) as never)).toContain('búsqueda de superficie crítica (no circular, global) ·');
    const summary = (doc: ModelDoc): string => stepStates(doc, [], []).surface.summary;
    expect(summary(miniDoc(undefined))).toBe('Búsqueda circular');
    expect(summary(miniDoc({}))).toBe('Búsqueda no circular');
    expect(summary(miniDoc({ global: {} }))).toBe('Búsqueda no circular, global');
    expect(summary(miniDoc({ global: null }))).toBe('Búsqueda no circular');
  });
});

// Un resumen de los valores de prueba para que un cambio de contrato rompa aquí y no en silencio.
describe('fixtures de F7.2', () => {
  it('cumplen la relación entre contadores del contrato', () => {
    for (const g of [GLOBAL_STATS_WINS, GLOBAL_STATS_REFINEMENT]) {
      expect(g.eligible + g.tension_rejected).toBeLessThanOrEqual(g.converged);
      expect(g.converged).toBeLessThanOrEqual(g.generated);
      expect(g.generated).toBeLessThanOrEqual(g.attempts);
      expect(g.generated).toBeLessThanOrEqual(2000);
      expect(g.refined).toBeLessThanOrEqual(3);
      expect(g.polish_evaluated).toBeLessThanOrEqual(g.evaluated);
    }
  });
});
