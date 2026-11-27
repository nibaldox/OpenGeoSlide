// UA1-M: modelo puro del armazón (resúmenes de los pasos, chip de estado, FS mínimo y contenido del informe).
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EngineStatus } from '../../engine/client';
import type { AnalysisReport, MethodKind, MethodReport, Model, Reinforcement } from '../../engine/types';
import { analyzeMock } from '../../engine/mockEngine';
import { saveOgsJson } from '../../io/ogsJson';
import { loadCaseDoc, loadEngineReport, loadPublishedDoc } from '../../report/fixtures';
import { buildReportContent } from '../../report/content';
import acads1a from '../../examples/acads1a.json';
import { loadDraftKey, loadDraftLabel } from '../panels/LoadsPanel';
import { vertexDraftKey, vertexDraftLabel } from '../panels/GeometryPanel';
import { NEW_MATERIAL_DRAFT } from '../panels/MaterialsPanel';
import { SEISMIC_DRAFT } from '../panels/SeismicPanel';
import { SURFACE_CIRCLE_DRAFT, SURFACE_POLYLINE_DRAFT } from '../panels/SurfacePanel';
import { WATER_GAMMA_DRAFT, WATER_PIEZO_DRAFT } from '../panels/WaterPanel';
import { clearPendingDrafts, getPendingDrafts, setPendingDraft } from '../panels/forms';
import { validateLocal } from '../state';
import type { Issue, ModelDoc } from '../types';
import type { PanelTabId } from './issueNav';
import { buildReportInput, type EngineRun } from './reportInput';
import { STEP_ORDER, draftStep, fsMinimum, fsText, reportContents, runStatus, stepStates, type RunStatusInput } from './shellModel';

// ───────── Documentos ─────────

const square = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Un modelo mínimo y válido: una región de 10 × 5 (50 m²), un material, un círculo fijo y Bishop. */
function mini(patch: Record<string, unknown> = {}): ModelDoc {
  const doc = {
    format: 'opengeoslide',
    version: '0.3',
    meta: {},
    units: 'SI',
    materials: [{ id: 'm1', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 5, friction_angle: 30 }],
    regions: [{ material: 'm1', polygon: square(0, 0, 10, 5) }],
    analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 5, yc: 8, r: 8 } },
    ...patch,
  };
  return doc as unknown as ModelDoc;
}

/** `mini` con `analysis` parcheado (se conserva lo demás). */
function miniAnalysis(patch: Record<string, unknown>): ModelDoc {
  return mini({ analysis: { methods: ['bishop'], slices: 50, ...patch } });
}

const summaryOf = (doc: ModelDoc, id: PanelTabId): string => stepStates(doc, [], [])[id].summary;
const statusOf = (doc: ModelDoc, id: PanelTabId): string => stepStates(doc, [], [])[id].status;

const fromCase = (id: string): ModelDoc => loadPublishedDoc(id);
const acadsDoc = (): ModelDoc => loadCaseDoc('V047a');

describe('stepStates: estructura', () => {
  it('devuelve los diez pasos de STEP_ORDER, cada uno con resumen de una línea de ≤ 40 caracteres', () => {
    const states = stepStates(mini(), [], []);
    expect(Object.keys(states).sort()).toEqual([...STEP_ORDER].sort());
    for (const id of STEP_ORDER) {
      expect(states[id].summary.length).toBeGreaterThan(0);
      expect(states[id].summary.length).toBeLessThanOrEqual(40);
      expect(states[id].summary).not.toContain('\n');
    }
  });

  it('el documento vacío no rompe: obligatorios `empty`, opcionales `optional`, nunca un resumen vacío', () => {
    const empty = { format: 'opengeoslide', version: '0.3', meta: {}, materials: [], regions: [], analysis: {} } as unknown as ModelDoc;
    const s = stepStates(empty, [], []);
    expect(s.geometry).toMatchObject({ summary: 'Sin regiones', status: 'empty' });
    expect(s.materials).toMatchObject({ summary: 'Sin materiales', status: 'empty' });
    expect(s.water).toMatchObject({ summary: 'Sin piezométrica', status: 'optional' });
    expect(s.search).toMatchObject({ summary: 'Inactiva', status: 'optional' });
    expect(s.loads).toMatchObject({ summary: 'Sin cargas', status: 'optional' });
    expect(s.reinforcements).toMatchObject({ summary: 'Sin refuerzos', status: 'optional' });
    expect(s.seismic).toMatchObject({ summary: 'Sin sismo', status: 'optional' });
    expect(s.project).toMatchObject({ summary: 'Sin título · SI', status: 'optional' });
    expect(s.analysis.summary).toBe('Bishop · 50 dovelas');
    for (const id of STEP_ORDER) expect(s[id].summary.trim()).not.toBe('');
  });

  it('con las incidencias de validateLocal, el documento vacío marca Geometría (y Superficie) como `error`', () => {
    const empty = { format: 'opengeoslide', version: '0.3', meta: {}, materials: [], regions: [], analysis: {} } as unknown as ModelDoc;
    const issues = validateLocal(empty);
    const s = stepStates(empty, issues, []);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
    expect(s.geometry.status).toBe('error');
    expect(s.surface.status).toBe('error');
    expect(s.geometry.summary).toBe('Sin regiones');
  });
});

