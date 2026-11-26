import { describe, expect, it } from 'vitest';
import { circleSpec } from '../../engine/surface';
import type { Point } from '../../engine/types';
import { createFakeStore, makeDoc, makeState, toPx, VP, type FakeStore } from './fakeStore';
import {
  DRAG_THRESHOLD_PX,
  IDLE,
  applyPreview,
  doubleClick,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  runActions,
  type GestureResult,
  type GestureState,
  type PointerInput,
} from './gesture';

/** Hace de componente: lee el estado del store, aplica la máquina y ejecuta las acciones. */
function driver(store: FakeStore) {
  let st: GestureState = IDLE;
  const ctx = () => store.getState();
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
    down: (x: number, y: number, extra?: Partial<PointerInput>) => run(pointerDown(st, ctx(), at(x, y, extra))),
    move: (x: number, y: number) => run(pointerMove(st, ctx(), at(x, y))),
    up: (x: number, y: number) => run(pointerUp(st, ctx(), at(x, y))),
    cancel: () => run(pointerCancel(st)),
    dbl: (x: number, y: number) => runActions(store, doubleClick(ctx(), at(x, y))),
  };
}

const polygon = (store: FakeStore, ri: number): Point[] => store.getState().doc.regions[ri].polygon;

describe('arrastrar un vértice', () => {
  it('un gesto = una entrada de historial; mueve también los vértices coincidentes', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(0, 5); // vértice compartido: región 0 vértice 3 y región 1 vértice 0
    const [tx, ty] = toPx(3.37, 7.21);

    d.down(sx, sy);
    expect(store.log).toEqual(['ui/select', 'beginGesture']);
    expect(store.getState().ui.selection).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 3 });

    d.move(tx, ty);
    // Durante el arrastre solo hay vista previa: el documento no cambia.
    expect(polygon(store, 0)[3]).toEqual([0, 5]);
    const st = d.state;
    expect(st.mode === 'drag' && st.preview?.kind).toBe('vertex');

    d.up(tx, ty);
    expect(polygon(store, 0)[3]).toEqual([3.37, 7.21]);
    expect(polygon(store, 1)[0]).toEqual([3.37, 7.21]);
    expect(store.past).toHaveLength(1);
    expect(store.log.slice(-1)).toEqual(['endGesture']);
    expect(d.state).toEqual(IDLE);

    store.undo();
    expect(polygon(store, 0)[3]).toEqual([0, 5]);
    expect(polygon(store, 1)[0]).toEqual([0, 5]);
  });

  it('Alt desacopla el vértice de los coincidentes', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(0, 5);
    const [tx, ty] = toPx(2, 9);
    d.down(sx, sy, { altKey: true });
    d.move(tx, ty);
    d.up(tx, ty);
    expect(polygon(store, 0)[3]).toEqual([2, 9]);
    expect(polygon(store, 1)[0]).toEqual([0, 5]);
    expect(store.past).toHaveLength(1);
  });

  it('enganchar a un vértice de otra región al arrastrar', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(60, 10);
    const [tx, ty] = toPx(40.3, 10.2); // a 3 px del vértice (40,10)
    d.down(sx, sy);
    d.move(tx, ty);
    const st = d.state;
    expect(st.mode === 'drag' && st.preview?.kind === 'vertex' && st.preview.snap.kind).toBe('vertex');
    d.up(tx, ty);
    expect(polygon(store, 1)[2]).toEqual([40, 10]);
  });

  it('un clic sin mover cancela el gesto: no hay entrada de historial', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(60, 0);
    d.down(sx, sy);
    d.move(sx + 1, sy + 1); // bajo el umbral
    d.up(sx + 1, sy + 1);
    expect(DRAG_THRESHOLD_PX).toBeGreaterThan(Math.SQRT2);
    expect(store.log).toEqual(['ui/select', 'beginGesture', 'cancelGesture']);
    expect(store.past).toHaveLength(0);
    expect(store.getState().ui.selection).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
  });

  it('cancelar a mitad de arrastre (Escape/pointercancel) no cambia nada', () => {
    const store = createFakeStore();
    const before = store.getState().doc;
    const d = driver(store);
    const [sx, sy] = toPx(60, 0);
    d.down(sx, sy);
    d.move(sx - 80, sy - 80);
    d.cancel();
    expect(store.getState().doc).toBe(before);
    expect(store.past).toHaveLength(0);
    expect(d.state).toEqual(IDLE);
    expect(store.log.slice(-1)).toEqual(['cancelGesture']);
  });

  it('con rejilla activa el vértice cae en la rejilla', () => {
    const store = createFakeStore(makeDoc(), { snap: { vertex: true, axis: false, gridStep: 2, radiusPx: 10 } });
    const d = driver(store);
    const [sx, sy] = toPx(60, 0);
    const [tx, ty] = toPx(51.3, 3.4);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(polygon(store, 0)[1]).toEqual([52, 4]);
  });

  it('pointerdown se ignora sin viewport o con un gesto en curso', () => {
    const noVp = makeState(makeDoc(), { viewport: null });
    expect(pointerDown(IDLE, noVp, { x: 1, y: 1, button: 0 })).toEqual({ state: IDLE, actions: [] });
    const busy: GestureState = { mode: 'pan', last: [0, 0] };
    expect(pointerDown(busy, makeState(), { x: 1, y: 1, button: 0 }).actions).toEqual([]);
  });
});

