import { describe, expect, it } from 'vitest';
import type { EditorCommand, EditorState } from '../types';
import { baseDoc, mat, square } from './testFixtures';
import { beginGesture, applyCommand, canApply, createInitialState, HISTORY_LIMIT, markSaved, reduce } from './reducer';

const fresh = (): EditorState => createInitialState(baseDoc(), 'base.ogs.json');

/** Aplica un comando y comprueba que cambió el documento, subió la revisión y apiló una entrada. */
function applied(state: EditorState, cmd: EditorCommand): EditorState {
  const next = reduce(state, cmd);
  expect(next).not.toBe(state);
  expect(next.revision).toBe(state.revision + 1);
  expect(next.history.past).toEqual([...state.history.past, state.doc]);
  expect(next.history.future).toEqual([]);
  return next;
}

/** El comando se ignora: mismo objeto de estado, sin historial ni revisión. */
function ignored(state: EditorState, cmd: EditorCommand): void {
  expect(canApply(state.doc, cmd)).toBe(false);
  expect(reduce(state, cmd)).toBe(state);
}

describe('reduce: pureza', () => {
  it('no muta el estado de entrada ni el documento', () => {
    const state = fresh();
    const snapshot = JSON.stringify(state);
    reduce(state, { type: 'vertex/move', regionIndex: 0, vertexIndex: 1, to: [11, 1] });
    reduce(state, { type: 'material/upsert', material: mat('m3') });
    reduce(state, { type: 'ui/select', selection: { kind: 'region', regionIndex: 1 } });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('el estado inicial es limpio', () => {
    const s = fresh();
    expect(s.revision).toBe(0);
    expect(s.history).toEqual({ past: [], future: [] });
    expect(s.file).toEqual({ name: 'base.ogs.json', savedRevision: 0 });
    expect(s.diagnostics.status).toBe('idle');
    expect(s.gesture).toBeNull();
  });
});

describe('vertex/*', () => {
  it('move: cambia solo el vértice indicado y copia el punto', () => {
    const s = fresh();
    const to: [number, number] = [11, 2];
    const n = applied(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 1, to });
    expect(n.doc.regions[0]?.polygon[1]).toEqual([11, 2]);
    expect(n.doc.regions[0]?.polygon[1]).not.toBe(to);
    expect(n.doc.regions[1]).toBe(s.doc.regions[1]);
  });
  it('move: índices fuera de rango, no enteros o punto no finito se ignoran', () => {
    const s = fresh();
    ignored(s, { type: 'vertex/move', regionIndex: 2, vertexIndex: 0, to: [0, 0] });
    ignored(s, { type: 'vertex/move', regionIndex: -1, vertexIndex: 0, to: [0, 0] });
    ignored(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 4, to: [0, 0] });
    ignored(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 0.5, to: [0, 0] });
    ignored(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [Number.NaN, 0] });
    ignored(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [0, Infinity] });
  });
  it('move al mismo punto no cambia nada', () => {
    const s = fresh();
    expect(reduce(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [0, 0] })).toBe(s);
  });
  it('insert: coloca el vértice después de afterIndex, incluso tras el último', () => {
    const s = fresh();
    const n = applied(s, { type: 'vertex/insert', regionIndex: 0, afterIndex: 0, at: [5, 0] });
    expect(n.doc.regions[0]?.polygon).toEqual([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]]);
    const last = applied(s, { type: 'vertex/insert', regionIndex: 0, afterIndex: 3, at: [0, 5] });
    expect(last.doc.regions[0]?.polygon[4]).toEqual([0, 5]);
  });
  it('insert: inválido se ignora', () => {
    const s = fresh();
    ignored(s, { type: 'vertex/insert', regionIndex: 5, afterIndex: 0, at: [1, 1] });
    ignored(s, { type: 'vertex/insert', regionIndex: 0, afterIndex: 4, at: [1, 1] });
    ignored(s, { type: 'vertex/insert', regionIndex: 0, afterIndex: -1, at: [1, 1] });
    ignored(s, { type: 'vertex/insert', regionIndex: 0, afterIndex: 0, at: [Number.NaN, 1] });
  });
  it('remove: quita el vértice si quedan al menos 3', () => {
    const s = applied(fresh(), { type: 'vertex/insert', regionIndex: 0, afterIndex: 0, at: [5, 0] });
    const n = applied(s, { type: 'vertex/remove', regionIndex: 0, vertexIndex: 1 });
    expect(n.doc.regions[0]?.polygon).toEqual(square(0, 0, 10, 10));
  });
  it('remove: no deja menos de 3 vértices ni acepta índices inválidos', () => {
    const tri = reduce(fresh(), { type: 'vertex/remove', regionIndex: 0, vertexIndex: 0 });
    expect(tri.doc.regions[0]?.polygon).toHaveLength(3);
    expect(tri.revision).toBe(1);
    ignored(tri, { type: 'vertex/remove', regionIndex: 0, vertexIndex: 0 });
    ignored(fresh(), { type: 'vertex/remove', regionIndex: 0, vertexIndex: 9 });
    ignored(fresh(), { type: 'vertex/remove', regionIndex: 9, vertexIndex: 0 });
  });
});