describe('stepStates: resumen de cada paso (tabla de §4.1)', () => {
  it('geometry: regiones · vértices · área, sin decimales desde 100 y uno por debajo', () => {
    expect(summaryOf(mini(), 'geometry')).toBe('1 región · 4 vértices · 50,0 m²');
    const two = mini({ regions: [{ material: 'm1', polygon: square(0, 0, 10, 5) }, { material: 'm1', polygon: square(10, 0, 10, 5.5) }] });
    expect(summaryOf(two, 'geometry')).toBe('2 regiones · 8 vértices · 105 m²');
    expect(summaryOf(mini({ regions: [{ material: 'm1', polygon: square(0, 0, 50, 24.68) }] }), 'geometry')).toBe('1 región · 4 vértices · 1.234 m²');
    expect(summaryOf(mini({ regions: [{ material: 'm1', polygon: square(0, 0, 3, 1.5) }] }), 'geometry')).toBe('1 región · 4 vértices · 4,5 m²');
  });

  it('geometry: el área es la unión de las regiones por suma, con orientación indiferente y sin contar vértices no finitos', () => {
    const cw = [...square(0, 0, 10, 5)].reverse();
    expect(summaryOf(mini({ regions: [{ material: 'm1', polygon: cw }] }), 'geometry')).toContain('50,0 m²');
    const bad = mini({ regions: [{ material: 'm1', polygon: [[0, 0], [Number.NaN, 5], [10, 5]] }] });
    expect(summaryOf(bad, 'geometry')).toBe('1 región · 3 vértices · 0,0 m²');
  });

  it('materials: cuenta y nombres de modelo de la UI, sin repetir', () => {
    expect(summaryOf(mini(), 'materials')).toBe('1 material · Mohr-Coulomb');
    const hb = { id: 'r', name: 'Roca', model: 'hoek_brown', unit_weight: 26, ucs: 50000, gsi: 60, mi: 10, disturbance: 0 };
    const mc2 = { id: 'm2', name: 'Otro', model: 'mohr_coulomb', unit_weight: 19, cohesion: 1, friction_angle: 20 };
    const mats = [mini().materials[0], mc2, hb];
    expect(summaryOf(mini({ materials: mats }), 'materials')).toBe('3 materiales · Mohr-Coulomb, Hoek-Brown');
  });

  it('materials: un material sin `model` cuenta como Mohr-Coulomb', () => {
    const m = { id: 'a', name: 'A', unit_weight: 20, cohesion: 1, friction_angle: 20 };
    expect(summaryOf(mini({ materials: [m] }), 'materials')).toBe('1 material · Mohr-Coulomb');
  });

  it('water: piezométrica y número de puntos; sin línea, vacío opcional', () => {
    const line = [[0, 2], [3, 2], [6, 3], [9, 3], [10, 3]];
    const doc = mini({ water: { unit_weight: 9.81, piezometric_line: line } });
    expect(summaryOf(doc, 'water')).toBe('Piezométrica · 5 puntos');
    expect(statusOf(doc, 'water')).toBe('done');
    expect(summaryOf(mini({ water: { piezometric_line: [[0, 2]] } }), 'water')).toBe('Piezométrica · 1 punto');
    const none = mini({ water: { unit_weight: 9.81 } });
    expect(summaryOf(none, 'water')).toBe('Sin piezométrica');
    expect(statusOf(none, 'water')).toBe('optional');
  });

  it('water (B-06): grieta con agua → «Agua en grieta · γw 9,81» (done); γw explícito o por defecto, también en imperial', () => {
    const crack = (fill: number, extra: Record<string, unknown> = {}): ModelDoc =>
      mini({ analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 5, yc: 8, r: 8 }, tension_crack: { depth: 'auto', water_fill: fill } }, ...extra });
    expect(summaryOf(crack(1), 'water')).toBe('Agua en grieta · γw 9,81');
    expect(statusOf(crack(0.5), 'water')).toBe('done');
    expect(summaryOf(crack(1, { water: { unit_weight: 9.807 } }), 'water')).toBe('Agua en grieta · γw 9,807');
    expect(summaryOf(crack(1, { units: 'imperial' }), 'water')).toBe('Agua en grieta · γw 62,45');
    // grieta seca: no hay agua
    expect(summaryOf(crack(0), 'water')).toBe('Sin piezométrica');
    expect(statusOf(crack(0), 'water')).toBe('optional');
    // con piezométrica, manda la piezométrica
    expect(summaryOf(crack(1, { water: { piezometric_line: [[0, 1], [10, 2]] } }), 'water')).toBe('Piezométrica · 2 puntos');
  });

  it('water (B-06): ru > 0 en algún material → «Sin piezométrica · ru en N mat.» (done); ru = 0 o nulo no cuenta', () => {
    const m = (id: string, ru: number | null | undefined) => ({ id, name: id, model: 'mohr_coulomb', unit_weight: 20, cohesion: 5, friction_angle: 30, ru });
    expect(summaryOf(mini({ materials: [m('a', 0.2), m('b', 0), m('c', null), m('d', 0.1)] }), 'water')).toBe('Sin piezométrica · ru en 2 mat.');
    expect(summaryOf(mini({ materials: [m('a', 0.2)] }), 'water')).toBe('Sin piezométrica · ru en 1 mat.');
    expect(statusOf(mini({ materials: [m('a', 0.2)] }), 'water')).toBe('done');
    expect(summaryOf(mini({ materials: [m('a', 0), m('b', undefined)] }), 'water')).toBe('Sin piezométrica');
  });

  it('water (B-06): los casos publicados con grieta llena (V048, V086b, V086d) y con ru (V044b, V101, V103) ya no dicen «Sin piezométrica» a secas', () => {
    for (const id of ['V048', 'V086b', 'V086d']) expect([id, summaryOf(fromCase(id), 'water'), statusOf(fromCase(id), 'water')]).toEqual([id, 'Agua en grieta · γw 9,807', 'done']);
    for (const id of ['V044b', 'V101', 'V103']) expect([id, summaryOf(fromCase(id), 'water'), statusOf(fromCase(id), 'water')]).toEqual([id, 'Sin piezométrica · ru en 1 mat.', 'done']);
  });

  it('surface: las cuatro formas y el vacío', () => {
    expect(summaryOf(mini(), 'surface')).toBe('Circular fija');
    const poly = miniAnalysis({ surface: { type: 'polyline', points: [[0, 5], [2, 3], [4, 2], [6, 2], [8, 3], [10, 5]] } });
    expect(summaryOf(poly, 'surface')).toBe('Polilínea fija · 6 puntos');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [0, 3], exit: [7, 10] } }), 'surface')).toBe('Búsqueda circular');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', non_circular: {} } }), 'surface')).toBe('Búsqueda no circular');
    const none = miniAnalysis({});
    expect(summaryOf(none, 'surface')).toBe('Sin superficie');
    expect(statusOf(none, 'surface')).toBe('empty');
  });

  it('surface: sin superficie es `error` cuando validateLocal lo marca (editor.no_surface apunta a «surface»)', () => {
    const none = miniAnalysis({});
    const issues = validateLocal(none);
    expect(issues.some((i) => i.code === 'editor.no_surface' && i.severity === 'error')).toBe(true);
    const s = stepStates(none, issues, []);
    expect(s.surface).toMatchObject({ summary: 'Sin superficie', status: 'error' });
    expect(s.surface.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('search: rangos de entrada y salida con la unidad; sin búsqueda, «Inactiva»', () => {
    const doc = miniAnalysis({ search: { type: 'circular_entry_exit', entry: [10, 25], exit: [40, 60] } });
    expect(summaryOf(doc, 'search')).toBe('Entrada 10–25 m · salida 40–60 m');
    expect(statusOf(doc, 'search')).toBe('done');
    expect(summaryOf(mini(), 'search')).toBe('Inactiva');
    expect(statusOf(mini(), 'search')).toBe('optional');
  });

  it('search: coma decimal, rangos automáticos y forma corta si no cabe', () => {
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [10.5, 25], exit: [40, 60.25] } }), 'search')).toBe('Entrada 10,5–25 m · salida 40–60,25 m');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit' } }), 'search')).toBe('Entrada y salida automáticas');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [10, 25] } }), 'search')).toBe('Entrada 10–25 m · salida automática');
    const medium = summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [100.5, 125.5], exit: [140.5, 160.5] } }), 'search');
    expect(medium).toBe('Ent. 100,5–125,5 m · sal. 140,5–160,5 m');
    const long = summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [100.25, 125.75], exit: [140.25, 160.75] } }), 'search');
    expect(long).toBe('100,25–125,75 m · 140,25–160,75 m');
  });

  it('search (B-09): con un solo rango definido, la forma corta conserva la unidad (m y ft)', () => {
    const entryOnly = miniAnalysis({ search: { type: 'circular_entry_exit', entry: [10.25, 25.55], exit: null } });
    expect(summaryOf(entryOnly, 'search')).toBe('Ent. 10,25–25,55 m · sal. auto.');
    const exitOnly = miniAnalysis({ search: { type: 'circular_entry_exit', exit: [10.25, 25.55] } });
    expect(summaryOf(exitOnly, 'search')).toBe('Ent. auto. · sal. 10,25–25,55 m');
    const imperial = mini({ units: 'imperial', analysis: { methods: ['bishop'], slices: 50, search: { type: 'circular_entry_exit', entry: [110.25, 125.55] } } });
    expect(summaryOf(imperial, 'search')).toBe('Ent. 110,25–125,55 ft · sal. auto.');
    const veryLong = miniAnalysis({ search: { type: 'circular_entry_exit', entry: [1100.25, 1125.55] } });
    expect(summaryOf(veryLong, 'search')).toBe('Ent. 1.100,25–1.125,55 m · sal. auto.');
  });

  it('search (B-09): ninguna forma deja un número sin unidad, con cualquier combinación de rangos', () => {
    const ranges = [undefined, null, [1, 2], [10.5, 25.25], [100.25, 125.75], [1100.5, 1125.5]] as const;
    for (const entry of ranges) {
      for (const exit of ranges) {
        const text = summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry, exit } }), 'search');
        const numbers = text.match(/\d[\d.,]*–\d[\d.,]*/g) ?? [];
        for (const n of numbers) expect([text, n, new RegExp(`${n.replace(/[.,–]/g, (c) => `\\${c}`)} (m|ft)`).test(text)]).toEqual([text, n, true]);
      }
    }
  });

  it('analysis: nombres cortos de los métodos en el orden de la UI y dovelas; la forma corta si no cabe', () => {
    expect(summaryOf(miniAnalysis({ methods: ['spencer', 'bishop', 'morgenstern_price'], slices: 50 }), 'analysis')).toBe('Bishop · Spencer · M-P · 50 dovelas');
    expect(summaryOf(miniAnalysis({ methods: ['bishop'], slices: 1 }), 'analysis')).toBe('Bishop · 1 dovela');
    expect(summaryOf(miniAnalysis({ methods: ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified'], slices: 50 }), 'analysis')).toBe('4 métodos · 50 dovelas');
    const all: MethodKind[] = ['janbu_corrected', 'janbu_simplified', 'morgenstern_price', 'spencer', 'bishop'];
    expect(summaryOf(miniAnalysis({ methods: all, slices: 120 }), 'analysis')).toBe('5 métodos · 120 dovelas');
  });

  it('analysis: sin `methods` ni `slices` valen los por defecto del motor (Bishop, 50 dovelas)', () => {
    expect(summaryOf(mini({ analysis: { surface: { type: 'circle', xc: 5, yc: 8, r: 8 } } }), 'analysis')).toBe('Bishop · 50 dovelas');
  });

  it('analysis: una lista de métodos vacía es `empty` (no hay nada que calcular)', () => {
    const doc = miniAnalysis({ methods: [] });
    expect(summaryOf(doc, 'analysis')).toBe('Sin métodos');
    expect(statusOf(doc, 'analysis')).toBe('empty');
  });

  it('loads: distribuidas y lineales con plural; sin cargas, vacío opcional', () => {
    const udl = { type: 'udl', x1: 0, x2: 3, q: 10 };
    const line = { type: 'line', x: 4, p: 20, angle: 0 };
    expect(summaryOf(mini({ loads: [udl, line, line] }), 'loads')).toBe('1 distribuida · 2 lineales');
    expect(summaryOf(mini({ loads: [udl, udl] }), 'loads')).toBe('2 distribuidas');
    expect(summaryOf(mini({ loads: [line] }), 'loads')).toBe('1 lineal');
    expect(summaryOf(mini({ loads: [] }), 'loads')).toBe('Sin cargas');
    expect(statusOf(mini({ loads: [] }), 'loads')).toBe('optional');
    expect(statusOf(mini({ loads: [udl] }), 'loads')).toBe('done');
  });

  it('reinforcements: por tipo si cabe, y el total si no', () => {
    const r = (type: Reinforcement['type'], id: string) => ({ id, type, x1: 0, y1: 5, x2: 5, y2: 2, application: 'active', tensile_capacity: 100, force: 10, direction: 'axial' });
    expect(summaryOf(mini({ reinforcements: [r('anchor', 'a'), r('nail', 'b'), r('nail', 'c')] }), 'reinforcements')).toBe('1 anclaje · 2 clavos');
    expect(summaryOf(mini({ reinforcements: [r('nail', 'a'), r('nail', 'b'), r('nail', 'c')] }), 'reinforcements')).toBe('3 clavos');
    const five = (['anchor', 'nail', 'geosynthetic', 'pile', 'sheet_pile'] as const).map((t, i) => r(t, `r${i}`));
    expect(summaryOf(mini({ reinforcements: five }), 'reinforcements')).toBe('5 refuerzos');
    expect(summaryOf(mini({ reinforcements: [r('anchor', 'a')] }), 'reinforcements')).toBe('1 anclaje');
    expect(summaryOf(mini(), 'reinforcements')).toBe('Sin refuerzos');
    expect(statusOf(mini(), 'reinforcements')).toBe('optional');
  });

  it('seismic: kh y kv con coma decimal; nulo o cero es «Sin sismo»', () => {
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.1, kv: 0 } }), 'seismic')).toBe('kh 0,10 · kv 0,00');
    expect(statusOf(miniAnalysis({ seismic: { kh: 0.1, kv: 0 } }), 'seismic')).toBe('done');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.125 } }), 'seismic')).toBe('kh 0,125 · kv 0,00');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0, kv: 0 } }), 'seismic')).toBe('Sin sismo');
    expect(summaryOf(miniAnalysis({ seismic: null }), 'seismic')).toBe('Sin sismo');
    expect(statusOf(miniAnalysis({ seismic: null }), 'seismic')).toBe('optional');
  });

  it('seismic (B-12b): un coeficiente no nulo que redondea a cero es «< 0,001», no «0,00»', () => {
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.0004, kv: 0 } }), 'seismic')).toBe('kh < 0,001 · kv 0,00');
    expect(statusOf(miniAnalysis({ seismic: { kh: 0.0004 } }), 'seismic')).toBe('done');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.1, kv: 0.0002 } }), 'seismic')).toBe('kh 0,10 · kv < 0,001');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.0004, kv: 0.0003 } }), 'seismic')).toBe('kh < 0,001 · kv < 0,001');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.0005, kv: 0 } }), 'seismic')).toBe('kh 0,001 · kv 0,00');
    expect(summaryOf(miniAnalysis({ seismic: { kh: 0.1, kv: -0.0002 } }), 'seismic')).toBe('kh 0,10 · kv > −0,001');
  });

  it('search (B-12c): los rangos con negativos usan «a» y el signo menos (−)', () => {
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [-25.5, -10.2] } }), 'search')).toBe('Ent. −25,5 a −10,2 m · sal. auto.');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [-5, 10], exit: [20, 30] } }), 'search')).toBe('Entrada −5 a 10 m · salida 20–30 m');
    expect(summaryOf(miniAnalysis({ search: { type: 'circular_entry_exit', entry: [10, 25] } }), 'search')).toBe('Entrada 10–25 m · salida automática');
    expect(summaryOf(acadsDoc(), 'search')).not.toMatch(/-\d/);
  });

  it('project: título (o «Sin título») y el sistema de unidades', () => {
    const titled = mini({ meta: { title: 'Presa norte' } });
    expect(summaryOf(titled, 'project')).toBe('Presa norte · SI');
    expect(statusOf(titled, 'project')).toBe('done');
    expect(summaryOf(mini(), 'project')).toBe('Sin título · SI');
    expect(statusOf(mini(), 'project')).toBe('optional');
    expect(summaryOf(mini({ meta: { title: '   ' } }), 'project')).toBe('Sin título · SI');
    expect(summaryOf(mini({ meta: { title: 'Talud' }, units: 'imperial' }), 'project')).toBe('Talud · imperial');
  });

  it('el estado del resto de pasos con contenido es `done`', () => {
    const s = stepStates(mini(), [], []);
    for (const id of ['geometry', 'materials', 'surface', 'analysis'] as const) expect(s[id].status).toBe('done');
    expect(s.geometry.errorCount).toBe(0);
  });
});

