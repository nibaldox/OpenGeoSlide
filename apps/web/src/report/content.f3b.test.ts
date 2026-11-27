// F3B-W2: secciones del informe (`report/content.ts` y `report/hoekBrown.ts`) para Hoek-Brown, SHANSEP, búsqueda no circular, avisos F6.7 e identidad v0.5.
import { describe, expect, it } from 'vitest';
import { describeWarning } from '../engine/warnings';
import {
  HOEK_BROWN_REPORT_NOTE,
  buildReportContent,
  buildSectionDrawing,
  type ReportBlock,
  type ReportSection,
} from './content';
import {
  F3B_CRITICAL_POLYLINE,
  hoekBrownFixture,
  hoekBrownNotConvergedFixture,
  nonCircularCircleWinsFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from './f3bFixtures';
import { loadCaseDoc, sampleInput } from './fixtures';
import { deriveHoekBrown, deriveHoekBrownFromMaterial } from './hoekBrown';

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

describe('deriveHoekBrown (ecs. 3 a 5 de Hoek, Carranza-Torres y Corkum, 2002)', () => {
  it('reproduce los ejemplos verificados de X25 (GeoStudio, Hammah 2005 y roca intacta GSI = 100, D = 0)', () => {
    const geo = deriveHoekBrown(10, 20, 1);
    expect(geo.mb).toBeCloseTo(0.032985058, 8);
    expect(geo.s).toBeCloseTo(1.6195968e-6, 12);
    expect(geo.a).toBeCloseTo(0.54372075, 7);

    const hammah = deriveHoekBrown(2, 5, 0);
    expect(hammah.mb).toBeCloseTo(0.067225, 5);
    expect(hammah.s).toBeCloseTo(2.6048e-5, 8);
    expect(hammah.a).toBeCloseTo(0.61921, 5);

    const intact = deriveHoekBrown(12, 100, 0);
    expect(intact.mb).toBeCloseTo(12, 12);
    expect(intact.s).toBeCloseTo(1, 12);
    expect(intact.a).toBeCloseTo(0.5, 12);

    expect(deriveHoekBrownFromMaterial({ mi: 10, gsi: 50, disturbance: null })).toBeNull();
  });
});

describe('Informe F3B: materiales Hoek-Brown y SHANSEP', () => {
  it('Hoek-Brown: tabla con σci, GSI, mi, D, mb, s y a calculados, nota fija de F6.8 y Hoek (1994), y pasadas del lazo por método', () => {
    const { input } = hoekBrownFixture();
    const content = buildReportContent(input);
    const matSec = sec(content, 'materials');
    const mainTable = tables(matSec)[0]!;
    expect(mainTable.rows.map((r) => [r[0], r[2]])).toEqual([
      ['relleno', 'Mohr-Coulomb'],
      ['roca', 'Hoek-Brown'],
    ]);

    const hbTable = tables(matSec).find((t) => t.title === 'Materiales Hoek-Brown generalizado');
    expect(hbTable).toBeDefined();
    expect(hbTable!.header).toEqual(['Id', 'σci (kPa)', 'GSI', 'mi', 'D', 'mb', 's', 'a']);
    const d = deriveHoekBrown(10, 50, 0.7);
    expect(hbTable!.rows).toEqual([
      ['roca', '30000', '50', '10', '0,7', String(Number(d.mb.toPrecision(6))).replace('.', ','), String(Number(d.s.toPrecision(6))).replace('.', ','), String(Number(d.a.toPrecision(6))).replace('.', ',')],
    ]);

    const note = matSec.blocks.find((b) => b.kind === 'paragraph' && b.text === HOEK_BROWN_REPORT_NOTE);
    expect(note).toBeDefined();
    expect(HOEK_BROWN_REPORT_NOTE).toContain('envolvente completa');
    expect(HOEK_BROWN_REPORT_NOTE).toContain('0 % a −2,9 %');
    expect(HOEK_BROWN_REPORT_NOTE).toContain('Hoek (1994');
    expect(HOEK_BROWN_REPORT_NOTE).toContain('cota superior');

    // En imperial la cabecera usa psf.
    const imp = structuredClone(input);
    imp.model.units = 'imperial';
    expect(tables(sec(buildReportContent(imp), 'materials')).find((t) => t.title === 'Materiales Hoek-Brown generalizado')!.header[1]).toBe('σci (psf)');

    // Resultados: pasadas del lazo de Hoek-Brown por método.
    const resParams = tables(sec(content, 'results')).find((t) => t.title === 'Parámetros por método');
    expect(resParams?.rows).toEqual([
      ['Bishop simplificado', 'Pasadas del lazo de Hoek-Brown', '11'],
      ['Spencer', 'Pasadas del lazo de Hoek-Brown', '12'],
    ]);

    // Leyenda de la figura del PDF distingue los modelos cuando hay F3B.
    const drawing = buildSectionDrawing(input.model, input.results);
    expect(drawing.legend.filter((l) => l.kind === 'material').map((l) => l.label)).toEqual([
      'roca (Caliza fracturada) · Hoek-Brown',
      'relleno (Relleno granular) · Mohr-Coulomb',
    ]);
  });

  it('SHANSEP: tabla con cociente S, exponente m (incluido por defecto 0,8) y las tres fuentes de OCR', () => {
    const { input } = shansepFixture();
    const content = buildReportContent(input);
    const matSec = sec(content, 'materials');
    expect(tables(matSec)[0]!.rows.every((r) => r[2] === 'SHANSEP')).toBe(true);
    // Sin Hoek-Brown no aparece la nota de Hoek-Brown.
    expect(matSec.blocks.some((b) => b.kind === 'paragraph' && b.text === HOEK_BROWN_REPORT_NOTE)).toBe(false);

    const shTable = tables(matSec).find((t) => t.title === 'Materiales SHANSEP');
    expect(shTable).toBeDefined();
    expect(shTable!.header).toEqual(['Id', 'Cociente S', 'Exponente m', 'Fuente OCR', 'Historia de esfuerzos']);
    expect(shTable!.rows).toEqual([
      ['arc_ocr', '0,23', '0,8 (por defecto)', 'OCR constante', 'OCR = 1,5'],
      ['arc_pop', '0,25', '0,82', 'POP (sobreconsolidación)', 'POP = 30 kPa'],
      ['arc_cota', '0,22', '0,78', 'OCR por cota', '(20 m; OCR 2,2) (28 m; OCR 1,4) (35 m; OCR 1)'],
    ]);
  });
});

describe('Informe F3B: búsqueda no circular y los cuatro avisos nuevos', () => {
  it('cuando gana la polilínea: datos de entrada, estadísticas no circulares, «Polilínea» ganadora y tabla de vértices críticos', () => {
    const { input } = nonCircularPolylineWinsFixture(true);
    const content = buildReportContent(input);

    const modelRows = kv(sec(content, 'model'));
    expect(modelRows['Búsqueda no circular']).toBe('Sí (variación alterna)');
    expect(modelRows['Semillas no circulares']).toBe('3');
    expect(modelRows['Vértices máximos (polilínea)']).toBe('33');

    const resSec = sec(content, 'results');
    const mainTable = tables(resSec)[0]!;
    expect(mainTable.header.slice(-1)).toEqual(['Superficie crítica']);
    expect(mainTable.rows[0]!.slice(-1)).toEqual([`Polilínea (${F3B_CRITICAL_POLYLINE.length} puntos)`]);

    const ncStats = tables(resSec).find((t) => t.title === 'Búsqueda no circular (refinamiento de semillas)');
    expect(ncStats).toBeDefined();
    expect(ncStats!.rows).toEqual([
      ['Spencer', '3', '4500', '1,620', '1,320', 'Polilínea'],
      ['Morgenstern-Price', '3', '4480', '1,622', '1,321', 'Polilínea'],
    ]);

    const critVerts = tables(resSec).find((t) => t.title === 'Vértices de la polilínea crítica (búsqueda no circular)');
    expect(critVerts).toBeDefined();
    expect(critVerts!.rows).toHaveLength(F3B_CRITICAL_POLYLINE.length);
    expect(critVerts!.rows[0]).toEqual(['1', '30', '25']);
    expect(critVerts!.rows[F3B_CRITICAL_POLYLINE.length - 1]).toEqual(['7', '51,2', '35']);

    const drawing = buildSectionDrawing(input.model, input.results);
    expect(drawing.legend.find((l) => l.kind === 'surface')?.label).toBe('Superficie crítica, polilínea (Spencer)');
  });

  it('cuando gana el círculo (polyline_fos > seed_fos o sin polilínea admisible): declara «Círculo» y no lista tabla de polilínea', () => {
    const withPoly = buildReportContent(nonCircularCircleWinsFixture(false).input);
    const modelRows = kv(sec(withPoly, 'model'));
    expect(modelRows['Semillas no circulares']).toBe('3 (por defecto)');
    expect(modelRows['Vértices máximos (polilínea)']).toBe('33 (por defecto)');

    const resTables = tables(sec(withPoly, 'results'));
    expect(resTables[0]!.header.slice(-2)).toEqual(['Centro (xc; yc) (m)', 'Radio (m)']);
    const ncStats = resTables.find((t) => t.title === 'Búsqueda no circular (refinamiento de semillas)')!;
    expect(ncStats.rows).toEqual([['Spencer', '3', '4502', '0,402', '0,412', 'Círculo']]);
    expect(resTables.find((t) => t.title?.startsWith('Vértices de la polilínea crítica'))).toBeUndefined();

    const omitted = buildReportContent(nonCircularCircleWinsFixture(true).input);
    const ncOmitted = tables(sec(omitted, 'results')).find((t) => t.title === 'Búsqueda no circular (refinamiento de semillas)')!;
    expect(ncOmitted.rows).toEqual([['Spencer', '3', '4502', '0,402', 'Sin polilínea admisible', 'Círculo']]);
  });

  it('incluye los cuatro avisos nuevos de F6.7 con su severidad y su texto exacto', () => {
    const codes = ['hoek_brown_not_converged', 'hoek_brown_low_confinement', 'shansep_nonpositive_stress', 'non_circular_large_change'] as const;
    const { input } = hoekBrownNotConvergedFixture();
    input.results[0]!.warnings = [...codes];
    const wBlock = sec(buildReportContent(input), 'warnings').blocks[0];
    expect(wBlock?.kind).toBe('list');
    if (wBlock?.kind === 'list') {
      expect(wBlock.items).toEqual(
        codes.map((c) => {
          const info = describeWarning(c);
          return { severity: info.severity, label: 'Bishop simplificado', text: info.text };
        }),
      );
    }
  });
});

describe('Identidad del contenido del informe de un modelo v0.5', () => {
  it('un modelo v0.5 con agua, grieta, refuerzo y material no drenado no agrega tablas, filas ni sufijos de v0.6', () => {
    const doc = loadCaseDoc('V047a');
    doc.version = '0.5';
    doc.materials.push({ id: 'arc', name: 'Arcilla blanda', model: 'undrained', unit_weight: 18, undrained_strength: 25 });
    doc.analysis.tension_crack = { depth: 2, water_fill: 1 };
    const base = sampleInput({ model: doc, engineName: 'ogs-core 0.4.0' });
    const content = buildReportContent(base);

    // Con nulls explícitos de campos v0.6 ausentes, el contenido es idéntico estructura a estructura.
    const withNulls = structuredClone(base);
    withNulls.model.materials[0]!.ucs = null;
    withNulls.model.materials[0]!.shansep = null;
    if (withNulls.model.analysis.search) withNulls.model.analysis.search.non_circular = null;
    expect(buildReportContent(withNulls)).toEqual(content);

    const allTableTitles = content.sections.flatMap((s) => tables(s).map((t) => t.title ?? ''));
    expect(allTableTitles).not.toContain('Materiales Hoek-Brown generalizado');
    expect(allTableTitles).not.toContain('Materiales SHANSEP');
    expect(allTableTitles).not.toContain('Búsqueda no circular (refinamiento de semillas)');
    expect(allTableTitles).not.toContain('Vértices de la polilínea crítica (búsqueda no circular)');

    const drawing = buildSectionDrawing(base.model, base.results);
    expect(drawing.legend.find((l) => l.kind === 'material')?.label).toBe(`soil (${doc.materials[0]!.name})`);
  });
});