describe('region/*', () => {
  it('add: agrega una copia de la región', () => {
    const s = fresh();
    const polygon = square(20, 0, 30, 10);
    const n = applied(s, { type: 'region/add', region: { material: 'm1', polygon } });
    expect(n.doc.regions).toHaveLength(3);
    expect(n.doc.regions[2]?.polygon).toEqual(polygon);
    expect(n.doc.regions[2]?.polygon).not.toBe(polygon);
  });
  it('add: material inexistente, menos de 3 vértices o coordenadas no finitas se ignoran', () => {
    const s = fresh();
    ignored(s, { type: 'region/add', region: { material: 'nope', polygon: square(20, 0, 30, 10) } });
    ignored(s, { type: 'region/add', region: { material: 'm1', polygon: [[0, 0], [1, 1]] } });
    ignored(s, { type: 'region/add', region: { material: 'm1', polygon: [[0, 0], [1, 1], [Number.NaN, 2]] } });
  });
  it('remove: quita la región; índice inválido se ignora', () => {
    const s = fresh();
    const n = applied(s, { type: 'region/remove', regionIndex: 0 });
    expect(n.doc.regions).toEqual([s.doc.regions[1]]);
    ignored(s, { type: 'region/remove', regionIndex: 2 });
    ignored(s, { type: 'region/remove', regionIndex: -1 });
  });
  it('setMaterial: cambia el material; inexistente o índice inválido se ignoran', () => {
    const s = fresh();
    const n = applied(s, { type: 'region/setMaterial', regionIndex: 0, materialId: 'm2' });
    expect(n.doc.regions[0]?.material).toBe('m2');
    ignored(s, { type: 'region/setMaterial', regionIndex: 0, materialId: 'zz' });
    ignored(s, { type: 'region/setMaterial', regionIndex: 3, materialId: 'm2' });
    expect(reduce(s, { type: 'region/setMaterial', regionIndex: 0, materialId: 'm1' })).toBe(s);
  });
});