describe('stepStates: modelo imperial', () => {
  it('usa ft y ft² y los mismos resúmenes', () => {
    const doc = mini({
      units: 'imperial',
      regions: [{ material: 'm1', polygon: square(0, 0, 40, 30) }],
      analysis: { methods: ['bishop'], slices: 50, search: { type: 'circular_entry_exit', entry: [10, 25], exit: [40, 60] } },
    });
    expect(summaryOf(doc, 'geometry')).toBe('1 región · 4 vértices · 1.200 ft²');
    expect(summaryOf(doc, 'search')).toBe('Entrada 10–25 ft · salida 40–60 ft');
    expect(summaryOf(doc, 'project')).toBe('Sin título · imperial');
  });

  it('un ejemplo imperial real (V026) resume en ft', () => {
    const doc = fromCase('V026');
    expect(doc.units).toBe('imperial');
    const s = stepStates(doc, [], []);
    expect(s.geometry.summary).toMatch(/ ft²$/);
    expect(s.project.summary).toMatch(/ · imperial$/);
  });
});

describe('stepStates: resúmenes que no caben en 40 caracteres', () => {
  it('geometría: cae a «regiones · área» y después a «regiones», nunca corta a mitad de palabra', () => {
    const polygon = square(0, 0, 1000, 1000);
    const many = (n: number) => mini({ regions: Array.from({ length: n }, () => ({ material: 'm1', polygon })) });
    expect(summaryOf(many(12), 'geometry')).toBe('12 regiones · 12.000.000 m²');
    expect(summaryOf(mini({ regions: Array.from({ length: 12 }, () => ({ material: 'm1', polygon: square(0, 0, 100, 100) })) }), 'geometry')).toBe('12 regiones · 48 vértices · 120.000 m²');
    expect(summaryOf(many(120), 'geometry')).toBe('120 regiones · 120.000.000 m²');
    expect(summaryOf(many(120), 'geometry').length).toBeLessThanOrEqual(40);
    const huge = mini({ regions: Array.from({ length: 120000 }, () => ({ material: 'm1', polygon: square(0, 0, 100000, 100000) })) });
    expect(summaryOf(huge, 'geometry')).toBe('120.000 regiones');
  });

  it('materiales: cae a «n materiales · k modelos» cuando los nombres no caben', () => {
    const m = (id: string, model: string) => ({ id, name: id, model, unit_weight: 20 });
    const doc = mini({ materials: [m('a', 'mohr_coulomb'), m('b', 'undrained'), m('c', 'hoek_brown'), m('d', 'shansep')] });
    expect(summaryOf(doc, 'materials')).toBe('4 materiales · 4 modelos');
  });

  it('proyecto: un título largo se recorta en el límite de una palabra con elipsis y conserva las unidades', () => {
    const doc = mini({ meta: { title: 'Estabilidad del talud norte de la presa de relaves' }, units: 'imperial' });
    const text = summaryOf(doc, 'project');
    expect(text).toBe('Estabilidad del talud norte… · imperial');
    expect(text.length).toBeLessThanOrEqual(40);
  });

  it('proyecto: la elipsis no queda pegada a una coma o dos puntos', () => {
    expect(summaryOf(mini({ meta: { title: 'Duncan & Wright fig. 7.12, talud con agua' }, units: 'imperial' }), 'project')).toBe('Duncan & Wright fig. 7.12… · imperial');
  });

  it('proyecto: una sola palabra interminable se recorta con elipsis (no hay límite de palabra)', () => {
    const text = summaryOf(mini({ meta: { title: 'X'.repeat(80) } }), 'project');
    expect(text.length).toBeLessThanOrEqual(40);
    expect(text).toMatch(/^X+… · SI$/);
  });

  it('todo resumen, con cualquier ejemplo real, cabe en 40 caracteres', () => {
    for (const file of readdirSync(new URL('../../../../../verification/cases/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
      const model = (JSON.parse(readFileSync(new URL(`../../../../../verification/cases/${file}`, import.meta.url), 'utf8')) as { model: Model }).model;
      const s = stepStates(model as unknown as ModelDoc, [], []);
      for (const id of STEP_ORDER) expect([file, id, s[id].summary.length <= 40]).toEqual([file, id, true]);
    }
  });
});

describe('stepStates: precedencia de estados', () => {
  const issue = (path: string | null, code: string, severity: Issue['severity'] = 'error'): Issue => ({ source: 'local', severity, code, text: 't', path });

  it('error: cuenta las incidencias de severidad `error` cuyo destino es el paso (issueTargetFor)', () => {
    const doc = mini();
    const issues = [issue('/regions/0/polygon/1', 'editor.out_of_range'), issue('/regions/0', 'editor.self_intersection'), issue('/materials/0/cohesion', 'editor.out_of_range'), issue('/regions/0/material', 'editor.missing_material')];
    const s = stepStates(doc, issues, []);
    expect(s.geometry).toMatchObject({ status: 'error', errorCount: 2 });
    expect(s.materials).toMatchObject({ status: 'error', errorCount: 2 });
    expect(s.water.errorCount).toBe(0);
  });

  it('avisos y notas no cuentan como error; una incidencia sin destino tampoco', () => {
    const s = stepStates(mini(), [issue('/regions/0', 'x', 'aviso'), issue('/materials/0', 'x', 'nota'), issue(null, 'x'), issue('/nada', 'x')], []);
    for (const id of STEP_ORDER) expect(s[id].errorCount).toBe(0);
    expect(s.materials.status).toBe('done'); // una nota no cambia el estado
  });

  it('warn (UA-E3 §4, B-02): un aviso local cuyo destino es el paso lo marca; las notas, los errores ajenos y los avisos sin destino no', () => {
    const doc = mini();
    const s = stepStates(doc, [issue('/regions/0', 'x', 'aviso'), issue('/materials/0', 'x', 'nota'), issue(null, 'x', 'aviso'), issue('/nada', 'x', 'aviso')], []);
    expect(s.geometry).toMatchObject({ status: 'warn', errorCount: 0 });
    expect(s.materials.status).toBe('done');
    for (const id of STEP_ORDER.filter((x) => x !== 'geometry')) expect(s[id].status).not.toBe('warn');
  });

  it('warn reparte cada aviso con issueTargetFor: ru y σci en Materiales, piezométrica en Agua', () => {
    const doc = mini({ water: { piezometric_line: [[0, 1], [10, 2]] } });
    const s = stepStates(doc, [issue('/materials/0/ru', 'a', 'aviso'), issue('/water/piezometric_line/1', 'b', 'aviso')], []);
    expect(s.materials.status).toBe('warn');
    expect(s.water.status).toBe('warn');
    expect(s.water.summary).toBe('Piezométrica · 2 puntos');
  });

  it('warn gana sobre `optional` y `empty` (un aviso no deja el paso en gris)', () => {
    expect(stepStates(mini(), [issue('/water/unit_weight', 'x', 'aviso')], []).water.status).toBe('warn');
    expect(stepStates(mini({ materials: [] }), [issue('/materials/0', 'x', 'aviso')], []).materials.status).toBe('empty'); // sin destino real: no hay material 0
  });

  it('precedencia completa: error › borrador › warn › resto', () => {
    const doc = mini();
    const warnOnly = stepStates(doc, [issue('/regions/0', 'x', 'aviso')], []);
    expect(warnOnly.geometry.status).toBe('warn');
    const warnDraft = stepStates(doc, [issue('/regions/0', 'x', 'aviso')], ['Vértice 1 (0, 0) de la región 1']);
    expect(warnDraft.geometry.status).toBe('draft');
    const all = stepStates(doc, [issue('/regions/0', 'x', 'aviso'), issue('/regions/0/polygon/1', 'y', 'error')], ['Vértice 1 (0, 0) de la región 1']);
    expect(all.geometry).toMatchObject({ status: 'error', errorCount: 1 });
  });

  it('avisos reales de validateLocal (γsat < γ, ru) marcan Materiales', () => {
    const doc = mini({ materials: [{ id: 'm1', name: 'S', model: 'mohr_coulomb', unit_weight: 22, unit_weight_sat: 18, cohesion: 5, friction_angle: 30, ru: 0.25 }] });
    const issues = validateLocal(doc);
    expect(issues.some((i) => i.severity === 'aviso')).toBe(true);
    const s = stepStates(doc, issues, []);
    expect(s.materials.status).toBe('warn');
  });

  it('cada ruta se reparte en el paso que abre issueNav (clima, sismo, cargas, refuerzos, agua, búsqueda, proyecto)', () => {
    const doc = mini({
      water: { piezometric_line: [[0, 1], [10, 2]] },
      loads: [{ type: 'udl', x1: 0, x2: 3, q: 10 }],
      reinforcements: [{ id: 'a', type: 'nail', x1: 0, y1: 5, x2: 5, y2: 2, application: 'active', tensile_capacity: 1, direction: 'axial' }],
      analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 5, yc: 8, r: 8 }, seismic: { kh: 0.1 }, search: { type: 'circular_entry_exit' } },
    });
    const byPath: [string, PanelTabId][] = [
      ['/water/piezometric_line/0', 'water'],
      ['/loads/0/q', 'loads'],
      ['/reinforcements/0/x1', 'reinforcements'],
      ['/analysis/seismic/kh', 'seismic'],
      ['/analysis/search/n_entry', 'search'],
      ['/analysis/slices', 'analysis'],
      ['/analysis/surface/r', 'surface'],
      ['/meta/title', 'project'],
      ['/units', 'project'],
    ];
    for (const [path, tab] of byPath) expect([path, stepStates(doc, [issue(path, 'x')], [])[tab].errorCount]).toEqual([path, 1]);
  });

  it('draft: un borrador del paso gana sobre `done` y sobre `empty`/`optional`', () => {
    const doc = mini();
    expect(stepStates(doc, [], [vertexDraftLabel(0, 1, [10, 0])]).geometry.status).toBe('draft');
    expect(stepStates(doc, [], [SEISMIC_DRAFT.label]).seismic.status).toBe('draft'); // era `optional`
    const bare = { ...mini(), regions: [] } as ModelDoc;
    expect(stepStates(bare, [], [vertexDraftLabel(0, 0, [0, 0])]).geometry.status).toBe('draft'); // era `empty`
  });

  it('error gana sobre borrador', () => {
    const s = stepStates(mini(), [issue('/regions/0/polygon/1', 'editor.out_of_range')], [vertexDraftLabel(0, 1, [10, 0])]);
    expect(s.geometry.status).toBe('error');
  });

  it('un borrador de un paso no cambia el estado de los demás', () => {
    const s = stepStates(mini(), [], [loadDraftLabel(0)]);
    expect(s.loads.status).toBe('draft');
    expect(s.geometry.status).toBe('done');
    expect(s.seismic.status).toBe('optional');
  });
});

