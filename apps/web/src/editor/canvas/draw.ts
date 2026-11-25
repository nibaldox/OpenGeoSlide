// Dibujo de una región nueva (herramienta «Dibujar región», tecla R): máquina de estados pura. Sin React ni DOM.
//
//   ratón y táctil: cada clic (o toque) agrega un vértice con el ajuste a vértices, ejes y rejilla; un clic sobre el primer
//     vértice cierra la región. La arista elástica llega hasta el cursor (`cursor`).
//   teclado: las flechas mueven el cursor (0,1 m por paso o el de la rejilla; Mayús ×10; Ctrl ×100); Espacio coloca el punto.
//     Intro coloca el punto si el cursor se movió con las flechas desde el último punto (`pending`); si no, cierra la región.
//     Con el cursor sobre el primer punto, Intro cierra siempre.
//   Retroceso (o Supr, o Ctrl+Z) quita el último punto; Esc cancela el dibujo y, sin puntos, sale a «Seleccionar».
//
// Al cerrar se valida con `validateLocal` (polígono simple, área no nula, sin solapes con las demás regiones) y, si es
// válida, se emite UN solo `region/add`: un solo paso de historial.

import type { Point } from '../../engine/types';
import { screenToWorld, worldToScreen } from '../../geometry/viewport';
import { properCross } from '../state/polygonChecks';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc, Selection } from '../types';
import type { CanvasAction, GestureContext, PointerInput } from './gesture';
import { HIT_RADIUS_TOUCH_PX, handleHitRadius } from './hitTest';
import { formatNumber, lengthUnitOf } from './layout';
import { insertionCommands, sharedInsertions, withInsertions } from './regionOps';
import { snapPoint, type SnapKind } from './snap';
import { revealCursor } from './viewportOps';

export interface DrawDraft {
  /** Vértices ya colocados, en orden. */
  points: Point[];
  /** Posición actual del cursor de dibujo (mundo), o `null` si todavía no hay. */
  cursor: Point | null;
  /** El cursor se movió con las flechas desde el último punto colocado: Intro coloca en lugar de cerrar. */
  pending: boolean;
  /** Tipo de ajuste activo en el cursor (para dibujarlo). */
  snapKind: SnapKind;
}

export const EMPTY_DRAFT: DrawDraft = { points: [], cursor: null, pending: false, snapKind: 'none' };

export interface DrawStep {
  draft: DrawDraft;
  /** Acciones para el store (`region/add`, selección, herramienta, vista). */
  actions: CanvasAction[];
  /** Mensaje para la región aria-live. */
  announce?: string;
  /** Motivo por el que no se pudo cerrar o colocar el punto (también va en `announce`). */
  error?: string;
}

export interface DrawKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface DrawKeyResult {
  handled: boolean;
  step: DrawStep;
}

/** Paso de las flechas sin rejilla, en metros (coincide con el de los tiradores). */
export const DRAW_ARROW_STEP = 0.1;
/** Tolerancia para considerar que dos puntos coinciden. */
const SAME_TOL = 1e-9;

/** Instrucciones de la herramienta, para el lienzo y la ayuda. */
export const DRAW_INSTRUCTIONS =
  'Dibujar región: cada clic o toque agrega un vértice; Intro, o un clic sobre el primer vértice, cierra la región. ' +
  'Se puede dibujar fuera del modelo, y cerca del borde del lienzo la vista se desplaza sola. Un punto cerca de una arista se apoya en ella. ' +
  'Con el teclado, las flechas mueven el cursor (Mayús ×10, Ctrl ×100) y Espacio coloca el punto. ' +
  'Retroceso quita el último punto y Esc cancela.';

export const noStep = (draft: DrawDraft): DrawStep => ({ draft, actions: [] });
export const reject = (draft: DrawDraft, message: string): DrawStep => ({ draft, actions: [], announce: message, error: message });

