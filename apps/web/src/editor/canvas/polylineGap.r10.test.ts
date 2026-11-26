// R10B-04d: el paso mínimo de x de la polilínea crece con el ancho del modelo (el motor exige 1e-9·ancho): en el lienzo (arrastre, agregar vértice)
// y en el teclado (mover, insertar).
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { createFakeStore, makeDoc, makeState, toPx } from './fakeStore';
import { IDLE, pointerDown, pointerMove, pointerUp, runActions, type GestureState } from './gesture';
import { keyActions, type KeyInput } from './keys';
import { POLYLINE_MIN_GAP, modelWidth, movePolylineVertex, polylineMinGap } from './polyline';

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });

/** `makeDoc` con x multiplicada por `k` (ancho 60·k) y una polilínea dada. */
function wide(k: number, points: Point[]): ModelDoc {
  const d = makeDoc();
  d.regions = d.regions.map((r) => ({ ...r, polygon: r.polygon.map(([x, y]): Point => [x * k, y]) }));
  d.analysis.surface = { type: 'polyline', points };
  return d;
}

describe('polylineMinGap', () => {
  it('1e-3 en modelos corrientes y el doble de 1e-9·ancho en los muy anchos', () => {
    expect(polylineMinGap(60)).toBe(POLYLINE_MIN_GAP);
    expect(polylineMinGap(2e6)).toBeCloseTo(4e-3, 15);
    expect(polylineMinGap(Number.NaN)).toBe(POLYLINE_MIN_GAP);
    expect(modelWidth(makeDoc().regions)).toBe(60);
  });
  it('el contraejemplo: [[0,0],[1e6,0],[2e6,0]], vértice 1 hacia [0,0], deja una separación ≥ 1e-9·ancho', () => {
    const pts: Point[] = [[0, 0], [1e6, 0], [2e6, 0]];
    const r = movePolylineVertex(pts, 1, [0, 0], polylineMinGap(2e6));
    expect(r!.points[1]![0] - 0).toBeGreaterThanOrEqual(1e-9 * 2e6);
    expect(r!.clamped).toBe(true);
  });
});

describe('teclado', () => {
  it('Insert no cabe si el tramo mide menos que el doble del paso mínimo escalado', () => {
    // ancho 6e6 → paso mínimo 0,012: un tramo de 0,02 no admite un punto entre medias (cabrían dos de 0,01 < 0,012).
    const doc = wide(1e5, [[1e6, 5], [1e6 + 0.02, 5]]);
    const state = makeState(doc, { selection: { kind: 'surface_vertex', index: 0 } });
    const r = keyActions(state, key('Insert'));
    expect(r.handled).toBe(true);
    expect(r.actions).toEqual([]);
    expect(r.announce).toMatch(/demasiado corto/);
  });
  it('mover un vértice con flecha no baja del paso mínimo escalado a su vecino', () => {
    const doc = wide(1e5, [[1e6, 5], [1e6 + 0.5, 5], [1e6 + 100, 5]]);
    const state = makeState(doc, { selection: { kind: 'surface_vertex', index: 1 }, snap: { vertex: false, axis: false, gridStep: 1, radiusPx: 10 } });
    // Shift+← mueve en pasos grandes: tras varios, la x no pasa de la del vecino + paso mínimo.
    let d = doc;
    for (let i = 0; i < 4; i += 1) {
      const r = keyActions({ ...state, doc: d }, key('ArrowLeft', { shiftKey: true }));
      const act = r.actions.find((a) => a.type === 'surface/set');
      if (act && act.type === 'surface/set' && act.surface?.type === 'polyline') d = { ...d, analysis: { ...d.analysis, surface: act.surface } };
    }
    const s = d.analysis.surface;
    const pts = s && s.type === 'polyline' ? s.points : [];
    expect(pts[1]![0] - pts[0]![0]).toBeGreaterThanOrEqual(1e-9 * 6e6);
  });
});

describe('lienzo', () => {
  it('arrastrar un vértice junto a su vecino deja la separación mínima escalada', () => {
    const k = 1e5;
    const doc = wide(k, [[1e6, 5], [2e6, 5], [3e6, 5]]);
    const store = createFakeStore(doc);
    let st: GestureState = IDLE;
    const run = (r: ReturnType<typeof pointerDown>): void => {
      st = r.state;
      runActions(store, r.actions);
    };
    // viewport de prueba: la escala es 10 px/m, así que el vértice (2e6, 5) queda muy lejos de la pantalla; se arrastra por mundo con un vp acorde.
    const vp = { scale: 1e-5, tx: 0, ty: 300, width: 800, height: 600 };
    const ui = { ...store.getState().ui, viewport: vp, tool: 'select' as const };
    const ctx = { doc, ui };
    const px = (x: number, y: number): [number, number] => [vp.tx + vp.scale * x, vp.ty - vp.scale * y];
    const [sx, sy] = px(2e6, 5);
    run(pointerDown(st, ctx, { x: sx, y: sy, button: 0 }));
    const [tx, ty] = px(1e6 + 1e-6, 5);
    run(pointerMove(st, ctx, { x: tx, y: ty, button: 0 }));
    const moving = st.mode === 'drag' ? st.preview : null;
    expect(moving && moving.kind === 'surface_polyline').toBe(true);
    if (moving && moving.kind === 'surface_polyline') expect(moving.points[1]![0] - 1e6).toBeGreaterThanOrEqual(1e-9 * 6e6);
    void toPx;
    void pointerUp;
  });
});
