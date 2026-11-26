import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import { createFakeStore, makeState, toPx, VP, type FakeStore } from './fakeStore';
import { EMPTY_DRAFT, type DrawDraft } from './draw';
import {
  IDLE,
  applyPreview,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  runActions,
  type GestureResult,
  type GestureState,
  type PointerInput,
} from './gesture';
import { handleKey, handleList, handleSelection, handleWorldPoint, selectionHandle, stepHandle } from './handles';
import { hitTest } from './hitTest';
import { keyActions, type KeyInput } from './keys';
import { ALL_TYPES, ANCHOR, GEO, NAIL, PILE, SHEET, docWith } from './reinforcementFixtures';
import { isTraceTool } from './trace';
import { constrainReinforceDraft, reinforceClick, reinforceKey, reinforcePlace } from './reinforce';

const list = (store: FakeStore): Reinforcement[] => store.getState().doc.reinforcements ?? [];
const px = (x: number, y: number): [number, number] => toPx(x, y);

function driver(store: FakeStore) {
  let st: GestureState = IDLE;
  const run = (r: GestureResult): GestureResult => {
    st = r.state;
    runActions(store, r.actions);
    return r;
  };
  const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({ x, y, button: 0, ...extra });
  return {
    down: (x: number, y: number, extra?: Partial<PointerInput>) => run(pointerDown(st, store.getState(), at(x, y, extra))),
    move: (x: number, y: number) => run(pointerMove(st, store.getState(), at(x, y))),
    up: (x: number, y: number) => run(pointerUp(st, store.getState(), at(x, y))),
    cancel: () => run(pointerCancel(st)),
    get state() {
      return st;
    },
  };
}

const upserts = (store: FakeStore): number => store.log.filter((l) => l === 'reinforcement/upsert').length;

describe('tiradores de los refuerzos', () => {
  const doc = docWith(ANCHOR, SHEET);

  it('cada refuerzo aporta cabeza, punta y centro, tras los de la superficie, en un orden estable', () => {
    const keys = handleList(doc).map(handleKey).filter((k) => k.startsWith('r-'));
    expect(keys).toEqual(['r-0-1', 'r-0-2', 'r-0-c', 'r-1-1', 'r-1-2', 'r-1-c']);
  });

  it('la selección ↔ tirador es biyectiva: extremo → reinforcement_end y centro → reinforcement', () => {
    for (const h of handleList(doc).filter((x) => handleKey(x).startsWith('r-'))) {
      expect(selectionHandle(handleSelection(h))).toEqual(h);
    }
    expect(handleSelection({ kind: 'reinforcement_center', index: 3 })).toEqual({ kind: 'reinforcement', index: 3 });
  });

  it('la posición de cada tirador sale del refuerzo', () => {
    expect(handleWorldPoint(doc, { kind: 'reinforcement_end', index: 0, end: 2 })).toEqual([15, 12]);
    expect(handleWorldPoint(doc, { kind: 'reinforcement_center', index: 1 })).toEqual([50, 5.5]);
    expect(handleWorldPoint(docWith(), { kind: 'reinforcement_center', index: 0 })).toBeNull();
  });

  it('[ y ] recorren los tiradores de refuerzo con la vuelta', () => {
    const l = handleList(doc);
    const last = l[l.length - 1];
    expect(stepHandle(l, last, 1, true)).toEqual(l[0]);
    expect(stepHandle(l, { kind: 'reinforcement_end', index: 0, end: 1 }, 1, true)).toEqual({ kind: 'reinforcement_end', index: 0, end: 2 });
  });
});

