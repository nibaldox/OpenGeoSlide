// CM-WB: reencuadre al cambiar la caja del modelo (X34 §3), con el store real y la caja del modelo como entrada.
import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../../state/store';
import { baseDoc } from '../../state/testFixtures';
import type { ModelDoc } from '../../types';
import { fitToDocInsets } from '../../canvas/viewportOps';
import { isLastAutoFit, modelBoundsKey } from './hudFit';
import { attachModelRefit, createModelRefitGate } from './modelRefit';
import { FIT_INSETS_DESKTOP } from './layout';

describe('createModelRefitGate', () => {
  const step = (key: string, busy = false, auto = true) => ({ key, busy, auto });
  it('la primera llamada solo fija la caja de partida', () => {
    const gate = createModelRefitGate();
    expect(gate(step('a'))).toBe(false);
    expect(gate(step('a'))).toBe(false);
  });
  it('reencuadra una vez por cambio de caja y solo si la vista sigue en el último encuadre automático', () => {
    const gate = createModelRefitGate();
    gate(step('a'));
    expect(gate(step('b'))).toBe(true);
    expect(gate(step('b'))).toBe(false); // sin bucle: la misma caja ya está atendida
    expect(gate(step('c', false, false))).toBe(false); // el usuario movió la vista: no se toca…
    expect(gate(step('c', false, true))).toBe(false); // …y esa caja queda atendida, no pendiente
    expect(gate(step('d'))).toBe(true);
  });
  it('durante un gesto deja la caja pendiente y la atiende al soltar', () => {
    const gate = createModelRefitGate();
    gate(step('a'));
    expect(gate(step('b', true))).toBe(false);
    expect(gate(step('c', true))).toBe(false);
    expect(gate(step('c', false))).toBe(true);
    expect(gate(step('c', false))).toBe(false);
  });
  it('si la caja vuelve a la de partida durante el gesto no hay nada que reencuadrar', () => {
    const gate = createModelRefitGate();
    gate(step('a'));
    expect(gate(step('b', true))).toBe(false);
    expect(gate(step('a', false))).toBe(false);
  });
});

/** Cota superior del polígono de la región 0 (la cresta) y el índice de su primer vértice. */
function crest(doc: ModelDoc): { index: number; y: number } {
  const poly = doc.regions[0]!.polygon;
  let index = 0;
  poly.forEach((p, i) => {
    if (p[1] > poly[index]![1]) index = i;
  });
  return { index, y: poly[index]![1] };
}

/** Un lienzo simulado: el store real, un viewport que el «lienzo» fija con `autoFit` y la vista que mueve el usuario. */
function harness(doc: ModelDoc = baseDoc()) {
  const store = createEditorStore(doc);
  const size = { w: 640, h: 420 };
  let lastAuto = fitToDocInsets(store.getState().doc, size.w, size.h, FIT_INSETS_DESKTOP);
  store.dispatch({ type: 'ui/viewport', viewport: lastAuto });
  let busy = false;
  let refits = 0;
  const off = attachModelRefit(store, {
    isAuto: () => isLastAutoFit(store.getState().ui.viewport, lastAuto),
    refit: () => {
      const s = store.getState();
      refits += 1;
      lastAuto = fitToDocInsets(s.doc, size.w, size.h, FIT_INSETS_DESKTOP);
      store.dispatch({ type: 'ui/viewport', viewport: lastAuto });
    },
    isBusy: () => busy,
  });
  const raise = (dy: number): void => {
    const c = crest(store.getState().doc);
    const p = store.getState().doc.regions[0]!.polygon[c.index]!;
    store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: c.index, to: [p[0], c.y + dy] });
  };
  return { store, off, raise, refits: () => refits, lastAuto: () => lastAuto, setBusy: (b: boolean) => (busy = b), size };
}

