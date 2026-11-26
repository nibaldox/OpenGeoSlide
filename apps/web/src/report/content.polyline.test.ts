// F3-W1f: el informe describe la superficie (círculo o polilínea), el método con su función y f₀, y dibuja la polilínea.
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { MethodReport, Point } from '../engine/types';
import { buildReportContent, buildSectionDrawing, type ReportBlock, type ReportSection } from './content';
import { loadCaseDoc, sampleInput } from './fixtures';

const FITTED: Point[] = [[30, 25], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
const USER: Point[] = [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
const slices = Array.from({ length: 4 }, (_, i) => ({
  x_left: 30 + i * 5, x_right: 35 + i * 5, y_base_left: FITTED[i]![1], y_base_right: FITTED[i + 1]![1], y_top_mid: 33, width: 5, alpha: 0.2, base_length: 5.1,
  weight: 100, cohesion: 5, tan_phi: 0.3, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
}));

function polyDoc(over: (d: ModelDoc) => void = () => undefined): ModelDoc {
  const d = loadCaseDoc('V047a');
  d.version = '0.3';
  d.analysis = { ...d.analysis, search: null, methods: ['morgenstern_price', 'janbu_corrected'], surface: { type: 'polyline', points: USER } };
  over(d);
  return d;
}
const rep = (o: Partial<MethodReport>): MethodReport =>
  ({ method: 'morgenstern_price', fos: 0.9991, status: 'converged', iterations: 6, lambda: 0.31, surface: { points: FITTED }, slices, search: null, warnings: [], ...o }) as MethodReport;

const results = (): MethodReport[] => [
  rep({ interslice: { function: 'half_sine' } }),
  rep({ method: 'janbu_corrected', lambda: null, fos: 0.9993, correction_factor: 1.0482 }),
];
const input = (model = polyDoc(), res = results()) => sampleInput({ model, results: res, engineName: 'ogs-core 0.1.0', checks: [] });
const sec = (c: ReturnType<typeof buildReportContent>, id: string): ReportSection => c.sections.find((s) => s.id === id)!;
const kv = (s: ReportSection): Record<string, string> => Object.fromEntries((s.blocks.find((b) => b.kind === 'kv') as Extract<ReportBlock, { kind: 'kv' }>).rows);
const tables = (s: ReportSection) => s.blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');

describe('Datos del modelo con polilínea', () => {
  const model = sec(buildReportContent(input()), 'model');
  it('describe la superficie como polilínea fija con su número de puntos y no inventa centro ni radio', () => {
    const rows = kv(model);
    expect(rows['Superficies']).toBe('Polilínea fija');
    expect(rows['Puntos de la polilínea']).toBe('5');
    expect(rows['Centro (xc, yc)']).toBeUndefined();
    expect(rows['Radio']).toBeUndefined();
  });
  it('lista los puntos (x, y) del modelo con su unidad', () => {
    const t = tables(model).find((b) => b.title?.startsWith('Polilínea fija'));
    expect(t?.header).toEqual(['N.º', 'x (m)', 'y (m)']);
    expect(t?.rows).toHaveLength(5);
    expect(t?.rows[0]).toEqual(['1', '30', '25,000001']);
    expect(t?.rows[4]).toEqual(['5', '51,291118', '35']);
  });
  it('en imperial las cabeceras llevan ft', () => {
    const t = tables(sec(buildReportContent(input(polyDoc((d) => (d.units = 'imperial')))), 'model')).find((b) => b.title?.startsWith('Polilínea fija'));
    expect(t?.header).toEqual(['N.º', 'x (ft)', 'y (ft)']);
  });
  it('aclara que se ajusta al terreno al calcular', () => {
    const p = model.blocks.find((b) => b.kind === 'paragraph' && b.text.includes('terreno'));
    expect(p).toBeDefined();
  });
  it('con M-P indica la función de interfaz (por defecto, medio seno); sin M-P no la menciona', () => {
    expect(kv(model)['Función entre dovelas (Morgenstern-Price)']).toBe('Medio seno (por defecto)');
    const withFn = polyDoc((d) => (d.analysis.interslice = { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] }));
    expect(kv(sec(buildReportContent(input(withFn)), 'model'))['Función entre dovelas (Morgenstern-Price)']).toBe('Definida por puntos (3 puntos)');
    const noMp = polyDoc((d) => (d.analysis.methods = ['spencer']));
    expect(kv(sec(buildReportContent(input(noMp, [rep({ method: 'spencer' })])), 'model'))['Función entre dovelas (Morgenstern-Price)']).toBeUndefined();
  });
  it('el círculo fijo sigue describiéndose con centro y radio', () => {
    const circleDoc = polyDoc((d) => (d.analysis.surface = { type: 'circle', xc: 29.5, yc: 53.6, r: 28.6 }));
    expect(kv(sec(buildReportContent(input(circleDoc)), 'model'))['Centro (xc, yc)']).toBe('(29,5; 53,6) m');
  });
});

describe('Resultados con polilínea, función y f₀', () => {
  const content = buildReportContent(input());
  const results$ = tables(sec(content, 'results'));
  it('una columna «Superficie fija» con «Polilínea (5 puntos)» en lugar de centro y radio', () => {
    expect(results$[0]!.header.slice(-1)).toEqual(['Superficie fija']);
    expect(results$[0]!.header.join('|')).not.toContain('Centro');
    expect(results$[0]!.rows.map((r) => r[r.length - 1])).toEqual(['Polilínea (5 puntos)', 'Polilínea (5 puntos)']);
    expect(results$[0]!.rows.every((r) => r.length === results$[0]!.header.length)).toBe(true);
  });
  it('λ se muestra en Morgenstern-Price convergido y no en Janbu', () => {
    const lam = results$[0]!.header.indexOf('λ');
    expect(results$[0]!.rows[0]![lam]).toBe('0,3100');
    expect(results$[0]!.rows[1]![lam]).toBe('—');
  });
  it('tabla «Parámetros por método»: la función de M-P y f₀ y F₀ de Janbu corregido', () => {
    const p = results$.find((t) => t.title === 'Parámetros por método');
    expect(p?.header).toEqual(['Método', 'Parámetro', 'Valor']);
    expect(p?.rows).toEqual([
      ['Morgenstern-Price', 'Función de fuerzas entre dovelas', 'Medio seno'],
      ['Janbu corregido', 'Factor de corrección f₀', '1,048'],
      ['Janbu corregido', 'F₀ (Janbu simplificado) = FS / f₀', '0,953'],
    ]);
  });
  it('M-P con puntos: lista los pares (ξ; f)', () => {
    const r = [rep({ interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] } })];
    const p = tables(sec(buildReportContent(input(polyDoc(), r)), 'results')).find((t) => t.title === 'Parámetros por método');
    expect(p?.rows).toEqual([
      ['Morgenstern-Price', 'Función de fuerzas entre dovelas', 'Definida por puntos (3 puntos)'],
      ['Morgenstern-Price', 'Puntos (ξ; f)', '(0; 0) (0,5; 1) (1; 0)'],
    ]);
  });
  it('sin M-P ni Janbu corregido no hay tabla de parámetros', () => {
    const t = tables(sec(buildReportContent(sampleInput()), 'results'));
    expect(t.some((x) => x.title === 'Parámetros por método')).toBe(false);
    expect(t[0]!.header.slice(-2)).toEqual(['Centro (xc; yc) (m)', 'Radio (m)']);
  });
  it('un informe mixto (círculo y polilínea) conserva centro y radio', () => {
    const t = tables(sec(buildReportContent(input(polyDoc(), [rep({ surface: { xc: 1, yc: 2, r: 3 } }), rep({})])), 'results'))[0]!;
    expect(t.header.slice(-2)).toEqual(['Centro (xc; yc) (m)', 'Radio (m)']);
    expect(t.rows[1]![t.rows[1]!.length - 2]).toBe('Polilínea (5 puntos)');
  });
});

