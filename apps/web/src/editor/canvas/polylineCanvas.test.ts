// F3-W1f: la polilínea fija de falla en el lienzo: tiradores, acierto, arrastre (puntero y táctil), teclado y etiquetas.
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import type { ModelDoc, Selection } from '../types';
import { createFakeStore, makeDoc, makeState, toPx, VP, type FakeStore } from './fakeStore';
import { handleKey, handleList, handleSelection, handleWorldPoint, selectionHandle, stepHandle } from './handles';
import { hitTest } from './hitTest';
import { IDLE, applyPreview, doubleClick, pointerCancel, pointerDown, pointerMove, pointerUp, runActions, type GestureResult, type GestureState, type PointerInput } from './gesture';
import { keyActions, type KeyInput } from './keys';
import { surfaceVertexAnnouncement, surfaceVertexLabel } from './layout';

// Polilínea bajo el terreno de makeDoc (terreno y = 10 a x ≥ 40; 20 en x ≤ 0; talud entre 20 y 40).
const PTS: Point[] = [[10, 8], [20, 9], [30, 12], [45, 8]];

function polyDoc(points: Point[] = PTS): ModelDoc {
  const d = makeDoc();
  d.analysis.surface = { type: 'polyline', points: points.map((p): Point => [p[0], p[1]]) };
  return d;
}
const surfacePoints = (d: ModelDoc): Point[] => (d.analysis.surface && d.analysis.surface.type === 'polyline' ? d.analysis.surface.points : []);

const FREE = { vertex: false, axis: false, gridStep: null, radiusPx: 10 } as const;
const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
const ctx = (selection: Selection, doc = polyDoc(), gridStep: number | null = null) =>
  makeState(doc, { selection, snap: { vertex: true, axis: true, gridStep, radiusPx: 10 } });

describe('tiradores de la polilínea', () => {
  it('una polilínea aporta un tirador por vértice, después de los de regiones y piezométrica, y ninguno de círculo', () => {
    const list = handleList(polyDoc());
    const surface = list.filter((h) => h.kind === 'surface_vertex');
    expect(surface).toEqual([0, 1, 2, 3].map((index) => ({ kind: 'surface_vertex', index })));
    expect(list.slice(-4)).toEqual(surface);
    expect(list.some((h) => h.kind === 'circle_center' || h.kind === 'circle_radius')).toBe(false);
    expect(surface.map(handleKey)).toEqual(['s-0', 's-1', 's-2', 's-3']);
  });
  it('un círculo sigue con centro y radio (sin cambios)', () => {
    expect(handleList(makeDoc()).slice(-2)).toEqual([{ kind: 'circle_center' }, { kind: 'circle_radius' }]);
  });
  it('selección ↔ tirador y posición en el mundo', () => {
    const h = { kind: 'surface_vertex', index: 2 } as const;
    expect(handleSelection(h)).toEqual({ kind: 'surface_vertex', index: 2 });
    expect(selectionHandle({ kind: 'surface_vertex', index: 1 })).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(handleWorldPoint(polyDoc(), h)).toEqual([30, 12]);
    expect(handleWorldPoint(polyDoc(), { kind: 'surface_vertex', index: 9 })).toBeNull();
    expect(handleWorldPoint(makeDoc(), h)).toBeNull();
  });
  it('[ y ] recorren los vértices de la polilínea con vuelta', () => {
    const list = handleList(polyDoc());
    const last = list[list.length - 1]!;
    expect(stepHandle(list, last, 1, true)).toEqual(list[0]);
    expect(stepHandle(list, { kind: 'surface_vertex', index: 1 }, 1, true)).toEqual({ kind: 'surface_vertex', index: 2 });
    const r = keyActions(ctx({ kind: 'surface_vertex', index: 3 }), key(']'));
    expect(r.focus).toEqual(list[0]);
  });
});

