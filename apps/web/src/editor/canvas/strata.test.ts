// UX9-01 y T2: estratos bajo un talud. Dibujar un estrato que comparte la base (ajuste a aristas, vértices compartidos), dividir una región
// con una línea y verificar con el motor (OGS_BIN) que ambos modelos calculan. Usa el store real: un paso deshacible = un `undo()`.

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { simpleSlope } from '../app/newModel';
import { deepestPoint, engineRun, haveEngine } from '../state/engineRun.testutil';
import { createEditorStore, validateLocal } from '../state';
import type { ModelDoc } from '../types';
import { drawClick, drawHover, drawKey, drawPlace, EMPTY_DRAFT, type DrawDraft, type DrawKeyInput, type DrawStep } from './draw';
import { VP, toPx } from './fakeStore';
import { runActions, type GestureContext } from './gesture';
import { splitClick, splitKey, splitPlace, planSplit } from './split';

const key = (k: string, over: Partial<DrawKeyInput> = {}): DrawKeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });

/** Talud de 15 m a 1,5H:1V: corona 10 m, pie en x = 32,5, hasta x = 52,5 y base y = −10. */
function slopeDoc(): ModelDoc {
  return simpleSlope({
    units: 'SI',
    height: 15,
    slope: { kind: 'ratio', horizontal: 1.5 },
    crownWidth: 10,
    toeWidth: 20,
    depth: 10,
    material: { name: 'Arcilla', unit_weight: 18, cohesion: 25, friction_angle: 20 },
    water: 'toe',
  });
}

function setup(doc: ModelDoc = slopeDoc(), tool: 'draw_region' | 'split_region' = 'draw_region') {
  const store = createEditorStore(doc);
  store.dispatch({ type: 'ui/viewport', viewport: VP });
  store.dispatch({ type: 'ui/tool', tool });
  const ctx = (): GestureContext => ({ doc: store.getState().doc, ui: store.getState().ui });
  return { store, ctx };
}

function click(draft: DrawDraft, ctx: GestureContext, p: Point, fn: typeof drawClick = drawClick, pointerType = 'mouse'): DrawStep {
  const [x, y] = toPx(p[0], p[1]);
  const hovered = drawHover(draft, ctx, { x, y, button: 0, pointerType });
  return fn(hovered, ctx, { x, y, button: 0, pointerType });
}