describe('draftStep: de lo que devuelve getPendingDrafts al paso', () => {
  // `getPendingDrafts(store)` devuelve las ETIQUETAS (el valor de `setPendingDraft(store, clave, etiqueta)`), no las claves.
  const cases: [string, PanelTabId][] = [
    // GeometryPanel
    [vertexDraftKey(2, 3), 'geometry'],
    [vertexDraftLabel(2, 3, [1.5, 2]), 'geometry'],
    // MaterialsPanel
    ['material:m1', 'materials'],
    ['Material m1', 'materials'],
    [NEW_MATERIAL_DRAFT.key, 'materials'],
    [NEW_MATERIAL_DRAFT.label, 'materials'],
    // WaterPanel
    [WATER_GAMMA_DRAFT.key, 'water'],
    [WATER_GAMMA_DRAFT.label, 'water'],
    [WATER_PIEZO_DRAFT.key, 'water'],
    [WATER_PIEZO_DRAFT.label, 'water'],
    // SurfacePanel
    [SURFACE_CIRCLE_DRAFT.key, 'surface'],
    [SURFACE_CIRCLE_DRAFT.label, 'surface'],
    [SURFACE_POLYLINE_DRAFT.key, 'surface'],
    [SURFACE_POLYLINE_DRAFT.label, 'surface'],
    // SearchPanel
    ['search', 'search'],
    ['Búsqueda', 'search'],
    // AnalysisPanel
    ['analysis', 'analysis'],
    ['Análisis', 'analysis'],
    ['analysis:interslice', 'analysis'],
    ['Función entre dovelas', 'analysis'],
    ['analysis:crack', 'analysis'],
    ['Grieta de tracción', 'analysis'],
    // LoadsPanel
    [loadDraftKey(1), 'loads'],
    [loadDraftLabel(1), 'loads'],
    // ReinforcementsPanel
    ['reinforcement:0', 'reinforcements'],
    ['Refuerzo 1', 'reinforcements'],
    // SeismicPanel
    [SEISMIC_DRAFT.key, 'seismic'],
    [SEISMIC_DRAFT.label, 'seismic'],
  ];
  it.each(cases)('%s → %s', (draft, step) => {
    expect(draftStep(draft)).toBe(step);
  });

  it('una entrada desconocida no es de ningún paso y no cambia ningún estado', () => {
    expect(draftStep('otra cosa')).toBeNull();
    expect(draftStep('')).toBeNull();
    const s = stepStates(mini(), [], ['otra cosa']);
    expect(STEP_ORDER.filter((id) => s[id].status === 'draft')).toEqual([]);
  });

  it('cada panel que registra borradores, de ida y vuelta por el canal real: setPendingDraft → getPendingDrafts → stepStates', () => {
    const registrations: [string, string, PanelTabId][] = [
      [vertexDraftKey(0, 1), vertexDraftLabel(0, 1, [10, 0]), 'geometry'],
      ['material:m1', 'Material m1', 'materials'],
      [NEW_MATERIAL_DRAFT.key, NEW_MATERIAL_DRAFT.label, 'materials'],
      [WATER_GAMMA_DRAFT.key, WATER_GAMMA_DRAFT.label, 'water'],
      [WATER_PIEZO_DRAFT.key, WATER_PIEZO_DRAFT.label, 'water'],
      [SURFACE_POLYLINE_DRAFT.key, SURFACE_POLYLINE_DRAFT.label, 'surface'],
      [SURFACE_CIRCLE_DRAFT.key, SURFACE_CIRCLE_DRAFT.label, 'surface'],
      ['search', 'Búsqueda', 'search'],
      ['analysis', 'Análisis', 'analysis'],
      ['analysis:interslice', 'Función entre dovelas', 'analysis'],
      ['analysis:crack', 'Grieta de tracción', 'analysis'],
      [loadDraftKey(0), loadDraftLabel(0), 'loads'],
      ['reinforcement:0', 'Refuerzo 1', 'reinforcements'],
      [SEISMIC_DRAFT.key, SEISMIC_DRAFT.label, 'seismic'],
    ];
    const doc = mini();
    for (const [key, label, step] of registrations) {
      const store = {};
      setPendingDraft(store, key, label);
      const s = stepStates(doc, [], getPendingDrafts(store));
      expect([key, STEP_ORDER.filter((id) => s[id].status === 'draft')]).toEqual([key, [step]]);
      clearPendingDrafts(store);
      expect(STEP_ORDER.filter((id) => stepStates(doc, [], getPendingDrafts(store))[id].status === 'draft')).toEqual([]);
    }
  });

  it('las claves y etiquetas de los paneles son las del código (si un panel las cambia, esta prueba avisa)', () => {
    const src = (f: string) => readFileSync(new URL(`../panels/${f}`, import.meta.url), 'utf8');
    expect(src('MaterialsPanel.tsx')).toContain('`material:${material.id}`');
    expect(src('MaterialsPanel.tsx')).toContain('const scope = `Material ${material.id}`');
    expect(src('ReinforcementsPanel.tsx')).toContain('`reinforcement:${index}`');
    expect(src('ReinforcementsPanel.tsx')).toContain('const scope = `Refuerzo ${index + 1}`');
    expect(src('SearchPanel.tsx')).toContain("setPendingDraft(store, 'search', pending ? 'Búsqueda' : null)");
    const analysis = src('AnalysisPanel.tsx');
    expect(analysis).toContain("setPendingDraft(store, 'analysis:interslice', rowsPending ? 'Función entre dovelas' : null)");
    expect(analysis).toContain("setPendingDraft(store, 'analysis:crack', crackPending ? 'Grieta de tracción' : null)");
    expect(analysis).toContain("setPendingDraft(store, 'analysis', analysisPending ? 'Análisis' : null)");
    // El panel «Proyecto» no registra borradores.
    expect(src('ProjectPanel.tsx')).not.toContain('setPendingDraft');
  });
});