describe('acierto', () => {
  it('un vértice de la polilínea se acierta con el radio de acierto y gana al interior de la región', () => {
    const [sx, sy] = toPx(30, 12);
    expect(hitTest(polyDoc(), VP, sx + 3, sy - 2, 16, {})).toMatchObject({ kind: 'surface_vertex', index: 2 });
  });
  it('con el dedo (22 px) acierta más lejos que con el ratón (16 px)', () => {
    const [sx, sy] = toPx(20, 9);
    expect(hitTest(polyDoc(), VP, sx + 20, sy, 16, {}).kind).not.toBe('surface_vertex');
    expect(hitTest(polyDoc(), VP, sx + 20, sy, 22, {})).toMatchObject({ kind: 'surface_vertex', index: 1 });
  });
  it('un tramo solo es acertable con la herramienta de agregar vértice (surfaceEdge)', () => {
    const [mx, my] = toPx(25, 10.5);
    expect(hitTest(polyDoc(), VP, mx, my, 16, {}).kind).toBe('region');
    expect(hitTest(polyDoc(), VP, mx, my, 16, { surfaceEdge: true })).toMatchObject({ kind: 'surface_edge', afterIndex: 1 });
  });
  it('sin círculo ni polilínea no hay tiradores de superficie', () => {
    const d = makeDoc();
    d.analysis.surface = null;
    const [sx, sy] = toPx(30, 12);
    expect(hitTest(d, VP, sx, sy, 16, {}).kind).not.toMatch(/surface|circle/);
  });
});

function driver(store: FakeStore) {
  let st: GestureState = IDLE;
  const ctx2 = () => store.getState();
  const run = (r: GestureResult): GestureResult => {
    st = r.state;
    runActions(store, r.actions);
    return r;
  };
  const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({ x, y, button: 0, ...extra });
  return {
    get state() {
      return st;
    },
    down: (x: number, y: number, extra?: Partial<PointerInput>) => run(pointerDown(st, ctx2(), at(x, y, extra))),
    move: (x: number, y: number, extra?: Partial<PointerInput>) => run(pointerMove(st, ctx2(), at(x, y, extra))),
    up: (x: number, y: number, extra?: Partial<PointerInput>) => run(pointerUp(st, ctx2(), at(x, y, extra))),
    cancel: () => run(pointerCancel(st)),
  };
}