describe('dibujar un estrato bajo el talud (UX9-01)', () => {
  it('un estrato bajo la base, con un vértice sobre la arista de la base: el límite es compartido y el modelo valida', () => {
    const { store, ctx } = setup();
    const before = store.getState().doc;
    let d = EMPTY_DRAFT;
    // La base del talud va de (0,−10) a (52,5; −10). Se apoyan dos vértices en ella: uno ya existente y uno en medio de la arista.
    const points: Point[] = [[0, -10], [20, -10], [52.5, -10], [52.5, -20], [0, -20]];
    for (const p of points) {
      const s = click(d, ctx(), p);
      expect(s.error, `punto ${p}`).toBeUndefined();
      d = s.draft;
    }
    expect(d.points).toHaveLength(5);
    expect(d.points[1]).toEqual([20, -10]);
    const closed = drawKey(d, ctx(), key('Enter'));
    expect(closed.handled).toBe(true);
    expect(closed.step.error).toBeUndefined();
    runActions(store, closed.step.actions);
    const doc = store.getState().doc;
    expect(doc.regions).toHaveLength(2);
    // el vértice (20, −10) también está ahora en la región vecina: contacto compartido
    expect(doc.regions[0]!.polygon).toContainEqual([20, -10]);
    expect(doc.regions[1]!.polygon).toContainEqual([20, -10]);
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
    // un solo paso deshacible
    store.undo();
    expect(store.getState().doc).toEqual(before);
    expect(store.getState().history.past).toHaveLength(0);
    expect(closed.step.announce).toMatch(/Comparte un vértice con la región 1/);
  });

  it('se puede colocar un punto lejos del modelo y cerrar con Intro aunque el último quede fuera de la extensión anterior', () => {
    const { store, ctx } = setup();
    let d = EMPTY_DRAFT;
    // todos los puntos bajo la base y a la derecha de la extensión del modelo (x > 52,5; y < −10)
    for (const p of [[60, -30], [90, -30], [90, -22]] as Point[]) d = drawPlace(d, ctx(), p).draft;
    const closed = drawKey(d, ctx(), key('Enter'));
    expect(closed.step.error).toBeUndefined();
    runActions(store, closed.step.actions);
    expect(store.getState().doc.regions).toHaveLength(2);
    expect(store.getState().doc.regions[1]!.polygon).toEqual([[60, -30], [90, -30], [90, -22]]);
  });

  it('un estrato que se solapa con el talud se rechaza con un motivo', () => {
    const { ctx } = setup();
    let d = EMPTY_DRAFT;
    for (const p of [[5, -5], [30, -5], [30, -15]] as Point[]) d = drawPlace(d, ctx(), p).draft;
    const closed = drawKey(d, ctx(), key('Enter'));
    expect(closed.step.error).toMatch(/solap/i);
    expect(closed.step.actions).toEqual([]);
  });

  it('teclado: al llevar el cursor a menos de 24 px del borde la vista se desplaza sola y deja el cursor dentro', () => {
    const { ctx } = setup();
    let d: DrawDraft = { ...EMPTY_DRAFT, points: [[0, -10]], cursor: [0, -10] };
    // cada flecha con Ctrl mueve 10 m (100 × 0,1 m); 6 pasos abajo = 60 m = 600 px, bastante más que el alto del lienzo
    let viewport = VP;
    for (let i = 0; i < 6; i += 1) {
      const s = drawKey(d, { ...ctx(), ui: { ...ctx().ui, viewport } }, key('ArrowDown', { ctrlKey: true }));
      d = s.step.draft;
      const vpAction = s.step.actions.find((a) => a.type === 'ui/viewport');
      if (vpAction && vpAction.type === 'ui/viewport' && vpAction.viewport) viewport = vpAction.viewport;
    }
    expect(viewport).not.toEqual(VP);
    const [, sy] = [0, viewport.ty - viewport.scale * d.cursor![1]];
    expect(sy).toBeGreaterThanOrEqual(24);
    expect(sy).toBeLessThanOrEqual(viewport.height - 24);
    expect(d.cursor![1]).toBeCloseTo(-70, 9);
  });
});

