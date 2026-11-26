import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { MethodReport } from '../engine/types';
import { baseSurfacePoints, buildReportContent, buildSectionDrawing, clipPolylineX, fmt, fmtParam, professionalDisclaimer, terrainY, type ReportSection } from './content';
import { loadCaseDoc, loadDifferentialDoc, loadEngineReport, sampleInput } from './fixtures';

const section = (c: ReturnType<typeof buildReportContent>, id: string): ReportSection => {
  const s = c.sections.find((x) => x.id === id);
  if (!s) throw new Error(`falta la sección ${id}`);
  return s;
};

const kv = (s: ReportSection): Record<string, string> => {
  const b = s.blocks.find((x) => x.kind === 'kv');
  return b && b.kind === 'kv' ? Object.fromEntries(b.rows) : {};
};

describe('formato', () => {
  it('coma decimal y guion para vacíos', () => {
    expect(fmt(1.23456, 3)).toBe('1,235');
    expect(fmt(null)).toBe('—');
    expect(fmt(Number.NaN)).toBe('—');
    expect(fmtParam(0.00001)).toBe('0,00001');
    expect(fmtParam(1e-7)).toBe('1e-7');
    expect(fmtParam(9.807)).toBe('9,807');
    expect(fmtParam(null)).toBe('—');
  });

  it('advertencia profesional aprobada (F1.4)', () => {
    expect(professionalDisclaimer('ogs-core 0.1.0')).toBe(
      'Resultado de un cálculo de equilibrio límite con OpenGeoSlide 0.1.0. No sustituye el juicio del profesional responsable. Revise los avisos antes de usar el resultado en un diseño.',
    );
    expect(professionalDisclaimer('mock')).toContain('OpenGeoSlide mock.');
  });
});