describe('stepStates: ejemplos reales', () => {
  it('ACADS 1(a) de src/examples: resúmenes de los diez pasos', () => {
    const doc = (acads1a as unknown as { model: ModelDoc }).model;
    const s = stepStates(doc, validateLocal(doc), []);
    expect(s.geometry.summary).toMatch(/^1 región · \d+ vértices · [\d.,]+ m²$/);
    expect(s.materials.summary).toBe('1 material · Mohr-Coulomb');
    expect(s.surface.summary).toBe('Búsqueda circular'); // el ejemplo busca; la superficie fija se ignora
    expect(s.search.summary).toMatch(/^Entrada .* m · salida .* m$/);
    expect(s.project.summary).toBe('ACADS 1(a) · SI');
    expect(STEP_ORDER.filter((id) => s[id].status === 'error')).toEqual([]);
  });

  it('un caso con refuerzos, uno con Hoek-Brown y uno con búsqueda no circular', () => {
    expect(summaryOf(fromCase('V010'), 'reinforcements')).toMatch(/^\d+ (refuerzos?|geosintéticos?|anclajes?|clavos?|pilotes?|tablestacas?)/);
    expect(summaryOf(fromCase('HAM1'), 'materials')).toContain('Hoek-Brown');
    expect(summaryOf(fromCase('V001-nc'), 'surface')).toBe('Búsqueda no circular');
  });
});