function clean(v: number): number {
  return Number(v.toPrecision(12));
}

export function same(a: Point, b: Point): boolean {
  return Math.abs(a[0] - b[0]) <= SAME_TOL && Math.abs(a[1] - b[1]) <= SAME_TOL;
}

/** Aviso de que el punto quedó apoyado en un vértice o una arista existentes. */
export function snapNote(kind: SnapKind): string {
  return kind === 'edge' ? ' sobre una arista' : kind === 'vertex' ? ' sobre un vértice' : '';
}

export function coords(p: Point, units: string | undefined): string {
  const u = lengthUnitOf(units);
  return `x ${formatNumber(p[0])} ${u}, y ${formatNumber(p[1])} ${u}`;
}

/** Material de la región nueva: el seleccionado en el panel (si existe) o el primero del modelo; `null` si no hay materiales. */
export function pickMaterial(doc: ModelDoc, selection: Selection): string | null {
  if (selection.kind === 'material' && doc.materials.some((m) => m.id === selection.materialId)) return selection.materialId;
  return doc.materials[0]?.id ?? null;
}

export type NewRegionValidation = { ok: true } | { ok: false; message: string };

/**
 * Valida la región que se va a agregar con la misma regla que `validateLocal` (polígono simple, área no nula, sin solapes con las
 * regiones existentes). Solo cuentan los errores de la región nueva: los de otras partes del modelo no la bloquean.
 */
export function validateNewRegion(doc: ModelDoc, polygon: readonly Point[], material: string): NewRegionValidation {
  if (polygon.length < 3) return { ok: false, message: 'Una región necesita al menos 3 puntos. Coloque más puntos antes de cerrarla.' };
  const index = doc.regions.length;
  const trial: ModelDoc = { ...doc, regions: [...doc.regions, { material, polygon: polygon.map((p): Point => [p[0], p[1]]) }] };
  const own = (path: string | null): boolean => path === `/regions/${index}` || (path?.startsWith(`/regions/${index}/`) ?? false);
  const first = validateLocal(trial).find((i) => i.severity === 'error' && own(i.path));
  return first ? { ok: false, message: first.text.endsWith('.') ? first.text : `${first.text}.` } : { ok: true };
}

// ───────────────────────── Colocar, retroceder, cancelar ─────────────────────────

/** ¿El segmento último→`p` cruzaría alguna arista anterior del contorno en curso? */
function crossesContour(points: readonly Point[], p: Point): boolean {
  const n = points.length;
  if (n < 3) return false;
  const last = points[n - 1] as Point;
  for (let i = 0; i < n - 2; i += 1) {
    if (properCross(last, p, points[i] as Point, points[i + 1] as Point, SAME_TOL)) return true;
  }
  return false;
}

/** Agrega un vértice en `p` (mundo). Con 3 o más puntos, un punto sobre el primero cierra la región. */
export function drawPlace(draft: DrawDraft, ctx: GestureContext, p: Point, kind: SnapKind = 'none'): DrawStep {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return noStep(draft);
  const { points } = draft;
  const n = points.length;
  if (n >= 3 && same(p, points[0] as Point)) return drawClose(draft, ctx);
  if (n > 0 && same(p, points[n - 1] as Point)) return reject(draft, 'Ese punto coincide con el punto anterior. Elija otro lugar.');
  if (points.some((q) => same(p, q))) return reject(draft, 'Ya hay un punto ahí. Elija otro lugar.');
  if (crossesContour(points, p)) return reject(draft, 'Ese punto cruzaría el contorno que ya dibujó. Elija otro lugar o quite el último punto con Retroceso.');
  const next: DrawDraft = { points: [...points, [p[0], p[1]]], cursor: [p[0], p[1]], pending: false, snapKind: 'none' };
  const count = next.points.length;
  const hint = count >= 3 ? ' Intro cierra la región.' : '';
  return { draft: next, actions: [], announce: `Punto ${count} colocado${snapNote(kind)}: ${coords(p, ctx.doc.units)}.${hint}` };
}

