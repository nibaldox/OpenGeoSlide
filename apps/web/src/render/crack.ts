// Grieta de tracción de la superficie crítica (F5.4, G1 a G3), en el lienzo y en el informe. Módulo puro: calcula la geometría en el
// mundo y en píxeles; lo consumen el lienzo del editor (SVG), la vista de Casos (Canvas 2D) y el PDF (con un `Viewport` propio).
//
// El motor da `tension_crack: { x, depth, water_force }` en cada resultado truncado (`CrackReport`). `x` es `x_c`, el primer punto desde
// la cresta donde terreno − base ≥ profundidad: la base de la masa en `x_c` sale de las dovelas (el borde de la primera o la última), y
// la grieta sube desde allí `depth` hasta el terreno. `Pw = ½·γw·hw²` con `hw = depth·water_fill`, horizontal y en el sentido del
// deslizamiento (G3), es decir, hacia la masa: la flecha apunta del lado de la cresta hacia las dovelas.

import type { CrackReport, Slice } from '../engine/types';
import { worldToScreen, type Viewport } from '../geometry/viewport';
import { formatNumber, lengthUnitOf } from '../editor/canvas/layout';
import { forceUnit } from '../editor/canvas/reinforcements';

export interface CrackGeometry {
  /** `x_c` de la grieta. */
  x: number;
  /** Ordenada de la base de la masa en `x_c`. */
  yBase: number;
  /** Ordenada del terreno en `x_c` (base + profundidad). */
  yTop: number;
  depth: number;
  /** Fracción llena de agua, en [0, 1]. */
  waterFill: number;
  /** Altura del agua en la grieta: `depth·waterFill`. */
  hw: number;
  /** Ordenada de la resultante de Pw: `yBase + hw/3`. */
  yForce: number;
  /** Pw por metro de talud; 0 con la grieta seca. */
  force: number;
  /** Sentido horizontal de Pw en el mundo: +1 hacia +x, −1 hacia −x (el de las dovelas respecto de la cara). */
  dir: 1 | -1;
}

/**
 * Geometría de la grieta del resultado. `waterFill` es el del modelo (`analysis.tension_crack.water_fill`); si no se conoce, se deduce de
 * `water_force`: con fuerza es 1 y sin ella 0. `null` sin grieta o sin dovelas.
 */
export function crackGeometry(crack: CrackReport | null | undefined, slices: readonly Slice[], waterFill?: number | null): CrackGeometry | null {
  if (!crack || slices.length === 0) return null;
  if (!Number.isFinite(crack.x) || !Number.isFinite(crack.depth) || !(crack.depth > 0)) return null;
  // La base en `x_c`: el borde de dovela más cercano (el truncado agrega un nodo en `x_c`, así que coincide).
  let yBase = Number.NaN;
  let best = Infinity;
  let sumMid = 0;
  for (const s of slices) {
    sumMid += 0.5 * (s.x_left + s.x_right);
    const dl = Math.abs(s.x_left - crack.x);
    if (dl < best) {
      best = dl;
      yBase = s.y_base_left;
    }
    const dr = Math.abs(s.x_right - crack.x);
    if (dr < best) {
      best = dr;
      yBase = s.y_base_right;
    }
  }
  if (!Number.isFinite(yBase)) return null;
  const fill = Math.min(1, Math.max(0, waterFill ?? (crack.water_force > 0 ? 1 : 0)));
  const hw = crack.depth * fill;
  const meanMid = sumMid / slices.length;
  return {
    x: crack.x,
    yBase,
    yTop: yBase + crack.depth,
    depth: crack.depth,
    waterFill: fill,
    hw,
    yForce: yBase + hw / 3,
    force: crack.water_force,
    dir: meanMid >= crack.x ? 1 : -1,
  };
}

/** Longitud de la flecha de Pw, en px. */
export const CRACK_ARROW_PX = 40;
/** Ancho del hueco de agua dibujado dentro de la grieta, en px. */
export const CRACK_WATER_PX = 6;

export interface CrackShape {
  /** La línea discontinua vertical: del terreno a la base, en px. */
  top: [number, number];
  bottom: [number, number];
  /** Hueco de agua en la grieta (rectángulo en px) o `null` con la grieta seca. */
  water: { x: number; y: number; width: number; height: number } | null;
  /** Flecha de Pw: cola en la cara de la grieta y punta hacia la masa; `null` sin agua. */
  arrow: { at: [number, number]; tip: [number, number] } | null;
  depthLabel: { x: number; y: number; text: string; anchor: 'start' | 'end' };
  forceLabel: { x: number; y: number; text: string; anchor: 'start' | 'end' } | null;
  title: string;
}

/** Texto del rótulo de la profundidad: «Grieta d = 2.43 m». */
export function crackDepthText(depth: number, units?: string | null): string {
  return `Grieta d = ${formatNumber(depth, 1, 2)} ${lengthUnitOf(units)}`;
}

/** Texto del rótulo de la fuerza del agua: «Pw = 19.6 kN/m». */
export function crackForceText(force: number, units?: string | null): string {
  return `Pw = ${formatNumber(force, 1, 2)} ${forceUnit(units)}`;
}

/** Descripción accesible y pie del dibujo: posición, profundidad y fuerza del agua. */
export function crackTitle(g: Pick<CrackGeometry, 'x' | 'depth' | 'waterFill' | 'force'>, units?: string | null): string {
  const L = lengthUnitOf(units);
  const head = `Grieta de tracción en x = ${formatNumber(g.x, 1, 2)} ${L}, profundidad ${formatNumber(g.depth, 1, 2)} ${L}`;
  return g.force > 0 || g.waterFill > 0
    ? `${head}; agua en la grieta ${formatNumber(g.waterFill * 100, 0, 0)} %, Pw = ${formatNumber(g.force, 1, 2)} ${forceUnit(units)}`
    : `${head}; grieta seca (Pw = 0)`;
}

/** La grieta en píxeles para el `Viewport` dado. */
export function crackShape(g: CrackGeometry, vp: Viewport, units?: string | null): CrackShape {
  const top = worldToScreen(vp, g.x, g.yTop);
  const bottom = worldToScreen(vp, g.x, g.yBase);
  const wet = g.hw > 0 && g.force > 0;
  // El hueco de agua queda del lado de la cresta (opuesto a las dovelas), pegado a la cara de la grieta.
  const waterTop = worldToScreen(vp, g.x, g.yBase + g.hw);
  const water = wet
    ? { x: g.dir === 1 ? bottom[0] - CRACK_WATER_PX : bottom[0], y: waterTop[1], width: CRACK_WATER_PX, height: Math.max(bottom[1] - waterTop[1], 0) }
    : null;
  const at = worldToScreen(vp, g.x, g.yForce);
  const tip: [number, number] = [at[0] + g.dir * CRACK_ARROW_PX, at[1]];
  const crestSide = (g.dir === 1 ? 'end' : 'start') as 'start' | 'end';
  const massSide = (g.dir === 1 ? 'start' : 'end') as 'start' | 'end';
  return {
    top,
    bottom,
    water,
    arrow: wet ? { at, tip } : null,
    // La profundidad va del lado de la cresta, a media altura; la fuerza, tras la punta de la flecha.
    depthLabel: { x: top[0] - g.dir * 8, y: 0.5 * (top[1] + bottom[1]), text: crackDepthText(g.depth, units), anchor: crestSide },
    forceLabel: wet ? { x: tip[0] + g.dir * 5, y: tip[1] - 6, text: crackForceText(g.force, units), anchor: massSide } : null,
    title: crackTitle(g, units),
  };
}
