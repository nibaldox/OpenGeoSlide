import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import {
  EMPTY_DRAFT,
  drawBackspace,
  drawCancel,
  drawClick,
  drawClose,
  drawHover,
  drawKey,
  drawPlace,
  pickMaterial,
  validateNewRegion,
  type DrawDraft,
  type DrawKeyInput,
} from './draw';
import { makeDoc, makeState, toPx, VP } from './fakeStore';
import type { CanvasAction } from './gesture';

const emptyDoc = (): ModelDoc => ({ ...makeDoc(), regions: [], water: null, analysis: { methods: ['bishop'] } });
const ctxOf = (doc: ModelDoc, ui = {}) => makeState(doc, ui);
const key = (k: string, over: Partial<DrawKeyInput> = {}): DrawKeyInput => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });
const draftOf = (...points: Point[]): DrawDraft => ({ ...EMPTY_DRAFT, points });

/** Aplica una secuencia de puntos con `drawPlace` (sin ajuste) y devuelve el borrador final. */
function place(doc: ModelDoc, points: Point[]): DrawDraft {
  let d = EMPTY_DRAFT;
  for (const p of points) d = drawPlace(d, ctxOf(doc), p).draft;
  return d;
}

const RECT: Point[] = [[0, 0], [20, 0], [20, 10], [0, 10]];

describe('pickMaterial', () => {
  const doc = emptyDoc();
  it('usa el material seleccionado y, si no hay, el primero', () => {
    expect(pickMaterial(doc, { kind: 'material', materialId: 'm2' })).toBe('m2');
    expect(pickMaterial(doc, { kind: 'none' })).toBe('m1');
    expect(pickMaterial(doc, { kind: 'material', materialId: 'no-existe' })).toBe('m1');
  });
  it('sin materiales no hay ninguno', () => {
    expect(pickMaterial({ ...doc, materials: [] }, { kind: 'none' })).toBeNull();
  });
});

describe('máquina de estados: colocar puntos', () => {
  it('cada punto se agrega y se anuncia con sus coordenadas', () => {
    const s = drawPlace(EMPTY_DRAFT, ctxOf(emptyDoc()), [31.4, 26.4]);
    expect(s.draft.points).toEqual([[31.4, 26.4]]);
    expect(s.announce).toBe('Punto 1 colocado: x 31,4 m, y 26,4 m.');
    expect(s.actions).toEqual([]);
  });
  it('con tres puntos o más recuerda cómo cerrar', () => {
    const d = place(emptyDoc(), RECT.slice(0, 2));
    const s = drawPlace(d, ctxOf(emptyDoc()), RECT[2]!);
    expect(s.announce).toContain('Intro cierra la región');
  });
  it('un punto igual al anterior se rechaza sin cambiar el borrador', () => {
    const d = draftOf([0, 0], [5, 0]);
    const s = drawPlace(d, ctxOf(emptyDoc()), [5, 0]);
    expect(s.draft).toBe(d);
    expect(s.announce).toMatch(/coincide con el punto anterior/);
  });
  it('un punto sobre otro ya colocado (no el primero) se rechaza', () => {
    const d = draftOf([0, 0], [10, 0], [10, 10]);
    const s = drawPlace(d, ctxOf(emptyDoc()), [10, 0]);
    expect(s.draft).toBe(d);
    expect(s.announce).toMatch(/Ya hay un punto/);
  });
  it('un segmento que cruzaría el contorno se rechaza', () => {
    const d = draftOf([0, 0], [10, 0], [10, 10], [0, 10]);
    const s = drawPlace(d, ctxOf(emptyDoc()), [5, -5]); // de (0,10) a (5,-5) corta la arista (0,0)-(10,0)
    expect(s.draft).toBe(d);
    expect(s.announce).toMatch(/cruzaría/);
  });
  it('las unidades imperiales se anuncian en pies', () => {
    const s = drawPlace(EMPTY_DRAFT, ctxOf({ ...emptyDoc(), units: 'imperial' }), [1, 2]);
    expect(s.announce).toContain('ft');
  });
  it('un valor no finito se ignora', () => {
    const s = drawPlace(EMPTY_DRAFT, ctxOf(emptyDoc()), [Number.NaN, 1]);
    expect(s.draft).toBe(EMPTY_DRAFT);
  });
});