/** Quita el último punto colocado. */
export function drawBackspace(draft: DrawDraft): DrawStep {
  const n = draft.points.length;
  if (n === 0) return { draft, actions: [], announce: 'No hay puntos que quitar.' };
  const remaining = draft.points.slice(0, -1);
  const text = remaining.length === 0 ? 'No quedan puntos.' : remaining.length === 1 ? 'Queda 1 punto.' : `Quedan ${remaining.length} puntos.`;
  return { draft: { ...draft, points: remaining, pending: false }, actions: [], announce: `Punto eliminado. ${text}` };
}

/** Descarta el dibujo en curso sin tocar el documento. */
export function drawCancel(draft: DrawDraft): DrawStep {
  void draft;
  return { draft: EMPTY_DRAFT, actions: [], announce: 'Dibujo cancelado. No se agregó ninguna región.' };
}

// ───────────────────────── Cerrar ─────────────────────────

/**
 * Cierra la región: si es válida emite un único `region/add` (un paso de historial), la selecciona y vuelve a «Seleccionar».
 * Si no, conserva el borrador y explica qué corregir.
 */
export function drawClose(draft: DrawDraft, ctx: GestureContext): DrawStep {
  const { doc, ui } = ctx;
  if (draft.points.length < 3) return reject(draft, 'Una región necesita al menos 3 puntos. Coloque más puntos antes de cerrarla.');
  const material = pickMaterial(doc, ui.selection);
  if (material === null) return reject(draft, 'No hay materiales: cree uno en el panel «Materiales» antes de dibujar una región.');
  const regionIndex = doc.regions.length;
  const name = doc.materials.find((m) => m.id === material)?.name ?? material;
  const region = { material, polygon: draft.points.map((p): Point => [p[0], p[1]]) };
  // Un vértice apoyado en una arista de otra región se inserta también en ella: el límite queda compartido, sin hueco ni solape.
  const shared = sharedInsertions(doc, draft.points);
  const checked = validateNewRegion(withInsertions(doc, shared), draft.points, material);
  if (!checked.ok) return reject(draft, checked.message);
  const tail: CanvasAction[] = [
    { type: 'ui/select', selection: { kind: 'region', regionIndex } },
    { type: 'ui/tool', tool: 'select' },
  ];
  const actions: CanvasAction[] =
    shared.length === 0
      ? [{ type: 'region/add', region }, ...tail]
      : [{ type: 'gesture/begin', label: 'Dibujar región' }, ...insertionCommands(shared), { type: 'region/add', region }, { type: 'gesture/end' }, ...tail];
  const joined = shared.length > 0 ? ` Comparte ${shared.length === 1 ? 'un vértice' : `${shared.length} vértices`} con ${new Set(shared.map((i) => i.regionIndex)).size === 1 ? 'la región ' : 'las regiones '}${[...new Set(shared.map((i) => i.regionIndex + 1))].join(', ')}.` : '';
  return {
    draft: EMPTY_DRAFT,
    actions,
    announce: `Región ${regionIndex + 1} creada con el material ${name} (${draft.points.length} vértices).${joined} Pulse R para dibujar otra.`,
  };
}

// ───────────────────────── Puntero ─────────────────────────

