import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reinforcementForcesCsv, hasReinforcementForces } from '../editor/app/reportInput';
import { buildReportContent, buildSectionDrawing, type ReportBlock } from './content';
import { buildReportPdfWith, type FontLoader } from './pdf';
import { STRUCTURAL_LIMIT_TEXT, forceRecords, forcesTable, hasStructuralElements, reinforcementInputTables } from './reinforcementReport';
import { ANCHOR, GEO, NAIL, SHEET, syntheticReinforcedInput } from './reinforcementFixtures';
import { sampleInput } from './fixtures';
import { reinforcementForcesToCsv } from '../io/csv';
import { parseCsv } from '../io/csv';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const tables = (blocks: ReportBlock[]): Extract<ReportBlock, { kind: 'table' }>[] => blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');

describe('sección «Refuerzos» del informe', () => {
  const input = syntheticReinforcedInput();
  const content = buildReportContent(input);
  const section = content.sections.find((s) => s.id === 'reinforcements');

  it('aparece después de los resultados y tiene su propio título', () => {
    expect(section?.title).toBe('Refuerzos');
    const ids = content.sections.map((s) => s.id);
    expect(ids.indexOf('reinforcements')).toBe(ids.indexOf('results') + 1);
  });

  it('la portada dice formato 0.4 con refuerzos, aunque el modelo en memoria traiga una versión menor, y 0.2 sin ellos', () => {
    const kvOf = (c: ReturnType<typeof buildReportContent>): Record<string, string> =>
      Object.fromEntries((c.sections.find((s) => s.id === 'cover')!.blocks.find((b) => b.kind === 'kv') as Extract<ReportBlock, { kind: 'kv' }>).rows);
    const old = { ...input, model: { ...input.model, version: '0.2' } };
    expect(kvOf(buildReportContent(old))['Versión del formato']).toBe('0.4');
    expect(kvOf(buildReportContent(sampleInput()))['Versión del formato']).toBe('0.2');
  });

  it('sin refuerzos no hay sección (el informe de siempre no cambia)', () => {
    expect(buildReportContent(sampleInput()).sections.map((s) => s.id)).not.toContain('reinforcements');
  });

  it('lleva los datos de entrada (geometría y capacidades) con los rótulos de F4.11', () => {
    const [geo, cap] = tables(section!.blocks);
    expect(geo.title).toBe('Datos de entrada: geometría');
    expect(cap.title).toBe('Datos de entrada: capacidades');
    expect(geo.rows.map((r) => r.slice(0, 3))).toEqual([
      ['tablestaca-1', 'Tablestaca', 'Pasiva'],
      ['anclaje-1', 'Anclaje', 'Activa'],
      ['clavo-1', 'Clavo', 'Pasiva'],
      ['geosintetico-1', 'Geosintético', 'Pasiva'],
    ]);
    expect(geo.rows[1]!.slice(3)).toEqual(['40; 29', '58; 23', '18,9737', 'Axial']);
    expect(geo.rows[0]![6]).toBe('Ángulo 0°');
    expect(cap.rows[1]).toEqual(['anclaje-1', 'Tracción 150 kN · cabeza 150 · punta 0', '2,5', 'Sin arrancamiento: totalmente anclado']);
    expect(cap.rows[0]).toEqual(['tablestaca-1', 'Fuerza 120 kN/m de muro', '—', '—']);
    expect(cap.rows[2]![3]).toBe('Adherencia 30 kN/m');
    expect(cap.rows[3]![3]).toBe('Interfaz: adhesión 2, δ 20°, Rc 0,8');
  });

  it('la tabla de fuerzas tiene id, tipo, cruce, estación, disponible, aplicada (fx; fy), aplicación y estado, una por método', () => {
    const forceTables = tables(section!.blocks).slice(2);
    expect(forceTables.map((t) => t.title)).toEqual(['Fuerzas por cruce con la superficie final (Bishop simplificado)', 'Fuerzas por cruce con la superficie final (Spencer)']);
    const t = forceTables[0]!;
    expect(t.header).toEqual(['Id', 'Tipo', 'Cruce', 'Estación (m)', 'Disponible (kN/m)', 'Aplicada fx; fy (kN/m)', 'Aplicación', 'Estado']);
    expect(t.rows).toHaveLength(4);
    expect(t.rows[0]).toEqual(['tablestaca-1', 'Tablestaca', '1', '6,027', '120,000', '120,000; 0,000', 'Pasiva: se moviliza dividida por F', 'Aplicada']);
    expect(t.rows[1]![6]).toBe('Activa');
    expect(t.rows[1]![5]).toBe('56,921; -18,974');
    expect(t.rows[2]![7]).toBe('Ignorada por compresión');
    expect(t.rows[3]![7]).toBe('Fuera de la masa');
  });

  it('con una tablestaca o un pilote lleva SIEMPRE el texto del límite de F4.8', () => {
    const text = section!.blocks.filter((b) => b.kind === 'paragraph').map((b) => (b as { text: string }).text).join(' ');
    expect(flat(text)).toContain(flat(STRUCTURAL_LIMIT_TEXT));
    for (const needle of ['estabilidad global', 'empuje sobre el elemento', 'empotramiento', 'momento flector', 'deflexión', 'comprobaciones internas o externas de un muro']) {
      expect(STRUCTURAL_LIMIT_TEXT).toContain(needle);
    }
    expect(hasStructuralElements([SHEET])).toBe(true);
    expect(hasStructuralElements([ANCHOR, NAIL, GEO])).toBe(false);
  });

  it('sin pilotes ni tablestacas no dice el límite estructural, pero sí la leyenda de las pasivas', () => {
    const only = syntheticReinforcedInput({ reinforcements: [ANCHOR, NAIL] });
    const sec = buildReportContent(only).sections.find((s) => s.id === 'reinforcements')!;
    const text = flat(sec.blocks.filter((b) => b.kind === 'paragraph').map((b) => (b as { text: string }).text).join(' '));
    expect(text).not.toContain('empotramiento');
    expect(text).toContain('se moviliza dividida por F');
  });

  it('un informe sin fuerzas (motor simulado, método sin converger) lo dice en vez de omitir la tabla', () => {
    const input2 = syntheticReinforcedInput();
    input2.results = input2.results.map((r) => ({ ...r, reinforcement_forces: undefined }));
    const sec = buildReportContent(input2).sections.find((s) => s.id === 'reinforcements')!;
    expect(tables(sec.blocks)).toHaveLength(2);
    expect(flat(sec.blocks.map((b) => (b.kind === 'paragraph' ? b.text : '')).join(' '))).toContain('Ningún método devolvió fuerzas');
  });

  it('en un modelo imperial las unidades son ft y lbf/ft', () => {
    const imp = syntheticReinforcedInput();
    imp.model = { ...imp.model, units: 'imperial' };
    const t = reinforcementInputTables(imp.model);
    expect(t.geometry.header[3]).toBe('Cabeza (x; y) (ft)');
    expect(t.capacity.rows[0]![1]).toBe('Fuerza 120 lbf/ft de muro');
    expect(forcesTable(forceRecords(imp.results, imp.model.reinforcements), 'imperial').header[4]).toBe('Disponible (lbf/ft)');
  });
});