describe('Dibujo de la sección con polilínea', () => {
  it('la superficie son los puntos ajustados del informe; las dovelas conservan sus límites; no hay centro ni radio', () => {
    const d = buildSectionDrawing(polyDoc(), results());
    expect(d.surface?.points).toEqual(FITTED);
    expect(d.surface?.center).toBeUndefined();
    expect(d.surface?.radius).toBeUndefined();
    expect(d.surface?.sliceLines).toHaveLength(3); // los extremos están sobre el terreno: sin línea vertical
  });
  it('la leyenda dice «Superficie fija, polilínea» con el método; sin convergencia, superficie evaluada', () => {
    const d = buildSectionDrawing(polyDoc(), results());
    expect(d.legend.find((l) => l.kind === 'surface')?.label).toBe('Superficie fija, polilínea (Morgenstern-Price)');
    const bad = buildSectionDrawing(polyDoc(), [rep({ status: 'not_converged' })]);
    expect(bad.legend.find((l) => l.kind === 'surface')?.label).toBe('Superficie evaluada, sin convergencia (Morgenstern-Price)');
  });
  it('sin dovelas se dibuja igualmente la polilínea del informe', () => {
    expect(buildSectionDrawing(polyDoc(), [rep({ slices: [] })]).surface?.points).toEqual(FITTED);
  });
  it('los extremos de la polilínea ajustada entran en los límites en y', () => {
    const deep = [rep({ surface: { points: [[30, 25], [40, 5], [51, 35]] } })];
    expect(buildSectionDrawing(polyDoc(), deep).bounds.ymin).toBeLessThanOrEqual(5);
  });
});