describe('buildReportContent', () => {
  const input = sampleInput({ engineName: 'ogs-core 0.1.0', disclaimer: '' });
  const content = buildReportContent(input);

  it('secciones de X3 §2.9 en orden (la 6 solo si hay comprobaciones)', () => {
    expect(content.sections.map((s) => s.id)).toEqual(['cover', 'model', 'materials', 'section', 'results', 'checks', 'warnings', 'engine']);
    const none = buildReportContent({ ...input, checks: [] });
    expect(none.sections.map((s) => s.id)).toEqual(['cover', 'model', 'materials', 'section', 'results', 'warnings', 'engine']);
  });

  it('portada: título, id, fecha, motor, SHA-256 completo y unidades', () => {
    expect(content.title).toBe('ACADS 1(a), homogeneous slope, dry');
    expect(kv(section(content, 'cover'))).toMatchObject({
      Título: 'ACADS 1(a), homogeneous slope, dry',
      Identificador: 'V047a',
      Fecha: '2026-11-25T12:00:00Z',
      Motor: 'ogs-core 0.1.0',
      'SHA-256 del .ogs.json': input.modelSha256,
      Unidades: 'SI',
    });
  });

  it('datos del modelo: notas, sentido, métodos, búsqueda y valores por defecto', () => {
    const m = section(content, 'model');
    expect(m.blocks[0]).toEqual({ kind: 'paragraph', text: input.model.meta.notes });
    const rows = kv(m);
    expect(rows['Sentido del deslizamiento']).toBe('De derecha a izquierda');
    expect(rows['Métodos']).toBe('Bishop simplificado, Spencer');
    expect(rows['Dovelas']).toBe('50');
    expect(rows['Tolerancia (relativa en FS)']).toBe('0,00001');
    expect(rows['Peso unitario del agua']).toBe('Sin agua (no aplica)'); // R9-03c: sin piezométrica no hay γw que mostrar
    expect(rows['Línea piezométrica']).toBe('Sin piezométrica');
    expect(rows['Superficies']).toBe('Búsqueda circular por entrada y salida');
    expect(rows['Rango de entrada (coronamiento)']).toBe('todo el terreno');
    expect(rows['Ancho mínimo']).toContain('por defecto');
  });

  it('círculo fijo, sismo y cargas', () => {
    const doc: ModelDoc = structuredClone(input.model);
    doc.analysis.search = null;
    doc.analysis.surface = { type: 'circle', xc: 45.5, yc: 60, r: 40 };
    doc.analysis.seismic = { kh: 0.1, kv: 0 };
    doc.loads = [
      { type: 'udl', id: 'u1', x1: 50, x2: 70, q: 20 },
      { type: 'line', x: 40, p: 20, angle: -10 },
    ];
    const c = buildReportContent({ ...input, model: doc });
    const m = section(c, 'model');
    const rows = kv(m);
    expect(rows['Superficies']).toBe('Círculo fijo');
    expect(rows['Centro (xc, yc)']).toBe('(45,5; 60) m');
    expect(rows['Sismo pseudoestático']).toBe('kh = 0,1 · kv = 0');
    const table = m.blocks.find((b) => b.kind === 'table');
    expect(table && table.kind === 'table' ? table.rows : null).toEqual([
      ['u1', 'Distribuida', '50 a 70 m', '20 kPa', '—'],
      ['2', 'Lineal', '40 m', '20 kN/m', '-10'],
    ]);
  });

  it('materiales con símbolos y unidades; imperial cambia las unidades', () => {
    const t = section(content, 'materials').blocks[0];
    expect(t && t.kind === 'table' ? t.header : null).toEqual(['Id', 'Nombre', 'γ (kN/m³)', 'γsat (kN/m³)', 'c (kPa)', 'φ (°)', 'ru']);
    expect(t && t.kind === 'table' ? t.rows[0] : null).toEqual(['soil', 'Arcilla φ ≤ 20°', '20', '—', '3', '19,6', '—']);
    const imp = structuredClone(input.model);
    imp.units = 'imperial';
    const t2 = section(buildReportContent({ ...input, model: imp }), 'materials').blocks[0];
    expect(t2 && t2.kind === 'table' ? t2.header[2] : null).toBe('γ (pcf)');
  });

  it('B-04: las tablas de resultados y de cargas declaran las unidades (SI e imperial)', () => {
    const si = structuredClone(input.model);
    si.loads = [
      { type: 'udl', id: 'u1', x1: 50, x2: 70, q: 20 },
      { type: 'line', x: 40, p: 20, angle: -10 },
    ];
    const tableOf = (doc: ModelDoc, id: string) => {
      const t = section(buildReportContent({ ...input, model: doc }), id).blocks.find((b) => b.kind === 'table');
      return t && t.kind === 'table' ? t : null;
    };
    expect(tableOf(si, 'results')?.header.slice(-2)).toEqual(['Centro (xc; yc) (m)', 'Radio (m)']);
    expect(tableOf(si, 'model')?.rows.map((r) => r.slice(2, 4))).toEqual([['50 a 70 m', '20 kPa'], ['40 m', '20 kN/m']]);
    const imp = structuredClone(si);
    imp.units = 'imperial';
    expect(tableOf(imp, 'results')?.header.slice(-2)).toEqual(['Centro (xc; yc) (ft)', 'Radio (ft)']);
    expect(tableOf(imp, 'model')?.rows.map((r) => r.slice(2, 4))).toEqual([['50 a 70 ft', '20 psf'], ['40 ft', '20 lbf/ft']]);
    expect(tableOf(imp, 'materials')?.header.slice(2, 5)).toEqual(['γ (pcf)', 'γsat (pcf)', 'c (psf)']);
  });

  it('FS y λ solo si el método convergió; datos de la superficie crítica', () => {
    const base = input.results[0] as MethodReport;
    const results: MethodReport[] = [
      { ...base, method: 'bishop', status: 'converged', fos: 1.23456, lambda: null },
      { ...base, method: 'spencer', status: 'not_converged', fos: 0.99, lambda: 0.1234, search: null },
      { ...base, method: 'bishop', status: 'invalid', fos: null, lambda: null },
      { ...base, method: 'spencer', status: 'converged', fos: 1.05, lambda: 0.1234, search: null },
      { ...base, method: 'spencer', status: 'invalid', fos: null, lambda: 0.5, search: null },
    ];
    const t = section(buildReportContent({ ...input, results }), 'results').blocks[0];
    const rows = t && t.kind === 'table' ? t.rows : [];
    expect(rows[0]?.slice(0, 5)).toEqual(['Bishop simplificado', 'Convergió', '1,235', String(base.iterations), '—']);
    expect(rows[1]?.slice(0, 7)).toEqual(['Spencer', 'No convergió', '—', String(base.iterations), '—', '—', '—']);
    expect(rows[2]?.[1]).toBe('No válida');
    expect(rows[3]?.slice(0, 5)).toEqual(['Spencer', 'Convergió', '1,050', String(base.iterations), '0,1234']);
    expect(rows[4]?.[4]).toBe('—');
    expect(rows[0]?.[7]).toContain(';');
  });

  it('comprobaciones: error relativo en % y resultado', () => {
    const c = buildReportContent({
      ...input,
      checks: [
        { method: 'bishop', published: 1, fos: 1.02, ok: true },
        { method: 'spencer', published: 1, fos: 1.2, ok: false },
        { method: 'spencer', published: 1, fos: null, ok: false },
      ],
    });
    const t = section(c, 'checks').blocks[0];
    expect(t && t.kind === 'table' ? t.rows : null).toEqual([
      ['Bishop simplificado', '1,000', '1,020', '2,00', 'Cumple'],
      ['Spencer', '1,000', '1,200', '20,00', 'No cumple'],
      ['Spencer', '1,000', '—', '—', 'Sin FS'],
    ]);
  });

  it('avisos: catálogo de warnings.ts, sin duplicados y con los pasados en la entrada', () => {
    const base = input.results[0] as MethodReport;
    const results: MethodReport[] = [
      { ...base, method: 'bishop', warnings: ['m_alpha', 'm_alpha', 'codigo_desconocido'] },
      { ...base, method: 'spencer', warnings: ['negative_lambda'] },
    ];
    const c = buildReportContent({
      ...input,
      results,
      warnings: [{ method: 'bishop', severity: 'aviso', code: 'm_alpha', text: 'texto propio' }],
    });
    const b = section(c, 'warnings').blocks[0];
    const items = b && b.kind === 'list' ? b.items : [];
    expect(items.map((i) => [i.label, i.severity, i.text])).toEqual([
      ['Bishop simplificado', 'aviso', 'texto propio'],
      ['Bishop simplificado', 'aviso', 'codigo_desconocido'],
      ['Spencer', 'nota', 'El método seleccionó una raíz de equilibrio con λ negativo; revise el resultado o compare con Bishop simplificado.'],
    ]);
    const none = buildReportContent({ ...input, results: results.map((r) => ({ ...r, warnings: [] })) });
    expect(section(none, 'warnings').blocks).toEqual([{ kind: 'paragraph', text: 'Sin avisos ni notas.' }]);
  });

  it('motor y advertencia: la de la entrada o, si está vacía, la aprobada', () => {
    const e = section(content, 'engine');
    expect(e.blocks[1]).toEqual({ kind: 'paragraph', text: professionalDisclaimer('ogs-core 0.1.0') });
    const custom = buildReportContent({ ...input, disclaimer: 'Texto aprobado' });
    expect(section(custom, 'engine').blocks[1]).toEqual({ kind: 'paragraph', text: 'Texto aprobado' });
  });
});

