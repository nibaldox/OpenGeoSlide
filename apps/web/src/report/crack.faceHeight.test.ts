// E15m-15 (R13): `tension_crack.face_height` en la tabla, el PDF, el CSV y el resumen de Diagnósticos. Salidas del motor construidas a mano (el motor de
// esta rama aún no emite el campo; el test con el motor real está en `editor/state/faceHeight.engine.test.ts`).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { resultsToCsv } from '../io/csv';
import { CrackSummary, CrackTable } from '../ui/CrackResults';
import { buildReportContent, type ReportBlock } from './content';
import { NO_CRACK_TEXT, crackCsvHeader, crackRecords, crackTable, cutNoCrackText, isCutNoCrack, isNoCrack } from './crackReport';
import { loadCaseDoc, sampleInput } from './fixtures';

const slice = (xl: number, xr: number, yl: number, yr: number) => ({
  x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl, alpha: 0.2, base_length: xr - xl, weight: 100, cohesion: 3, tan_phi: 0.35, pore_pressure: 0,
  material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
});
const rep = (crack: MethodReport['tension_crack'], o: Partial<MethodReport> = {}): MethodReport =>
  ({
    method: 'bishop', fos: 1.1, status: 'converged', iterations: 5, lambda: null, surface: { xc: 52, yc: 45, r: 24 },
    slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], search: null, warnings: [], tension_crack: crack, ...o,
  }) as MethodReport;
const CUT = { x: -42.4211, depth: 0, water_force: 0, face_height: 1.7827 };
const DEEP = { x: 12.5, depth: 2.616, water_force: 34.2, face_height: 4.9707 };
const text = (h: string): string => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const SENTENCE = 'Corte de la masa en x = -42,421 (cara de 1,783 m) sin grieta de tracción: la profundidad de Rankine es 0 en ese punto (p. ej., bajo una sobrecarga)';

describe('E15m-15: clasificación y frase', () => {
  it('depth 0 con cara > 0 es un corte, no «Sin grieta»; sin cara (o 0) sigue siendo «Sin grieta»', () => {
    expect(isCutNoCrack(CUT)).toBe(true);
    expect(isNoCrack(CUT)).toBe(false);
    expect(isNoCrack({ x: 1, depth: 0, water_force: 0 })).toBe(true);
    expect(isNoCrack({ depth: 0, face_height: 0 })).toBe(true);
    expect(isCutNoCrack({ depth: 2.4, face_height: 4 })).toBe(false);
  });
  it('la frase es la del contrato, con la longitud en la unidad del modelo', () => {
    expect(cutNoCrackText(-42.4211, 1.7827, 'SI')).toBe(SENTENCE);
    expect(cutNoCrackText(10, 5.5, 'imperial')).toBe('Corte de la masa en x = 10 (cara de 5,5 ft) sin grieta de tracción: la profundidad de Rankine es 0 en ese punto (p. ej., bajo una sobrecarga)');
  });
});

describe('E15m-15: tabla', () => {
  it('crackRecords trae la cara solo si el motor la informó', () => {
    expect(crackRecords([rep(CUT), rep({ x: 47, depth: 2.4, water_force: 28.2 }, { method: 'spencer' })]).map((r) => r.face)).toEqual([1.7827, undefined]);
  });
  it('con depth 0 y cara: la frase de E15m-15 en lugar de «Sin grieta», con la cara en su columna', () => {
    const t = crackTable(crackRecords([rep(CUT)]), 'SI', 1);
    expect(t.header).toEqual(['Método', 'x_c (m)', 'Profundidad (m)', 'Cara cortada (m)', 'Agua en la grieta', 'Pw (kN/m)']);
    expect(t.rows).toEqual([['Bishop simplificado', '—', SENTENCE, '1,783', '—', '—']]);
    expect(t.rows.flat().join(' ')).not.toContain('Sin grieta');
  });
  it('con depth > 0 y cara: la cara junto a la profundidad; un método sin cara deja «—»', () => {
    const t = crackTable(crackRecords([rep(DEEP), rep({ x: 47, depth: 2.4, water_force: 28.2 }, { method: 'spencer' })]), 'SI', 1);
    expect(t.rows).toEqual([
      ['Bishop simplificado', '12,5', '2,616', '4,971', '100 % (llena)', '34,2'],
      ['Spencer', '47', '2,4', '—', '100 % (llena)', '28,2'],
    ]);
  });
  it('en imperial la cabecera lleva ft y lbf/ft', () => {
    const t = crackTable(crackRecords([rep(DEEP)]), 'imperial', 1);
    expect(t.header).toEqual(['Método', 'x_c (ft)', 'Profundidad (ft)', 'Cara cortada (ft)', 'Agua en la grieta', 'Pw (lbf/ft)']);
  });
  it('sin cara en ningún método la tabla no cambia (sin regresión)', () => {
    const t = crackTable(crackRecords([rep({ x: 47, depth: 2.4, water_force: 28.2 })]), 'SI', 1);
    expect(t.header).toEqual(['Método', 'x_c (m)', 'Profundidad (m)', 'Agua en la grieta', 'Pw (kN/m)']);
    expect(t.rows).toEqual([['Bishop simplificado', '47', '2,4', '100 % (llena)', '28,2']]);
  });
});