// ───────── runStatus ─────────

const emptyRun = (report: AnalysisReport, revision = 1): EngineRun => ({ revision, doc: mini(), json: '', sha256: '', report, elapsedMs: 1, checkedAt: '2026-11-27T12:00:00.000Z' });

const result = (method: MethodKind, fos: number, status: MethodReport['status'] = 'converged'): MethodReport => ({ method, status, fos, iterations: 5, warnings: [] }) as unknown as MethodReport;
const report = (...results: MethodReport[]): AnalysisReport => ({ engine: 'test', results });

const base = (patch: Partial<RunStatusInput> = {}): RunStatusInput => ({
  engineStatus: 'ready' as EngineStatus,
  busy: false,
  run: null,
  current: false,
  pendingDrafts: 0,
  hasRegions: true,
  localErrors: 0,
  methodsRequested: 1,
  message: null,
  messageKind: 'info',
  ...patch,
});

describe('runStatus: una fila por condición, de arriba abajo', () => {
  const okRun = emptyRun(report(result('bishop', 1.234), result('spencer', 1.25)));

  it.each<[string, Partial<RunStatusInput>, { tone: string; text: string }]>([
    ['motor cargando', { engineStatus: 'loading' }, { tone: 'neutral', text: 'Cargando el motor…' }],
    ['motor fallido', { engineStatus: 'failed' }, { tone: 'nok', text: 'Motor no disponible' }],
    ['calculando 4 métodos', { busy: true, methodsRequested: 4 }, { tone: 'accent', text: 'Calculando 4 métodos…' }],
    ['calculando 1 método', { busy: true, methodsRequested: 1 }, { tone: 'accent', text: 'Calculando 1 método…' }],
    ['sin regiones', { hasRegions: false }, { tone: 'neutral', text: 'Sin modelo' }],
    ['error del motor sin resultado actual', { message: 'Falló', messageKind: 'error' }, { tone: 'nok', text: 'Error: Falló' }],
    ['resultado actual, FS ≥ 1, sin avisos (neutral, no ok)', { run: okRun, current: true }, { tone: 'neutral', text: 'Calculado · FS mín. 1,234' }],
    ['resultado actual, FS ≥ 1, con avisos', { run: okRun, current: true, advisories: 2 }, { tone: 'warn', text: 'Calculado · FS mín. 1,234 · 2 avisos' }],
    ['resultado actual con un solo aviso (singular)', { run: okRun, current: true, advisories: 1 }, { tone: 'warn', text: 'Calculado · FS mín. 1,234 · 1 aviso' }],
    ['resultado actual con borradores: nunca es actual (A-02, B-01)', { run: okRun, current: true, pendingDrafts: 1 }, { tone: 'warn', text: 'Cambios sin aplicar' }],
    ['resultado no actual con borradores', { run: okRun, current: false, pendingDrafts: 2 }, { tone: 'warn', text: 'Cambios sin aplicar' }],
    ['resultado no actual', { run: okRun, current: false }, { tone: 'warn', text: 'Resultados desactualizados' }],
    ['3 problemas', { localErrors: 3 }, { tone: 'warn', text: 'Modelo con 3 problemas' }],
    ['1 problema', { localErrors: 1 }, { tone: 'warn', text: 'Modelo con 1 problema' }],
    ['borradores', { pendingDrafts: 1 }, { tone: 'warn', text: 'Cambios sin aplicar' }],
    ['en otro caso', {}, { tone: 'neutral', text: 'Listo para calcular' }],
  ])('%s', (_name, patch, want) => {
    const s = runStatus(base(patch));
    expect(s).toMatchObject(want);
    expect(s.text.length).toBeLessThanOrEqual(40);
    expect(s.title.startsWith(s.text)).toBe(true);
  });

  it('precedencia entre filas', () => {
    expect(runStatus(base({ engineStatus: 'loading', busy: true, hasRegions: false })).text).toBe('Cargando el motor…');
    expect(runStatus(base({ engineStatus: 'failed', busy: true })).text).toBe('Motor no disponible');
    expect(runStatus(base({ busy: true, hasRegions: false, methodsRequested: 2 })).text).toBe('Calculando 2 métodos…');
    expect(runStatus(base({ hasRegions: false, message: 'x', messageKind: 'error' })).text).toBe('Sin modelo');
    expect(runStatus(base({ message: 'Falló', messageKind: 'error', localErrors: 2, pendingDrafts: 1 })).text).toBe('Error: Falló');
    expect(runStatus(base({ run: okRun, current: false, localErrors: 2 })).text).toBe('Resultados desactualizados');
    expect(runStatus(base({ localErrors: 2, pendingDrafts: 1 })).text).toBe('Modelo con 2 problemas');
  });

  it('calculando sin métodos pedidos no inventa un número', () => {
    expect(runStatus(base({ busy: true, methodsRequested: 0 })).text).toBe('Calculando…');
  });

  it('un mensaje informativo no es un error; uno vacío tampoco', () => {
    expect(runStatus(base({ message: 'Todo bien', messageKind: 'info' })).text).toBe('Listo para calcular');
    expect(runStatus(base({ message: '', messageKind: 'error' })).text).toBe('Listo para calcular');
    expect(runStatus(base({ message: '  \n ', messageKind: 'error' })).text).toBe('Listo para calcular');
  });

  it('con resultado actual un mensaje de error no tapa el resultado', () => {
    expect(runStatus(base({ run: okRun, current: true, message: 'Falló', messageKind: 'error' })).text).toBe('Calculado · FS mín. 1,234');
  });

  it('un resultado sin `current` no cuenta como resultado actual aunque exista', () => {
    expect(runStatus(base({ run: okRun, current: false, message: 'Falló', messageKind: 'error' })).tone).toBe('nok');
  });

  it('`current` sin `run` no inventa un resultado', () => {
    expect(runStatus(base({ run: null, current: true })).text).toBe('Listo para calcular');
  });

  it('error largo: ≤ 40 caracteres con elipsis y el texto completo en `title`', () => {
    const message = 'El motor rechazó el modelo: la superficie fija no corta el terreno en ningún punto';
    const s = runStatus(base({ message, messageKind: 'error' }));
    expect(s.text.length).toBe(40);
    expect(s.text.endsWith('…')).toBe(true);
    expect(s.text.startsWith('Error: El motor rechazó el modelo')).toBe(true);
    expect(s.title).toBe(`Error: ${message}`);
    expect(s.tone).toBe('nok');
  });

  it('error con saltos de línea: una sola línea', () => {
    const s = runStatus(base({ message: 'Línea uno\nlínea dos', messageKind: 'error' }));
    expect(s.text).toBe('Error: Línea uno línea dos');
    expect(s.text).not.toContain('\n');
  });

  it('un error de exactamente 40 caracteres no se recorta', () => {
    const message = 'a'.repeat(40 - 'Error: '.length);
    expect(runStatus(base({ message, messageKind: 'error' })).text).toBe(`Error: ${message}`);
  });
});