describe('dibujo de la sección', () => {
  it('terrainY toma la mayor intersección de las aristas', () => {
    const doc = loadCaseDoc('V047a');
    expect(terrainY(doc, 20)).toBe(25);
    expect(terrainY(doc, 40)).toBeCloseTo(30, 9);
    expect(terrainY(doc, 60)).toBe(35);
    expect(terrainY(doc, 100)).toBeNull();
  });

  it('clipPolylineX recorta e interpola en los extremos', () => {
    expect(clipPolylineX([[0, 0], [10, 10]], 2, 6)).toEqual([[2, 2], [6, 6]]);
    expect(clipPolylineX([[0, 0], [10, 10], [20, 0]], 0, 20)).toEqual([[0, 0], [10, 10], [20, 0]]);
    expect(clipPolylineX([[0, 0], [1, 1]], 5, 6)).toEqual([]);
  });

  it('regiones, superficie crítica con dovelas y leyenda', () => {
    const input = sampleInput();
    const d = buildSectionDrawing(input.model, input.results);
    expect(d.regions).toHaveLength(1);
    expect(d.bounds).toMatchObject({ xmin: 20, xmax: 70, ymax: 35 });
    expect(d.bounds.ymin).toBeLessThanOrEqual(20);
    expect(d.surface?.points.length).toBeGreaterThan(5);
    expect(d.surface?.sliceLines.length).toBeGreaterThan(5);
    expect(d.legend.map((l) => l.kind)).toEqual(['material', 'surface', 'slices']);
  });

  it('piezométrica recortada al ancho del modelo y en la leyenda', () => {
    const input = sampleInput();
    input.model.water = { piezometric_line: [[0, 22], [100, 22]] };
    const d = buildSectionDrawing(input.model, []);
    expect(d.piezo).toEqual([[20, 22], [70, 22]]);
    expect(d.surface).toBeNull();
    expect(d.legend.map((l) => l.kind)).toEqual(['material', 'piezo']);
  });

  it('sin dovelas dibuja el arco del círculo dentro del modelo', () => {
    const input = sampleInput();
    const base = input.results[0] as MethodReport;
    const d = buildSectionDrawing(input.model, [{ ...base, slices: [], surface: { xc: 45, yc: 50, r: 30 } }]);
    expect(d.surface?.sliceLines).toEqual([]);
    expect(d.surface?.points.length).toBeGreaterThan(2);
    for (const [x, y] of d.surface?.points ?? []) {
      expect(x).toBeGreaterThanOrEqual(20);
      expect(x).toBeLessThanOrEqual(70);
      expect(y).toBeLessThanOrEqual((terrainY(input.model, x) ?? 0) + 1e-9);
    }
  });
});