describe('arrastrar un vértice de la polilínea', () => {
  it('un gesto = una entrada de historial, con surface/set de la polilínea completa', () => {
    const store = createFakeStore(polyDoc(), { snap: FREE });
    const d = driver(store);
    const [sx, sy] = toPx(20, 9);
    const [tx, ty] = toPx(22, 7);
    d.down(sx, sy);
    expect(store.getState().ui.selection).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(store.log).toEqual(['ui/select', 'beginGesture']);
    d.move(tx, ty);
    expect(surfacePoints(store.getState().doc)[1]).toEqual([20, 9]); // solo vista previa
    const st = d.state;
    expect(st.mode === 'drag' && st.preview?.kind).toBe('surface_polyline');
    d.up(tx, ty);
    expect(store.log.slice(-2)).toEqual(['surface/set', 'endGesture']);
    expect(store.past).toHaveLength(1);
    const moved = surfacePoints(store.getState().doc);
    expect(moved).toHaveLength(4);
    expect(moved[1]![0]).toBeCloseTo(22, 6);
    expect(moved[1]![1]).toBeCloseTo(7, 6);
    expect(moved[0]).toEqual([10, 8]);
  });
  it('la x no cruza la del vecino: se acota y la vista previa lo marca', () => {
    const store = createFakeStore(polyDoc());
    const d = driver(store);
    const [sx, sy] = toPx(20, 9);
    const [tx, ty] = toPx(34, 9); // más allá del vértice de x = 30
    d.down(sx, sy);
    d.move(tx, ty);
    const st = d.state;
    expect(st.mode === 'drag' && st.preview?.kind === 'surface_polyline' && st.preview.clamped).toBe(true);
    d.up(tx, ty);
    const x = surfacePoints(store.getState().doc)[1]![0];
    expect(x).toBeLessThan(30);
    expect(x).toBeGreaterThan(29.99);
  });
  it('la vista previa se aplica al documento solo para dibujar; Escape (cancel) no deja cambios', () => {
    const store = createFakeStore(polyDoc(), { snap: FREE });
    const d = driver(store);
    const [sx, sy] = toPx(20, 9);
    d.down(sx, sy);
    d.move(...toPx(21, 6));
    const st = d.state;
    const shown = applyPreview(store.getState().doc, st.mode === 'drag' ? st.preview : null);
    expect(surfacePoints(shown)[1]![1]).toBeCloseTo(6, 6);
    d.cancel();
    expect(store.log.slice(-1)).toEqual(['cancelGesture']);
    expect(surfacePoints(store.getState().doc)[1]).toEqual([20, 9]);
  });
  it('táctil: el radio de acierto es de 22 px y el arrastre actúa igual', () => {
    const store = createFakeStore(polyDoc());
    const d = driver(store);
    const [sx, sy] = toPx(30, 12);
    d.down(sx + 20, sy, { pointerType: 'touch' });
    expect(store.getState().ui.selection).toEqual({ kind: 'surface_vertex', index: 2 });
    d.move(...toPx(31, 11));
    d.up(...toPx(31, 11));
    expect(surfacePoints(store.getState().doc)[2]![0]).toBeCloseTo(31, 6);
  });
  it('un clic sin mover selecciona y no escribe en el documento', () => {
    const store = createFakeStore(polyDoc());
    const d = driver(store);
    const [sx, sy] = toPx(20, 9);
    d.down(sx, sy);
    d.up(sx, sy);
    expect(store.getState().ui.selection).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(store.past).toHaveLength(0);
  });
  it('con «Agregar vértice», un clic sobre un tramo inserta un punto y lo selecciona', () => {
    const store = createFakeStore(polyDoc(), { tool: 'add_vertex' });
    const d = driver(store);
    const [mx, my] = toPx(25, 10.5);
    d.down(mx, my);
    const pts = surfacePoints(store.getState().doc);
    expect(pts).toHaveLength(5);
    expect(pts[2]![0]).toBeCloseTo(25, 0);
    expect(store.getState().ui.selection).toEqual({ kind: 'surface_vertex', index: 2 });
  });
  it('doble clic quita el vértice (mínimo 2 puntos)', () => {
    const store = createFakeStore(polyDoc());
    const [sx, sy] = toPx(20, 9);
    runActions(store, doubleClick(store.getState(), { x: sx, y: sy, button: 0 }));
    expect(surfacePoints(store.getState().doc)).toEqual([[10, 8], [30, 12], [45, 8]]);
    const two = createFakeStore(polyDoc([[10, 8], [20, 9]]));
    runActions(two, doubleClick(two.getState(), { x: sx, y: sy, button: 0 }));
    expect(surfacePoints(two.getState().doc)).toHaveLength(2);
  });
});

