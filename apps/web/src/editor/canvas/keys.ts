// Atajos de teclado del lienzo, como función pura: tecla → lista de acciones.
//   Ctrl+Z deshace; Ctrl+Mayús+Z o Ctrl+Y rehace; Supr/Retroceso quita el vértice o punto seleccionado;
//   flechas mueven la selección 1 paso de rejilla (Mayús = ×10); Escape deselecciona.

import type { Point } from '../../engine/types';
import { coincidentVertices, piezoPoints } from './geom';
import { movePiezoPoint, removePiezoPoint } from './edits';
import type { CanvasAction, GestureContext } from './gesture';

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface KeyResult {
  /** Si es true, el componente debe llamar a preventDefault(). */
  handled: boolean;
  actions: CanvasAction[];
}

/** Paso de las flechas, en metros, cuando no hay rejilla activa. */
export const DEFAULT_ARROW_STEP = 0.1;

const NOT_HANDLED: KeyResult = { handled: false, actions: [] };

function clean(v: number): number {
  return Number(v.toPrecision(12));
}

export function keyActions(ctx: GestureContext, k: KeyInput, gestureActive = false): KeyResult {
  if (gestureActive) return NOT_HANDLED; // Escape se resuelve como cancelación del gesto en el componente.
  const { doc, ui } = ctx;
  const mod = k.ctrlKey || k.metaKey;
  const lower = k.key.length === 1 ? k.key.toLowerCase() : k.key;

  if (mod && lower === 'z') {
    return { handled: true, actions: [{ type: k.shiftKey ? 'history/redo' : 'history/undo' }] };
  }
  if (mod && lower === 'y') return { handled: true, actions: [{ type: 'history/redo' }] };
  if (mod || k.altKey) return NOT_HANDLED;

  const sel = ui.selection;

  if (k.key === 'Escape') {
    if (sel.kind === 'none') return NOT_HANDLED;
    return { handled: true, actions: [{ type: 'ui/select', selection: { kind: 'none' } }] };
  }

  if (k.key === 'Delete' || k.key === 'Backspace') {
    if (sel.kind === 'vertex') {
      if ((doc.regions[sel.regionIndex]?.polygon.length ?? 0) <= 3) return { handled: true, actions: [] };
      return {
        handled: true,
        actions: [
          { type: 'vertex/remove', regionIndex: sel.regionIndex, vertexIndex: sel.vertexIndex },
          { type: 'ui/select', selection: { kind: 'none' } },
        ],
      };
    }
    if (sel.kind === 'piezo_point') {
      const next = removePiezoPoint(piezoPoints(doc), sel.index);
      if (!next) return { handled: true, actions: [] };
      return { handled: true, actions: [{ type: 'piezo/set', points: next }, { type: 'ui/select', selection: { kind: 'none' } }] };
    }
    return NOT_HANDLED;
  }

  const dir: Point | null =
    k.key === 'ArrowLeft' ? [-1, 0] : k.key === 'ArrowRight' ? [1, 0] : k.key === 'ArrowUp' ? [0, 1] : k.key === 'ArrowDown' ? [0, -1] : null;
  if (!dir) return NOT_HANDLED;

  const step = (ui.snap.gridStep !== null && ui.snap.gridStep > 0 ? ui.snap.gridStep : DEFAULT_ARROW_STEP) * (k.shiftKey ? 10 : 1);
  const dx = dir[0] * step;
  const dy = dir[1] * step;
  const shift = (p: Point): Point => [clean(p[0] + dx), clean(p[1] + dy)];

  if (sel.kind === 'vertex') {
    const origin = doc.regions[sel.regionIndex]?.polygon[sel.vertexIndex];
    if (!origin) return NOT_HANDLED;
    const group = coincidentVertices(doc, sel);
    const moves: CanvasAction[] = group.map((r) => ({
      type: 'vertex/move',
      regionIndex: r.regionIndex,
      vertexIndex: r.vertexIndex,
      to: shift(origin),
    }));
    // Varias regiones comparten el vértice: un solo paso de historial.
    return { handled: true, actions: group.length > 1 ? [{ type: 'gesture/begin', label: 'Mover vértice' }, ...moves, { type: 'gesture/end' }] : moves };
  }
  if (sel.kind === 'piezo_point') {
    const pts = piezoPoints(doc);
    const cur = pts[sel.index];
    if (!cur) return NOT_HANDLED;
    const next = movePiezoPoint(pts, sel.index, shift(cur));
    return { handled: true, actions: next ? [{ type: 'piezo/set', points: next }] : [] };
  }
  if (sel.kind === 'surface_circle') {
    const c = doc.analysis.surface;
    if (!c) return NOT_HANDLED;
    return {
      handled: true,
      actions: [{ type: 'surface/set', surface: { type: 'circle', xc: clean(c.xc + dx), yc: clean(c.yc + dy), r: c.r } }],
    };
  }
  return NOT_HANDLED;
}