describe('dibujo de la sección con refuerzos', () => {
  it('lleva los refuerzos, las fuerzas del resultado principal y la leyenda', () => {
    const input = syntheticReinforcedInput();
    const d = buildSectionDrawing(input.model, input.results);
    expect(d.reinforcements).toHaveLength(4);
    expect(d.forces).toHaveLength(4);
    expect(d.legend.map((l) => l.kind)).toEqual(expect.arrayContaining(['reinforcement', 'force', 'force_off']));
    expect(d.legend.find((l) => l.kind === 'force')!.label).toContain('kN/m');
    // los extremos de los refuerzos entran en el encuadre
    expect(d.bounds.xmax).toBeGreaterThanOrEqual(66);
    expect(d.bounds.ymax).toBeGreaterThanOrEqual(35);
  });

  it('sin refuerzos el dibujo no cambia', () => {
    const d = buildSectionDrawing(sampleInput().model, sampleInput().results);
    expect(d.reinforcements).toEqual([]);
    expect(d.forces).toEqual([]);
    expect(d.legend.map((l) => l.kind)).not.toContain('reinforcement');
  });
});

describe('CSV de las fuerzas', () => {
  const input = syntheticReinforcedInput();
  const run = { report: { engine: input.engineName, results: input.results }, doc: input.model };

  it('una fila por cruce y método, con cabecera de unidades y RFC 4180 puro', () => {
    const csv = reinforcementForcesCsv(run);
    const parsed = parseCsv(csv);
    expect(parsed.ok).toBe(true);
    expect(Object.keys(parsed.rows[0]!)).toEqual(['metodo', 'id', 'tipo', 'cruce', 'x_m', 'y_m', 'estacion_m', 'disponible_kn_m', 'fx_kn_m', 'fy_kn_m', 'aplicacion', 'estado', 'unidades']);
    expect(parsed.rows).toHaveLength(8);
    expect(parsed.rows[0]).toMatchObject({ metodo: 'bishop', id: 'tablestaca-1', tipo: 'sheet_pile', cruce: '1', disponible_kn_m: '120', fx_kn_m: '120', fy_kn_m: '0', aplicacion: 'passive', estado: 'applied', unidades: 'SI' });
    expect(parsed.rows[1]).toMatchObject({ id: 'anclaje-1', tipo: 'anchor', aplicacion: 'active' });
    expect(parsed.rows[2]).toMatchObject({ estado: 'compression_ignored' });
    expect(parsed.rows[3]).toMatchObject({ estado: 'outside_mass' });
    expect(csv).not.toContain('#');
  });

  it('imperial: cabeceras en ft y lbf/ft', () => {
    const csv = reinforcementForcesToCsv(forceRecords(input.results, input.model.reinforcements), { units: 'imperial' });
    expect(csv.split('\r\n')[0]).toBe('metodo,id,tipo,cruce,x_ft,y_ft,estacion_ft,disponible_lbf_ft,fx_lbf_ft,fy_lbf_ft,aplicacion,estado,unidades');
  });

  it('un id desconocido no rompe: tipo vacío; sin fuerzas no hay nada que exportar', () => {
    const orphan = forceRecords(input.results, []);
    expect(orphan[0]!.type).toBeNull();
    expect(hasReinforcementForces(input.results)).toBe(true);
    expect(hasReinforcementForces(sampleInput().results)).toBe(false);
  });
});