describe('retroceso y cancelación', () => {
  it('Retroceso quita el último punto', () => {
    const s = drawBackspace(draftOf([0, 0], [5, 0], [5, 5]));
    expect(s.draft.points).toEqual([[0, 0], [5, 0]]);
    expect(s.announce).toMatch(/Punto eliminado\. Quedan 2/);
  });
  it('sin puntos no hace nada y lo dice', () => {
    const s = drawBackspace(EMPTY_DRAFT);
    expect(s.draft).toBe(EMPTY_DRAFT);
    expect(s.announce).toMatch(/No hay puntos/);
  });
  it('Esc cancela: borrador vacío y ninguna acción sobre el documento', () => {
    const s = drawCancel(draftOf([0, 0], [5, 0]));
    expect(s.draft.points).toEqual([]);
    expect(s.actions).toEqual([]);
    expect(s.announce).toMatch(/cancelado/i);
  });
});

describe('validación al cerrar (misma regla que validateLocal)', () => {
  it('un rectángulo válido pasa', () => {
    expect(validateNewRegion(emptyDoc(), RECT, 'm1')).toEqual({ ok: true });
  });
  it('menos de 3 puntos', () => {
    const v = validateNewRegion(emptyDoc(), [[0, 0], [1, 0]], 'm1');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toMatch(/al menos 3 puntos/);
  });
  it('puntos alineados: región sin área', () => {
    const v = validateNewRegion(emptyDoc(), [[0, 0], [5, 0], [10, 0]], 'm1');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toMatch(/no encierra superficie/);
  });
  it('contorno que se cruza (corbata)', () => {
    const v = validateNewRegion(emptyDoc(), [[0, 0], [10, 10], [10, 0], [0, 10]], 'm1');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toMatch(/se cruza/);
  });
  it('solape con una región existente', () => {
    const v = validateNewRegion(makeDoc(), [[5, 5], [30, 5], [30, 15], [5, 15]], 'm1');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toMatch(/se solapan/);
  });
  it('compartir una arista con una región existente es válido', () => {
    // bajo la región 0 (y = 0): comparte la arista (0,0)-(60,0)
    expect(validateNewRegion(makeDoc(), [[0, -10], [60, -10], [60, 0], [0, 0]], 'm1')).toEqual({ ok: true });
  });
  it('ignora los errores de otras partes del modelo', () => {
    const doc = { ...emptyDoc(), analysis: { methods: [] as never[] } }; // sin superficie ni métodos: errores ajenos a la región
    expect(validateNewRegion(doc, RECT, 'm1')).toEqual({ ok: true });
  });
});

describe('cerrar la región', () => {
  it('válida: un solo region/add, selecciona la región nueva y vuelve a «Seleccionar»', () => {
    const s = drawClose(draftOf(...RECT), ctxOf(emptyDoc()));
    expect(s.error).toBeUndefined();
    expect(s.draft.points).toEqual([]);
    expect(s.actions.filter((a) => a.type === 'region/add')).toEqual([{ type: 'region/add', region: { material: 'm1', polygon: RECT } }]);
    expect(s.actions).toContainEqual({ type: 'ui/select', selection: { kind: 'region', regionIndex: 0 } });
    expect(s.actions).toContainEqual({ type: 'ui/tool', tool: 'select' });
    expect(s.announce).toMatch(/Región 1 creada con el material Arcilla \(4 vértices\)/);
  });
  it('usa el material seleccionado', () => {
    const s = drawClose(draftOf(...RECT), ctxOf(emptyDoc(), { selection: { kind: 'material', materialId: 'm2' } }));
    const add = s.actions.find((a): a is Extract<CanvasAction, { type: 'region/add' }> => a.type === 'region/add');
    expect(add?.region.material).toBe('m2');
  });
  it('la región nueva toma el índice siguiente', () => {
    const s = drawClose(draftOf([0, -10], [60, -10], [60, 0], [0, 0]), ctxOf(makeDoc()));
    expect(s.actions).toContainEqual({ type: 'ui/select', selection: { kind: 'region', regionIndex: 2 } });
  });
  it('inválida: no hay acciones, el borrador se conserva y el error explica qué hacer', () => {
    const d = draftOf([0, 0], [10, 10], [10, 0], [0, 10]);
    const s = drawClose(d, ctxOf(emptyDoc()));
    expect(s.actions).toEqual([]);
    expect(s.draft).toBe(d);
    expect(s.error).toMatch(/se cruza/);
    expect(s.announce).toBe(s.error);
  });
  it('con menos de 3 puntos no cierra', () => {
    const s = drawClose(draftOf([0, 0], [5, 5]), ctxOf(emptyDoc()));
    expect(s.actions).toEqual([]);
    expect(s.error).toMatch(/al menos 3 puntos/);
  });
  it('sin materiales no se puede crear una región', () => {
    const s = drawClose(draftOf(...RECT), ctxOf({ ...emptyDoc(), materials: [] }));
    expect(s.actions).toEqual([]);
    expect(s.error).toMatch(/material/);
  });
  it('cerrar emite un único comando sobre el documento (un solo paso deshacible)', () => {
    const s = drawClose(draftOf(...RECT), ctxOf(emptyDoc()));
    const docCommands = s.actions.filter((a) => !a.type.startsWith('ui/') && !a.type.startsWith('gesture/') && !a.type.startsWith('history/'));
    expect(docCommands).toHaveLength(1);
  });
});

