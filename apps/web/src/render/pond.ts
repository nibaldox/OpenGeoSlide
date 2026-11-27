// Agua embalsada (F5.3, E15c): la región entre la piezométrica y el terreno donde la piezométrica queda SOBRE el terreno. Como en
// el motor, abarca todo el modelo (no solo la masa de la superficie evaluada) y la piezométrica se prolonga en horizontal hasta los
// bordes del modelo (`piezoExtension`). Módulo puro: lo consumen el lienzo del editor (SVG), la vista de Casos (Canvas 2D) y el PDF.

import type { Point } from '../engine/types';
import { groundPieces } from '../editor/state/polylineGround.ts';

type Regions = ReadonlyArray<{ polygon: ReadonlyArray<readonly [number, number]> }>;

/** Calados menores que esta fracción de la escala del modelo no se dibujan: es redondeo, no agua. */
const THICKNESS_EPS = 1e-9;

/** Ordenada de la piezométrica en `x`: lineal entre sus puntos y horizontal fuera de su rango (como `piezometric_y` del motor). */
function piezoAt(line: readonly Point[], x: number): number {
  const first = line[0] as Point;
  const last = line[line.length - 1] as Point;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  let i = 0;
  while (i + 1 < line.length - 1 && (line[i + 1] as Point)[0] <= x) i += 1;
  const a = line[i] as Point;
  const b = line[i + 1] as Point;
  return b[0] === a[0] ? b[1] : a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
}

const samePoint = (a: Point | undefined, b: Point): boolean => a !== undefined && Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;

interface Stretch {
  /** Extremos del tramo con agua, con el terreno y la piezométrica en cada uno. */
  u: number;
  v: number;
  gu: number;
  gv: number;
  pu: number;
  pv: number;
  /** El tramo empieza en el borde del intervalo (continúa al anterior) / termina en el borde del intervalo. */
  startsAtEdge: boolean;
  endsAtEdge: boolean;
}

/** Tramos con agua: por tramo lineal del terreno, partido en los vértices de la piezométrica y en los cruces. De izquierda a derecha. */
function stretches(regions: Regions, line: readonly Point[]): Stretch[] {
  const pieces = groundPieces(regions);
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const r of regions) for (const p of r.polygon) {
    ymin = Math.min(ymin, p[1]);
    ymax = Math.max(ymax, p[1]);
  }
  const eps = THICKNESS_EPS * Math.max(ymax - ymin, 1);
  const out: Stretch[] = [];
  for (const g of pieces) {
    const ground = (x: number): number => g.y0 + ((x - g.x0) * (g.y1 - g.y0)) / (g.x1 - g.x0);
    const xs = [g.x0, ...line.map((p) => p[0]).filter((x) => x > g.x0 && x < g.x1), g.x1];
    for (let i = 0; i + 1 < xs.length; i += 1) {
      const a = xs[i] as number;
      const b = xs[i + 1] as number;
      const ha = piezoAt(line, a) - ground(a);
      const hb = piezoAt(line, b) - ground(b);
      if (ha <= eps && hb <= eps) continue;
      const cross = ha <= eps || hb <= eps ? a + ((b - a) * (0 - ha)) / (hb - ha) : NaN;
      const u = ha <= eps ? cross : a;
      const v = hb <= eps ? cross : b;
      out.push({ u, v, gu: ground(u), gv: ground(v), pu: piezoAt(line, u), pv: piezoAt(line, v), startsAtEdge: ha > eps, endsAtEdge: hb > eps });
    }
  }
  return out;
}

const cleanLine = (line: readonly Point[] | null | undefined): Point[] =>
  [...(line ?? [])].filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]);

/**
 * Polígonos del agua embalsada, uno por tramo continuo del terreno bajo agua. Cada polígono recorre la piezométrica de izquierda a
 * derecha y vuelve por el terreno; un escalón del terreno (paramento vertical de una presa) queda como borde vertical.
 * Vacío si no hay piezométrica o no pasa sobre el terreno.
 */
export function pondPolygons(regions: Regions, piezometricLine: readonly Point[] | null | undefined): Point[][] {
  const line = cleanLine(piezometricLine);
  if (line.length === 0) return [];
  const out: Point[][] = [];
  let top: Point[] = [];
  let bottom: Point[] = [];
  let open = false;
  let prevV = NaN;
  const push = (list: Point[], p: Point): void => {
    if (!samePoint(list[list.length - 1], p)) list.push(p);
  };
  const flush = (): void => {
    if (top.length >= 2 && bottom.length >= 2) out.push([...top, ...[...bottom].reverse()]);
    top = [];
    bottom = [];
    open = false;
  };
  for (const s of stretches(regions, line)) {
    // Un tramo que no arranca en el borde del anterior (o el anterior no llegó a su borde) abre un polígono nuevo.
    if (!(open && s.startsAtEdge && Math.abs(prevV - s.u) < 1e-12)) flush();
    push(top, [s.u, s.pu]);
    push(bottom, [s.u, s.gu]);
    push(top, [s.v, s.pv]);
    push(bottom, [s.v, s.gv]);
    open = s.endsAtEdge;
    prevV = s.v;
    if (!open) flush();
  }
  flush();
  return out;
}

/** Calado máximo del agua embalsada (piezométrica − terreno), o 0 sin agua sobre el terreno. Para rótulos y avisos. */
export function pondMaxDepth(regions: Regions, piezometricLine: readonly Point[] | null | undefined): number {
  const line = cleanLine(piezometricLine);
  if (line.length === 0) return 0;
  let max = 0;
  for (const s of stretches(regions, line)) max = Math.max(max, s.pu - s.gu, s.pv - s.gv);
  return max;
}
