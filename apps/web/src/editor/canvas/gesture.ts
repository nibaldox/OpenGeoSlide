// Máquina de estados de gestos del lienzo: pointerdown/move/up/cancel → lista de acciones del store.
// Pura: no toca el DOM ni el store. `runActions` aplica la lista a un EditorStore.
//
// Arrastre (X3 §2.3): pointerdown en un tirador → beginGesture; pointermove solo actualiza la vista previa;
// pointerup → comando(s) + endGesture. Un gesto = una entrada de historial. Un clic sin mover cancela el gesto.

import { circleSpec } from '../../engine/surface';
import type { Circle, Point, Reinforcement } from '../../engine/types';
import type { EditorCommand, EditorState, EditorStore, ModelDoc, UiAction } from '../types';
import { screenToWorld, type Viewport } from '../../geometry/viewport';
import { coincidentVertices, piezoPoints, roundForScale, type VertexRef } from './geom';
import { handleHitRadius, hitTest, type Hit } from './hitTest';
import { insertPiezoPoint, movePiezoPoint, removePiezoPoint } from './edits';
import { insertPolylineVertex, modelWidth, movePolylineVertex, polylineMinGap, removePolylineVertex } from './polyline';
import { isVerticalReinforcement, moveBody, moveEnd, refEnd } from './reinforcements';
import { snapPoint, type SnapResult } from './snap';
import { panBy } from './viewportOps';

export type CanvasAction =
  | EditorCommand
  | UiAction
  | { type: 'gesture/begin'; label: string }
  | { type: 'gesture/end' }
  | { type: 'gesture/cancel' }
  | { type: 'history/undo' }
  | { type: 'history/redo' };

/** Lo que el gesto necesita leer del estado del editor. */
export type GestureContext = Pick<EditorState, 'doc' | 'ui'>;

export interface PointerInput {
  /** Coordenadas en píxeles relativas al SVG. */
  x: number;
  y: number;
  /** 0 = principal, 1 = central. */
  button: number;
  /** Alt desacopla un vértice de los coincidentes de otras regiones. */
  altKey?: boolean;
  /** `mouse`, `pen` o `touch`: con el dedo la tolerancia de acierto es mayor (R7-10). */
  pointerType?: string;
}

export type DragTarget =
  | { kind: 'vertex'; group: VertexRef[] }
  | { kind: 'piezo_point'; index: number }
  | { kind: 'circle_center' }
  | { kind: 'circle_radius' }
  | { kind: 'surface_vertex'; index: number }
  /** Extremo de un refuerzo (v0.4): la tablestaca conserva su x. */
  | { kind: 'reinforcement_end'; index: number; end: 1 | 2 }
  /** Centro de un refuerzo: los dos extremos se mueven juntos. `grab` es el punto (mundo) donde se pulsó. */
  | { kind: 'reinforcement_move'; index: number; grab: Point };

export type Preview =
  | { kind: 'vertex'; moves: { regionIndex: number; vertexIndex: number; to: Point }[]; snap: SnapResult }
  | { kind: 'piezo_point'; index: number; to: Point; snap: SnapResult }
  | { kind: 'circle'; circle: Circle; snap: SnapResult | null }
  /** Polilínea de falla con un vértice movido; `clamped`: la x se acotó para no cruzar a la de su vecino. */
  | { kind: 'surface_polyline'; index: number; points: Point[]; clamped: boolean; snap: SnapResult }
  /** Refuerzo `index` con un extremo o el cuerpo movido; `clamped`: el movimiento lo dejaría sin longitud y no se aplica. */
  | { kind: 'reinforcement'; index: number; reinforcement: Reinforcement; clamped: boolean; snap: SnapResult };

export type GestureState =
  | { mode: 'idle' }
  | { mode: 'pan'; last: [number, number] }
  | { mode: 'drag'; target: DragTarget; start: [number, number]; moved: boolean; preview: Preview | null };

export interface GestureResult {
  state: GestureState;
  actions: CanvasAction[];
}

export const IDLE: GestureState = { mode: 'idle' };
/** Desplazamiento mínimo en píxeles para considerar que un clic pasó a ser arrastre. */
export const DRAG_THRESHOLD_PX = 3;

const noop = (state: GestureState): GestureResult => ({ state, actions: [] });

// ---------- Vista previa ----------

function neighborsOf(doc: ModelDoc, ref: VertexRef): Point[] {
  const poly = doc.regions[ref.regionIndex]?.polygon ?? [];
  const n = poly.length;
  if (n < 2) return [];
  return [poly[(ref.vertexIndex + n - 1) % n], poly[(ref.vertexIndex + 1) % n]];
}