export function snapAt(draft: DrawDraft, ctx: GestureContext, input: PointerInput): { point: Point; kind: SnapKind } | null {
  const vp = ctx.ui.viewport;
  if (!vp) return null;
  const raw = screenToWorld(vp, input.x, input.y) as Point;
  // La alineación horizontal/vertical se ofrece con el último punto y con el primero (para cerrar rectángulos).
  const neighbors: Point[] = [];
  const last = draft.points[draft.points.length - 1];
  if (last) neighbors.push(last);
  if (draft.points.length > 1) neighbors.push(draft.points[0] as Point);
  // Con el dedo el radio de ajuste crece (como el de los tiradores): un toque no apunta con precisión a una arista.
  const radiusPx = input.pointerType === 'touch' ? Math.max(ctx.ui.snap.radiusPx, HIT_RADIUS_TOUCH_PX) : ctx.ui.snap.radiusPx;
  const snap = snapPoint(raw, { doc: ctx.doc, vp, snap: { ...ctx.ui.snap, radiusPx }, neighbors, edges: true });
  return { point: snap.point, kind: snap.kind };
}

/** Movimiento del puntero: actualiza el cursor (arista elástica) con el ajuste. */
export function drawHover(draft: DrawDraft, ctx: GestureContext, input: PointerInput): DrawDraft {
  const s = snapAt(draft, ctx, input);
  if (!s) return draft;
  const c = draft.cursor;
  if (c && c[0] === s.point[0] && c[1] === s.point[1] && !draft.pending && draft.snapKind === s.kind) return draft;
  return { ...draft, cursor: s.point, pending: false, snapKind: s.kind };
}

/** Clic o toque: cierra si cae sobre el primer vértice (con 3 o más puntos); si no, agrega un vértice ajustado. */
export function drawClick(draft: DrawDraft, ctx: GestureContext, input: PointerInput): DrawStep {
  const vp = ctx.ui.viewport;
  if (!vp) return noStep(draft);
  if (draft.points.length >= 3) {
    const first = draft.points[0] as Point;
    const [fx, fy] = worldToScreen(vp, first[0], first[1]);
    if (Math.hypot(input.x - fx, input.y - fy) <= handleHitRadius(ctx.ui.snap.radiusPx, input.pointerType)) return drawClose(draft, ctx);
  }
  const s = snapAt(draft, ctx, input);
  return s ? drawPlace(draft, ctx, s.point, s.kind) : noStep(draft);
}

// ───────────────────────── Teclado ─────────────────────────

export function keyboardStart(draft: DrawDraft, ctx: GestureContext, step: number): Point {
  const last = draft.points[draft.points.length - 1];
  if (last) return [last[0], last[1]];
  const vp = ctx.ui.viewport;
  if (!vp) return [0, 0];
  const [cx, cy] = screenToWorld(vp, vp.width / 2, vp.height / 2);
  const grid = ctx.ui.snap.gridStep !== null && ctx.ui.snap.gridStep > 0 ? ctx.ui.snap.gridStep : step;
  return [clean(Math.round(cx / grid) * grid), clean(Math.round(cy / grid) * grid)];
}

export function arrowStep(ctx: GestureContext): number {
  const g = ctx.ui.snap.gridStep;
  return g !== null && g > 0 ? g : DRAW_ARROW_STEP;
}

function moveCursor(draft: DrawDraft, ctx: GestureContext, dir: Point, k: DrawKeyInput): DrawStep {
  const base = arrowStep(ctx);
  const mult = (k.shiftKey ? 10 : 1) * (k.ctrlKey || k.metaKey ? 100 : 1);
  const from = draft.cursor ?? keyboardStart(draft, ctx, base);
  const to: Point = [clean(from[0] + dir[0] * base * mult), clean(from[1] + dir[1] * base * mult)];
  const actions: CanvasAction[] = [];
  const vp = ctx.ui.viewport;
  if (vp) {
    const [sx, sy] = worldToScreen(vp, to[0], to[1]);
    const next = revealCursor(vp, sx, sy);
    if (next !== vp) actions.push({ type: 'ui/viewport', viewport: next });
  }
  return { draft: { ...draft, cursor: to, pending: true, snapKind: 'none' }, actions, announce: `Cursor: ${coords(to, ctx.doc.units)}.` };
}