describe('prueba de impacto', () => {
  const doc = docWith(ANCHOR, SHEET);
  const hit = (x: number, y: number, r = 12) => {
    const [sx, sy] = px(x, y);
    return hitTest(doc, VP, sx, sy, r);
  };

  it('acierta cabeza, punta y centro', () => {
    expect(hit(30, 15)).toMatchObject({ kind: 'reinforcement_end', index: 0, end: 1 });
    expect(hit(15, 12)).toMatchObject({ kind: 'reinforcement_end', index: 0, end: 2 });
    expect(hit(22.5, 13.5)).toMatchObject({ kind: 'reinforcement_center', index: 0 });
    expect(hit(50, 1)).toMatchObject({ kind: 'reinforcement_end', index: 1, end: 2 });
  });

  it('el cuerpo del segmento selecciona el refuerzo (no el centro ni la región)', () => {
    expect(hit(26.2, 14.4, 6)).toMatchObject({ kind: 'reinforcement', index: 0 });
    expect(hit(50, 8, 6)).toMatchObject({ kind: 'reinforcement', index: 1 });
  });

  it('el extremo gana al centro cuando el segmento es corto', () => {
    const short = docWith({ ...ANCHOR, x1: 30, y1: 15, x2: 29, y2: 15 } as Reinforcement);
    const [sx, sy] = px(30, 15);
    expect(hitTest(short, VP, sx, sy, 16)).toMatchObject({ kind: 'reinforcement_end', end: 1 });
  });
});

describe('arrastrar un extremo con el puntero', () => {
  it('un gesto = un comando reinforcement/upsert = una entrada de historial', () => {
    const store = createFakeStore(docWith(ANCHOR, SHEET));
    const d = driver(store);
    const [sx, sy] = px(15, 12);
    const [tx, ty] = px(13, 9);
    d.down(sx, sy);
    expect(store.getState().ui.selection).toEqual({ kind: 'reinforcement_end', index: 0, end: 2 });
    d.move((sx + tx) / 2, (sy + ty) / 2);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(upserts(store)).toBe(1);
    expect(store.past).toHaveLength(1);
    expect(list(store)[0]).toMatchObject({ x1: 30, y1: 15, x2: 13, y2: 9 });
    store.undo();
    expect(list(store)[0]).toMatchObject({ x2: 15, y2: 12 });
  });

  it('el comando lleva el índice y el refuerzo completo', () => {
    const store = createFakeStore(docWith(ANCHOR, NAIL));
    const dispatched: unknown[] = [];
    const orig = store.dispatch.bind(store);
    store.dispatch = (a) => {
      dispatched.push(a);
      orig(a);
    };
    const d = driver(store);
    const [sx, sy] = px(10, 14);
    const [tx, ty] = px(8, 15);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    const cmd = dispatched.find((a) => (a as { type: string }).type === 'reinforcement/upsert') as { index: number; reinforcement: Reinforcement };
    expect(cmd.index).toBe(1);
    expect(cmd.reinforcement).toMatchObject({ id: 'clavo-1', type: 'nail', x1: 25, y1: 17.5, x2: 8, y2: 15, pullout: { model: 'bond', strength: 30 } });
  });

  it('la tablestaca mantiene la x aunque el puntero se desvíe en x', () => {
    const store = createFakeStore(docWith(SHEET));
    const d = driver(store);
    const [sx, sy] = px(50, 1);
    const [tx, ty] = px(58, -4);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(list(store)[0]).toMatchObject({ x1: 50, x2: 50, y1: 10 });
    expect(list(store)[0].y2).toBeCloseTo(-4, 1);
  });

  it('un extremo que cae sobre el otro no cambia nada y no ensucia el historial', () => {
    const store = createFakeStore(docWith(ANCHOR));
    const d = driver(store);
    const [sx, sy] = px(15, 12);
    const [tx, ty] = px(30, 15);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(upserts(store)).toBe(0);
    expect(store.past).toHaveLength(0);
    expect(list(store)[0]).toMatchObject({ x2: 15, y2: 12 });
  });

  it('Escape (pointercancel) a mitad del gesto deja el refuerzo como estaba', () => {
    const store = createFakeStore(docWith(ANCHOR));
    const d = driver(store);
    const [sx, sy] = px(15, 12);
    d.down(sx, sy);
    d.move(sx + 40, sy + 40);
    d.cancel();
    expect(list(store)[0]).toMatchObject({ x2: 15, y2: 12 });
    expect(store.past).toHaveLength(0);
  });

  it('la vista previa mueve el refuerzo sin tocar el documento', () => {
    const store = createFakeStore(docWith(ANCHOR));
    const d = driver(store);
    const [sx, sy] = px(15, 12);
    const [tx, ty] = px(10, 12);
    d.down(sx, sy);
    const r = d.move(tx, ty);
    expect(r.state.mode).toBe('drag');
    if (r.state.mode !== 'drag') return;
    const shown = applyPreview(store.getState().doc, r.state.preview);
    expect(shown.reinforcements?.[0].x2).toBeCloseTo(10, 1);
    expect(store.getState().doc.reinforcements?.[0].x2).toBe(15);
  });

  it('con el dedo (toque) el tirador se acierta con el radio de 22 px', () => {
    const store = createFakeStore(docWith(ANCHOR));
    const d = driver(store);
    const [sx, sy] = px(15, 12);
    d.down(sx + 20, sy, { pointerType: 'touch' });
    expect(store.getState().ui.selection).toEqual({ kind: 'reinforcement_end', index: 0, end: 2 });
  });
});