function computePreview(target: DragTarget, ctx: GestureContext, input: PointerInput): Preview | null {
  const vp = ctx.ui.viewport;
  if (!vp) return null;
  const { doc, ui } = ctx;
  const raw = screenToWorld(vp, input.x, input.y) as Point;

  switch (target.kind) {
    case 'vertex': {
      const primary = target.group[0];
      const snap = snapPoint(raw, { doc, vp, snap: ui.snap, exclude: target.group, neighbors: neighborsOf(doc, primary) });
      return {
        kind: 'vertex',
        moves: target.group.map((r) => ({ regionIndex: r.regionIndex, vertexIndex: r.vertexIndex, to: snap.point })),
        snap,
      };
    }
    case 'piezo_point': {
      const pts = piezoPoints(doc);
      const neighbors: Point[] = [];
      if (pts[target.index - 1]) neighbors.push(pts[target.index - 1]);
      if (pts[target.index + 1]) neighbors.push(pts[target.index + 1]);
      const snap = snapPoint(raw, { doc, vp, snap: ui.snap, neighbors });
      const moved = movePiezoPoint(pts, target.index, snap.point);
      const to = moved ? moved[target.index] : snap.point;
      return { kind: 'piezo_point', index: target.index, to, snap };
    }
    case 'surface_vertex': {
      const surface = doc.analysis.surface;
      if (!surface || surface.type !== 'polyline') return null;
      const neighbors: Point[] = [];
      if (surface.points[target.index - 1]) neighbors.push(surface.points[target.index - 1]!);
      if (surface.points[target.index + 1]) neighbors.push(surface.points[target.index + 1]!);
      const snap = snapPoint(raw, { doc, vp, snap: ui.snap, neighbors });
      const moved = movePolylineVertex(surface.points, target.index, snap.point, polylineMinGap(modelWidth(doc.regions)));
      if (!moved) return null;
      return { kind: 'surface_polyline', index: target.index, points: moved.points, clamped: moved.clamped, snap };
    }
    case 'reinforcement_end': {
      const r = doc.reinforcements?.[target.index];
      if (!r) return null;
      const other = refEnd(r, target.end === 1 ? 2 : 1);
      // E15l-21: un refuerzo vertical (tablestaca o pilote Ito-Matsui) conserva su x; el ajuste y la vista previa trabajan sobre su vertical.
      const own = refEnd(r, target.end);
      const aim: Point = isVerticalReinforcement(r) ? [own[0], raw[1]] : raw;
      const snap = snapPoint(aim, { doc, vp, snap: ui.snap, neighbors: [other] });
      const moved = moveEnd(r, target.end, snap.point);
      return { kind: 'reinforcement', index: target.index, reinforcement: moved ?? r, clamped: moved === null, snap };
    }
    case 'reinforcement_move': {
      const r = doc.reinforcements?.[target.index];
      if (!r) return null;
      // El ajuste (rejilla, vértices, ejes) se aplica a la cabeza desplazada; los dos extremos reciben el mismo desplazamiento.
      const head: Point = [r.x1 + raw[0] - target.grab[0], r.y1 + raw[1] - target.grab[1]];
      const snap = snapPoint(head, { doc, vp, snap: ui.snap });
      const moved = moveBody(r, snap.point[0] - r.x1, snap.point[1] - r.y1);
      return { kind: 'reinforcement', index: target.index, reinforcement: moved ?? r, clamped: moved === null, snap };
    }
    case 'circle_center': {
      const c = circleSpec(doc.analysis.surface);
      if (!c) return null;
      // Solo rejilla: alinear el centro con vértices del modelo no tiene sentido geométrico.
      const snap = snapPoint(raw, { doc, vp, snap: { ...ui.snap, vertex: false, axis: false } });
      return { kind: 'circle', circle: { xc: snap.point[0], yc: snap.point[1], r: c.r }, snap };
    }
    case 'circle_radius': {
      const c = circleSpec(doc.analysis.surface);
      if (!c) return null;
      let r = Math.hypot(raw[0] - c.xc, raw[1] - c.yc);
      const step = ui.snap.gridStep;
      r = step !== null && step > 0 ? Math.round(r / step) * step : roundForScale(r, vp.scale);
      return { kind: 'circle', circle: { xc: c.xc, yc: c.yc, r: Math.max(r, 1e-3) }, snap: null };
    }
  }
}