describe('E15m-15: resumen de Diagnósticos y tabla de resultados', () => {
  const render = (results: MethodReport[], units = 'SI') => {
    const report = { engine: 'ogs-core 0.5.0', results } as AnalysisReport;
    const p = { report, tensionCrack: { depth: 'auto' as const, water_fill: 1 }, units };
    return { table: text(renderToStaticMarkup(createElement(CrackTable, p))), summary: text(renderToStaticMarkup(createElement(CrackSummary, p))) };
  };
  it('con depth 0 y cara dicen el corte, no «Sin grieta»', () => {
    const { table, summary } = render([rep(CUT)]);
    for (const t of [table, summary]) {
      expect(t).toContain(SENTENCE);
      expect(t).not.toContain('Sin grieta');
      expect(t).not.toContain('100 %');
    }
    expect(table).toContain('Cara cortada (m)');
  });
  it('con depth > 0 y cara, el resumen la muestra junto a la profundidad', () => {
    const { summary } = render([rep(DEEP)]);
    expect(summary).toContain('profundidad = 2,62 m (cara de 4,971 m), Pw = 34,2 kN/m');
    expect(render([rep(DEEP)], 'imperial').summary).toContain('profundidad = 2,62 ft (cara de 4,971 ft), Pw = 34,2 lbf/ft');
  });
  it('sin cara el resumen no cambia', () => {
    expect(render([rep({ x: 47, depth: 2.4, water_force: 28.2 })]).summary).toContain('x_c = 47 m, profundidad = 2,4 m, Pw = 28,2 kN/m');
    expect(render([rep({ x: 47, depth: 0, water_force: 0 })]).summary).toContain(NO_CRACK_TEXT);
  });
});

describe('E15m-15: PDF (contenido)', () => {
  const content = (results: MethodReport[]) => {
    const model: ModelDoc = loadCaseDoc('V047a');
    model.version = '0.5';
    model.analysis = { ...model.analysis, tension_crack: { depth: 'auto', water_fill: 1 } };
    const c = buildReportContent(sampleInput({ model, results, engineName: 'ogs-core 0.5.0', checks: [] }));
    const blocks = c.sections.find((x) => x.id === 'crack')?.blocks ?? [];
    return { table: blocks.find((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table'), blocks };
  };
  it('la tabla lleva la frase del corte y la cara; el texto explica los dos casos', () => {
    const { table, blocks } = content([rep(CUT), rep(DEEP, { method: 'spencer' })]);
    expect(table?.header).toContain(`Cara cortada (m)`);
    expect(table?.rows[0]).toContain(SENTENCE);
    expect(table?.rows[1]).toContain('4,971');
    const para = blocks.filter((b): b is Extract<ReportBlock, { kind: 'paragraph' }> => b.kind === 'paragraph').map((b) => b.text).join(' ');
    expect(para).toContain('cara cortada');
    expect(para).toContain('Rankine');
  });
  it('sin cara la tabla y el texto no cambian', () => {
    const { table, blocks } = content([rep({ x: 47, depth: 2.4, water_force: 28.2 })]);
    expect(table?.header).not.toContain('Cara cortada (m)');
    expect(JSON.stringify(blocks)).not.toContain('cara cortada');
  });
});

describe('E15m-15: CSV', () => {
  it('con cara agrega grieta_cara_<L> al final del grupo; un método sin cara la deja vacía', () => {
    const csv = resultsToCsv([rep(DEEP), rep(CUT, { method: 'spencer' }), rep({ x: 47, depth: 2.4, water_force: 28.2 }, { method: 'janbu_simplified' })], { units: 'SI' }).split('\r\n');
    expect(csv[0]!.endsWith('grieta_x_m,grieta_profundidad_m,grieta_pw_kn_m,grieta_cara_m')).toBe(true);
    expect(csv[1]!.endsWith(',12.5,2.616,34.2,4.9707')).toBe(true);
    expect(csv[2]!.endsWith(',-42.4211,0,0,1.7827')).toBe(true); // corte sin grieta de tracción: los números tal cual
    expect(csv[3]!.endsWith(',47,2.4,28.2,')).toBe(true);
  });
  it('en imperial la columna es grieta_cara_ft', () => {
    expect(crackCsvHeader('imperial', true)).toEqual(['grieta_x_ft', 'grieta_profundidad_ft', 'grieta_pw_lbf_ft', 'grieta_cara_ft']);
    expect(resultsToCsv([rep(DEEP)], { units: 'imperial' }).split('\r\n')[0]).toContain('grieta_cara_ft');
  });
  it('sin cara el CSV no cambia (sin regresión)', () => {
    expect(crackCsvHeader('SI')).toEqual(['grieta_x_m', 'grieta_profundidad_m', 'grieta_pw_kn_m']);
    const [h, row] = resultsToCsv([rep({ x: 47, depth: 2.4, water_force: 28.2 })], { units: 'SI' }).split('\r\n');
    expect(h).not.toContain('grieta_cara');
    expect(row!.endsWith(',47,2.4,28.2')).toBe(true);
    expect(resultsToCsv([rep({ x: 47, depth: 0, water_force: 0 })], { units: 'SI' }).split('\r\n')[1]!.endsWith(`,,${NO_CRACK_TEXT},`)).toBe(true);
  });
});
