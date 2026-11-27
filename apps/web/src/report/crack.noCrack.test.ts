// E15l-15 (R12 B-02): una grieta automática con `depth = 0` es «sin grieta» (E15j-3). La tabla, el resumen de Diagnósticos, el PDF, el CSV y
// los avisos no muestran x_c, un 100 % de agua ni un aviso que afirme que se cortó una grieta.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { describeWarning, warningContext } from '../engine/warnings';
import { resultsToCsv } from '../io/csv';
import { CrackSummary, CrackTable } from '../ui/CrackResults';
import { buildReportContent, type ReportBlock } from './content';
import { NO_CRACK_TEXT, crackRecords, crackTable } from './crackReport';
import { loadCaseDoc, sampleInput } from './fixtures';

const slice = (xl: number, xr: number, yl: number, yr: number) => ({
  x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl, alpha: 0.2, base_length: xr - xl, weight: 100, cohesion: 3, tan_phi: 0.35, pore_pressure: 0,
  material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
});
const rep = (o: Partial<MethodReport> = {}): MethodReport =>
  ({
    method: 'spencer', fos: 1.5, status: 'converged', iterations: 5, lambda: 0.1, surface: { xc: 52, yc: 45, r: 24 },
    slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], search: null, warnings: ['water_above_ground', 'negative_effective_normal'],
    tension_crack: { x: 32.1245, depth: 0, water_force: 0 }, ...o,
  }) as MethodReport;
const text = (h: string): string => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('E15l-15: grieta con depth = 0', () => {
  it('crackTable: «Sin grieta (z = 0)», sin x_c ni porcentaje de agua', () => {
    const t = crackTable(crackRecords([rep()]), 'SI', 1);
    const row = t.rows[0]!.join(' | ');
    expect(row).toContain(NO_CRACK_TEXT);
    expect(NO_CRACK_TEXT).toBe('Sin grieta (z = 0)');
    expect(row).not.toContain('32,125');
    expect(row).not.toContain('100 %');
    expect(row).not.toContain('llena');
  });

  it('una grieta con profundidad > 0 no cambia (sin regresión)', () => {
    const t = crackTable(crackRecords([rep({ tension_crack: { x: 47, depth: 2.4, water_force: 28.2 } })]), 'SI', 1);
    expect(t.rows).toEqual([['Spencer', '47', '2,4', '100 % (llena)', '28,2']]);
  });

  it('CrackTable y CrackSummary (Diagnósticos) lo dicen y no muestran x_c ni 100 %', () => {
    const report = { engine: 'ogs-core 0.5.0', results: [rep()] } as AnalysisReport;
    for (const el of [createElement(CrackTable, { report, tensionCrack: { depth: 'auto', water_fill: 1 }, units: 'SI' }), createElement(CrackSummary, { report, tensionCrack: { depth: 'auto', water_fill: 1 }, units: 'SI' })]) {
      const t = text(renderToStaticMarkup(el));
      expect(t).toContain(NO_CRACK_TEXT);
      expect(t).not.toMatch(/32[,.]12/);
      expect(t).not.toContain('100 %');
      expect(t).not.toContain('llena');
    }
  });

  it('el PDF: la tabla de la sección de la grieta dice «Sin grieta (z = 0)»', () => {
    const model: ModelDoc = loadCaseDoc('V047a');
    model.version = '0.5';
    model.analysis = { ...model.analysis, tension_crack: { depth: 'auto', water_fill: 1 } };
    const c = buildReportContent(sampleInput({ model, results: [rep()], engineName: 'ogs-core 0.5.0', checks: [] }));
    const s = c.sections.find((x) => x.id === 'crack');
    const tbl = (s?.blocks ?? []).find((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');
    expect(tbl?.rows.flat().join(' ')).toContain(NO_CRACK_TEXT);
    expect(tbl?.rows.flat().join(' ')).not.toContain('100 %');
  });

  it('el CSV: x_c y Pw vacíos y la columna de profundidad con «Sin grieta (z = 0)»', () => {
    const [, row] = resultsToCsv([rep()], { units: 'SI' }).split('\r\n');
    expect(row?.endsWith(`,,${NO_CRACK_TEXT},`)).toBe(true);
  });

  it('warningContext no marca tensionCrack con depth 0 y el aviso no dice que hubo grieta', () => {
    const ctx = warningContext(rep());
    expect(ctx.tensionCrack).toBeUndefined();
    expect(describeWarning('negative_effective_normal', ctx)).not.toContain('a pesar de la grieta');
    expect(warningContext(rep({ tension_crack: { x: 47, depth: 0.43, water_force: 0.09 } })).tensionCrack).toBe(true);
  });
});