describe('runStatus: resultado actual', () => {
  const cur = (r: AnalysisReport, patch: Partial<RunStatusInput> = {}) => runStatus(base({ run: emptyRun(r), current: true, ...patch }));

  it('ningún método convergió → «Sin convergencia» (warn) y el título dice cuáles', () => {
    const s = cur(report(result('bishop', 0.9, 'not_converged'), result('spencer', Number.NaN, 'invalid')));
    expect(s).toMatchObject({ tone: 'warn', text: 'Sin convergencia' });
    expect(s.title).toBe('Sin convergencia. No convergieron: Bishop, Spencer.');
  });

  it('parcial → «Parcial · 3 de 4 métodos» (warn) y el título nombra los que no convergieron', () => {
    const s = cur(report(result('bishop', 1.1), result('spencer', 1.2), result('morgenstern_price', 1.3), result('janbu_simplified', 0.9, 'not_converged')));
    expect(s).toMatchObject({ tone: 'warn', text: 'Parcial · 3 de 4 métodos' });
    expect(s.title).toBe('Parcial · 3 de 4 métodos. No convergieron: Janbu.');
  });

  it('parcial con FS mínimo < 1 → «Parcial · c de t · FS < 1,0» (nok, B-04b)', () => {
    const s = cur(report(result('bishop', 0.985), result('spencer', 1.2, 'not_converged'), result('morgenstern_price', 1.1, 'not_converged')));
    expect(s).toMatchObject({ tone: 'nok', text: 'Parcial · 1 de 3 · FS < 1,0' });
    expect(s.title).toBe('Parcial · 1 de 3 · FS < 1,0. FS mínimo 0,985 (Bishop). No convergieron: Spencer, M-P.');
  });

  it('parcial con FS mínimo ≥ 1 → «Parcial · c de t métodos» (warn)', () => {
    expect(cur(report(result('bishop', 1.3), result('spencer', 0.8, 'not_converged')))).toMatchObject({ tone: 'warn', text: 'Parcial · 1 de 2 métodos' });
  });

  it('sin avisos o con 0 no cambia el texto; el título nombra los avisos si el texto no los lleva', () => {
    const r = report(result('bishop', 0.984), result('spencer', 1.02));
    expect(cur(r, { advisories: 0 }).text).toBe('Calculado · FS < 1,0');
    const s = cur(r, { advisories: 3 });
    expect(s).toMatchObject({ tone: 'nok', text: 'Calculado · FS < 1,0 · 3 avisos' });
    expect(s.title).toBe('Calculado · FS < 1,0 · 3 avisos. FS mínimo 0,984 (Bishop)');
  });

  it('« · N avisos» solo si cabe en 40 caracteres; si no, el número va en el título', () => {
    const r = report(result('bishop', 1.234), result('spencer', 1.5, 'not_converged'), result('janbu_simplified', 1.6, 'not_converged'));
    const s = cur(r, { advisories: 12 });
    expect(s.text.length).toBeLessThanOrEqual(40);
    expect(s.text).toBe('Parcial · 1 de 3 métodos · 12 avisos');
    const long = cur(report(result('bishop', 0.9), result('spencer', 1.5, 'not_converged'), result('janbu_simplified', 1.6, 'not_converged')), { advisories: 99999 });
    expect(long.text).toBe('Parcial · 1 de 3 · FS < 1,0');
    expect(long.title).toContain('Avisos: 99.999');
  });

  it('sin convergencia mantiene su tono warn y suma los avisos si caben', () => {
    expect(cur(report(result('bishop', 0.9, 'not_converged')), { advisories: 2 })).toMatchObject({ tone: 'warn', text: 'Sin convergencia · 2 avisos' });
  });

  it('el tono `ok` ya no se usa en el chip, con ningún resultado', () => {
    for (const fos of [0.5, 0.9997, 1, 1.35, 3]) {
      for (const advisories of [0, 2]) expect(cur(report(result('bishop', fos)), { advisories }).tone).not.toBe('ok');
    }
  });

  it('borradores pendientes: aunque `current` sea verdadero el resultado no es actual y no se muestra FS', () => {
    const s = runStatus(base({ run: emptyRun(report(result('bishop', 0.8))), current: true, pendingDrafts: 2, advisories: 4 }));
    expect(s).toMatchObject({ tone: 'warn', text: 'Cambios sin aplicar' });
  });

  it('borradores y un error del motor: manda el error (no hay resultado actual)', () => {
    const s = runStatus(base({ run: emptyRun(report(result('bishop', 1.2))), current: true, pendingDrafts: 1, message: 'Falló', messageKind: 'error' }));
    expect(s).toMatchObject({ tone: 'nok', text: 'Error: Falló' });
  });

  it('FS mínimo < 1 → «Calculado · FS < 1,0» (nok)', () => {
    const s = cur(report(result('bishop', 0.984), result('spencer', 1.02)));
    expect(s).toMatchObject({ tone: 'nok', text: 'Calculado · FS < 1,0' });
    expect(s.title).toBe('Calculado · FS < 1,0. FS mínimo 0,984 (Bishop)');
  });

  it('FS = 1 exacto no es < 1', () => {
    expect(cur(report(result('bishop', 1))).text).toBe('Calculado · FS mín. 1,000');
  });

  it('FS mínimo ≥ 1 → «Calculado · FS mín. 1,234» (neutral); el título lleva los métodos del mínimo, empates incluidos', () => {
    const s = cur(report(result('bishop', 1.2344), result('spencer', 1.2339), result('morgenstern_price', 1.5)));
    expect(s).toMatchObject({ tone: 'neutral', text: 'Calculado · FS mín. 1,234' });
    expect(s.title).toBe('Calculado · FS mín. 1,234. FS mínimo 1,234 (Bishop, Spencer)');
  });

  it('un FS finito de un método que no convergió no cuenta', () => {
    expect(cur(report(result('bishop', 0.5, 'not_converged'), result('spencer', 1.4))).text).toBe('Parcial · 1 de 2 métodos');
  });

  it('un informe sin resultados es «Sin convergencia»', () => {
    expect(cur(report()).text).toBe('Sin convergencia');
  });
});

// ───────── fsMinimum ─────────