/** Acciones que distinguen a las herramientas de trazo («Dibujar región» y «Dividir región»); el resto del teclado es común. */
export interface ToolOps {
  /** Coloca un punto ya ajustado; `kind` indica si quedó apoyado en un vértice o una arista. */
  place(draft: DrawDraft, ctx: GestureContext, p: Point, kind: SnapKind): DrawStep;
  /** Intro sin cursor pendiente: cierra la región o divide. */
  finish(draft: DrawDraft, ctx: GestureContext): DrawStep;
  /** ¿Intro, sin cursor pendiente, termina el trazo (si no, coloca el punto)? */
  canFinish(draft: DrawDraft): boolean;
}

/** Con el teclado el cursor se mueve en pasos fijos: solo se ajusta a un vértice o una arista si queda a menos de `radiusPx` de ella. */
export function keyboardSnap(ctx: GestureContext, at: Point): { point: Point; kind: SnapKind } {
  const vp = ctx.ui.viewport;
  if (!vp) return { point: at, kind: 'none' };
  const snap = snapPoint(at, { doc: ctx.doc, vp, snap: ctx.ui.snap, edges: true });
  return snap.kind === 'vertex' || snap.kind === 'edge' ? { point: snap.point, kind: snap.kind } : { point: at, kind: 'none' };
}

const DRAW_OPS: ToolOps = {
  place: (draft, ctx, p, kind) => drawPlace(draft, ctx, p, kind),
  finish: drawClose,
  canFinish: (draft) => {
    const n = draft.points.length;
    const onFirst = n >= 3 && draft.cursor !== null && same(draft.cursor, draft.points[0] as Point);
    return n >= 3 && (!draft.pending || onFirst);
  },
};

/** Teclado común de las herramientas de trazo: flechas, Espacio, Intro, Retroceso, Esc y Ctrl+Z. Lo no consumido sigue su camino normal. */
export function toolKey(draft: DrawDraft, ctx: GestureContext, k: DrawKeyInput, ops: ToolOps): DrawKeyResult {
  const handled = (step: DrawStep): DrawKeyResult => ({ handled: true, step });
  const ignored: DrawKeyResult = { handled: false, step: noStep(draft) };
  const mod = k.ctrlKey || k.metaKey;
  const lower = k.key.length === 1 ? k.key.toLowerCase() : k.key;

  if (mod && lower === 'z' && !k.shiftKey) return draft.points.length > 0 ? handled(drawBackspace(draft)) : ignored;
  if (k.altKey) return ignored;

  const dir: Point | null =
    k.key === 'ArrowLeft' ? [-1, 0] : k.key === 'ArrowRight' ? [1, 0] : k.key === 'ArrowUp' ? [0, 1] : k.key === 'ArrowDown' ? [0, -1] : null;
  if (dir) return handled(moveCursor(draft, ctx, dir, k));
  if (mod) return ignored;

  if (k.key === 'Escape') {
    if (draft.points.length > 0) return handled(drawCancel(draft));
    return handled({ draft, actions: [{ type: 'ui/tool', tool: 'select' }], announce: 'Herramienta Seleccionar.' });
  }
  if (k.key === 'Backspace' || k.key === 'Delete') return handled(drawBackspace(draft));

  const placeAtCursor = (): DrawStep => {
    const at = draft.cursor ?? keyboardStart(draft, ctx, arrowStep(ctx));
    const snapped = keyboardSnap(ctx, at);
    return ops.place(draft, ctx, snapped.point, snapped.kind);
  };
  if (k.key === ' ' || k.key === 'Spacebar') return handled(placeAtCursor());
  if (k.key === 'Enter') return handled(ops.canFinish(draft) ? ops.finish(draft, ctx) : placeAtCursor());
  return ignored;
}

/** Tecla del teclado en la herramienta «Dibujar región». */
export function drawKey(draft: DrawDraft, ctx: GestureContext, k: DrawKeyInput): DrawKeyResult {
  return toolKey(draft, ctx, k, DRAW_OPS);
}