describe('arrastrar el centro', () => {
  it('mueve los dos extremos con el mismo desplazamiento en UN solo paso', () => {
    const store = createFakeStore(docWith(ANCHOR, SHEET));
    const d = driver(store);
    const [sx, sy] = px(22.5, 13.5);
    const [tx, ty] = px(24.5, 11.5);
    d.down(sx, sy);
    expect(store.getState().ui.selection).toEqual({ kind: 'reinforcement', index: 0 });
    d.move((sx + tx) / 2, (sy + ty) / 2);
    d.move(tx, ty);
    d.up(tx, ty);
    expect(upserts(store)).toBe(1);
    expect(store.past).toHaveLength(1);
    const r = list(store)[0];
    expect(r.x1 - 30).toBeCloseTo(r.x2 - 15, 9);
    expect(r.y1 - 15).toBeCloseTo(r.y2 - 12, 9);
    expect(r.x1).toBeCloseTo(32, 1);
    expect(r.y1).toBeCloseTo(13, 1);
    store.undo();
    expect(list(store)[0]).toMatchObject({ x1: 30, y1: 15, x2: 15, y2: 12 });
  });

  it('la tablestaca sigue vertical al moverla', () => {
    const store = createFakeStore(docWith(SHEET));
    const d = driver(store);
    const [sx, sy] = px(50, 5.5);
    const [tx, ty] = px(53, 4.5);
    d.down(sx, sy);
    d.move(tx, ty);
    d.up(tx, ty);
    const r = list(store)[0];
    expect(r.x1).toBe(r.x2);
    expect(r.x1).toBeCloseTo(53, 1);
    expect(r.y1 - r.y2).toBeCloseTo(9, 9);
  });

  it('un clic sin mover solo selecciona', () => {
    const store = createFakeStore(docWith(ANCHOR));
    const d = driver(store);
    const [sx, sy] = px(22.5, 13.5);
    d.down(sx, sy);
    d.up(sx, sy);
    expect(upserts(store)).toBe(0);
    expect(store.past).toHaveLength(0);
    expect(store.getState().ui.selection).toEqual({ kind: 'reinforcement', index: 0 });
  });
});