describe('fsMinimum', () => {
  it('el mínimo de los convergidos, con coma y tres decimales', () => {
    const fs = fsMinimum(report(result('bishop', 1.4), result('spencer', 1.2345), result('morgenstern_price', 1.6)));
    expect(fs).toEqual({ value: 1.2345, text: '1,235', methods: ['spencer'], below1: false, converged: 3, total: 3 });
  });

  it('empates: los métodos cuyo FS formateado es igual, en el orden del informe', () => {
    const fs = fsMinimum(report(result('bishop', 0.9844), result('spencer', 0.9841), result('morgenstern_price', 0.9851), result('janbu_simplified', 1.2)));
    expect(fs.value).toBe(0.9841);
    expect(fs.text).toBe('0,984');
    expect(fs.methods).toEqual(['bishop', 'spencer']);
    expect(fs.below1).toBe(true);
    expect(fs.converged).toBe(4);
  });

  it('empate exacto', () => {
    expect(fsMinimum(report(result('spencer', 1.1), result('bishop', 1.1))).methods).toEqual(['spencer', 'bishop']);
  });

  it('ningún método convergió: valor nulo, «—», sin métodos y sin `below1`', () => {
    const fs = fsMinimum(report(result('bishop', 0.7, 'not_converged'), result('spencer', 0.8, 'invalid')));
    expect(fs).toEqual({ value: null, text: '—', methods: [], below1: false, converged: 0, total: 2 });
  });

  it('informe vacío', () => {
    expect(fsMinimum(report())).toEqual({ value: null, text: '—', methods: [], below1: false, converged: 0, total: 0 });
  });

  it('NaN e Infinity en el FS de un método convergido se ignoran (y no cuentan como convergidos)', () => {
    const fs = fsMinimum(report(result('bishop', Number.NaN), result('spencer', Number.POSITIVE_INFINITY), result('morgenstern_price', Number.NEGATIVE_INFINITY), result('janbu_simplified', 1.5)));
    expect(fs).toEqual({ value: 1.5, text: '1,500', methods: ['janbu_simplified'], below1: false, converged: 1, total: 4 });
  });

  it('todos no finitos: como si ninguno hubiera convergido', () => {
    const fs = fsMinimum(report(result('bishop', Number.NaN), result('spencer', Number.POSITIVE_INFINITY)));
    expect(fs).toMatchObject({ value: null, text: '—', methods: [], converged: 0, total: 2 });
  });

  it('`below1` usa el valor crudo y, en [0,9995, 1), el texto lleva 4 decimales: nunca «1,000» junto a «FS < 1,0» (B-12a)', () => {
    const fs = fsMinimum(report(result('bishop', 0.9996)));
    expect(fs.text).toBe('0,9996');
    expect(fs.below1).toBe(true);
    expect(fsMinimum(report(result('bishop', 0.9997))).text).toBe('0,9997');
    expect(fsMinimum(report(result('bishop', 0.99996))).text).toBe('0,9999');
    expect(fsMinimum(report(result('bishop', 0.9995))).text).toBe('0,9995');
    // fuera del intervalo, tres decimales de siempre
    expect(fsMinimum(report(result('bishop', 0.9994))).text).toBe('0,999');
    expect(fsMinimum(report(result('bishop', 1))).text).toBe('1,000');
    expect(fsMinimum(report(result('bishop', 1.0004))).text).toBe('1,000');
  });

  it('fsText: el chip y el HUD usan el mismo texto; los empates se comparan con él', () => {
    expect(fsText(0.9997)).toBe('0,9997');
    expect(fsText(null)).toBe('—');
    const fs = fsMinimum(report(result('bishop', 0.9997), result('spencer', 0.9997), result('morgenstern_price', 0.9998)));
    expect(fs.methods).toEqual(['bishop', 'spencer']);
    const chip = runStatus(base({ run: emptyRun(report(result('bishop', 0.9997))), current: true }));
    expect(chip.text).toBe('Calculado · FS < 1,0');
    expect(chip.title).toBe('Calculado · FS < 1,0. FS mínimo 0,9997 (Bishop)');
  });

  it('con los resultados reales del motor (reporte guardado)', () => {
    const real = loadEngineReport('v047a-search-rtl');
    const fs = fsMinimum(real);
    const finite = real.results.filter((r) => r.status === 'converged' && Number.isFinite(r.fos)).map((r) => r.fos as number);
    expect(fs.value).toBe(Math.min(...finite));
    expect(fs.total).toBe(real.results.length);
    expect(fs.methods.length).toBeGreaterThanOrEqual(1);
  });
});

// ───────── reportContents ─────────

describe('reportContents', () => {
  const runFor = (doc: ModelDoc, results = loadEngineReport('d01-fixed-ltr').results): EngineRun => ({ ...emptyRun({ engine: 'test', results }), doc, sha256: 'f'.repeat(64) });
  const included = (items: { label: string; included: boolean }[]): string[] => items.filter((i) => i.included).map((i) => i.label);

  it('sin cálculo: lista vacía', () => {
    expect(reportContents(null)).toEqual([]);
  });

  it('modelo sin grieta, sin agua embalsada y sin refuerzos: seis secciones fijas más avisos y motor; las condicionales fuera', () => {
    const items = reportContents(runFor(acadsDoc(), analyzeMock(saveOgsJson(acadsDoc())).results));
    expect(items.map((i) => i.label)).toEqual([
      'Portada',
      'Datos del modelo',
      'Materiales',
      'Sección analizada',
      'Factor de seguridad por método',
      'Grieta de tracción y agua embalsada',
      'Refuerzos',
      'Avisos y notas',
      'Versión del motor y advertencia',
    ]);
    expect(items.filter((i) => !i.included).map((i) => i.label)).toEqual(['Grieta de tracción y agua embalsada', 'Refuerzos']);
  });

  it('con refuerzos sale «Refuerzos»; con grieta, «Grieta de tracción y agua embalsada»', () => {
    const reinforced = fromCase('V010');
    expect(reinforcementsLen(reinforced)).toBeGreaterThan(0);
    expect(included(reportContents(runFor(reinforced)))).toContain('Refuerzos');
    const cracked = Object.values(allCases()).find((d) => d.analysis.tension_crack);
    expect(cracked).toBeDefined();
    expect(included(reportContents(runFor(cracked as ModelDoc)))).toContain('Grieta de tracción y agua embalsada');
  });

  it('coincide con las secciones que genera buildReportContent en todos los casos publicados', () => {
    const results = loadEngineReport('d01-fixed-ltr').results;
    let withCrack = 0;
    let withReinf = 0;
    let withPond = 0;
    for (const [id, doc] of Object.entries(allCases())) {
      const run = runFor(doc, results);
      const generated = buildReportContent(buildReportInput(run, new Date('2026-11-27T12:00:00Z'))).sections.map((s) => s.id);
      const items = reportContents(run);
      const byLabel = Object.fromEntries(items.map((i) => [i.label, i.included]));
      const has = (sectionId: string, label: string): void => expect([id, sectionId, byLabel[label]]).toEqual([id, sectionId, (generated as string[]).includes(sectionId)]);
      has('cover', 'Portada');
      has('model', 'Datos del modelo');
      has('materials', 'Materiales');
      has('section', 'Sección analizada');
      has('results', 'Factor de seguridad por método');
      has('crack', 'Grieta de tracción y agua embalsada');
      has('reinforcements', 'Refuerzos');
      has('warnings', 'Avisos y notas');
      has('engine', 'Versión del motor y advertencia');
      // Ninguna sección del PDF del editor se queda fuera de la lista, salvo «checks», que `buildReportInput` nunca pasa.
      expect(generated.filter((g) => g !== 'checks').length).toBe(items.filter((i) => i.included).length);
      expect(generated).not.toContain('checks');
      if (byLabel['Grieta de tracción y agua embalsada']) withCrack += 1;
      if (byLabel['Refuerzos']) withReinf += 1;
      if (doc.water?.piezometric_line) withPond += 1;
    }
    expect(withCrack).toBeGreaterThan(0);
    expect(withReinf).toBeGreaterThan(0);
    expect(withPond).toBeGreaterThan(0);
  });
});

function reinforcementsLen(doc: ModelDoc): number {
  return doc.reinforcements?.length ?? 0;
}

let casesCache: Record<string, ModelDoc> | null = null;
function allCases(): Record<string, ModelDoc> {
  if (casesCache) return casesCache;
  casesCache = {};
  const dir = new URL('../../../../../verification/cases/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) casesCache[f.replace(/\.json$/, '')] = loadPublishedDoc(f.replace(/\.json$/, ''));
  return casesCache;
}
