// F5.3, F5.4, F5.7: la grieta de tracción y el agua embalsada en el informe (contenido, dibujo, PDF y CSV), con resultados simulados que traen `tension_crack`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { MethodReport } from '../engine/types';
import { resultsToCsv } from '../io/csv';
import { buildReportContent, buildSectionDrawing, conventionNotes, type ReportBlock } from './content';
import { crackCsvHeader, crackInputRows, crackRecords, crackTable, pondSummary, POND_NOTE, waterFillText } from './crackReport';
import { loadCaseDoc, sampleInput } from './fixtures';
import { buildReportPdfWith, type FontLoader } from './pdf';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

const slice = (xl: number, xr: number, yl: number, yr: number) => ({
  x_left: xl, x_right: xr, y_base_left: yl, y_base_right: yr, y_top_mid: 30, width: xr - xl, alpha: 0.2, base_length: xr - xl, weight: 100, cohesion: 3, tan_phi: 0.35, pore_pressure: 0,
  material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
});

/** V047a con 2 m de agua al pie y grieta de 2,4 m llena de agua, con resultado simulado que trae `tension_crack`. */
function crackDoc(over: (d: ModelDoc) => void = () => undefined): ModelDoc {
  const d = loadCaseDoc('V047a');
  d.version = '0.5';
  d.water = { piezometric_line: [[20, 27], [70, 27]] };
  d.analysis = { ...d.analysis, tension_crack: { depth: 2.4, water_fill: 1 } };
  over(d);
  return d;
}
const rep = (o: Partial<MethodReport> = {}): MethodReport =>
  ({
    method: 'bishop', fos: 0.924, status: 'converged', iterations: 5, lambda: null, surface: { xc: 52, yc: 45, r: 24 },
    slices: [slice(30, 38, 25, 23), slice(38, 47, 23, 32.6)], search: null, warnings: ['water_above_ground'],
    tension_crack: { x: 47, depth: 2.4, water_force: 28.2 }, ...o,
  }) as MethodReport;
const input = (model = crackDoc(), results = [rep()]) => sampleInput({ model, results, engineName: 'ogs-core 0.5.0', checks: [] });
const section = (c: ReturnType<typeof buildReportContent>, id: string) => c.sections.find((s) => s.id === id);
const tables = (blocks: ReportBlock[] | undefined) => (blocks ?? []).filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');
const text = (blocks: ReportBlock[] | undefined): string =>
  (blocks ?? []).map((b) => (b.kind === 'paragraph' ? b.text : b.kind === 'bullets' ? b.items.join(' ') : b.kind === 'table' ? [...b.header, ...b.rows.flat()].join(' ') : '')).join('\n');

describe('crackReport: textos y tabla', () => {
  it('crackRecords solo trae los métodos con grieta', () => {
    expect(crackRecords([rep(), rep({ method: 'spencer', tension_crack: undefined })])).toEqual([{ method: 'bishop', x: 47, depth: 2.4, force: 28.2, fs: 0.924 }]);
  });
  it('crackTable: x_c, profundidad, fracción de agua y Pw con unidades, en coma decimal', () => {
    const t = crackTable(crackRecords([rep()]), 'SI', 1);
    expect(t.header).toEqual(['Método', 'x_c (m)', 'Profundidad (m)', 'Agua en la grieta', 'Pw (kN/m)']);
    expect(t.rows).toEqual([['Bishop simplificado', '47', '2,4', '100 % (llena)', '28,2']]);
    expect(crackTable(crackRecords([rep()]), 'imperial', 0).header).toEqual(['Método', 'x_c (ft)', 'Profundidad (ft)', 'Agua en la grieta', 'Pw (lbf/ft)']);
    expect(waterFillText(0)).toBe('0 % (seca)');
    expect(waterFillText(0.5)).toBe('50 %');
  });
  it('crackInputRows: profundidad fija o Automática', () => {
    expect(crackInputRows(crackDoc())).toEqual([['Grieta de tracción', 'Sí'], ['Profundidad de la grieta', '2,4 m'], ['Fracción de agua en la grieta', '100 % (llena)']]);
    const auto = crackDoc((d) => (d.analysis.tension_crack = { depth: 'auto', water_fill: 0 }));
    expect(crackInputRows(auto)[1]).toEqual(['Profundidad de la grieta', 'Automática']);
    expect(crackInputRows(loadCaseDoc('V047a'))).toEqual([]);
  });
  it('pondSummary: calado máximo solo con la piezométrica sobre el terreno', () => {
    expect(pondSummary(loadCaseDoc('V047a'))).toBeNull();
    const s = pondSummary(crackDoc());
    expect(s?.maxDepth).toBeCloseTo(2, 12);
    expect(s?.text).toContain(POND_NOTE);
    expect(s?.text).toContain('calado máximo 2 m');
  });
});