describe('teclado', () => {
  const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
  const ctxOf = (selection: Parameters<typeof makeState>[1] extends infer U ? NonNullable<U> extends { selection?: infer S } ? S : never : never, ...list: Reinforcement[]) =>
    makeState(docWith(...list), { selection });

  it('las flechas mueven el extremo seleccionado 0,1 m (Mayús ×10) con un solo comando', () => {
    const ctx = ctxOf({ kind: 'reinforcement_end', index: 0, end: 2 }, ANCHOR);
    const r = keyActions(ctx, key('ArrowRight'), false, { units: 'SI' });
    expect(r.handled).toBe(true);
    const cmd = r.actions.find((a) => a.type === 'reinforcement/upsert') as { index: number; reinforcement: Reinforcement };
    expect(cmd.index).toBe(0);
    expect(cmd.reinforcement).toMatchObject({ x1: 30, y1: 15, x2: 15.1, y2: 12 });
    expect(r.announce).toBe('Punta del refuerzo 1 (Anclaje): x 15,1 m, y 12,0 m');
    const big = keyActions(ctx, key('ArrowUp', { shiftKey: true }), false, { units: 'SI' });
    expect((big.actions.find((a) => a.type === 'reinforcement/upsert') as { reinforcement: Reinforcement }).reinforcement.y2).toBe(13);
  });

  it('en la tablestaca izquierda y derecha no hacen nada y lo dicen; arriba y abajo sí', () => {
    const ctx = ctxOf({ kind: 'reinforcement_end', index: 0, end: 1 }, SHEET);
    const lr = keyActions(ctx, key('ArrowLeft'), false, { units: 'SI' });
    expect(lr.handled).toBe(true);
    expect(lr.actions).toEqual([]);
    expect(lr.announce).toContain('x es fija');
    const ud = keyActions(ctx, key('ArrowDown'), false, { units: 'SI' });
    expect((ud.actions[0] as { reinforcement: Reinforcement }).reinforcement).toMatchObject({ x1: 50, x2: 50, y1: 9.9 });
  });

  it('un extremo no puede caer sobre el otro con el teclado', () => {
    const tiny = { ...ANCHOR, x2: 30.05, y2: 15 } as Reinforcement;
    const ctx = ctxOf({ kind: 'reinforcement_end', index: 0, end: 2 }, tiny);
    const r = keyActions(ctx, key('ArrowLeft'), false, { units: 'SI' });
    // 30,05 − 0,1 = 29,95: sigue habiendo longitud, así que se mueve; para llegar a la cabeza hace falta 0,05
    expect(r.actions).toHaveLength(1);
    const ctx2 = makeState(docWith(tiny), { selection: { kind: 'reinforcement_end', index: 0, end: 2 }, snap: { vertex: true, axis: true, gridStep: 0.05, radiusPx: 10 } });
    const r2 = keyActions(ctx2, key('ArrowLeft'), false, { units: 'SI' });
    expect(r2.actions).toEqual([]);
    expect(r2.announce).toContain('sin longitud');
  });

  it('con el centro seleccionado las flechas mueven el refuerzo entero', () => {
    const ctx = ctxOf({ kind: 'reinforcement', index: 0 }, SHEET);
    const r = keyActions(ctx, key('ArrowRight'), false, { units: 'SI' });
    const moved = (r.actions[0] as { reinforcement: Reinforcement }).reinforcement;
    expect(moved).toMatchObject({ x1: 50.1, x2: 50.1, y1: 10, y2: 1 });
    expect(r.announce).toContain('Refuerzo 1 (Tablestaca) movido');
  });

  it('Supr elimina el refuerzo y el foco pasa al anterior', () => {
    const ctx = ctxOf({ kind: 'reinforcement_end', index: 1, end: 1 }, ANCHOR, NAIL);
    const r = keyActions(ctx, key('Delete'), false, { units: 'SI' });
    expect(r.actions[0]).toEqual({ type: 'reinforcement/remove', index: 1 });
    expect(r.focus).toEqual({ kind: 'reinforcement_center', index: 0 });
    expect(r.announce).toBe('Refuerzo 2 (Clavo) eliminado.');
    const first = keyActions(ctxOf({ kind: 'reinforcement', index: 0 }, ANCHOR), key('Backspace'), false, { units: 'SI' });
    expect(first.actions[1]).toEqual({ type: 'ui/select', selection: { kind: 'none' } });
    expect(first.focus).toBeUndefined();
  });

  it('el borrado en el almacén es un solo paso deshacible', () => {
    const store = createFakeStore(docWith(ANCHOR, NAIL), { selection: { kind: 'reinforcement', index: 1 } });
    const r = keyActions(store.getState(), key('Delete'), false, { units: 'SI' });
    runActions(store, r.actions);
    expect(list(store).map((x) => x.id)).toEqual(['anclaje-1']);
    store.undo();
    expect(list(store).map((x) => x.id)).toEqual(['anclaje-1', 'clavo-1']);
  });
});

