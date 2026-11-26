// Informe, tabla de fuerzas y CSV con el pilote de Ito-Matsui (v0.5, E15i-7): columnas «Fuerza del suelo», «Gobierna» y «Brazo», datos de
// entrada del pilote y el texto del límite del cálculo. Sin pilotes de Ito-Matsui, todo queda como antes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reinforcementForcesCsv } from '../editor/app/reportInput';
import { itoPile } from '../editor/state/reinforcementFixtures';
import type { Reinforcement } from '../engine/types';
import { parseCsv, reinforcementForcesToCsv } from '../io/csv';
import { buildReportContent, type ReportBlock } from './content';
import { buildReportPdfWith, type FontLoader } from './pdf';
import { GIVEN_PILE, ITO_PILE, SHEET, syntheticItoMatsuiInput, syntheticReinforcedInput } from './reinforcementFixtures';
import {
  GOVERNS_LABEL,
  ITO_MATSUI_NOTE,
  ITO_MATSUI_STRUCTURAL_LIMIT_TEXT,
  STRUCTURAL_LIMIT_TEXT,
  csvRowNote,
  forceRecords,
  forcesTable,
  hasItoMatsui,
  reinforcementInputTables,
  structuralLimitText,
} from './reinforcementReport';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const tables = (blocks: ReportBlock[]): Extract<ReportBlock, { kind: 'table' }>[] => blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');
const paragraphs = (blocks: ReportBlock[]): string => blocks.map((b) => (b.kind === 'paragraph' ? b.text : '')).join(' ');

const ITO = ITO_PILE;
const GIVEN = GIVEN_PILE;
const itoInput = syntheticItoMatsuiInput;

describe('registros de fuerza', () => {
  it('forceRecords lleva soil_force, governs y arm del motor; los pilotes con fuerza dada no', () => {
    const input = itoInput();
    const recs = forceRecords(input.results, input.model.reinforcements);
    const ito = recs.filter((r) => r.id === 'pilote-1');
    expect(ito.length).toBeGreaterThan(0);
    expect(ito[0]).toMatchObject({ soilForce: 117.8, governs: 'shear', arm: 1.2236 });
    const given = recs.filter((r) => r.id === 'pilote-2');
    expect(given[0]!.soilForce).toBeUndefined();
    expect(given[0]!.governs).toBeUndefined();
    expect(hasItoMatsui(recs)).toBe(true);
    expect(hasItoMatsui(forceRecords(syntheticReinforcedInput().results, syntheticReinforcedInput().model.reinforcements))).toBe(false);
  });
});

describe('tabla de fuerzas', () => {
  const input = itoInput('shear');
  const recs = forceRecords([input.results[0]!], input.model.reinforcements);
  const t = forcesTable(recs, 'SI');

  it('agrega «Fuerza del suelo», «Gobierna» y «Brazo» tras «Disponible», y «Estado» sigue al final', () => {
    expect(t.header.slice(0, 7)).toEqual(['Id', 'Tipo', 'Cruce', 'Estación (m)', 'Disponible (kN/m)', 'Fuerza del suelo (kN/m)', 'Gobierna']);
    expect(t.header[7]).toBe('Brazo (m)');
    expect(t.header[t.header.length - 1]).toBe('Estado');
    expect(t.header).toHaveLength(12);
    for (const row of t.rows) expect(row).toHaveLength(t.header.length);
  });

  it('el pilote de Ito-Matsui informa el suelo, qué gobierna y el brazo; los demás, un guion', () => {
    const row = t.rows.find((r) => r[0] === 'pilote-1')!;
    expect(row.slice(5, 8)).toEqual(['117,800', 'Corte', '1,224']);
    const other = t.rows.find((r) => r[0] === 'pilote-2')!;
    expect(other.slice(5, 8)).toEqual(['—', '—', '—']);
  });

  it('los tres valores de «Gobierna» van en español', () => {
    expect(GOVERNS_LABEL).toEqual({ soil: 'Suelo', shear: 'Corte', bending: 'Flexión' });
    for (const [g, label] of [['soil', 'Suelo'], ['bending', 'Flexión']] as const) {
      const i = itoInput(g);
      const rows = forcesTable(forceRecords([i.results[0]!], i.model.reinforcements), 'SI').rows;
      expect(rows.find((r) => r[0] === 'pilote-1')![6]).toBe(label);
    }
  });

  it('marca qué columnas son numéricas (`numeric`), incluidas las nuevas', () => {
    expect(t.numeric).toHaveLength(t.header.length);
    expect(t.numeric.slice(0, 9)).toEqual([false, false, true, true, true, true, false, true, true]);
    expect(t.numeric[t.numeric.length - 1]).toBe(false);
  });

  it('en imperial las unidades son lbf/ft y ft', () => {
    const imp = forcesTable(recs, 'imperial');
    expect(imp.header[5]).toBe('Fuerza del suelo (lbf/ft)');
    expect(imp.header[7]).toBe('Brazo (ft)');
  });

  it('sin pilotes de Ito-Matsui la tabla es la de siempre: 9 columnas, sin las nuevas', () => {
    const plain = syntheticReinforcedInput();
    const pt = forcesTable(forceRecords(plain.results, plain.model.reinforcements), 'SI');
    expect(pt.header).toHaveLength(9);
    expect(pt.header.join('|')).not.toMatch(/suelo|Gobierna|Brazo/);
    expect(pt.numeric).toEqual([false, false, true, true, true, true, true, false, false]);
  });
});