describe('informe: sección «Grieta de tracción y agua embalsada»', () => {
  it('con grieta y agua: nota del agua, tabla por método y convenciones (sin sismo, ru, fracción de agua)', () => {
    const c = buildReportContent(input());
    const s = section(c, 'crack');
    expect(s?.title).toBe('Grieta de tracción y agua embalsada');
    expect(c.sections.map((x) => x.id).indexOf('crack')).toBe(c.sections.map((x) => x.id).indexOf('results') + 1);
    const t = tables(s?.blocks)[0];
    expect(t?.rows).toEqual([['Bishop simplificado', '47', '2,4', '100 % (llena)', '28,2']]);
    const all = text(s?.blocks);
    expect(all).toContain(POND_NOTE);
    expect(all).toContain('ni kh ni kv');
    expect(all).toContain('u = ru·(W + V)/b');
    expect(all).toContain('1 es lo conservador');
    expect(all).toContain('tension_crack_not_reached');
  });
  it('sin grieta ni agua sobre el terreno la sección no existe y el informe no cambia', () => {
    const c = buildReportContent(sampleInput());
    expect(section(c, 'crack')).toBeUndefined();
    expect(text(section(c, 'model')?.blocks)).not.toContain('Grieta');
  });
  it('solo agua embalsada: nota y convenciones del agua, sin tabla ni convenciones de la grieta', () => {
    const doc = crackDoc((d) => {
      d.version = '0.3';
      d.analysis = { ...d.analysis, tension_crack: null };
    });
    const s = section(buildReportContent(input(doc, [rep({ tension_crack: undefined })])), 'crack');
    expect(tables(s?.blocks)).toHaveLength(0);
    expect(text(s?.blocks)).toContain(POND_NOTE);
    expect(text(s?.blocks)).not.toContain('Pw = ½');
  });
  it('con grieta pero sin resultado con grieta lo dice (superficie que no la alcanza) y con el motor simulado también', () => {
    const none = section(buildReportContent(input(crackDoc(), [rep({ tension_crack: undefined })])), 'crack');
    expect(text(none?.blocks)).toContain('Ningún método devolvió la grieta');
    const mock = section(buildReportContent(input(crackDoc(), [rep({ tension_crack: undefined, warnings: ['mock_engine'] })])), 'crack');
    expect(text(mock?.blocks)).toContain('El motor simulado no calcula la grieta');
  });
  it('«Datos del modelo» lleva la grieta de entrada', () => {
    const kv = section(buildReportContent(input()), 'model')?.blocks.find((b) => b.kind === 'kv');
    expect(kv && kv.kind === 'kv' ? kv.rows.filter((r) => r[0].includes('rieta')) : []).toEqual([
      ['Grieta de tracción', 'Sí'],
      ['Profundidad de la grieta', '2,4 m'],
      ['Fracción de agua en la grieta', '100 % (llena)'],
    ]);
    expect(conventionNotes(crackDoc()).some((n) => n.includes('Grieta'))).toBe(false);
  });
  it('la nota water_above_ground del motor llega a «Avisos y notas» (su texto lo define engine/warnings.ts, de W1)', () => {
    const w = section(buildReportContent(input()), 'warnings');
    const list = w?.blocks.find((b) => b.kind === 'list');
    expect(list && list.kind === 'list' ? list.items.map((i) => i.label) : []).toEqual(['Bishop simplificado']);
  });
});

describe('dibujo del informe', () => {
  it('trae el polígono del agua, la geometría de la grieta y su leyenda', () => {
    const d = buildSectionDrawing(crackDoc(), [rep()]);
    expect(d.pond).toHaveLength(1);
    expect(d.crack?.x).toBe(47);
    expect(d.crack?.dir).toBe(-1);
    expect(d.legend.map((l) => l.kind)).toEqual(expect.arrayContaining(['pond', 'crack']));
  });
  it('sin agua ni grieta el dibujo y su leyenda no cambian', () => {
    const d = buildSectionDrawing(loadCaseDoc('V047a'), [rep({ tension_crack: undefined })]);
    expect(d.pond).toEqual([]);
    expect(d.crack).toBeNull();
    expect(d.legend.map((l) => l.kind)).not.toEqual(expect.arrayContaining(['pond']));
    expect(d.legend.map((l) => l.kind)).not.toContain('crack');
  });
});

describe('PDF con grieta y agua embalsada', () => {
  it('genera un PDF válido, de más de una página, también con la grieta seca y en imperial', async () => {
    for (const doc of [crackDoc(), crackDoc((d) => (d.analysis.tension_crack = { depth: 'auto', water_fill: 0 })), crackDoc((d) => (d.units = 'imperial'))]) {
      const blob = await buildReportPdfWith(input(doc), { loadFont, compress: false });
      const head = Buffer.from(await blob.slice(0, 5).arrayBuffer()).toString('latin1');
      expect(head).toBe('%PDF-');
      expect(blob.size).toBeGreaterThan(5000);
    }
  });
});

describe('CSV de resultados', () => {
  it('con grieta agrega x_c, profundidad y Pw; sin grieta el CSV no cambia', () => {
    const csv = resultsToCsv([rep()], { units: 'SI' });
    const [head, row] = csv.split('\r\n');
    expect(head?.endsWith(',grieta_x_m,grieta_profundidad_m,grieta_pw_kn_m')).toBe(true);
    expect(row?.endsWith(',47,2.4,28.2')).toBe(true);
    const imperial = resultsToCsv([rep()], { units: 'imperial' }).split('\r\n')[0];
    expect(imperial?.endsWith(',grieta_x_ft,grieta_profundidad_ft,grieta_pw_lbf_ft')).toBe(true);
    const plain = resultsToCsv([rep({ tension_crack: undefined })], { units: 'SI' });
    expect(plain).not.toContain('grieta');
    expect(crackCsvHeader('SI')).toHaveLength(3);
  });
  it('un método sin grieta junto a otro con grieta deja las celdas vacías', () => {
    const csv = resultsToCsv([rep(), rep({ method: 'spencer', tension_crack: undefined })], { units: 'SI' }).split('\r\n');
    expect(csv[2]?.endsWith(',,,')).toBe(true);
  });
});
