// Trazo en curso («Dibujar región» / «Dividir región»): qué pasa con él al cargar otro modelo (R8 A-01) y al cambiar de herramienta (A-04, B-08).
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { createEditorStore } from '../state';
import type { ModelDoc } from '../types';
import { EMPTY_DRAFT, drawClick, drawKey, type DrawDraft, type DrawKeyInput } from './draw';
import { makeDoc, makeState, toPx } from './fakeStore';
import { runActions } from './gesture';
import { TRACE_CONFIRM_MIN_POINTS, traceOnDocChange, traceOnToolChange, traceToolSwitchNeedsConfirm } from './trace';

const emptyDoc = (): ModelDoc => ({ ...makeDoc(), regions: [], water: null, analysis: { methods: ['bishop'] } });
const enter: DrawKeyInput = { key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
const draftOf = (...points: Point[]): DrawDraft => ({ ...EMPTY_DRAFT, points });
const click = (x: number, y: number) => ({ x: toPx(x, y)[0], y: toPx(x, y)[1], button: 0, pointerType: 'mouse' });

describe('A-01: cargar otro documento descarta el trazo', () => {
  it('con 2 puntos colocados, «Nuevo» y luego Intro no crean ninguna región', () => {
    const store = createEditorStore(emptyDoc(), null);
    store.dispatch({ type: 'ui/viewport', viewport: makeState().ui.viewport });
    store.dispatch({ type: 'ui/tool', tool: 'draw_region' });
    const ctx = () => store.getState();
    let draft = EMPTY_DRAFT;
    for (const [x, y] of [[5, 5], [25, 5]] as const) draft = drawClick(draft, ctx(), click(x, y)).draft;
    expect(draft.points).toHaveLength(2);

    const epoch = store.getState().docEpoch;
    store.dispatch({ type: 'doc/load', doc: emptyDoc(), fileName: null }); // «Nuevo»
    expect(store.getState().docEpoch).toBe(epoch + 1);

    // El lienzo observa el cambio de época y aplica esta regla antes de la siguiente tecla.
    const after = traceOnDocChange(draft);
    draft = after.draft;
    const step = drawKey(draft, ctx(), enter);
    runActions(store, step.step.actions);
    expect(store.getState().doc.regions).toHaveLength(0);
    expect(draft.points).toHaveLength(0);
  });

  it('sin la regla, el trazo del modelo anterior sí llegaría al nuevo (el defecto que se corrige)', () => {
    const store = createEditorStore(emptyDoc(), null);
    store.dispatch({ type: 'ui/viewport', viewport: makeState().ui.viewport });
    let draft = draftOf([0, 0], [20, 0], [20, 10]);
    store.dispatch({ type: 'doc/load', doc: emptyDoc(), fileName: null });
    runActions(store, drawKey(draft, store.getState(), enter).step.actions);
    expect(store.getState().doc.regions).toHaveLength(1); // trazo viejo dentro del modelo nuevo
    draft = traceOnDocChange(draftOf([0, 0], [20, 0], [20, 10])).draft;
    expect(draft.points).toEqual([]);
  });

  it('anuncia cuántos puntos se descartaron; sin puntos no dice nada', () => {
    expect(traceOnDocChange(draftOf([0, 0], [1, 1])).announce).toMatch(/Se descartó el trazo en curso \(2 puntos\).*otro modelo/);
    expect(traceOnDocChange(draftOf([0, 0])).announce).toMatch(/\(1 punto\)/);
    expect(traceOnDocChange(EMPTY_DRAFT).announce).toBeNull();
    expect(traceOnDocChange({ ...EMPTY_DRAFT, cursor: [1, 1] }).draft).toBe(EMPTY_DRAFT);
  });

  it('doc/load y doc/replace suben la época; un cambio normal no', () => {
    const store = createEditorStore(makeDoc(), null);
    expect(store.getState().docEpoch).toBe(0);
    store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: 0, to: [1, 1] });
    expect(store.getState().docEpoch).toBe(0);
    store.dispatch({ type: 'doc/replace', doc: makeDoc(), fileName: null });
    expect(store.getState().docEpoch).toBe(1);
    store.dispatch({ type: 'doc/load', doc: makeDoc(), fileName: 'a' });
    expect(store.getState().docEpoch).toBe(2);
  });

  it('doc/load pone a 0 el recuento de puntos del trazo', () => {
    const store = createEditorStore(makeDoc(), null);
    store.dispatch({ type: 'ui/trace', points: 4 });
    expect(store.getState().ui.tracePoints).toBe(4);
    store.dispatch({ type: 'doc/load', doc: makeDoc(), fileName: null });
    expect(store.getState().ui.tracePoints).toBe(0);
  });
});

describe('A-04 y B-08: cambiar de herramienta con un trazo en curso', () => {
  it('con 1 o 2 puntos se descarta y se anuncia; con 3 o más se pide confirmación', () => {
    expect(TRACE_CONFIRM_MIN_POINTS).toBe(3);
    expect(traceToolSwitchNeedsConfirm(2, 'draw_region', 'select')).toBe(false);
    expect(traceToolSwitchNeedsConfirm(3, 'draw_region', 'select')).toBe(true);
    expect(traceToolSwitchNeedsConfirm(5, 'split_region', 'draw_region')).toBe(true);
    expect(traceToolSwitchNeedsConfirm(5, 'draw_region', 'draw_region')).toBe(false); // misma herramienta: nada que descartar
    expect(traceToolSwitchNeedsConfirm(5, 'select', 'draw_region')).toBe(false); // no había trazo
  });
  it('el trazo descartado se anuncia con el número de puntos y la herramienta de destino', () => {
    const r = traceOnToolChange(draftOf([0, 0], [1, 1]), 'draw_region', 'select');
    expect(r.draft).toBe(EMPTY_DRAFT);
    expect(r.announce).toMatch(/Se descartó el trazo en curso \(2 puntos\)/);
  });
  it('sin puntos no anuncia; entrar a una herramienta de trazo no descarta nada', () => {
    expect(traceOnToolChange(EMPTY_DRAFT, 'draw_region', 'select').announce).toBeNull();
    const d = draftOf([0, 0]);
    expect(traceOnToolChange(d, 'select', 'draw_region').draft).toBe(d);
  });
});