describe('piezométrica y círculo', () => {
  it('arrastrar un punto de la piezométrica acota x entre vecinos', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(30, 8);
    const [tx, ty] = toPx(75, 12);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(store.getState().doc.water?.piezometric_line).toEqual([[0, 8], [59.999, 12], [60, 6]]);
    expect(store.past).toHaveLength(1);
    expect(store.getState().ui.selection).toEqual({ kind: 'piezo_point', index: 1 });
  });

  it('arrastrar el centro del círculo conserva el radio', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(30, 30);
    const [tx, ty] = toPx(34, 28);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(store.getState().doc.analysis.surface).toEqual({ type: 'circle', xc: 34, yc: 28, r: 25 });
    expect(store.getState().ui.selection).toEqual({ kind: 'surface_circle' });
  });

  it('arrastrar el tirador del radio fija r = distancia al centro', () => {
    const store = createFakeStore();
    const d = driver(store);
    const hx = 30 + 25 * Math.cos(-Math.PI / 4);
    const hy = 30 + 25 * Math.sin(-Math.PI / 4);
    const [sx, sy] = toPx(hx, hy);
    const [tx, ty] = toPx(30 + 20, 30); // a 20 m a la derecha del centro
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(store.getState().doc.analysis.surface).toEqual({ type: 'circle', xc: 30, yc: 30, r: 20 });
  });

  it('applyPreview devuelve un documento nuevo solo para dibujar', () => {
    const doc = makeDoc();
    const p = applyPreview(doc, { kind: 'circle', circle: { xc: 1, yc: 2, r: 3 }, snap: null });
    expect(p.analysis.surface).toEqual({ type: 'circle', xc: 1, yc: 2, r: 3 });
    expect(circleSpec(doc.analysis.surface)?.xc).toBe(30);
    expect(applyPreview(doc, null)).toBe(doc);
  });
});