describe('CSV de fuerzas', () => {
  const input = itoInput('bending');
  const csv = reinforcementForcesToCsv(forceRecords(input.results, input.model.reinforcements), { units: 'SI' });
  const parsed = parseCsv(csv);

  it('agrega fuerza_suelo_kn_m, gobierna y brazo_m antes de unidades y nota', () => {
    const keys = Object.keys(parsed.rows[0]!);
    expect(keys.slice(-5)).toEqual(['fuerza_suelo_kn_m', 'gobierna', 'brazo_m', 'unidades', 'nota']);
    expect(keys.slice(0, 15)).toEqual(['metodo', 'id', 'tipo', 'cruce', 'x_m', 'y_m', 'estacion_m', 'disponible_kn_m', 'fx_kn_m', 'fy_kn_m', 'aplicacion', 'estado', 'fs', 'movilizada_fx_kn_m', 'movilizada_fy_kn_m']);
  });

  it('el pilote de Ito-Matsui lleva los valores del formato (soil, shear, bending) y los demás, vacío', () => {
    const ito = parsed.rows.find((r) => r.id === 'pilote-1')!;
    expect(Number(ito.fuerza_suelo_kn_m)).toBeCloseTo(117.8, 9);
    expect(ito.gobierna).toBe('bending');
    expect(Number(ito.brazo_m)).toBeCloseTo(1.2236, 9);
    const other = parsed.rows.find((r) => r.id === 'pilote-2')!;
    expect([other.fuerza_suelo_kn_m, other.gobierna, other.brazo_m]).toEqual(['', '', '']);
  });

  it('la nota dice que el empuje es de Ito-Matsui y qué no se calcula', () => {
    const ito = parsed.rows.find((r) => r.id === 'pilote-1')!;
    expect(ito.nota).toBe('pasiva: se moviliza dividida por F; empuje del suelo (Ito-Matsui); no calcula empotramiento, momento a lo largo del pilote ni deflexión');
    expect(parsed.rows.find((r) => r.id === 'pilote-2')!.nota).toContain('solo estabilidad global');
    expect(csvRowNote({ application: 'active', type: 'pile', governs: 'soil' })).toBe('empuje del suelo (Ito-Matsui); no calcula empotramiento, momento a lo largo del pilote ni deflexión');
  });

  it('en imperial: fuerza_suelo_lbf_ft y brazo_ft', () => {
    const imp = reinforcementForcesToCsv(forceRecords(input.results, input.model.reinforcements), { units: 'imperial' }).split('\r\n')[0]!;
    expect(imp).toContain('fuerza_suelo_lbf_ft,gobierna,brazo_ft,unidades,nota');
  });

  it('sin Ito-Matsui el CSV no cambia: mismas 17 columnas de siempre', () => {
    const plain = syntheticReinforcedInput();
    expect(reinforcementForcesToCsv(forceRecords(plain.results, plain.model.reinforcements)).split('\r\n')[0]).toBe(
      'metodo,id,tipo,cruce,x_m,y_m,estacion_m,disponible_kn_m,fx_kn_m,fy_kn_m,aplicacion,estado,fs,movilizada_fx_kn_m,movilizada_fy_kn_m,unidades,nota',
    );
  });

  it('el botón de exportar (reportInput) usa las mismas columnas', () => {
    const run = { report: { engine: 'ogs-core', results: input.results }, doc: input.model } as unknown as Parameters<typeof reinforcementForcesCsv>[0];
    expect(reinforcementForcesCsv(run)).toContain('gobierna');
  });
});

