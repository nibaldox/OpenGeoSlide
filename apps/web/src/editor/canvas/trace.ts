// Trazo en curso de «Dibujar región» y «Dividir región»: qué se conserva y qué se descarta (R8 A-01, A-04, B-08). Puro.
//
// El trazo vive en el lienzo (no entra en el documento ni en el historial hasta cerrar). Para que el resto de la aplicación
// pueda decidir con él (¿hay cambios sin guardar?, ¿pido confirmación al cambiar de herramienta?), el lienzo publica su
// número de puntos en `ui.tracePoints` (`ui/trace`).

import type { Tool } from '../types';
import { EMPTY_DRAFT, type DrawDraft } from './draw';

/** Desde este número de puntos, descartar el trazo por cambiar de herramienta pide confirmación; con menos, solo se anuncia. */
export const TRACE_CONFIRM_MIN_POINTS = 3;

export const isTraceTool = (tool: Tool | string): boolean => tool === 'draw_region' || tool === 'split_region';

export interface TraceReset {
  draft: DrawDraft;
  /** Texto para la región aria-live, o `null` si no había nada que descartar. */
  announce: string | null;
}

const plural = (n: number): string => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

function hasTrace(draft: DrawDraft): boolean {
  return draft.points.length > 0 || draft.cursor !== null;
}

/** Se cargó otro documento (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar borrador, importación): el trazo era del anterior. */
export function traceOnDocChange(draft: DrawDraft): TraceReset {
  if (!hasTrace(draft)) return { draft, announce: null };
  const n = draft.points.length;
  return {
    draft: EMPTY_DRAFT,
    announce: n > 0 ? `Se descartó el trazo en curso (${plural(n)}) porque se cargó otro modelo.` : null,
  };
}

/** Cambio de herramienta: el trazo se descarta al salir de una herramienta de trazo (o al pasar de una a la otra). */
export function traceOnToolChange(draft: DrawDraft, from: Tool, to: Tool): TraceReset {
  if (from === to) return { draft, announce: null };
  if (!isTraceTool(from)) return { draft, announce: null };
  if (!hasTrace(draft)) return { draft, announce: null };
  const n = draft.points.length;
  return {
    draft: EMPTY_DRAFT,
    announce: n > 0 ? `Se descartó el trazo en curso (${plural(n)}) al cambiar de herramienta.` : null,
  };
}

/** ¿Hay que preguntar antes de cambiar de herramienta? (trazo de 3 o más puntos que se perdería). */
export function traceToolSwitchNeedsConfirm(points: number, from: Tool, to: Tool): boolean {
  return from !== to && isTraceTool(from) && points >= TRACE_CONFIRM_MIN_POINTS;
}

/** Texto de la confirmación: dice cuántos puntos se pierden y que no se puede deshacer. */
export function traceDiscardConfirm(points: number): { title: string; message: string; confirmLabel: string; cancelLabel: string; tone: 'danger' } {
  return {
    title: 'Descartar el trazo en curso',
    message: `Hay un trazo de ${plural(points)} sin cerrar. Si cambia de herramienta se descarta y no se puede deshacer. Para conservarlo, cancele y ciérrelo con Intro.`,
    confirmLabel: 'Descartar el trazo',
    cancelLabel: 'Seguir trazando',
    tone: 'danger',
  };
}