describe('teclado sobre la polilínea', () => {
  it('flechas: un paso de rejilla (0,1 sin rejilla), Mayús ×10, y anuncian la posición', () => {
    const sel: Selection = { kind: 'surface_vertex', index: 1 };
    const r = keyActions(ctx(sel, polyDoc(), 0.5), key('ArrowRight'));
    expect(r.actions[0]).toEqual({ type: 'surface/set', surface: { type: 'polyline', points: [[10, 8], [20.5, 9], [30, 12], [45, 8]] } });
    expect(r.announce).toBe('Punto 2 de la polilínea de falla: x 20,5 m, y 9,0 m');
    const up = keyActions(ctx(sel), key('ArrowUp', { shiftKey: true }));
    expect(up.actions[0]).toMatchObject({ surface: { points: [[10, 8], [20, 10], [30, 12], [45, 8]] } });
    expect(keyActions(ctx(sel), key('ArrowDown')).actions[0]).toMatchObject({ surface: { points: [[10, 8], [20, 8.9], [30, 12], [45, 8]] } });
  });
  it('la flecha no cruza la x del vecino: se acota y se avisa', () => {
    const sel: Selection = { kind: 'surface_vertex', index: 1 };
    const doc = polyDoc([[10, 8], [29.95, 9], [30, 12], [45, 8]]);
    const r = keyActions(ctx(sel, doc, 1), key('ArrowRight'));
    const pts = (r.actions[0] as { surface: { points: Point[] } }).surface.points;
    expect(pts[1]![0]).toBeCloseTo(30 - 1e-3, 9);
    expect(r.announce).toMatch(/no puede cruzar la de su vecino/);
    // ya pegado al vecino: no hay acción, solo el aviso
    const stuck = polyDoc([[10, 8], [29.999, 9], [30, 12], [45, 8]]);
    const r2 = keyActions(ctx(sel, stuck, 1), key('ArrowRight'));
    expect(r2.handled).toBe(true);
    expect(r2.actions).toEqual([]);
    expect(r2.announce).toMatch(/no puede cruzar/);
  });
  it('Insert o i insertan en el punto medio del tramo siguiente y pasan el foco al nuevo', () => {
    for (const k of ['Insert', 'i']) {
      const r = keyActions(ctx({ kind: 'surface_vertex', index: 1 }), key(k));
      expect(r.actions[0]).toEqual({ type: 'surface/set', surface: { type: 'polyline', points: [[10, 8], [20, 9], [25, 10.5], [30, 12], [45, 8]] } });
      expect(r.actions[1]).toEqual({ type: 'ui/select', selection: { kind: 'surface_vertex', index: 2 } });
      expect(r.focus).toEqual({ kind: 'surface_vertex', index: 2 });
      expect(r.announce).toBe('Punto insertado. Punto 3 de la polilínea de falla: x 25,0 m, y 10,5 m');
    }
  });
  it('Supr quita el vértice (mínimo 2) y el foco pasa al anterior', () => {
    const r = keyActions(ctx({ kind: 'surface_vertex', index: 2 }), key('Delete'));
    expect(r.actions).toEqual([
      { type: 'surface/set', surface: { type: 'polyline', points: [[10, 8], [20, 9], [45, 8]] } },
      { type: 'ui/select', selection: { kind: 'surface_vertex', index: 1 } },
    ]);
    expect(r.focus).toEqual({ kind: 'surface_vertex', index: 1 });
    expect(r.announce).toBe('Punto eliminado. Foco en el punto 2 de la polilínea de falla: x 20,0 m, y 9,0 m');
    const first = keyActions(ctx({ kind: 'surface_vertex', index: 0 }), key('Backspace'));
    expect(first.focus).toEqual({ kind: 'surface_vertex', index: 0 });
    const two = keyActions(ctx({ kind: 'surface_vertex', index: 0 }, polyDoc([[10, 8], [20, 9]])), key('Delete'));
    expect(two).toMatchObject({ handled: true, actions: [], announce: 'No se puede eliminar: la polilínea necesita al menos 2 puntos' });
  });
  it('en imperial las etiquetas llevan ft', () => {
    const d = polyDoc();
    d.units = 'imperial';
    expect(keyActions(ctx({ kind: 'surface_vertex', index: 1 }, d), key('ArrowRight')).announce).toBe('Punto 2 de la polilínea de falla: x 20,1 ft, y 9,0 ft');
  });
});

describe('etiquetas accesibles', () => {
  it('son estables y llevan unidad', () => {
    expect(surfaceVertexLabel(1, [20, 9.25])).toBe('Polilínea de falla, punto 2: x 20,0 m, y 9,25 m');
    expect(surfaceVertexAnnouncement(0, [1.5, 2], 'imperial')).toBe('Punto 1 de la polilínea de falla: x 1,5 ft, y 2,0 ft');
  });
});
