// Modelo de vista del lienzo: textos en español (coma decimal), rejilla, cargas y sismo en coordenadas de pantalla.
// Puro y sin React, para poder probarlo en entorno node.

import type { Point } from '../../engine/types';
import { worldToScreen, screenToWorld, type Viewport } from '../../geometry/viewport';
import type { ModelDoc } from '../types';
import { modelXRange, topY } from './geom';
import { BAND_HEIGHT_PX, searchRange } from './hitTest';

/** Número con coma decimal: al menos `minDec` y como máximo `maxDec` decimales (se recortan ceros sobrantes). */
export function formatNumber(v: number, minDec = 1, maxDec = 3): string {
  if (!Number.isFinite(v)) return '—';
  let s = v.toFixed(maxDec);
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length;
  while (end - dot - 1 > minDec && s[end - 1] === '0') end--;
  s = s.slice(0, end);
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s.replace('.', ',');
}

export function vertexLabel(regionIndex: number, vertexIndex: number, p: Point): string {
  return `Región ${regionIndex + 1}, vértice ${vertexIndex + 1}: x ${formatNumber(p[0])} m, y ${formatNumber(p[1])} m`;
}

export function piezoLabel(index: number, p: Point): string {
  return `Piezométrica, punto ${index + 1}: x ${formatNumber(p[0])} m, y ${formatNumber(p[1])} m`;
}

export function circleCenterLabel(xc: number, yc: number): string {
  return `Círculo de falla, centro: x ${formatNumber(xc)} m, y ${formatNumber(yc)} m`;
}

export function circleRadiusLabel(r: number): string {
  return `Círculo de falla, radio: ${formatNumber(r)} m`;
}

export function seismicLabel(seismic: { kh?: number; kv?: number }): string {
  return `kh = ${formatNumber(seismic.kh ?? 0, 2, 4)} · kv = ${formatNumber(seismic.kv ?? 0, 2, 4)}`;
}

export const SEISMIC_BADGE = { width: 196, height: 50, margin: 10 } as const;

/**
 * Recuadro del indicador de sismo: esquina superior derecha del área de dibujo, que no tiene etiquetas de eje
 * (las del eje Y van a la izquierda y las del eje X abajo). Incluye el texto y el segmento de la flecha.
 */
export function seismicBadge(
  vp: Pick<Viewport, 'width'>,
  dir: 1 | -1,
): { x: number; y: number; width: number; height: number; textX: number; textY: number; arrowX1: number; arrowX2: number; arrowY: number } {
  const { width, height, margin } = SEISMIC_BADGE;
  const x = Math.max(margin, vp.width - width - margin);
  const y = margin;
  const left = x + 8;
  const right = x + width - 8;
  return {
    x,
    y,
    width,
    height,
    textX: left,
    textY: y + 19,
    arrowX1: dir === 1 ? left : right,
    arrowX2: dir === 1 ? right : left,
    arrowY: y + 36,
  };
}

export function isImperial(doc: ModelDoc): boolean {
  return /imp/i.test(doc.units ?? '');
}

/** Sentido de deslizamiento: +1 hacia +x, −1 hacia −x. Con `auto`, hacia el lado más bajo del terreno. */
export function slideDirection(doc: ModelDoc): 1 | -1 {
  const d = doc.slope?.direction ?? 'auto';
  if (d === 'left_to_right') return 1;
  if (d === 'right_to_left') return -1;
  const range = modelXRange(doc);
  if (!range) return 1;
  const yl = topY(doc, range[0]) ?? 0;
  const yr = topY(doc, range[1]) ?? 0;
  return yl >= yr ? 1 : -1;
}