describe('material/*', () => {
  it('upsert: agrega y reemplaza por id', () => {
    const s = fresh();
    const added = applied(s, { type: 'material/upsert', material: mat('m3', { cohesion: 5 }) });
    expect(added.doc.materials.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    const replaced = applied(added, { type: 'material/upsert', material: mat('m1', { cohesion: 99 }) });
    expect(replaced.doc.materials).toHaveLength(3);
    expect(replaced.doc.materials[0]?.cohesion).toBe(99);
  });
  it('upsert: id vacío o números no finitos se ignoran', () => {
    const s = fresh();
    ignored(s, { type: 'material/upsert', material: mat('') });
    ignored(s, { type: 'material/upsert', material: mat('x', { cohesion: Number.NaN }) });
    ignored(s, { type: 'material/upsert', material: mat('x', { unit_weight: Infinity }) });
  });
  it('remove: quita un material sin uso', () => {
    const s = applied(fresh(), { type: 'material/upsert', material: mat('m3') });
    const n = applied(s, { type: 'material/remove', materialId: 'm3' });
    expect(n.doc.materials.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
  it('remove: material en uso o inexistente se ignora', () => {
    const s = fresh();
    ignored(s, { type: 'material/remove', materialId: 'm1' });
    ignored(s, { type: 'material/remove', materialId: 'zz' });
  });
});

describe('agua', () => {
  it('water/setUnitWeight: fija y elimina el peso unitario', () => {
    const s = fresh();
    const n = applied(s, { type: 'water/setUnitWeight', value: 10 });
    expect(n.doc.water?.unit_weight).toBe(10);
    expect(n.doc.water?.piezometric_line).toEqual(s.doc.water?.piezometric_line);
    const u = applied(n, { type: 'water/setUnitWeight', value: undefined });
    expect(u.doc.water).toEqual({ piezometric_line: s.doc.water?.piezometric_line });
    expect('unit_weight' in (u.doc.water ?? {})).toBe(false);
  });
  it('water/setUnitWeight: crea water si falta; quitar sin water no cambia; no finito se ignora', () => {
    const noWater = createInitialState({ ...baseDoc(), water: undefined });
    expect(reduce(noWater, { type: 'water/setUnitWeight', value: undefined })).toBe(noWater);
    expect(reduce(noWater, { type: 'water/setUnitWeight', value: 9.81 }).doc.water).toEqual({ unit_weight: 9.81 });
    ignored(fresh(), { type: 'water/setUnitWeight', value: Number.NaN });
  });
  it('piezo/set: fija una copia, y null la elimina', () => {
    const s = fresh();
    const points: [number, number][] = [[0, 1], [5, 2]];
    const n = applied(s, { type: 'piezo/set', points });
    expect(n.doc.water?.piezometric_line).toEqual(points);
    expect(n.doc.water?.piezometric_line).not.toBe(points);
    const off = applied(n, { type: 'piezo/set', points: null });
    expect('piezometric_line' in (off.doc.water ?? {})).toBe(false);
    expect(reduce(off, { type: 'piezo/set', points: null })).toBe(off);
  });
  it('piezo/set: puntos no finitos o mal formados se ignoran', () => {
    ignored(fresh(), { type: 'piezo/set', points: [[0, 0], [Number.NaN, 1]] });
    ignored(fresh(), { type: 'piezo/set', points: [[0, 0], [1, 2, 3] as unknown as [number, number]] });
  });
});

describe('análisis', () => {
  it('surface/set y search/set: fijan y ponen null', () => {
    const s = fresh();
    const a = applied(s, { type: 'surface/set', surface: { type: 'circle', xc: 1, yc: 2, r: 3 } });
    expect(a.doc.analysis.surface).toEqual({ type: 'circle', xc: 1, yc: 2, r: 3 });
    const b = applied(a, { type: 'surface/set', surface: null });
    expect(b.doc.analysis.surface).toBeNull();
    const c = applied(b, { type: 'search/set', search: { type: 'circular_entry_exit', entry: [0, 5], exit: [15, 20] } });
    expect(c.doc.analysis.search?.entry).toEqual([0, 5]);
    expect(applied(c, { type: 'search/set', search: null }).doc.analysis.search).toBeNull();
  });
  it('surface/set y search/set: valores no finitos se ignoran', () => {
    ignored(fresh(), { type: 'surface/set', surface: { type: 'circle', xc: Number.NaN, yc: 0, r: 1 } });
    ignored(fresh(), { type: 'search/set', search: { type: 'circular_entry_exit', entry: [0, Infinity] } });
  });
  it('analysis/patch: mezcla y elimina las claves undefined', () => {
    const s = fresh();
    const n = applied(s, { type: 'analysis/patch', patch: { slices: 80, methods: ['bishop', 'spencer'] } });
    expect(n.doc.analysis.slices).toBe(80);
    expect(n.doc.analysis.methods).toEqual(['bishop', 'spencer']);
    expect(n.doc.analysis.surface).toEqual(s.doc.analysis.surface);
    const m = applied(n, { type: 'analysis/patch', patch: { slices: undefined } });
    expect('slices' in m.doc.analysis).toBe(false);
    ignored(s, { type: 'analysis/patch', patch: { tolerance: Number.NaN } });
  });
  it('slope/setDirection: cambia la dirección y conserva el resto de slope', () => {
    const s = fresh();
    const n = applied(s, { type: 'slope/setDirection', direction: 'right_to_left' });
    expect(n.doc.slope).toEqual({ direction: 'right_to_left' });
    ignored(s, { type: 'slope/setDirection', direction: 'up' as 'auto' });
    expect(reduce(s, { type: 'slope/setDirection', direction: 'auto' })).toBe(s);
  });
  it('meta/patch: mezcla y elimina las claves undefined', () => {
    const s = fresh();
    const n = applied(s, { type: 'meta/patch', patch: { title: 'Nuevo', notes: 'n' } });
    expect(n.doc.meta).toEqual({ title: 'Nuevo', notes: 'n' });
    const m = applied(n, { type: 'meta/patch', patch: { notes: undefined } });
    expect(m.doc.meta).toEqual({ title: 'Nuevo' });
  });
});

describe('units/set', () => {
  it('cambia solo la etiqueta de unidades: no convierte ningún valor y es un paso deshacible', () => {
    const s = fresh();
    const n = applied(s, { type: 'units/set', units: 'imperial' });
    expect(n.doc.units).toBe('imperial');
    expect(n.doc.materials).toBe(s.doc.materials);
    expect(n.doc.regions).toBe(s.doc.regions);
    expect(n.file.name).toBe('base.ogs.json'); // conserva el archivo
    expect(n.file.savedRevision).toBe(s.file.savedRevision); // y queda con cambios sin guardar
  });
  it('las mismas unidades no ensucian el historial', () => {
    const s = reduce(fresh(), { type: 'units/set', units: 'SI' });
    expect(reduce(s, { type: 'units/set', units: 'SI' })).toBe(s);
  });
  it('rechaza un valor que no es texto o es vacío', () => {
    ignored(fresh(), { type: 'units/set', units: '' });
    ignored(fresh(), { type: 'units/set', units: '   ' });
    ignored(fresh(), { type: 'units/set', units: 3 as unknown as string });
  });
});

describe('sismo y cargas', () => {
  it('seismic/set: fija kh y kv y sube a v0.2; null elimina el campo', () => {
    const v01 = createInitialState({ ...baseDoc(), version: '0.1' });
    const n = applied(v01, { type: 'seismic/set', seismic: { kh: 0.1, kv: -0.05 } });
    expect(n.doc.analysis.seismic).toEqual({ kh: 0.1, kv: -0.05 });
    expect(n.doc.version).toBe('0.2');
    const off = applied(n, { type: 'seismic/set', seismic: null });
    expect('seismic' in off.doc.analysis).toBe(false);
    expect(reduce(off, { type: 'seismic/set', seismic: null })).toBe(off);
    ignored(fresh(), { type: 'seismic/set', seismic: { kh: Number.NaN, kv: 0 } });
  });
  it('loads/set: reemplaza la lista y valida cada carga', () => {
    const s = fresh();
    const loads = [
      { type: 'udl', id: 'u1', x1: 2, x2: 8, q: 20 },
      { type: 'line', id: 'l1', x: 5, p: 10, angle: 5 },
    ] as const;
    const n = applied(s, { type: 'loads/set', loads: [...loads] });
    expect(n.doc.loads).toEqual(loads);
    expect(reduce(s, { type: 'loads/set', loads: [] })).toBe(s); // sin loads y lista vacía: sin cambios
    ignored(s, { type: 'loads/set', loads: [{ type: 'udl', x1: 0, x2: Number.NaN, q: 1 }] });
    ignored(s, { type: 'loads/set', loads: [{ type: 'otra' } as never] });
  });
  it('load/upsert: agrega con index null, reemplaza con índice y rechaza índices fuera de rango', () => {
    const s = fresh();
    const a = applied(s, { type: 'load/upsert', index: null, load: { type: 'udl', x1: 1, x2: 2, q: 5 } });
    expect(a.doc.loads).toHaveLength(1);
    const b = applied(a, { type: 'load/upsert', index: 0, load: { type: 'line', x: 4, p: 1, angle: 0 } });
    expect(b.doc.loads).toEqual([{ type: 'line', x: 4, p: 1, angle: 0 }]);
    ignored(b, { type: 'load/upsert', index: 1, load: { type: 'line', x: 4, p: 1, angle: 0 } });
    ignored(b, { type: 'load/upsert', index: -1, load: { type: 'line', x: 4, p: 1, angle: 0 } });
    ignored(b, { type: 'load/upsert', index: null, load: { type: 'line', x: Number.NaN, p: 1, angle: 0 } });
  });
  it('load/remove: quita por índice; índice fuera de rango se ignora', () => {
    const s = applied(fresh(), { type: 'loads/set', loads: [{ type: 'udl', x1: 1, x2: 2, q: 5 }, { type: 'line', x: 3, p: 1, angle: 0 }] });
    const n = applied(s, { type: 'load/remove', index: 0 });
    expect(n.doc.loads).toEqual([{ type: 'line', x: 3, p: 1, angle: 0 }]);
    ignored(n, { type: 'load/remove', index: 1 });
    ignored(fresh(), { type: 'load/remove', index: 0 });
  });
});

describe('doc/replace', () => {
  it('reemplaza el documento, apila el anterior y fija el archivo', () => {
    const s = fresh();
    const other = { ...baseDoc(), meta: { title: 'Otro' } };
    const n = applied(s, { type: 'doc/replace', doc: other, fileName: 'otro.ogs.json' });
    expect(n.doc).toBe(other);
    expect(n.file).toEqual({ name: 'otro.ogs.json', savedRevision: n.revision });
    expect(n.ui.selection).toEqual({ kind: 'none' });
  });
  it('con fileName null el documento queda sin guardar', () => {
    const n = reduce(fresh(), { type: 'doc/replace', doc: baseDoc(), fileName: null });
    expect(n.file.name).toBeNull();
    expect(n.file.savedRevision).not.toBe(n.revision);
  });
});

describe('doc/load (R7-08)', () => {
  it('reinicia el historial: tras cargar otro documento no hay nada que deshacer ni rehacer', () => {
    const edited = reduce(reduce(fresh(), { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [1, 1] }), { type: 'meta/patch', patch: { title: 'editado' } });
    expect(edited.history.past.length).toBeGreaterThan(0);
    const other = { ...baseDoc(), meta: { title: 'Otro' } };
    const n = reduce(edited, { type: 'doc/load', doc: other, fileName: 'otro.ogs.json' });
    expect(n.doc).toBe(other);
    expect(n.history).toEqual({ past: [], future: [] });
    expect(n.file.name).toBe('otro.ogs.json');
    expect(n.revision).toBe(edited.revision + 1);
    expect(n.ui.selection).toEqual({ kind: 'none' });
    expect(n.gesture).toBeNull();
  });
  it('no marca el documento como guardado: lo decide quien llama con markSaved', () => {
    const n = reduce(fresh(), { type: 'doc/load', doc: baseDoc(), fileName: 'a.ogs.json' });
    expect(n.file.savedRevision).not.toBe(n.revision);
  });
  it('un gesto abierto se descarta al cargar', () => {
    const g = beginGesture(fresh(), 'mover');
    const n = reduce(g, { type: 'doc/load', doc: baseDoc(), fileName: null });
    expect(n.gesture).toBeNull();
  });
  it('doc/replace sigue siendo deshacible (importación)', () => {
    const s = fresh();
    const n = reduce(s, { type: 'doc/replace', doc: { ...baseDoc(), meta: { title: 'R' } }, fileName: null });
    expect(n.history.past).toHaveLength(1);
  });
});

describe('historial', () => {
  it('limita past a 200 entradas y descarta las más antiguas', () => {
    let s = fresh();
    for (let i = 0; i < HISTORY_LIMIT + 25; i += 1) {
      s = reduce(s, { type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [0, -(i + 1)] });
    }
    expect(s.history.past).toHaveLength(HISTORY_LIMIT);
    expect(s.revision).toBe(HISTORY_LIMIT + 25);
    // La entrada más antigua conservada es el estado tras 25 movimientos.
    expect(s.history.past[0]?.regions[0]?.polygon[0]).toEqual([0, -25]);
    expect(s.history.past[HISTORY_LIMIT - 1]?.regions[0]?.polygon[0]).toEqual([0, -(HISTORY_LIMIT + 24)]);
  });
  it('un cambio nuevo vacía future', () => {
    const base: EditorState = { ...fresh(), history: { past: [], future: [baseDoc()] } };
    const n = reduce(base, { type: 'meta/patch', patch: { title: 'x' } });
    expect(n.history.future).toEqual([]);
  });
});

describe('diagnóstico y archivo', () => {
  it('un cambio de doc deja stale el diagnóstico ya calculado, pero no el idle', () => {
    const s = fresh();
    expect(reduce(s, { type: 'meta/patch', patch: { title: 'x' } }).diagnostics.status).toBe('idle');
    const checked: EditorState = { ...s, diagnostics: { status: 'ok', issues: [], revision: 0 } };
    const n = reduce(checked, { type: 'meta/patch', patch: { title: 'x' } });
    expect(n.diagnostics).toEqual({ status: 'stale', issues: [], revision: 0 });
  });
  it('markSaved fija savedRevision', () => {
    const n = reduce(fresh(), { type: 'meta/patch', patch: { title: 'x' } });
    expect(n.file.savedRevision).toBe(0);
    expect(markSaved(n).file.savedRevision).toBe(1);
    expect(markSaved(n, 'nuevo.ogs.json').file).toEqual({ name: 'nuevo.ogs.json', savedRevision: 1 });
  });
});

describe('UiAction', () => {
  it('no tocan doc, revisión ni historial', () => {
    let s = fresh();
    s = reduce(s, { type: 'ui/tool', tool: 'add_vertex' });
    s = reduce(s, { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 2 } });
    s = reduce(s, { type: 'ui/snap', patch: { gridStep: 0.5, vertex: false } });
    const vp = { scale: 10, tx: 1, ty: 2, width: 100, height: 50 };
    s = reduce(s, { type: 'ui/viewport', viewport: vp });
    expect(s.ui.tool).toBe('add_vertex');
    expect(s.ui.selection).toEqual({ kind: 'vertex', regionIndex: 1, vertexIndex: 2 });
    expect(s.ui.snap).toEqual({ vertex: false, axis: true, gridStep: 0.5, radiusPx: 10 });
    expect(s.ui.viewport).toBe(vp);
    expect(s.revision).toBe(0);
    expect(s.history).toEqual({ past: [], future: [] });
    expect(s.doc).toEqual(baseDoc());
  });
  it('la herramienta «Dibujar región» es válida y no toca el historial', () => {
    const s = reduce(fresh(), { type: 'ui/tool', tool: 'draw_region' });
    expect(s.ui.tool).toBe('draw_region');
    expect(s.revision).toBe(0);
    expect(s.history).toEqual({ past: [], future: [] });
    expect(reduce(s, { type: 'ui/tool', tool: 'draw_region' })).toBe(s);
    expect(reduce(s, { type: 'ui/tool', tool: 'nope' as never })).toBe(s);
  });
  it('acciones repetidas o inválidas devuelven el mismo estado', () => {
    const s = fresh();
    expect(reduce(s, { type: 'ui/tool', tool: 'select' })).toBe(s);
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'none' } })).toBe(s);
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'region', regionIndex: 9 } })).toBe(s);
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 4 } })).toBe(s);
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'material', materialId: 'zz' } })).toBe(s);
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'load', index: 0 } })).toBe(s);
    expect(reduce(s, { type: 'ui/snap', patch: { radiusPx: -3 } })).toBe(s);
    expect(reduce(s, { type: 'ui/snap', patch: { gridStep: 0 } })).toBe(s);
    expect(reduce(s, { type: 'ui/snap', patch: { vertex: true } })).toBe(s);
    expect(reduce(s, { type: 'ui/viewport', viewport: null })).toBe(s);
  });
  it('acepta selecciones válidas de cada tipo', () => {
    let s = reduce(fresh(), { type: 'loads/set', loads: [{ type: 'line', x: 3, p: 1, angle: 0 }] });
    const valid = [
      { kind: 'region', regionIndex: 1 },
      { kind: 'material', materialId: 'm2' },
      { kind: 'piezo_point', index: 2 },
      { kind: 'surface_circle' },
      { kind: 'load', index: 0 },
    ] as const;
    for (const selection of valid) {
      s = reduce(s, { type: 'ui/select', selection });
      expect(s.ui.selection).toEqual(selection);
    }
    expect(reduce(s, { type: 'ui/select', selection: { kind: 'search_range', which: 'entry' } })).toBe(s); // sin search
  });
  it('la selección sigue al documento cuando se quitan elementos', () => {
    let s = reduce(fresh(), { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 3 } });
    s = reduce(s, { type: 'region/remove', regionIndex: 0 });
    expect(s.ui.selection).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 3 });
    s = reduce(s, { type: 'vertex/remove', regionIndex: 0, vertexIndex: 3 });
    expect(s.ui.selection).toEqual({ kind: 'region', regionIndex: 0 });
    s = reduce(s, { type: 'region/remove', regionIndex: 0 });
    expect(s.ui.selection).toEqual({ kind: 'none' });
  });
  it('la selección de una carga se reubica y la de una superficie desaparece con la superficie', () => {
    let s = reduce(fresh(), { type: 'loads/set', loads: [{ type: 'line', x: 1, p: 1, angle: 0 }, { type: 'line', x: 2, p: 1, angle: 0 }] });
    s = reduce(s, { type: 'ui/select', selection: { kind: 'load', index: 1 } });
    s = reduce(s, { type: 'load/remove', index: 0 });
    expect(s.ui.selection).toEqual({ kind: 'load', index: 0 });
    s = reduce(s, { type: 'ui/select', selection: { kind: 'surface_circle' } });
    s = reduce(s, { type: 'surface/set', surface: null });
    expect(s.ui.selection).toEqual({ kind: 'none' });
  });
});

describe('applyCommand', () => {
  it('es pura y devuelve null para un comando inválido', () => {
    const doc = baseDoc();
    expect(applyCommand(doc, { type: 'region/remove', regionIndex: 7 })).toBeNull();
    expect(doc).toEqual(baseDoc());
  });
});