describe('E12i: superficie en x creciente (R5-03)', () => {
  const increasing = (pts: [number, number][]): boolean => pts.every((p, i) => i === 0 || p[0] > (pts[i - 1] as [number, number])[0]);

  it('D01 con superficie fija, left_to_right: del menor x al mayor, con el pie (x = 40) y sin retrocesos', () => {
    const doc = loadDifferentialDoc('D01');
    expect(doc.slope?.direction).toBe('left_to_right');
    const report = loadEngineReport('d01-fixed-ltr');
    const bishop = report.results[0] as MethodReport;
    // El motor entrega las dovelas del pie al coronamiento: en left_to_right, x decreciente.
    expect(bishop.slices[0]?.x_right).toBe(40);
    expect((bishop.slices[1]?.x_left as number) < (bishop.slices[0]?.x_left as number)).toBe(true);

    const d = buildSectionDrawing(doc, report.results);
    const points = d.surface?.points ?? [];
    expect(points).toHaveLength(bishop.slices.length + 1);
    expect(points[0]?.[0]).toBe(Math.min(...bishop.slices.map((s) => s.x_left)));
    expect(points[points.length - 1]?.[0]).toBe(40); // el pie
    expect(points[points.length - 1]?.[1]).toBe(bishop.slices[0]?.y_base_right);
    expect(increasing(points)).toBe(true);
    // Los antiguos 52 puntos de R5-03 (39,5329 primero; 17,1118 → 16,6447 → 17,1118 al final) ya no aparecen.
    expect(points.some((p) => p[0] === 39.5328947368421)).toBe(true);
    expect(d.surface?.sliceLines.every(([a, b]) => a[0] === b[0])).toBe(true);
  });

  it('right_to_left (V047a): también de menor a mayor x, con el pie en x = 30', () => {
    const doc = loadCaseDoc('V047a');
    const report = loadEngineReport('v047a-search-rtl');
    for (const r of report.results) {
      const pts = baseSurfacePoints(r.slices);
      expect(pts).toHaveLength(r.slices.length + 1);
      expect(increasing(pts)).toBe(true);
      expect(pts[0]?.[0]).toBeCloseTo(30, 5);
    }
    expect(increasing(buildSectionDrawing(doc, report.results).surface?.points ?? [])).toBe(true);
  });

  it('baseSurfacePoints no depende del orden de entrada y no modifica los datos', () => {
    const slices = (loadEngineReport('d01-fixed-ltr').results[0] as MethodReport).slices;
    const copy = structuredClone(slices);
    expect(baseSurfacePoints([...slices].reverse())).toEqual(baseSurfacePoints(slices));
    expect(slices).toEqual(copy);
    expect(baseSurfacePoints([])).toEqual([]);
  });
});

describe('E12i: rótulo de la superficie y λ en el dibujo (R5-04)', () => {
  const doc = loadDifferentialDoc('D01');
  const results = loadEngineReport('d01-fixed-ltr').results;
  const label = (rs: MethodReport[]): string | undefined => buildSectionDrawing(doc, rs).legend.find((l) => l.kind === 'surface')?.label;

  it('con un método convergido se rotula «Superficie crítica»', () => {
    expect(label(results)).toBe('Superficie crítica (Bishop simplificado)');
  });

  it('si ningún método convergió no dice «Superficie crítica»', () => {
    const notConverged = results.map((r) => ({ ...r, status: 'not_converged' as const }));
    expect(label(notConverged)).toBe('Superficie evaluada, sin convergencia (Bishop simplificado)');
    expect(label(notConverged)).not.toContain('crítica');
    const invalid = results.map((r) => ({ ...r, status: 'invalid' as const, fos: null }));
    expect(label(invalid)).not.toContain('crítica');
  });

  it('si el primero no convergió y el segundo sí, la superficie crítica es la del que convergió', () => {
    const mixed = [{ ...(results[0] as MethodReport), status: 'not_converged' as const }, results[1] as MethodReport];
    expect(label(mixed)).toBe('Superficie crítica (Spencer)');
  });
});