export function pointsAttr(vp: Viewport, pts: readonly Point[]): string {
  return pts
    .map(([x, y]) => {
      const [sx, sy] = worldToScreen(vp, x, y);
      return `${round2(sx)},${round2(sy)}`;
    })
    .join(' ');
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------- Rejilla ----------

export interface GridLine {
  /** Posición en píxeles. */
  px: number;
  label: string;
}

/** Paso «bonito» (1, 2 o 5 × 10^k) que deja al menos `minPx` píxeles entre líneas. */
export function niceStep(scale: number, minPx = 70): number {
  const raw = minPx / scale;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

export function gridLines(vp: Viewport): { vertical: GridLine[]; horizontal: GridLine[]; step: number } {
  const step = niceStep(vp.scale);
  const [x0, y1] = screenToWorld(vp, 0, 0);
  const [x1, y0] = screenToWorld(vp, vp.width, vp.height);
  const vertical: GridLine[] = [];
  const horizontal: GridLine[] = [];
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  for (let i = Math.ceil(x0 / step), n = 0; i * step <= x1 && n < 400; i++, n++) {
    const x = Number((i * step).toPrecision(12));
    vertical.push({ px: worldToScreen(vp, x, 0)[0], label: formatNumber(x, 0, dec) });
  }
  for (let j = Math.ceil(y0 / step), n = 0; j * step <= y1 && n < 400; j++, n++) {
    const y = Number((j * step).toPrecision(12));
    horizontal.push({ px: worldToScreen(vp, 0, y)[1], label: formatNumber(y, 0, dec) });
  }
  return { vertical, horizontal, step };
}

// ---------- Bandas de búsqueda ----------

/** Polígono (pantalla) de la banda de un rango de búsqueda siguiendo el terreno, o null si no hay rango o terreno. */
export function rangeBand(doc: ModelDoc, vp: Viewport, which: 'entry' | 'exit'): Point[] | null {
  const range = searchRange(doc, which);
  if (!range) return null;
  const xs = new Set<number>([range[0], range[1]]);
  for (const region of doc.regions) for (const [x] of region.polygon) if (x > range[0] && x < range[1]) xs.add(x);
  const lower: Point[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    const y = topY(doc, x);
    if (y !== null) lower.push(worldToScreen(vp, x, y));
  }
  if (lower.length < 2) return null;
  const upper = lower.map(([sx, sy]): Point => [sx, sy - BAND_HEIGHT_PX]).reverse();
  return [...lower, ...upper];
}

export function rangeLabel(which: 'entry' | 'exit', range: [number, number]): string {
  const name = which === 'entry' ? 'Entrada' : 'Salida';
  return `${name}: x ${formatNumber(Math.min(...range))} a ${formatNumber(Math.max(...range))} m`;
}

// ---------- Cargas ----------

export interface Arrow {
  /** Cola y punta, en píxeles. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type LoadShape =
  | { kind: 'udl'; index: number; arrows: Arrow[]; topLine: Point[]; label: { x: number; y: number; text: string } }
  | { kind: 'line'; index: number; arrow: Arrow; label: { x: number; y: number; text: string } };

export const UDL_ARROW_PX = 26;
export const LINE_ARROW_PX = 46;
export const UDL_SPACING_PX = 24;

export function loadShapes(doc: ModelDoc, vp: Viewport): LoadShape[] {
  const out: LoadShape[] = [];
  const imp = isImperial(doc);
  (doc.loads ?? []).forEach((load, index) => {
    if (load.type === 'udl') {
      const widthPx = Math.abs(load.x2 - load.x1) * vp.scale;
      const n = Math.min(60, Math.max(2, Math.round(widthPx / UDL_SPACING_PX) + 1));
      const arrows: Arrow[] = [];
      const topLine: Point[] = [];
      for (let i = 0; i < n; i++) {
        const x = load.x1 + ((load.x2 - load.x1) * i) / (n - 1);
        const y = topY(doc, x);
        if (y === null) continue;
        const [sx, sy] = worldToScreen(vp, x, y);
        arrows.push({ x1: sx, y1: sy - UDL_ARROW_PX, x2: sx, y2: sy });
        topLine.push([sx, sy - UDL_ARROW_PX]);
      }
      if (arrows.length === 0) return;
      const mid = arrows[Math.floor(arrows.length / 2)];
      out.push({
        kind: 'udl',
        index,
        arrows,
        topLine,
        label: { x: mid.x1, y: mid.y1 - 6, text: `q = ${formatNumber(load.q)} ${imp ? 'psf' : 'kPa'}` },
      });
    } else {
      const y = topY(doc, load.x);
      if (y === null) return;
      const [sx, sy] = worldToScreen(vp, load.x, y);
      const th = (load.angle * Math.PI) / 180;
      // Dirección en pantalla: hacia abajo girada hacia +x con ángulo positivo.
      const dx = Math.sin(th);
      const dy = Math.cos(th);
      const arrow: Arrow = { x1: sx - dx * LINE_ARROW_PX, y1: sy - dy * LINE_ARROW_PX, x2: sx, y2: sy };
      out.push({
        kind: 'line',
        index,
        arrow,
        label: { x: arrow.x1, y: arrow.y1 - 6, text: `p = ${formatNumber(load.p)} ${imp ? 'lbf/ft' : 'kN/m'} · ${formatNumber(load.angle, 0, 1)}°` },
      });
    }
  });
  return out;
}