describe('Materiales no drenados', () => {
  it('el informe no deja c y φ en blanco sin explicar: añade la tabla de Su', () => {
    const doc = polyDoc((d) => {
      d.materials = [{ id: 'arc', name: 'Arcilla blanda', model: 'undrained', unit_weight: 18, undrained_strength: 20, strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 }];
      d.regions.forEach((r) => (r.material = 'arc'));
    });
    const t = tables(sec(buildReportContent(input(doc)), 'materials'));
    const su = t.find((x) => x.title === 'Materiales no drenados (Su)');
    expect(su?.header).toEqual(['Id', 'Su (kPa)', 'Cota de referencia (m)', 'Gradiente (kPa/m)', 'Límite (kPa)']);
    expect(su?.rows).toEqual([['arc', '20', '30', '1,5', '60']]);
    // sin gradiente: no hay cota, gradiente ni límite
    const flat = polyDoc((d) => {
      d.materials = [{ id: 'arc', name: 'A', model: 'undrained', unit_weight: 18, undrained_strength: 25 }];
      d.regions.forEach((r) => (r.material = 'arc'));
    });
    expect(tables(sec(buildReportContent(input(flat)), 'materials')).find((x) => x.title?.startsWith('Materiales no drenados'))?.rows).toEqual([['arc', '25', '—', '—', '—']]);
  });
  it('en imperial: psf, ft y psf/ft', () => {
    const doc = polyDoc((d) => {
      d.units = 'imperial';
      d.materials = [{ id: 'arc', name: 'A', model: 'undrained', unit_weight: 110, undrained_strength: 400, strength_datum: 10, strength_gradient: 5 }];
      d.regions.forEach((r) => (r.material = 'arc'));
    });
    expect(tables(sec(buildReportContent(input(doc)), 'materials')).find((x) => x.title?.startsWith('Materiales no drenados'))?.header).toEqual(['Id', 'Su (psf)', 'Cota de referencia (ft)', 'Gradiente (psf/ft)', 'Límite (psf)']);
  });
  it('sin materiales no drenados no hay tabla extra', () => {
    expect(tables(sec(buildReportContent(sampleInput()), 'materials'))).toHaveLength(1);
  });
});

describe('Portada: versión del formato del archivo guardado (I-W)', () => {
  const cover = (model: ModelDoc) => kv(sec(buildReportContent(input(model)), 'cover'));
  it('un modelo con campos de la 0.3 pero versión en memoria 0.2 se guarda (y se resume) como 0.3', () => {
    expect(cover(polyDoc((d) => { d.version = '0.2'; }))['Versión del formato']).toBe('0.3');
  });
  it('un modelo sin campos de la 0.3 se resume como 0.2, la versión del texto del que sale el SHA-256', () => {
    const d = loadCaseDoc('V047a');
    d.version = '0.1';
    expect(cover(d)['Versión del formato']).toBe('0.2');
  });
});
