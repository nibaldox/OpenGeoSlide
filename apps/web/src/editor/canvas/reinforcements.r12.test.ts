// R12 / W2: Ito-Matsui en el lienzo (E15l-21 a E15l-23). Un pilote con `lateral_pressure` es vertical como la tablestaca.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { validateLocal } from '../state/validateLocal';
import { createFakeStore, makeState, toPx, type FakeStore } from './fakeStore';
import { IDLE, pointerDown, pointerMove, pointerUp, runActions, type GestureResult, type GestureState, type PointerInput } from './gesture';
import { keyActions, type KeyInput } from './keys';
import { PILE, SHEET, asReinforcement, docWith } from './reinforcementFixtures';
import { isVerticalReinforcement, moveBody, moveEnd } from './reinforcements';

/** Pilote Ito-Matsui vertical: cabeza (45, 10), punta (45, 2). */
const IM_PILE: Reinforcement = asReinforcement({
  id: 'pilote-im', type: 'pile', x1: 45, y1: 10, x2: 45, y2: 2, application: 'passive', direction: 'angle', angle: 0, spacing: 2.4,
  lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'centroid' },
});

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
const list = (store: FakeStore): Reinforcement[] => store.getState().doc.reinforcements ?? [];

describe('E15l-21: isVerticalReinforcement', () => {
  it('es verdadero para la tablestaca y para el pilote con lateral_pressure; falso para el resto', () => {
    expect(isVerticalReinforcement(SHEET)).toBe(true);
    expect(isVerticalReinforcement(IM_PILE)).toBe(true);
    expect(isVerticalReinforcement(PILE)).toBe(false); // pilote con `force`
    expect(isVerticalReinforcement({ ...PILE, lateral_pressure: null } as Reinforcement)).toBe(false);
  });
});

describe('E15l-21: moveEnd con un pilote Ito-Matsui', () => {
  it('conserva la x del extremo (B-05): antes salía x2 = 23 y el modelo quedaba bloqueado', () => {
    const moved = moveEnd(IM_PILE, 2, [47, 1]);
    expect(moved).toMatchObject({ x1: 45, x2: 45, y2: 1 });
    expect(moveEnd(IM_PILE, 1, [40, 12])).toMatchObject({ x1: 45, x2: 45, y1: 12 });
  });

  it('el modelo sigue válido tras moverlo (sin editor.reinforcement_pile_vertical)', () => {
    const moved = moveEnd(IM_PILE, 2, [47, 1])!;
    const doc = { ...docWith(moved), version: '0.5' as const };
    expect(validateLocal(doc).filter((i) => i.code === 'editor.reinforcement_pile_vertical')).toEqual([]);
  });

  it('el pilote con force sigue inclinándose (la regla es solo para Ito-Matsui)', () => {
    expect(moveEnd(PILE, 2, [47, 1])).toMatchObject({ x1: 45, x2: 47, y2: 1 });
  });

  it('el centro desplaza los dos extremos y conserva x1 = x2', () => {
    expect(moveBody(IM_PILE, 3, 0.5)).toMatchObject({ x1: 48, x2: 48, y1: 10.5, y2: 2.5 });
  });
});

describe('E15l-21: teclado', () => {
  const ctxOf = (end: 1 | 2) => makeState(docWith(IM_PILE), { selection: { kind: 'reinforcement_end', index: 0, end } });

  it('izquierda y derecha no inclinan el pilote: no hacen nada y lo dicen', () => {
    for (const k of ['ArrowLeft', 'ArrowRight']) {
      const r = keyActions(ctxOf(2), key(k), false, { units: 'SI' });
      expect(r.handled).toBe(true);
      expect(r.actions).toEqual([]);
      expect(r.announce).toContain('vertical');
    }
  });

  it('arriba y abajo sí mueven el extremo y conservan x1 = x2', () => {
    const r = keyActions(ctxOf(2), key('ArrowDown'), false, { units: 'SI' });
    const cmd = r.actions.find((a) => a.type === 'reinforcement/upsert') as { reinforcement: Reinforcement };
    expect(cmd.reinforcement).toMatchObject({ x1: 45, x2: 45, y2: 1.9 });
  });

  it('la tablestaca conserva su mensaje', () => {
    const ctx = makeState(docWith(SHEET), { selection: { kind: 'reinforcement_end', index: 0, end: 1 } });
    expect(keyActions(ctx, key('ArrowLeft'), false, { units: 'SI' }).announce).toContain('x es fija');
  });
});

describe('E15l-21: arrastre con el puntero', () => {
  function drag(from: [number, number], to: [number, number]): FakeStore {
    const store = createFakeStore(docWith(IM_PILE));
    let st: GestureState = IDLE;
    const run = (r: GestureResult): void => {
      st = r.state;
      runActions(store, r.actions);
    };
    const at = (p: [number, number]): PointerInput => ({ x: p[0], y: p[1], button: 0 });
    const a = toPx(...from);
    const b = toPx(...to);
    run(pointerDown(st, store.getState(), at(a)));
    run(pointerMove(st, store.getState(), at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])));
    run(pointerMove(st, store.getState(), at(b)));
    run(pointerUp(st, store.getState(), at(b)));
    return store;
  }

  it('arrastrar la punta hacia un lado la deja vertical', () => {
    const store = drag([45, 2], [48, 1]);
    const r = list(store)[0]!;
    expect(r.x1).toBe(45);
    expect(r.x2).toBe(45);
    expect(r.y2).toBeCloseTo(1, 6);
  });
});