describe('ratón y táctil: drawClick', () => {
  const doc = emptyDoc();
  const at = (x: number, y: number, pointerType = 'mouse') => ({ x: toPx(x, y)[0], y: toPx(x, y)[1], button: 0, pointerType });
  it('un clic agrega un vértice', () => {
    const s = drawClick(EMPTY_DRAFT, ctxOf(doc), at(5, 5));
    expect(s.draft.points).toEqual([[5, 5]]);
  });
  it('un clic sobre el primer vértice cierra (con 3 o más puntos)', () => {
    const s = drawClick(draftOf(...RECT), ctxOf(doc), at(0.2, 0.2)); // a ~2,8 px del primero
    expect(s.actions.some((a) => a.type === 'region/add')).toBe(true);
  });
  it('con menos de 3 puntos, un clic sobre el primero no cierra ni duplica', () => {
    const s = drawClick(draftOf([0, 0], [10, 0]), ctxOf(doc), at(0, 0));
    expect(s.actions).toEqual([]);
    expect(s.draft.points.length).toBeLessThanOrEqual(2);
  });
  it('con el dedo el radio para cerrar es mayor (22 px)', () => {
    const d = draftOf(...RECT);
    const px = toPx(0, 0);
    const near = { x: px[0] + 20, y: px[1], button: 0 }; // 20 px: solo cierra con un toque
    expect(drawClick(d, ctxOf(doc), { ...near, pointerType: 'mouse' }).actions).toEqual([]);
    expect(drawClick(d, ctxOf(doc), { ...near, pointerType: 'touch' }).actions.some((a) => a.type === 'region/add')).toBe(true);
  });
  it('se ajusta a un vértice existente (regiones contiguas comparten vértices)', () => {
    const s = drawClick(EMPTY_DRAFT, ctxOf(makeDoc()), { x: toPx(60, 0)[0] + 3, y: toPx(60, 0)[1] - 2, button: 0, pointerType: 'mouse' });
    expect(s.draft.points).toEqual([[60, 0]]);
  });
  it('se ajusta a la rejilla', () => {
    const s = drawClick(EMPTY_DRAFT, ctxOf(doc, { snap: { vertex: true, axis: true, gridStep: 5, radiusPx: 10 } }), at(7.4, 12.6));
    expect(s.draft.points).toEqual([[5, 15]]);
  });
});

describe('vista previa: drawHover', () => {
  it('actualiza el cursor con el ajuste y marca que ya no está pendiente', () => {
    const d: DrawDraft = { ...draftOf([0, 0]), pending: true };
    const h = drawHover(d, ctxOf(emptyDoc()), { x: toPx(12.34, 7.5)[0], y: toPx(12.34, 7.5)[1], button: 0 });
    expect(h.cursor?.[0]).toBeCloseTo(12.34, 1);
    expect(h.pending).toBe(false);
    expect(h.points).toBe(d.points);
  });
});