const havePdftotext = spawnSync('pdftotext', ['-v']).status !== null;

describe('PDF con refuerzos', () => {
  it('trae la sección, las tablas y el texto del límite; el dibujo no rompe', async () => {
    const blob = await buildReportPdfWith(syntheticReinforcedInput(), { loadFont, compress: true });
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const dir = `${process.env.TMPDIR ?? '/tmp'}/f3r1wb-pdf`;
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/refuerzos.pdf`;
    writeFileSync(file, bytes);
    if (!havePdftotext) return;
    const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    const text = flat(r.stdout);
    expect(text).toContain('Refuerzos');
    expect(text).toContain('Datos de entrada: geometría');
    expect(text).toContain('Datos de entrada: capacidades');
    expect(text).toContain('Fuerzas por cruce con la superficie final (Bishop simplificado)');
    expect(text).toContain('Pasiva: se moviliza dividida por F');
    expect(text).toContain('Ignorada por');
    expect(text).toContain(flat(STRUCTURAL_LIMIT_TEXT));
    // Los rótulos del dibujo (halo y relleno) se revisan a la vista: la extracción de texto los mezcla con la leyenda.
    expect(text).toContain('Refuerzos (un símbolo por tipo');
  });

  it('el informe sin refuerzos no cambia ni un byte de contenido respecto de no pasar por la sección', () => {
    const c = buildReportContent(sampleInput());
    expect(c.sections.every((s) => s.id !== 'reinforcements')).toBe(true);
  });
});