describe('Dividir región', () => {
  it('ratón: una línea que entra por la izquierda y sale por la derecha divide el talud en dos, en un solo paso deshacible', () => {
    const { store, ctx } = setup(slopeDoc(), 'split_region');
    const before = store.getState().doc;
    let d = EMPTY_DRAFT;
    // el primer clic cae sobre la arista izquierda (x = 0), el segundo sobre la derecha (x = 52,5)
    const first = click(d, ctx(), [0, -5], splitClick);
    expect(first.error).toBeUndefined();
    expect(first.draft.points).toEqual([[0, -5]]);
    expect(first.announce).toMatch(/sobre una arista/);
    d = first.draft;
    const last = click(d, ctx(), [52.5, -5], splitClick);
    expect(last.error).toBeUndefined();
    runActions(store, last.actions);

    const doc = store.getState().doc;
    expect(doc.regions).toHaveLength(2);
    expect(doc.materials.map((m) => m.id)).toEqual(['suelo', 'estrato-2']);
    expect(doc.materials[1]).toMatchObject({ name: 'Estrato 2', unit_weight: 18, cohesion: 25, friction_angle: 20 });
    expect(doc.regions[1]!.material).toBe('estrato-2');
    expect(doc.regions[0]!.polygon).toContainEqual([0, -5]);
    expect(doc.regions[1]!.polygon).toContainEqual([52.5, -5]);
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
    expect(store.getState().ui.selection).toEqual({ kind: 'region', regionIndex: 1 });
    expect(store.getState().ui.tool).toBe('select');
    expect(last.announce).toMatch(/Región 1 dividida en dos.*región 2 recibe «Estrato 2»/);

    expect(store.getState().history.past).toHaveLength(1);
    store.undo();
    expect(store.getState().doc).toEqual(before);
    expect(store.getState().history.past).toHaveLength(0);
    store.redo();
    expect(store.getState().doc.regions).toHaveLength(2);
  });

  it('usa el material seleccionado para la parte nueva, sin crear otro', () => {
    const doc = slopeDoc();
    doc.materials.push({ id: 'roca', name: 'Roca', model: 'mohr_coulomb', unit_weight: 24, cohesion: 200, friction_angle: 40, unit_weight_sat: null, ru: null });
    const { store, ctx } = setup(doc, 'split_region');
    store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: 'roca' } });
    const a = click(EMPTY_DRAFT, ctx(), [0, -5], splitClick);
    const b = click(a.draft, ctx(), [52.5, -5], splitClick);
    runActions(store, b.actions);
    expect(store.getState().doc.materials).toHaveLength(2);
    expect(store.getState().doc.regions[1]!.material).toBe('roca');
  });

  it('táctil: un toque a 15 px de la arista (dentro del radio del dedo, no del ratón) se apoya en ella', () => {
    const { store, ctx } = setup(slopeDoc(), 'split_region');
    const [x, y] = toPx(0, -5);
    const near = { x: x + 15, y, button: 0, pointerType: 'touch' };
    const mouseStep = splitClick(EMPTY_DRAFT, ctx(), { ...near, pointerType: 'mouse' });
    expect(mouseStep.draft.snapKind).toBe('none'); // con el ratón, 15 px no alcanza el ajuste (10 px)
    const touchStep = splitClick(EMPTY_DRAFT, ctx(), near);
    expect(touchStep.draft.points[0]).toEqual([0, -5]);
    const [x2, y2] = toPx(52.5, -5);
    const end = splitClick(touchStep.draft, ctx(), { x: x2 - 14, y: y2, button: 0, pointerType: 'touch' });
    runActions(store, end.actions);
    expect(store.getState().doc.regions).toHaveLength(2);
  });

  it('teclado: Espacio coloca el primer punto (se apoya en la arista) y Espacio en el otro borde divide; Intro divide con los puntos colocados', () => {
    const { store, ctx } = setup(slopeDoc(), 'split_region');
    // el cursor se llevó a (0, −5) y a (52,5; −5) con las flechas
    let d: DrawDraft = { ...EMPTY_DRAFT, cursor: [0.03, -5.02], pending: true };
    d = splitKey(d, ctx(), key(' ')).step.draft;
    expect(d.points).toEqual([[0, -5.02]]); // x se ajusta a la arista (x = 0) aunque el cursor no estaba exacto
    d = { ...d, cursor: [52.5, -4.97], pending: true };
    const end = splitKey(d, ctx(), key(' '));
    expect(end.step.error).toBeUndefined();
    runActions(store, end.step.actions);
    expect(store.getState().doc.regions).toHaveLength(2);

    // Intro sin cursor pendiente: usa los puntos ya colocados (el segundo en el borde se colocó con otro gesto)
    const t = setup(slopeDoc(), 'split_region');
    let q = splitPlace(EMPTY_DRAFT, t.ctx(), [0, -5], 'edge').draft;
    q = { ...q, points: [...q.points, [20, -5]], cursor: [20, -5] };
    const sp = splitKey(q, t.ctx(), key('Enter'));
    expect(sp.step.error).toMatch(/no entra y sale/);
    q = { ...q, points: [...q.points, [60, -5]], cursor: [60, -5] };
    const ok = splitKey(q, t.ctx(), key('Enter'));
    expect(ok.step.error).toBeUndefined();
    runActions(t.store, ok.step.actions);
    expect(t.store.getState().doc.regions).toHaveLength(2);
  });

  it('una línea que no atraviesa la región se rechaza con un mensaje que dice qué hacer', () => {
    const { ctx } = setup(slopeDoc(), 'split_region');
    const a = click(EMPTY_DRAFT, ctx(), [0, -5], splitClick);
    const b = click(a.draft, ctx(), [20, -5], splitClick);
    const fin = splitKey(b.draft, ctx(), key('Enter'));
    expect(fin.step.actions).toEqual([]);
    expect(fin.step.error).toMatch(/Empiece y termine fuera de la región o sobre su borde/);
  });

  it('una línea que cruza dos regiones pide seleccionar cuál dividir, y con la región seleccionada divide solo esa', () => {
    const { store, ctx } = setup(slopeDoc(), 'split_region');
    // primero un contacto horizontal en y = −5 (dos regiones)
    const first = planSplit(store.getState().doc, { kind: 'none' }, [[-1, -5], [53.5, -5]]);
    if (!first.ok) throw new Error(first.message);
    runActions(store, first.actions);
    expect(store.getState().doc.regions).toHaveLength(2);
    store.dispatch({ type: 'ui/select', selection: { kind: 'none' } });
    // una línea vertical en x = 5 cruza ambas regiones
    const line: Point[] = [[5, 20], [5, -12]];
    const amb = planSplit(store.getState().doc, { kind: 'none' }, line);
    expect(amb.ok).toBe(false);
    expect(!amb.ok && amb.message).toMatch(/divide varias regiones \(1, 2\)/);
    const picked = planSplit(store.getState().doc, { kind: 'region', regionIndex: 1 }, line);
    expect(picked.ok).toBe(true);
    void ctx;
  });
});