describe('herramienta «Dibujar refuerzo»', () => {
  const ctx = () => makeState(docWith(), { tool: 'draw_reinforcement' });
  const click = (type: Parameters<typeof reinforceClick>[0], draft: DrawDraft, x: number, y: number, c = ctx()) => {
    const [sx, sy] = px(x, y);
    return reinforceClick(type, draft, c, { x: sx, y: sy, button: 0 });
  };

  it('es una herramienta de trazo (autodesplazamiento, descarte al cambiar de herramienta)', () => {
    expect(isTraceTool('draw_reinforcement')).toBe(true);
  });

  it('dos clics crean UN comando, seleccionan el refuerzo y vuelven a «Seleccionar»', () => {
    const first = click('anchor', EMPTY_DRAFT, 30.3, 7.7);
    expect(first.actions).toEqual([]);
    expect(first.draft.points).toHaveLength(1);
    expect(first.announce).toContain('Cabeza colocada');
    const second = click('anchor', first.draft, 15.1, 12.2);
    expect(second.actions.map((a) => a.type)).toEqual(['reinforcement/upsert', 'ui/select', 'ui/tool']);
    const cmd = second.actions[0] as { index: number | null; reinforcement: Reinforcement };
    expect(cmd.index).toBeNull();
    expect(cmd.reinforcement).toMatchObject({ id: 'a1', type: 'anchor', application: 'active', direction: 'axial' });
    expect(second.actions[1]).toEqual({ type: 'ui/select', selection: { kind: 'reinforcement', index: 0 } });
    expect(second.actions[2]).toEqual({ type: 'ui/tool', tool: 'select' });
    expect(second.draft).toEqual(EMPTY_DRAFT);
    expect(second.announce).toContain('Refuerzo 1 (Anclaje) creado');
  });

  it('el flujo completo en el almacén cuesta un solo Ctrl+Z', () => {
    const store = createFakeStore(docWith(ANCHOR), { tool: 'draw_reinforcement' });
    const a = click('nail', EMPTY_DRAFT, 25, 17.5, store.getState());
    const b = click('nail', a.draft, 10, 14, store.getState());
    runActions(store, b.actions);
    expect(list(store).map((r) => r.id)).toEqual(['anclaje-1', 'n1']); // R11B-07: el id del lienzo sigue la numeración del panel (a1, n1…)
    expect(store.getState().ui.selection).toEqual({ kind: 'reinforcement', index: 1 });
    expect(store.getState().ui.tool).toBe('select');
    expect(store.past).toHaveLength(1);
    store.undo();
    expect(list(store).map((r) => r.id)).toEqual(['anclaje-1']);
  });

  it('la tablestaca toma la x de la cabeza en la punta', () => {
    const a = click('sheet_pile', EMPTY_DRAFT, 50, 10);
    const b = click('sheet_pile', a.draft, 57, 2);
    const r = (b.actions[0] as { reinforcement: Reinforcement }).reinforcement;
    expect(r).toMatchObject({ type: 'sheet_pile', x1: 50, x2: 50, y1: 10 });
    expect(r.y2).toBeCloseTo(2, 1);
  });

  it('con una tablestaca el cursor de la punta conserva la x de la cabeza', () => {
    const draft: DrawDraft = { points: [[50, 10]], cursor: [57, 3], pending: false, snapKind: 'none' };
    expect(constrainReinforceDraft('draw_reinforcement', 'sheet_pile', draft).cursor).toEqual([50, 3]);
    expect(constrainReinforceDraft('draw_reinforcement', 'anchor', draft)).toBe(draft);
    expect(constrainReinforceDraft('draw_region', 'sheet_pile', draft)).toBe(draft);
  });

  it('la punta no puede coincidir con la cabeza', () => {
    const a = reinforcePlace('anchor', EMPTY_DRAFT, ctx(), [30, 15]);
    const b = reinforcePlace('anchor', a.draft, ctx(), [30, 15]);
    expect(b.error).toContain('coincide con la cabeza');
    expect(b.actions).toEqual([]);
    expect(b.draft.points).toHaveLength(1);
    // tablestaca: x se fija, y igual → misma cabeza
    expect(reinforcePlace('sheet_pile', a.draft, ctx(), [44, 15]).error).toContain('coincide');
  });

  it('el id sigue la numeración del tipo y no repite', () => {
    const c = makeState(docWith(ANCHOR), { tool: 'draw_reinforcement' });
    const a = reinforcePlace('anchor', EMPTY_DRAFT, c, [30, 15]);
    const b = reinforcePlace('anchor', a.draft, c, [20, 12]);
    expect((b.actions[0] as { reinforcement: Reinforcement }).reinforcement.id).toBe('a1');
    expect(b.actions[1]).toEqual({ type: 'ui/select', selection: { kind: 'reinforcement', index: 1 } });
  });

  it('cada tipo se puede dibujar', () => {
    for (const type of ALL_TYPES.map((r) => r.type)) {
      const a = reinforcePlace(type, EMPTY_DRAFT, ctx(), [30, 15]);
      const b = reinforcePlace(type, a.draft, ctx(), [20, 5]);
      expect((b.actions[0] as { reinforcement: Reinforcement }).reinforcement.type).toBe(type);
    }
  });

  it('teclado: flechas y Espacio colocan la cabeza y la punta; Intro también; Retroceso quita; Esc cancela', () => {
    const c = makeState(docWith(), { tool: 'draw_reinforcement', snap: { vertex: false, axis: false, gridStep: 1, radiusPx: 10 } });
    const k = (key: string): Parameters<typeof reinforceKey>[3] => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
    let draft: DrawDraft = EMPTY_DRAFT;
    const press = (key: string) => {
      const r = reinforceKey('anchor', draft, c, k(key));
      expect(r.handled).toBe(true);
      draft = r.step.draft;
      return r.step;
    };
    press('ArrowRight');
    press(' ');
    expect(draft.points).toHaveLength(1);
    press('Backspace');
    expect(draft.points).toHaveLength(0);
    press('ArrowRight');
    press(' ');
    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    const done = press('Enter');
    expect(done.actions[0]).toMatchObject({ type: 'reinforcement/upsert', index: null });
    // Esc con un punto cancela; con ninguno, vuelve a «Seleccionar».
    draft = EMPTY_DRAFT;
    press('ArrowRight');
    press(' ');
    expect(press('Escape').announce).toContain('cancelado');
    expect(press('Escape').actions).toEqual([{ type: 'ui/tool', tool: 'select' }]);
  });

  it('un toque sobre un tirador existente no lo arrastra: la herramienta solo suelta puntos', () => {
    // pointerDown de la máquina de arrastre no se usa con herramientas de trazo (EditorCanvas lo desvía); aquí basta con que isTraceTool lo diga.
    expect(isTraceTool('draw_reinforcement')).toBe(true);
    expect(isTraceTool('select')).toBe(false);
  });
});

describe('todos los tipos conviven en el modelo', () => {
  it('la lista de tiradores cubre cinco refuerzos', () => {
    const doc = docWith(...ALL_TYPES);
    expect(handleList(doc).filter((h) => h.kind === 'reinforcement_center')).toHaveLength(5);
    void PILE;
    void GEO;
  });
});