describe('attachModelRefit con el store real', () => {
  it('subir la cresta 20 m y luego 30 m reencuadra una vez por edición y la vista queda en el encuadre del modelo nuevo', () => {
    const h = harness();
    const before = h.store.getState().ui.viewport!;
    h.raise(20);
    expect(h.refits()).toBe(1);
    const afterFit = fitToDocInsets(h.store.getState().doc, h.size.w, h.size.h, FIT_INSETS_DESKTOP);
    expect(h.store.getState().ui.viewport).toEqual(afterFit);
    expect(h.store.getState().ui.viewport!.scale).toBeLessThan(before.scale); // el modelo creció: la escala baja para que entre
    h.raise(30);
    expect(h.refits()).toBe(2);
    h.off();
  });

  it('sin bucles: nada más que un reencuadre por edición, aunque el store notifique muchas veces', () => {
    const h = harness();
    h.raise(20);
    for (let i = 0; i < 50; i += 1) h.store.dispatch({ type: 'ui/select', selection: { kind: 'none' } });
    h.store.dispatch({ type: 'ui/viewport', viewport: { ...h.store.getState().ui.viewport!, width: h.size.w } });
    expect(h.refits()).toBe(1);
  });

  it('mover un vértice interior (la caja no cambia) no reencuadra', () => {
    const h = harness();
    const doc = h.store.getState().doc;
    const box = modelBoundsKey(doc);
    // El vértice (10, 10) de la primera región es una esquina compartida: se mueve 1 m dentro de la caja.
    const idx = doc.regions[0]!.polygon.findIndex((p) => p[0] === 10 && p[1] === 10);
    h.store.dispatch({ type: 'vertex/move', regionIndex: 0, vertexIndex: idx, to: [9, 9] });
    expect(modelBoundsKey(h.store.getState().doc)).toBe(box);
    expect(h.refits()).toBe(0);
  });

  it('si el usuario hizo zoom o movió la vista, no se toca', () => {
    const h = harness();
    const v = h.store.getState().ui.viewport!;
    h.store.dispatch({ type: 'ui/viewport', viewport: { ...v, scale: v.scale * 1.5 } }); // zoom del usuario
    const moved = h.store.getState().ui.viewport;
    h.raise(20);
    expect(h.refits()).toBe(0);
    expect(h.store.getState().ui.viewport).toEqual(moved);
  });

  it('durante un arrastre no reencuadra; al soltar, sí (gesto del store)', () => {
    const h = harness();
    h.store.beginGesture('Mover vértice');
    h.raise(10);
    h.raise(20);
    h.raise(30);
    expect(h.refits()).toBe(0);
    h.store.endGesture();
    expect(h.refits()).toBe(1);
    expect(h.store.getState().ui.viewport).toEqual(fitToDocInsets(h.store.getState().doc, h.size.w, h.size.h, FIT_INSETS_DESKTOP));
  });

  it('durante un arrastre del lienzo (vista previa, `isBusy`) no reencuadra; al soltar, sí', () => {
    const h = harness();
    h.setBusy(true);
    h.raise(20);
    expect(h.refits()).toBe(0);
    h.setBusy(false);
    h.raise(10); // el documento cambia de nuevo al soltar: una sola atención por la caja pendiente
    expect(h.refits()).toBe(1);
  });

  it('un arrastre cancelado (el documento vuelve a la caja de partida) no reencuadra', () => {
    const h = harness();
    h.store.beginGesture('Mover vértice');
    h.raise(20);
    h.store.cancelGesture();
    expect(h.refits()).toBe(0);
  });

  it('deshacer una edición pequeña también reencuadra (la caja vuelve a cambiar); una grande la encuadra el historial (viewport nulo)', () => {
    const h = harness();
    h.raise(2);
    h.store.undo();
    expect(h.refits()).toBe(2);
    h.raise(40); // la caja cambia más de 2×: `undo` deja el viewport en null (R9-06) y el lienzo encuadra de nuevo por su cuenta
    expect(h.refits()).toBe(3);
    h.store.undo();
    expect(h.store.getState().ui.viewport).toBeNull();
    expect(h.refits()).toBe(3);
  });

  it('el primer polígono de un modelo sin regiones pasa de «nada que encuadrar» a una caja: se atiende una vez', () => {
    const h = harness({ ...baseDoc(), regions: [] });
    h.store.dispatch({ type: 'region/add', region: { material: 'm1', polygon: [[0, 0], [5, 0], [5, 5]] } });
    expect(h.refits()).toBe(1);
    h.store.dispatch({ type: 'ui/select', selection: { kind: 'none' } });
    expect(h.refits()).toBe(1);
  });

  it('el desmontaje quita la suscripción', () => {
    const h = harness();
    h.off();
    h.raise(20);
    expect(h.refits()).toBe(0);
  });
});