/** Documento con la vista previa aplicada, solo para dibujar (no se escribe al store). */
export function applyPreview(doc: ModelDoc, preview: Preview | null): ModelDoc {
  if (!preview) return doc;
  switch (preview.kind) {
    case 'vertex': {
      const regions = doc.regions.map((region, ri) => {
        const mv = preview.moves.filter((m) => m.regionIndex === ri);
        if (mv.length === 0) return region;
        const polygon = region.polygon.map((p, vi): Point => mv.find((m) => m.vertexIndex === vi)?.to ?? p);
        return { ...region, polygon };
      });
      return { ...doc, regions };
    }
    case 'piezo_point': {
      const moved = movePiezoPoint(piezoPoints(doc), preview.index, preview.to);
      if (!moved) return doc;
      return { ...doc, water: { ...(doc.water ?? {}), piezometric_line: moved } };
    }
    case 'circle':
      return { ...doc, analysis: { ...doc.analysis, surface: { type: 'circle', ...preview.circle } } };
    case 'surface_polyline':
      return { ...doc, analysis: { ...doc.analysis, surface: { type: 'polyline', points: preview.points } } };
    case 'reinforcement':
      return { ...doc, reinforcements: (doc.reinforcements ?? []).map((r, i) => (i === preview.index ? preview.reinforcement : r)) };
  }
}

function commitActions(preview: Preview, doc: ModelDoc): CanvasAction[] {
  switch (preview.kind) {
    case 'vertex': {
      const out: CanvasAction[] = [];
      for (const m of preview.moves) {
        const cur = doc.regions[m.regionIndex]?.polygon[m.vertexIndex];
        if (!cur || (cur[0] === m.to[0] && cur[1] === m.to[1])) continue;
        out.push({ type: 'vertex/move', regionIndex: m.regionIndex, vertexIndex: m.vertexIndex, to: m.to });
      }
      return out;
    }
    case 'piezo_point': {
      const pts = piezoPoints(doc);
      const cur = pts[preview.index];
      if (!cur || (cur[0] === preview.to[0] && cur[1] === preview.to[1])) return [];
      const next = movePiezoPoint(pts, preview.index, preview.to);
      return next ? [{ type: 'piezo/set', points: next }] : [];
    }
    case 'circle': {
      const cur = circleSpec(doc.analysis.surface);
      const c = preview.circle;
      if (cur && cur.xc === c.xc && cur.yc === c.yc && cur.r === c.r) return [];
      return [{ type: 'surface/set', surface: { type: 'circle', xc: c.xc, yc: c.yc, r: c.r } }];
    }
    case 'surface_polyline': {
      const cur = doc.analysis.surface;
      const at = cur && cur.type === 'polyline' ? cur.points[preview.index] : undefined;
      const to = preview.points[preview.index];
      if (!at || !to || (at[0] === to[0] && at[1] === to[1])) return [];
      return [{ type: 'surface/set', surface: { type: 'polyline', points: preview.points } }];
    }
    case 'reinforcement': {
      const cur = doc.reinforcements?.[preview.index];
      const r = preview.reinforcement;
      if (!cur || preview.clamped || (cur.x1 === r.x1 && cur.y1 === r.y1 && cur.x2 === r.x2 && cur.y2 === r.y2)) return [];
      return [{ type: 'reinforcement/upsert', index: preview.index, reinforcement: r }];
    }
  }
}

// ---------- Eventos ----------

/** Qué hay bajo el puntero: tiradores con el radio de acierto del tipo de puntero (≥ 16 px; 22 px con el dedo). */
export function hitTestFor(doc: ModelDoc, vp: Viewport, input: PointerInput, snapRadiusPx: number, bands: boolean, surfaceEdge = false): Hit {
  const radius = handleHitRadius(snapRadiusPx, input.pointerType);
  return hitTest(doc, vp, input.x, input.y, radius, { bands, edgeRadiusPx: input.pointerType === 'touch' ? radius : snapRadiusPx, surfaceEdge });
}

