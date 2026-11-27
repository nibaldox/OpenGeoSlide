// Encuadre que deja libre el HUD (UA2-F1): lógica pura. El armazón mide la caja del HUD relativa a la tarjeta del lienzo,
// elige los márgenes de `fitInsets` que dan la mayor escala sin tapar el modelo, y reencuadra solo si el usuario no movió la vista.

import type { FitInsets } from '../../canvas/EditorCanvas';
import { fitToDocInsets, insetsFeasible } from '../../canvas/viewportOps';
import type { ModelDoc } from '../../types';
import type { Viewport } from '../../../geometry/viewport';

/** Caja en px, relativa a la esquina superior izquierda del lienzo (el borde interior de la tarjeta). */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Aire entre el HUD y el modelo. */
export const HUD_GAP_PX = 12;

/** Una escala debe superar a la del candidato anterior en esta proporción para cambiarlo (evita saltos al editar). */
export const PICK_HYSTERESIS = 1.05;

export type HudPick = 'base' | 'below' | 'beside';

export interface HudFitInput {
  doc: ModelDoc;
  /** Tamaño del lienzo en px. */
  width: number;
  height: number;
  /** Márgenes fijos del contrato §4.2. */
  base: FitInsets;
  /** Caja del HUD; `null` si no hay (móvil: el HUD es estático) o no se midió. */
  hud: Box | null;
  /** HUD plegado a píldora: solo cuenta el margen superior. */
  collapsed: boolean;
  /** Candidato elegido la vez anterior, para la histéresis. */
  prev?: HudPick;
  gap?: number;
}

export interface HudFit {
  insets: FitInsets;
  pick: HudPick;
}

const sameInsets = (a: FitInsets, b: FitInsets): boolean => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

/** Candidato A: los márgenes fijos con `top` bajo el HUD. Candidato B: con `left` a la derecha del HUD. */
export function hudCandidates(base: FitInsets, hud: Box, gap: number = HUD_GAP_PX): { below: FitInsets; beside: FitInsets } {
  return {
    below: { ...base, top: Math.max(base.top, Math.ceil(hud.bottom + gap)) },
    beside: { ...base, left: Math.max(base.left, Math.ceil(hud.right + gap)) },
  };
}

/**
 * Márgenes de encuadre con el HUD desplegado: de los dos candidatos, el de mayor escala para los límites del documento
 * (la misma cuenta que `fitToDocInsets`). Un candidato cuyos márgenes no caben (se reducirían y el HUD taparía el modelo)
 * solo gana si el otro tampoco cabe. Plegado, el margen superior deja libre la píldora. Sin HUD, los márgenes fijos.
 */
export function chooseHudFit(input: HudFitInput): HudFit {
  const { doc, width, height, base, hud, collapsed, prev, gap = HUD_GAP_PX } = input;
  if (!hud || !(hud.right > hud.left) || !(hud.bottom > hud.top) || doc.regions.length === 0) return { insets: base, pick: 'base' };
  const { below, beside } = hudCandidates(base, hud, gap);
  if (collapsed) return { insets: below, pick: 'below' };
  const fits = (i: FitInsets): boolean => insetsFeasible(width, height, i);
  const scale = (i: FitInsets): number => fitToDocInsets(doc, width, height, i).scale;
  const fa = fits(below);
  const fb = fits(beside);
  const sa = scale(below);
  const sb = scale(beside);
  // Un candidato cuyos márgenes no caben se reduciría y dejaría el HUD sobre el modelo: solo gana si el otro tampoco cabe.
  if (fa !== fb) return fa ? { insets: below, pick: 'below' } : { insets: beside, pick: 'beside' };
  // Histéresis: se conserva el candidato anterior salvo que el otro lo supere con claridad.
  if (prev === 'below' && sa * PICK_HYSTERESIS >= sb) return { insets: below, pick: 'below' };
  if (prev === 'beside' && sb * PICK_HYSTERESIS >= sa) return { insets: beside, pick: 'beside' };
  return sb > sa ? { insets: beside, pick: 'beside' } : { insets: below, pick: 'below' };
}

/** Misma identidad de valores (no de objeto) para no repetir el encuadre cuando el padre pasa márgenes iguales. */
export function insetsEqual(a: FitInsets | undefined, b: FitInsets | undefined): boolean {
  return a === b || (!!a && !!b && sameInsets(a, b));
}

const EPS = 1e-6;

/** ¿Son iguales dos vistas (escala, desplazamiento y tamaño)? */
export function sameViewport(a: Viewport, b: Viewport): boolean {
  return Math.abs(a.scale - b.scale) <= EPS * Math.max(1, Math.abs(a.scale)) && Math.abs(a.tx - b.tx) <= 1e-3 && Math.abs(a.ty - b.ty) <= 1e-3 && a.width === b.width && a.height === b.height;
}

/**
 * Regla del «último encuadre automático»: la vista actual se puede reencuadrar sola si es exactamente la que dejó el
 * último encuadre automático (al abrir, «Encuadrar» o un reencuadre por márgenes). Si el usuario hizo zoom o movió la
 * vista desde entonces, no se toca.
 */
export function isLastAutoFit(current: Viewport | null, lastAuto: Viewport | null): boolean {
  return current !== null && lastAuto !== null && sameViewport(current, lastAuto);
}

/** Caja de un rectángulo de pantalla relativa a un origen (la esquina interior de la tarjeta del lienzo). */
export function boxOf(rect: { left: number; top: number; right: number; bottom: number }, origin: { left: number; top: number }): Box {
  return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
}