describe('teclado', () => {
  const doc = emptyDoc();
  const ctx = ctxOf(doc);
  const run = (d: DrawDraft, k: DrawKeyInput) => drawKey(d, ctx, k);

  it('las flechas mueven el cursor 0,1 m; Mayús ×10; Ctrl ×100', () => {
    const start = run(EMPTY_DRAFT, key('ArrowRight'));
    expect(start.handled).toBe(true);
    const c0 = start.step.draft.cursor as Point;
    const r = run(start.step.draft, key('ArrowRight'));
    expect((r.step.draft.cursor as Point)[0]).toBeCloseTo(c0[0] + 0.1, 9);
    const s = run(r.step.draft, key('ArrowUp', { shiftKey: true }));
    expect((s.step.draft.cursor as Point)[1]).toBeCloseTo(c0[1] + 1, 9);
    const c = run(s.step.draft, key('ArrowLeft', { ctrlKey: true }));
    expect((c.step.draft.cursor as Point)[0]).toBeCloseTo(c0[0] + 0.1 - 10, 9);
    expect(c.step.draft.pending).toBe(true);
  });
  it('con rejilla activa el paso es el de la rejilla', () => {
    const g = drawKey(draftOf([0, 0]), ctxOf(doc, { snap: { vertex: true, axis: true, gridStep: 0.5, radiusPx: 10 } }), key('ArrowRight'));
    expect(g.step.draft.cursor).toEqual([0.5, 0]);
  });
  it('el primer movimiento parte del último punto colocado o, sin puntos, del centro de la vista', () => {
    const fromPoint = drawKey(draftOf([10, 10]), ctx, key('ArrowDown'));
    expect(fromPoint.step.draft.cursor).toEqual([10, 9.9]);
    const center = drawKey(EMPTY_DRAFT, ctx, key('ArrowDown')).step.draft.cursor as Point;
    expect(center[0]).toBeCloseTo((VP.width / 2 - VP.tx) / VP.scale, 0);
  });
  it('el movimiento anuncia las coordenadas del cursor', () => {
    const r = run(draftOf([10, 10]), key('ArrowRight'));
    expect(r.step.announce).toBe('Cursor: x 10,1 m, y 10,0 m.');
  });
  it('Espacio coloca el punto en el cursor', () => {
    const moved = run(draftOf([0, 0]), key('ArrowRight', { shiftKey: true })).step.draft;
    const r = run(moved, key(' '));
    expect(r.handled).toBe(true);
    expect(r.step.draft.points).toEqual([[0, 0], [1, 0]]);
    expect(r.step.draft.pending).toBe(false);
  });
  it('Intro coloca el punto si se acaba de mover el cursor; si no, cierra la región', () => {
    let d = EMPTY_DRAFT;
    const goto = (x: number, y: number): void => {
      d = run({ ...d, cursor: [x, y], pending: true }, key('Enter')).step.draft;
    };
    goto(0, 0);
    goto(20, 0);
    goto(20, 10);
    expect(d.points).toEqual([[0, 0], [20, 0], [20, 10]]);
    // Intro sin mover el cursor: cierra el triángulo
    expect(run(d, key('Enter')).step.actions.some((a) => a.type === 'region/add')).toBe(true);
  });
  it('Intro con el cursor sobre el primer punto cierra aunque se haya movido', () => {
    const d: DrawDraft = { points: [[0, 0], [20, 0], [20, 10]], cursor: [0, 0], pending: true, snapKind: 'none' };
    expect(run(d, key('Enter')).step.actions.some((a) => a.type === 'region/add')).toBe(true);
  });
  it('Intro con menos de 3 puntos coloca el punto', () => {
    const d: DrawDraft = { points: [[0, 0]], cursor: [5, 5], pending: false, snapKind: 'none' };
    expect(run(d, key('Enter')).step.draft.points).toEqual([[0, 0], [5, 5]]);
  });
  it('Retroceso y Supr quitan el último punto', () => {
    expect(run(draftOf([0, 0], [1, 0]), key('Backspace')).step.draft.points).toEqual([[0, 0]]);
    expect(run(draftOf([0, 0], [1, 0]), key('Delete')).step.draft.points).toEqual([[0, 0]]);
  });
  it('Esc cancela el dibujo; sin puntos, sale a «Seleccionar»', () => {
    const c = run(draftOf([0, 0], [1, 0]), key('Escape'));
    expect(c.step.draft.points).toEqual([]);
    expect(c.step.actions).toEqual([]);
    const out = run(EMPTY_DRAFT, key('Escape'));
    expect(out.handled).toBe(true);
    expect(out.step.actions).toEqual([{ type: 'ui/tool', tool: 'select' }]);
  });
  it('Ctrl+Z con puntos quita el último punto; sin puntos se deja al historial', () => {
    expect(run(draftOf([0, 0], [1, 0]), key('z', { ctrlKey: true })).step.draft.points).toEqual([[0, 0]]);
    expect(run(EMPTY_DRAFT, key('z', { ctrlKey: true })).handled).toBe(false);
  });
  it('otras teclas no se consumen (zoom, Tab…)', () => {
    for (const k of ['+', '-', '0', 'Tab', '[', 'a', 'r']) expect(run(draftOf([0, 0]), key(k)).handled).toBe(false);
  });
  it('un cierre inválido por teclado informa del problema y conserva el borrador', () => {
    const d: DrawDraft = { points: [[0, 0], [10, 0], [20, 0]], cursor: null, pending: false, snapKind: 'none' };
    const r = run(d, key('Enter'));
    expect(r.step.error).toMatch(/no encierra superficie/);
    expect(r.step.draft.points).toHaveLength(3);
  });
});