export function pointerDown(state: GestureState, ctx: GestureContext, input: PointerInput): GestureResult {
  const vp = ctx.ui.viewport;
  if (!vp || state.mode !== 'idle') return noop(state);

  if (input.button === 1 || (input.button === 0 && ctx.ui.tool === 'pan')) {
    return { state: { mode: 'pan', last: [input.x, input.y] }, actions: [] };
  }
  if (input.button !== 0) return noop(state);

  const { doc, ui } = ctx;
  const hit = hitTestFor(doc, vp, input, ui.snap.radiusPx, ui.tool === 'select', ui.tool === 'add_vertex');
  const start: [number, number] = [input.x, input.y];
  const drag = (target: DragTarget, label: string, selection: UiAction): GestureResult => ({
    state: { mode: 'drag', target, start, moved: false, preview: null },
    actions: [selection, { type: 'gesture/begin', label }],
  });

  switch (hit.kind) {
    case 'vertex': {
      const ref = { regionIndex: hit.regionIndex, vertexIndex: hit.vertexIndex };
      const sel: UiAction = { type: 'ui/select', selection: { kind: 'vertex', ...ref } };
      if (ui.tool === 'add_vertex') return { state, actions: [sel] };
      const group = input.altKey ? [ref] : coincidentVertices(doc, ref);
      return drag({ kind: 'vertex', group }, 'Mover vértice', sel);
    }
    case 'piezo_point': {
      const sel: UiAction = { type: 'ui/select', selection: { kind: 'piezo_point', index: hit.index } };
      if (ui.tool === 'add_vertex') return { state, actions: [sel] };
      return drag({ kind: 'piezo_point', index: hit.index }, 'Mover punto de la piezométrica', sel);
    }
    case 'surface_vertex': {
      const sel: UiAction = { type: 'ui/select', selection: { kind: 'surface_vertex', index: hit.index } };
      if (ui.tool === 'add_vertex') return { state, actions: [sel] };
      return drag({ kind: 'surface_vertex', index: hit.index }, 'Mover punto de la polilínea de falla', sel);
    }
    case 'reinforcement_end': {
      const sel: UiAction = { type: 'ui/select', selection: { kind: 'reinforcement_end', index: hit.index, end: hit.end } };
      if (ui.tool === 'add_vertex') return { state, actions: [sel] };
      return drag({ kind: 'reinforcement_end', index: hit.index, end: hit.end }, 'Mover extremo del refuerzo', sel);
    }
    case 'reinforcement_center': {
      const sel: UiAction = { type: 'ui/select', selection: { kind: 'reinforcement', index: hit.index } };
      if (ui.tool === 'add_vertex') return { state, actions: [sel] };
      return drag({ kind: 'reinforcement_move', index: hit.index, grab: screenToWorld(vp, input.x, input.y) as Point }, 'Mover refuerzo', sel);
    }
    case 'reinforcement':
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'reinforcement', index: hit.index } }] };
    case 'circle_center':
      return drag({ kind: 'circle_center' }, 'Mover el centro del círculo', { type: 'ui/select', selection: { kind: 'surface_circle' } });
    case 'circle_radius':
      return drag({ kind: 'circle_radius' }, 'Cambiar el radio del círculo', { type: 'ui/select', selection: { kind: 'surface_circle' } });
    case 'edge': {
      if (ui.tool === 'add_vertex') {
        const at: Point = [roundForScale(hit.point[0], vp.scale), roundForScale(hit.point[1], vp.scale)];
        return {
          state,
          actions: [
            { type: 'vertex/insert', regionIndex: hit.regionIndex, afterIndex: hit.afterIndex, at },
            { type: 'ui/select', selection: { kind: 'vertex', regionIndex: hit.regionIndex, vertexIndex: hit.afterIndex + 1 } },
          ],
        };
      }
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'region', regionIndex: hit.regionIndex } }] };
    }
    case 'piezo_edge': {
      if (ui.tool === 'add_vertex') {
        const at: Point = [roundForScale(hit.point[0], vp.scale), roundForScale(hit.point[1], vp.scale)];
        const next = insertPiezoPoint(piezoPoints(doc), hit.afterIndex, at);
        if (!next) return noop(state);
        return {
          state,
          actions: [
            { type: 'piezo/set', points: next },
            { type: 'ui/select', selection: { kind: 'piezo_point', index: hit.afterIndex + 1 } },
          ],
        };
      }
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'none' } }] };
    }
    case 'surface_edge': {
      // hitTestFor solo la devuelve con «Agregar vértice».
      const surface = doc.analysis.surface;
      if (ui.tool !== 'add_vertex' || !surface || surface.type !== 'polyline') return { state, actions: [{ type: 'ui/select', selection: { kind: 'none' } }] };
      const minGap = polylineMinGap(modelWidth(doc.regions));
      const inserted = insertPolylineVertex(surface.points, hit.afterIndex, minGap);
      if (!inserted) return noop(state);
      // El punto va donde se hizo clic (sobre el tramo), con el redondeo de la escala; se conserva el orden estricto de x.
      const at: Point = [roundForScale(hit.point[0], vp.scale), roundForScale(hit.point[1], vp.scale)];
      const a = surface.points[hit.afterIndex]!;
      const b = surface.points[hit.afterIndex + 1]!;
      const points = surface.points.map((p): Point => [p[0], p[1]]);
      points.splice(hit.afterIndex + 1, 0, at[0] - a[0] >= minGap && b[0] - at[0] >= minGap ? at : inserted.points[hit.afterIndex + 1]!);
      return {
        state,
        actions: [
          { type: 'surface/set', surface: { type: 'polyline', points } },
          { type: 'ui/select', selection: { kind: 'surface_vertex', index: hit.afterIndex + 1 } },
        ],
      };
    }
    case 'search_range':
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'search_range', which: hit.which } }] };
    case 'region':
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'region', regionIndex: hit.regionIndex } }] };
    case 'none':
      return { state, actions: [{ type: 'ui/select', selection: { kind: 'none' } }] };
  }
}