describe('datos de entrada del pilote', () => {
  it('capacidades: la presión del suelo, el diámetro, S/D, la ubicación y el tope', () => {
    const cap = reinforcementInputTables(itoInput().model).capacity;
    expect(cap.rows[0]).toEqual([
      'pilote-1',
      'Presión del suelo (Ito-Matsui): D = 0,8 m, S/D = 3, en el centroide · tope: corte 150 kN, momento 250 kN·m por pilote',
      '2,4',
      '—',
    ]);
  });

  it('sin tope, con ubicación en la superficie de falla y en imperial', () => {
    const model = { ...itoInput().model, units: 'imperial', reinforcements: [itoPile({ id: 'q', spacing: 6, lateral_pressure: { model: 'ito_matsui', diameter: 2, location: 'slip_surface' } })] as Reinforcement[] };
    expect(reinforcementInputTables(model).capacity.rows[0]![1]).toBe('Presión del suelo (Ito-Matsui): D = 2 ft, S/D = 3, en la superficie de falla · sin tope');
  });

  it('solo corte o solo momento', () => {
    const rows = (capacity: object): string => reinforcementInputTables({ ...itoInput().model, reinforcements: [itoPile({ capacity })] as Reinforcement[] }).capacity.rows[0]![1]!;
    expect(rows({ shear: 90 })).toContain('tope: corte 90 kN por pilote');
    expect(rows({ moment: 40 })).toContain('tope: momento 40 kN·m por pilote');
  });

  it('un pilote con fuerza dada se describe como antes', () => {
    expect(reinforcementInputTables(itoInput().model).capacity.rows[1]![1]).toBe('Fuerza 60 kN por pilote');
  });
});

describe('límite del cálculo', () => {
  it('con fuerza dada es el de siempre; con Ito-Matsui dice que sí calcula el empuje del suelo', () => {
    expect(structuralLimitText([GIVEN, SHEET])).toBe(STRUCTURAL_LIMIT_TEXT);
    expect(structuralLimitText([ITO])).toBe(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT);
    expect(structuralLimitText([ITO, GIVEN])).toBe(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT);
    expect(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT).toContain('empuje del suelo');
    expect(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT).toContain('empotramiento');
    expect(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT).toContain('deflexión');
    expect(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT).not.toContain('No calcula el empuje sobre el elemento');
  });
});

describe('sección «Refuerzos» con Ito-Matsui', () => {
  const content = buildReportContent(itoInput());
  const section = content.sections.find((s) => s.id === 'reinforcements')!;

  it('las tablas de fuerzas traen las columnas nuevas', () => {
    const forceTables = tables(section.blocks).slice(2);
    expect(forceTables).toHaveLength(2);
    for (const ft of forceTables) {
      expect(ft.header).toContain('Fuerza del suelo (kN/m)');
      expect(ft.header).toContain('Gobierna');
      expect(ft.header).toContain('Brazo (m)');
    }
  });

  it('explica el cálculo de Ito-Matsui y cita el artículo, y usa el límite de Ito-Matsui', () => {
    const text = flat(paragraphs(section.blocks));
    expect(text).toContain(flat(ITO_MATSUI_NOTE));
    expect(ITO_MATSUI_NOTE).toContain('Ito y Matsui (1975)');
    expect(ITO_MATSUI_NOTE).toContain('Gobierna');
    expect(ITO_MATSUI_NOTE).toContain('Brazo');
    expect(text).toContain(`Límite del cálculo. ${flat(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT)}`);
  });

  it('la portada dice formato 0.5 (lateral_pressure lo exige)', () => {
    const kv = Object.fromEntries((content.sections.find((s) => s.id === 'cover')!.blocks.find((b) => b.kind === 'kv') as Extract<ReportBlock, { kind: 'kv' }>).rows);
    expect(kv['Versión del formato']).toBe('0.5');
  });

  it('sin Ito-Matsui el informe no menciona esa nota y conserva el límite de siempre', () => {
    const plain = buildReportContent(syntheticReinforcedInput()).sections.find((s) => s.id === 'reinforcements')!;
    const text = flat(paragraphs(plain.blocks));
    expect(text).not.toContain('Ito');
    expect(text).toContain(`Límite del cálculo. ${flat(STRUCTURAL_LIMIT_TEXT)}`);
  });
});

const havePdftotext = spawnSync('pdftotext', ['-v']).status !== null;

describe('PDF con Ito-Matsui', () => {
  it('trae las columnas nuevas y la nota, y el dibujo no rompe', async () => {
    const blob = await buildReportPdfWith(itoInput(), { loadFont, compress: true });
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const dir = `${process.env.TMPDIR ?? '/tmp'}/w-ito-pdf`;
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/ito-matsui.pdf`;
    writeFileSync(file, bytes);
    if (!havePdftotext) return;
    const text = flat(spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout);
    expect(text).toContain('Gobierna');
    expect(text).toContain('Brazo');
    expect(text).toContain('Fuerza del suelo');
    expect(text).toContain('Ito y Matsui (1975)');
    expect(text).toContain('Presión del suelo (Ito-Matsui)');
  });
});