describe('estratos con el motor (OGS_BIN)', () => {
  const clay = { name: 'Arcilla', unit_weight: 18, cohesion: 25, friction_angle: 20 };
  const rock = { id: 'estrato-2', name: 'Roca', model: 'mohr_coulomb' as const, unit_weight: 24, cohesion: 200, friction_angle: 40, unit_weight_sat: null, ru: null };

  it.skipIf(!haveEngine)('dibujar bajo el talud un estrato de roca que comparte la base: validateLocal y el motor lo aceptan y calcula con FS finito', () => {
    const { store, ctx } = setup();
    store.dispatch({ type: 'material/upsert', material: rock });
    store.dispatch({ type: 'ui/select', selection: { kind: 'material', materialId: 'estrato-2' } });
    let d = EMPTY_DRAFT;
    for (const p of [[0, -10], [20, -10], [52.5, -10], [52.5, -20], [0, -20]] as Point[]) d = click(d, ctx(), p).draft;
    runActions(store, drawKey(d, ctx(), key('Enter')).step.actions);
    const doc = store.getState().doc;
    expect(doc.regions.map((r) => r.material)).toEqual(['suelo', 'estrato-2']);
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
    const run = engineRun(doc);
    expect(run.code, run.out.slice(0, 400)).toBe(0);
    for (const x of run.results) {
      expect(x.status).toBe('converged');
      expect(Number.isFinite(x.fos)).toBe(true);
    }
  });

  it.skipIf(!haveEngine)('T2 con «Dividir región»: talud 15 m a 1,5H:1V, arcilla sobre roca (contacto 5 m bajo el pie) y piezométrica en el pie: Bishop y Spencer finitos', () => {
    const { store, ctx } = setup(slopeDoc(), 'split_region');
    const a = click(EMPTY_DRAFT, ctx(), [0, -5], splitClick);
    const b = click(a.draft, ctx(), [52.5, -5], splitClick);
    runActions(store, b.actions);
    // la parte nueva (abajo) pasa a ser roca; la arcilla conserva sus parámetros
    store.dispatch({ type: 'material/upsert', material: rock });
    const doc = store.getState().doc;
    expect(doc.regions[0]!.polygon.some((p) => p[1] === -5)).toBe(true);
    expect(doc.materials.find((m) => m.id === 'suelo')).toMatchObject(clay);
    const run = engineRun(doc);
    expect(run.code, run.out.slice(0, 400)).toBe(0);
    const by = Object.fromEntries(run.results.map((x) => [x.method, x]));
    for (const m of ['bishop', 'spencer']) {
      expect(by[m]?.status, m).toBe('converged');
      expect(Number.isFinite(by[m]?.fos), m).toBe(true);
    }
    // la superficie crítica no se hunde en la roca de forma absurda (el contacto está en y = −5)
    const depth = deepestPoint(by.bishop!);
    if (process.env.OGS_DEBUG) writeFileSync(`${process.env.OGS_DEBUG}/t2-dividir.json`, JSON.stringify(run.results.map((x) => ({ method: x.method, fos: x.fos, status: x.status, depth: deepestPoint(x), surface: x.surface }))));
    expect(depth).toBeGreaterThan(-5 - 3); // a lo sumo 3 m dentro de la roca
  });
});