export function pointerMove(state: GestureState, ctx: GestureContext, input: PointerInput): GestureResult {
  const vp = ctx.ui.viewport;
  if (!vp) return noop(state);
  if (state.mode === 'pan') {
    const dx = input.x - state.last[0];
    const dy = input.y - state.last[1];
    if (dx === 0 && dy === 0) return noop(state);
    return {
      state: { mode: 'pan', last: [input.x, input.y] },
      actions: [{ type: 'ui/viewport', viewport: panBy(vp, dx, dy) }],
    };
  }
  if (state.mode === 'drag') {
    const moved = state.moved || Math.hypot(input.x - state.start[0], input.y - state.start[1]) >= DRAG_THRESHOLD_PX;
    if (!moved) return noop(state);
    return { state: { ...state, moved: true, preview: computePreview(state.target, ctx, input) }, actions: [] };
  }
  return noop(state);
}

export function pointerUp(state: GestureState, ctx: GestureContext, input: PointerInput): GestureResult {
  if (state.mode === 'pan') return { state: IDLE, actions: [] };
  if (state.mode !== 'drag') return noop(state);
  const moved = state.moved || Math.hypot(input.x - state.start[0], input.y - state.start[1]) >= DRAG_THRESHOLD_PX;
  if (!moved) return { state: IDLE, actions: [{ type: 'gesture/cancel' }] };
  const preview = computePreview(state.target, ctx, input) ?? state.preview;
  const commands = preview ? commitActions(preview, ctx.doc) : [];
  if (commands.length === 0) return { state: IDLE, actions: [{ type: 'gesture/cancel' }] };
  return { state: IDLE, actions: [...commands, { type: 'gesture/end' }] };
}

/** pointercancel o Escape durante un arrastre: deshace el gesto sin tocar el historial. */
export function pointerCancel(state: GestureState): GestureResult {
  if (state.mode === 'drag') return { state: IDLE, actions: [{ type: 'gesture/cancel' }] };
  return { state: IDLE, actions: [] };
}

/** Doble clic: quita el vértice (o el punto de la piezométrica) bajo el cursor si quedan los mínimos (3 y 2). */
export function doubleClick(ctx: GestureContext, input: PointerInput): CanvasAction[] {
  const vp = ctx.ui.viewport;
  if (!vp || ctx.ui.tool === 'pan') return [];
  const hit = hitTestFor(ctx.doc, vp, input, ctx.ui.snap.radiusPx, false);
  if (hit.kind === 'vertex') {
    if ((ctx.doc.regions[hit.regionIndex]?.polygon.length ?? 0) <= 3) return [];
    return [
      { type: 'vertex/remove', regionIndex: hit.regionIndex, vertexIndex: hit.vertexIndex },
      { type: 'ui/select', selection: { kind: 'none' } },
    ];
  }
  if (hit.kind === 'surface_vertex') {
    const surface = ctx.doc.analysis.surface;
    const next = surface && surface.type === 'polyline' ? removePolylineVertex(surface.points, hit.index) : null;
    if (!next) return [];
    return [{ type: 'surface/set', surface: { type: 'polyline', points: next } }, { type: 'ui/select', selection: { kind: 'none' } }];
  }
  if (hit.kind === 'piezo_point') {
    const next = removePiezoPoint(piezoPoints(ctx.doc), hit.index);
    if (!next) return [];
    return [{ type: 'piezo/set', points: next }, { type: 'ui/select', selection: { kind: 'none' } }];
  }
  return [];
}

/** Aplica una lista de acciones al store. */
export function runActions(store: EditorStore, actions: readonly CanvasAction[]): void {
  for (const a of actions) {
    switch (a.type) {
      case 'gesture/begin':
        store.beginGesture(a.label);
        break;
      case 'gesture/end':
        store.endGesture();
        break;
      case 'gesture/cancel':
        store.cancelGesture();
        break;
      case 'history/undo':
        store.undo();
        break;
      case 'history/redo':
        store.redo();
        break;
      default:
        store.dispatch(a);
    }
  }
}