describe('herramientas', () => {
  it('add_vertex: un clic cerca de una arista inserta el vértice en la proyección y lo selecciona', () => {
    const store = createFakeStore(makeDoc(), { tool: 'add_vertex' });
    const d = driver(store);
    const [sx, sy] = toPx(30, 0);
    d.down(sx, sy + 5);
    d.up(sx, sy + 5);
    expect(polygon(store, 0)).toEqual([[0, 0], [30, 0], [60, 0], [60, 5], [0, 5]]);
    expect(store.getState().ui.selection).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
    expect(store.past).toHaveLength(1);
  });

  it('add_vertex en la piezométrica inserta un punto; sobre un tirador solo selecciona', () => {
    const store = createFakeStore(makeDoc(), { tool: 'add_vertex' });
    const d = driver(store);
    const [qx, qy] = toPx(45, 7);
    d.down(qx, qy - 3);
    const line = store.getState().doc.water?.piezometric_line ?? [];
    expect(line).toHaveLength(4);
    expect(line[2][0]).toBeCloseTo(45, 1);
    expect(line[2][1]).toBeCloseTo(7, 1);
    expect(store.getState().ui.selection).toEqual({ kind: 'piezo_point', index: 2 });
    const [vx, vy] = toPx(60, 0);
    d.down(vx, vy);
    expect(polygon(store, 0)).toHaveLength(4);
    expect(store.getState().ui.selection).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
  });

  it('add_vertex no empieza arrastres: no abre gestos', () => {
    const store = createFakeStore(makeDoc(), { tool: 'add_vertex' });
    const d = driver(store);
    const [vx, vy] = toPx(60, 0);
    d.down(vx, vy);
    expect(store.log).not.toContain('beginGesture');
    expect(d.state).toEqual(IDLE);
  });

  it('pan: arrastrar desplaza el viewport sin tocar el historial; también con el botón central', () => {
    for (const mode of ['pan-tool', 'middle'] as const) {
      const store = createFakeStore(makeDoc(), mode === 'pan-tool' ? { tool: 'pan' } : {});
      const d = driver(store);
      d.down(100, 100, mode === 'middle' ? { button: 1 } : undefined);
      expect(d.state.mode).toBe('pan');
      d.move(130, 90);
      d.move(150, 95);
      d.up(150, 95);
      expect(store.getState().ui.viewport).toEqual({ ...VP, tx: VP.tx + 50, ty: VP.ty - 5 });
      expect(store.past).toHaveLength(0);
      expect(store.log).not.toContain('beginGesture');
      expect(d.state).toEqual(IDLE);
    }
  });

  it('clic en región, en vacío y en banda actualizan la selección', () => {
    const store = createFakeStore();
    store.getState().doc.analysis.search = { type: 'circular_entry_exit', entry: [0, 10] };
    const d = driver(store);
    const [rx, ry] = toPx(30, 2.5);
    d.down(rx, ry);
    d.up(rx, ry);
    expect(store.getState().ui.selection).toEqual({ kind: 'region', regionIndex: 0 });
    const [ex, ey] = toPx(5, 20);
    d.down(ex, ey - 8);
    d.up(ex, ey - 8);
    expect(store.getState().ui.selection).toEqual({ kind: 'search_range', which: 'entry' });
    d.down(700, 20);
    d.up(700, 20);
    expect(store.getState().ui.selection).toEqual({ kind: 'none' });
  });
});

describe('doble clic', () => {
  it('quita el vértice si quedan al menos 3', () => {
    const store = createFakeStore();
    const d = driver(store);
    const [sx, sy] = toPx(20, 20);
    d.dbl(sx, sy);
    expect(polygon(store, 1)).toHaveLength(5);
    expect(store.past).toHaveLength(1);
  });

  it('no emite nada si el polígono quedaría con menos de 3 vértices; quita puntos de la piezométrica', () => {
    const doc = makeDoc();
    doc.regions[0].polygon = [[0, 0], [60, 0], [60, 5]];
    const store = createFakeStore(doc);
    const d = driver(store);
    const [sx, sy] = toPx(60, 0);
    d.dbl(sx, sy);
    expect(store.log).toEqual([]);
    const [px, py] = toPx(30, 8);
    d.dbl(px, py);
    expect(store.getState().doc.water?.piezometric_line).toEqual([[0, 8], [60, 6]]);
  });
});

describe('acierto táctil y de ratón (R7-10)', () => {
  const [vx, vy] = toPx(60, 0);
  it('ratón: arrastra el vértice desde 14 px (radio 16) aunque el radio de ajuste sea 10; no desde 19 px', () => {
    const near = pointerDown(IDLE, makeState(), { x: vx + 14, y: vy, button: 0, pointerType: 'mouse' });
    expect(near.state.mode).toBe('drag');
    const far = pointerDown(IDLE, makeState(), { x: vx + 19, y: vy, button: 0, pointerType: 'mouse' });
    expect(far.state.mode).toBe('idle');
  });

  it('táctil: arrastra el vértice desde 20 px (radio 22); no desde 25 px', () => {
    const near = pointerDown(IDLE, makeState(), { x: vx + 20, y: vy, button: 0, pointerType: 'touch' });
    expect(near.state.mode).toBe('drag');
    expect(near.actions[0]).toMatchObject({ type: 'ui/select', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 1 } });
    const far = pointerDown(IDLE, makeState(), { x: vx + 25, y: vy, button: 0, pointerType: 'touch' });
    expect(far.state.mode).toBe('idle');
  });

  it('sin pointerType se usa el radio de ratón', () => {
    expect(pointerDown(IDLE, makeState(), { x: vx + 14, y: vy, button: 0 }).state.mode).toBe('drag');
  });
});
