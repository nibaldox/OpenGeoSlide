import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Load, LineLoad, UdlLoad } from '../engine/types';
import { describeWarning } from '../engine/warnings';
import type { CsvImportResult, DxfImportResult } from '../io/types';
import type { BuildReportPdf, ReportInput } from '../report/types';
import type {
  Diagnostics,
  EditorCommand,
  EditorIssueCode,
  EditorState,
  EditorStore,
  EditorUi,
  Issue,
  ModelDoc,
  Selection,
  UiAction,
} from './types';

const doc: ModelDoc = {
  format: 'opengeoslide',
  version: '0.2',
  meta: { title: 'Ejemplo v0.2' },
  units: 'si',
  materials: [{ id: 'm1', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 18, cohesion: 10, friction_angle: 25 }],
  regions: [
    {
      material: 'm1',
      polygon: [
        [0, 0],
        [100, 0],
        [100, 20],
        [40, 20],
        [0, 0],
      ],
    },
  ],
  loads: [
    { type: 'udl', id: 'u1', x1: 50, x2: 70, q: 20 },
    { type: 'line', id: 'l1', x: 40, p: 20, angle: 10 },
  ],
  analysis: { methods: ['bishop'], seismic: { kh: 0.1, kv: 0 } },
};

describe('tipos congelados v0.2 del editor', () => {
  it('un ModelDoc v0.2 con loads y seismic tipa y discrimina por type', () => {
    const loads: Load[] = doc.loads ?? [];
    expect(loads).toHaveLength(2);
    const udl: UdlLoad | undefined = loads.find((l): l is UdlLoad => l.type === 'udl');
    const line: LineLoad | undefined = loads.find((l): l is LineLoad => l.type === 'line');
    expect(udl?.q).toBe(20);
    expect(line?.angle).toBe(10);
    expect(doc.analysis.seismic).toEqual({ kh: 0.1, kv: 0 });
    const v01: ModelDoc = { ...doc, version: '0.1', loads: undefined, analysis: { methods: ['bishop'] } };
    expect(v01.version).toBe('0.1');
    // @ts-expect-error la versión solo admite '0.1' y '0.2'
    const bad: ModelDoc['version'] = '0.3';
    expect(bad).toBe('0.3');
  });

  it('el JSON de ejemplo de F1.1 coincide con los tipos', () => {
    const contract = readFileSync(
      fileURLToPath(new URL('../../../../briefs/01_CONTRATOS_FASE1.md', import.meta.url)),
      'utf8',
    );
    const block = /```json\n([\s\S]*?)\n```/.exec(contract);
    expect(block, 'no se encuentra el JSON de ejemplo de F1.1').not.toBeNull();
    const example = JSON.parse(block![1]) as {
      format: string;
      version: '0.1' | '0.2';
      loads: Load[];
      analysis: { seismic: { kh: number; kv: number } };
    };
    // Asignación tipada: si el JSON deja de ser compatible con los tipos, no compila.
    const loads: Load[] = example.loads;
    const seismic: NonNullable<ModelDoc['analysis']['seismic']> = example.analysis.seismic;
    expect(example.format).toBe('opengeoslide');
    expect(example.version).toBe('0.2');
    expect(loads).toEqual(doc.loads);
    expect(seismic).toEqual(doc.analysis.seismic);
  });

  it('hay un EditorCommand de cada tipo', () => {
    const udl: Load = { type: 'udl', x1: 1, x2: 2, q: 3 };
    const commands: EditorCommand[] = [
      { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [1, 1] },
      { type: 'vertex/insert', regionIndex: 0, afterIndex: 0, at: [1, 1] },
      { type: 'vertex/remove', regionIndex: 0, vertexIndex: 0 },
      { type: 'region/add', region: doc.regions[0] },
      { type: 'region/remove', regionIndex: 0 },
      { type: 'region/setMaterial', regionIndex: 0, materialId: 'm1' },
      { type: 'material/upsert', material: doc.materials[0] },
      { type: 'material/remove', materialId: 'm1' },
      { type: 'water/setUnitWeight', value: undefined },
      { type: 'piezo/set', points: null },
      { type: 'surface/set', surface: null },
      { type: 'search/set', search: null },
      { type: 'analysis/patch', patch: { slices: 30 } },
      { type: 'slope/setDirection', direction: 'auto' },
      { type: 'meta/patch', patch: { title: 't' } },
      { type: 'seismic/set', seismic: { kh: 0.1, kv: 0 } },
      { type: 'loads/set', loads: [udl] },
      { type: 'load/upsert', index: null, load: udl },
      { type: 'load/remove', index: 0 },
      { type: 'doc/replace', doc, fileName: null },
    ];
    expect(new Set(commands.map((c) => c.type)).size).toBe(commands.length);
    const ui: UiAction[] = [
      { type: 'ui/select', selection: { kind: 'load', index: 0 } },
      { type: 'ui/tool', tool: 'pan' },
      { type: 'ui/viewport', viewport: null },
      { type: 'ui/snap', patch: { gridStep: 1 } },
    ];
    expect(ui).toHaveLength(4);
  });

  it('Selection, EditorUi, Issue, Diagnostics y EditorState compilan sin features', () => {
    const selections: Selection[] = [
      { kind: 'none' },
      { kind: 'vertex', regionIndex: 0, vertexIndex: 0 },
      { kind: 'region', regionIndex: 0 },
      { kind: 'material', materialId: 'm1' },
      { kind: 'piezo_point', index: 0 },
      { kind: 'surface_circle' },
      { kind: 'search_range', which: 'entry' },
      { kind: 'load', index: 1 },
    ];
    const ui: EditorUi = {
      tool: 'select',
      selection: selections[7],
      viewport: null,
      snap: { vertex: true, axis: true, gridStep: null, radiusPx: 8 },
    };
    // @ts-expect-error EditorUi no tiene `features` (F1.4)
    const withFeatures: EditorUi = { ...ui, features: { loads: false, seismic: false } };
    expect(withFeatures).toBeDefined();
    const code: EditorIssueCode = 'editor.load_range';
    const issue: Issue = { source: 'local', severity: 'error', code, text: 'x', path: '/loads/0' };
    const diagnostics: Diagnostics = { status: 'stale', issues: [issue], revision: 0 };
    const state: EditorState = {
      doc,
      revision: 0,
      ui,
      history: { past: [], future: [] },
      file: { name: null, savedRevision: 0 },
      diagnostics,
      gesture: null,
    };
    expect(state.ui.selection).toEqual({ kind: 'load', index: 1 });
    const codes: EditorIssueCode[] = [
      'editor.self_intersection',
      'editor.region_overlap',
      'editor.too_few_vertices',
      'editor.duplicate_vertex',
      'editor.missing_material',
      'editor.duplicate_material',
      'editor.out_of_range',
      'editor.piezo_order',
      'editor.load_range',
    ];
    expect(codes.every((c) => c.startsWith('editor.'))).toBe(true);
    const storeShape = (s: EditorStore): EditorState => s.getState();
    expect(typeof storeShape).toBe('function');
  });

  it('io y report: tipos de W4 y BuildReportPdf como tipo', async () => {
    const dxf: DxfImportResult = {
      ok: true,
      regions: [],
      layers: [{ name: '0', suggestedMaterialId: null }],
      unsupported: [{ type: 'SPLINE', count: 1 }],
      unitsFromHeader: 'm',
      issues: [{ severity: 'aviso', text: 'x' }],
    };
    const csv: CsvImportResult = { ok: true, delimiter: ';', rows: [{ capa: 'a' }], issues: [] };
    const input: ReportInput = {
      generatedAt: '2026-11-25T00:00:00Z',
      engineName: 'mock',
      model: doc,
      modelSha256: '0'.repeat(64),
      results: [],
      warnings: [{ method: 'bishop', severity: 'nota', code: 'load_outside_mass', text: 'x' }],
      checks: [{ method: 'bishop', published: 1.5, fos: null, ok: false }],
      disclaimer: 'x',
    };
    const build: BuildReportPdf = () => Promise.resolve(new Blob([]));
    await expect(build(input)).resolves.toBeInstanceOf(Blob);
    expect(dxf.layers).toHaveLength(1);
    expect(csv.delimiter).toBe(';');
  });

  it('load_outside_mass es una nota con el texto acordado (F1.2 §5)', () => {
    expect(describeWarning('load_outside_mass')).toEqual({
      code: 'load_outside_mass',
      severity: 'nota',
      text: 'Alguna carga declarada no actúa sobre la masa analizada.',
    });
  });
});
