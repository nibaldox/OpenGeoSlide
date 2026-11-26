// Refuerzos (v0.4) en el lienzo: geometría de los extremos, valores por omisión de un refuerzo nuevo, textos accesibles y
// formas (en píxeles) del símbolo de cada tipo y de las flechas de fuerza del resultado. Puro: sin React ni DOM, para que
// el editor (SVG) y la vista Casos (Canvas 2D) dibujen lo mismo.
//
// Convención de F4.2: (x1, y1) es la cabeza y (x2, y2) la punta. La tablestaca es vertical (x1 = x2): al mover un extremo
// solo cambia su y; al mover el centro, los dos extremos se desplazan juntos y x1 = x2 se conserva.

import type { Point, Reinforcement, ReinforcementApplication, ReinforcementForce } from '../../engine/types';
import { worldToScreen, type Viewport } from '../../geometry/viewport';
import { isImperialUnits } from '../state/units';
import type { ModelDoc } from '../types';
import { formatNumber, lengthUnitOf } from './layout';

export type ReinforcementType = Reinforcement['type'];

/** Estado de un cruce en `reinforcement_forces`: los tres de F4.9 y `no_capacity` (E14m-4). */
export type ForceStatus = ReinforcementForce['status'] | 'no_capacity';

export const REINFORCEMENT_TYPES: readonly ReinforcementType[] = ['anchor', 'nail', 'geosynthetic', 'pile', 'sheet_pile'];

/** Rótulos de los tipos (F4.11). */
export const REINFORCEMENT_TYPE_LABEL: Record<ReinforcementType, string> = {
  anchor: 'Anclaje',
  nail: 'Clavo',
  geosynthetic: 'Geosintético',
  pile: 'Pilote',
  sheet_pile: 'Tablestaca',
};

export const APPLICATION_LABEL: Record<ReinforcementApplication, string> = { active: 'activa', passive: 'pasiva' };

/** Texto del estado de un cruce, para el lienzo, la tabla y el informe. */
export const FORCE_STATUS_LABEL: Record<ForceStatus, string> = {
  applied: 'aplicada',
  outside_mass: 'fuera de la masa',
  compression_ignored: 'ignorada por compresión',
  no_capacity: 'sin capacidad',
};

/** Solo `applied` aporta fuerza; los demás se dibujan en gris. */
export const isAppliedStatus = (status: ForceStatus): boolean => status === 'applied';

const MIN_LENGTH = 1e-9;
const clean = (v: number): number => Number(v.toPrecision(12));

// ───────────────────────── Geometría ─────────────────────────

export function refEnd(r: Reinforcement, end: 1 | 2): Point {
  return end === 1 ? [r.x1, r.y1] : [r.x2, r.y2];
}

export function refLength(r: Reinforcement): number {
  return Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
}

export function refCenter(r: Reinforcement): Point {
  return [clean((r.x1 + r.x2) / 2), clean((r.y1 + r.y2) / 2)];
}

/**
 * Mueve un extremo a `to`. En la tablestaca solo cambia la y (la x es fija y se conserva x1 = x2). Devuelve `null` si el
 * refuerzo quedaría sin longitud (F4.2: L > 0) o si `to` no es finito.
 */
export function moveEnd(r: Reinforcement, end: 1 | 2, to: Point): Reinforcement | null {
  if (!Number.isFinite(to[0]) || !Number.isFinite(to[1])) return null;
  const at: Point = r.type === 'sheet_pile' ? [end === 1 ? r.x1 : r.x2, to[1]] : [to[0], to[1]];
  const next: Reinforcement = end === 1 ? { ...r, x1: at[0], y1: at[1] } : { ...r, x2: at[0], y2: at[1] };
  return refLength(next) > MIN_LENGTH ? next : null;
}

/** Desplaza los dos extremos a la vez (un solo comando: un solo paso de historial). */
export function moveBody(r: Reinforcement, dx: number, dy: number): Reinforcement | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return { ...r, x1: clean(r.x1 + dx), y1: clean(r.y1 + dy), x2: clean(r.x2 + dx), y2: clean(r.y2 + dy) };
}

// ───────────────────────── Alta: valores por omisión ─────────────────────────

const SLUG: Record<ReinforcementType, string> = { anchor: 'anclaje', nail: 'clavo', geosynthetic: 'geosintetico', pile: 'pilote', sheet_pile: 'tablestaca' };

/** Identificador libre del tipo: «anclaje-1», «clavo-2»… (no repite ninguno de `reinforcements`). */
export function nextReinforcementId(doc: ModelDoc, type: ReinforcementType): string {
  const used = new Set((doc.reinforcements ?? []).map((r) => r.id));
  let n = (doc.reinforcements ?? []).filter((r) => r.type === type).length + 1;
  while (used.has(`${SLUG[type]}-${n}`)) n += 1;
  return `${SLUG[type]}-${n}`;
}

/** Fuerza por elemento (kN → lbf) y por metro (kN/m → lbf/ft), con tres cifras significativas, para modelos imperiales. */
function forceIn(units: string | null | undefined, kn: number): number {
  return isImperialUnits(units) ? Number((kn * 224.809).toPrecision(3)) : kn;
}
function perLengthIn(units: string | null | undefined, knPerM: number): number {
  return isImperialUnits(units) ? Number((knPerM * 68.5218).toPrecision(3)) : knPerM;
}

/**
 * Refuerzo nuevo de `type` entre la cabeza `p1` y la punta `p2`, con valores razonables que el panel «Refuerzos» edita después.
 * Anclaje: activo, con `end1_capacity = tensile_capacity` (E14m-2). Clavo y geosintético: pasivos. Pilote y tablestaca:
 * pasivos, con fuerza horizontal (`angle` 0). La tablestaca es vertical: x2 = x1.
 */
export function newReinforcement(type: ReinforcementType, id: string, p1: Point, p2: Point, units?: string | null): Reinforcement {
  const base = { id, x1: p1[0], y1: p1[1], x2: type === 'sheet_pile' ? p1[0] : p2[0], y2: p2[1] };
  let r: object;
  switch (type) {
    case 'anchor': {
      const t = forceIn(units, 150);
      r = { ...base, type, application: 'active', tensile_capacity: t, end1_capacity: t, spacing: 1, direction: 'axial' };
      break;
    }
    case 'nail':
      r = { ...base, type, application: 'passive', tensile_capacity: forceIn(units, 100), spacing: 1.5, direction: 'axial', pullout: { model: 'bond', strength: perLengthIn(units, 30) } };
      break;
    case 'geosynthetic':
      r = { ...base, type, application: 'passive', tensile_capacity: forceIn(units, 40), spacing: 1, direction: 'axial' };
      break;
    case 'pile':
      r = { ...base, type, application: 'passive', force: forceIn(units, 60), spacing: 1.5, direction: 'angle', angle: 0 };
      break;
    case 'sheet_pile':
      r = { ...base, type, application: 'passive', force: perLengthIn(units, 120), direction: 'angle', angle: 0 };
      break;
  }
  return r as Reinforcement;
}

// ───────────────────────── Textos accesibles (estables) ─────────────────────────

const typeLabel = (r: Reinforcement): string => REINFORCEMENT_TYPE_LABEL[r.type];
const coords = (p: Point, units?: string | null): string => {
  const u = lengthUnitOf(units);
  return `x ${formatNumber(p[0])} ${u}, y ${formatNumber(p[1])} ${u}`;
};
const endName = (end: 1 | 2): string => (end === 1 ? 'cabeza' : 'punta');

/** Nombre accesible del tirador de un extremo: «Refuerzo 2 (Anclaje), cabeza: x 20 m, y 42 m». */
export function reinforcementEndLabel(index: number, r: Reinforcement, end: 1 | 2, units?: string | null): string {
  return `Refuerzo ${index + 1} (${typeLabel(r)}), ${endName(end)}: ${coords(refEnd(r, end), units)}`;
}

/** Nombre accesible del tirador del centro, que mueve el refuerzo entero. */
export function reinforcementCenterLabel(index: number, r: Reinforcement, units?: string | null): string {
  return `Refuerzo ${index + 1} (${typeLabel(r)}), centro: ${coords(refCenter(r), units)}`;
}

/** Anuncio (región aria-live) tras mover un extremo. */
export function reinforcementEndAnnouncement(index: number, r: Reinforcement, end: 1 | 2, units?: string | null): string {
  return `${end === 1 ? 'Cabeza' : 'Punta'} del refuerzo ${index + 1} (${typeLabel(r)}): ${coords(refEnd(r, end), units)}`;
}

/** Anuncio tras mover el refuerzo entero. */
export function reinforcementMoveAnnouncement(index: number, r: Reinforcement, units?: string | null): string {
  return `Refuerzo ${index + 1} (${typeLabel(r)}) movido: cabeza ${coords([r.x1, r.y1], units)}; punta ${coords([r.x2, r.y2], units)}`;
}

export const SHEET_PILE_FIXED_X = 'La tablestaca es vertical: su x es fija. Use las flechas arriba y abajo, o mueva el centro.';
export const REINFORCEMENT_ZERO_LENGTH = 'El refuerzo no puede quedar sin longitud: la cabeza y la punta deben ser puntos distintos.';

/** Título de un refuerzo: «Refuerzo 2: Anclaje, activa, longitud 14 m». */
export function reinforcementTitle(index: number, r: Reinforcement, units?: string | null): string {
  return `Refuerzo ${index + 1}: ${typeLabel(r)}, ${APPLICATION_LABEL[r.application]}, longitud ${formatNumber(refLength(r))} ${lengthUnitOf(units)}`;
}

// ───────────────────────── Formas (píxeles) ─────────────────────────

export type PxPoint = [number, number];
export type ShapePart =
  | { kind: 'poly'; pts: PxPoint[]; width: number; closed?: boolean; fill?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; width: number; fill?: boolean };

export interface ReinforcementShape {
  index: number;
  type: ReinforcementType;
  application: ReinforcementApplication;
  p1: PxPoint;
  p2: PxPoint;
  mid: PxPoint;
  /** Símbolo del tipo: se dibuja con halo y trazo del color del refuerzo. */
  parts: ShapePart[];
  label: { x: number; y: number; text: string };
  title: string;
}

const add = (p: PxPoint, u: PxPoint, k: number): PxPoint => [p[0] + u[0] * k, p[1] + u[1] * k];

/** Símbolo de un refuerzo en pantalla: un tipo, una silueta (anclaje: placa y bulbo; clavo: cabeza cuadrada; geosintético: zigzag; pilote: trazo grueso y aro; tablestaca: trazo con dientes). */
export function reinforcementShape(r: Reinforcement, index: number, vp: Viewport, units?: string | null): ReinforcementShape {
  const p1 = worldToScreen(vp, r.x1, r.y1) as PxPoint;
  const p2 = worldToScreen(vp, r.x2, r.y2) as PxPoint;
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const u: PxPoint = len > 1e-6 ? [(p2[0] - p1[0]) / len, (p2[1] - p1[1]) / len] : [0, 1];
  const n: PxPoint = [-u[1], u[0]];
  const mid: PxPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const body: ShapePart = { kind: 'poly', pts: [p1, p2], width: 2.5 };
  const parts: ShapePart[] = [];
  switch (r.type) {
    case 'anchor': {
      const bulb = Math.min(len * 0.3, 40);
      parts.push(body, { kind: 'poly', pts: [add(p1, n, 8), add(p1, n, -8)], width: 4 });
      if (bulb >= 6) parts.push({ kind: 'poly', pts: [add(p2, u, -bulb), p2], width: 6.5 });
      break;
    }
    case 'nail':
      parts.push(body, { kind: 'poly', pts: [add(add(p1, u, -4), n, -4), add(add(p1, u, -4), n, 4), add(add(p1, u, 4), n, 4), add(add(p1, u, 4), n, -4)], width: 1.5, closed: true, fill: true });
      break;
    case 'geosynthetic': {
      const count = Math.max(2, Math.round(len / 8));
      const pts: PxPoint[] = [p1];
      for (let i = 1; i < count; i += 1) pts.push(add(add(p1, u, (len * i) / count), n, i % 2 === 1 ? 3.5 : -3.5));
      pts.push(p2);
      parts.push({ kind: 'poly', pts, width: 2 });
      break;
    }
    case 'pile':
      parts.push({ kind: 'poly', pts: [p1, p2], width: 6 }, { kind: 'circle', cx: p1[0], cy: p1[1], r: 5, width: 2 });
      break;
    case 'sheet_pile': {
      parts.push({ kind: 'poly', pts: [p1, p2], width: 4 });
      const teeth = Math.min(60, Math.floor(len / 9));
      for (let i = 0; i <= teeth; i += 1) {
        const c = add(p1, u, i * 9);
        parts.push({ kind: 'poly', pts: [add(c, n, 5), add(c, n, -5)], width: 2 });
      }
      break;
    }
  }
  // Rótulo a un lado del centro, del lado que queda más arriba en pantalla.
  const side = n[1] <= 0 ? 1 : -1;
  const label = { x: mid[0] + n[0] * 14 * side, y: mid[1] + n[1] * 14 * side, text: `${typeLabel(r)} ${index + 1}` };
  return { index, type: r.type, application: r.application, p1, p2, mid, parts, label, title: reinforcementTitle(index, r, units) };
}

/** Ancho aproximado de un carácter del rótulo (12 px) y alto de la línea, para que los rótulos de refuerzos vecinos no se pisen. */
const LABEL_CHAR_PX = 6.6;
const LABEL_LINE_PX = 14;

export function reinforcementShapes(list: readonly Reinforcement[] | undefined, vp: Viewport, units?: string | null): ReinforcementShape[] {
  const shapes = (list ?? []).map((r, i) => reinforcementShape(r, i, vp, units));
  // Los rótulos se desplazan en vertical (alternando arriba y abajo) hasta no pisar a los ya colocados.
  const boxes: { x1: number; x2: number; y1: number; y2: number }[] = [];
  for (const s of shapes) {
    const half = (s.label.text.length * LABEL_CHAR_PX) / 2;
    for (let k = 0; k < 10; k += 1) {
      const dy = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * LABEL_LINE_PX;
      const box = { x1: s.label.x - half, x2: s.label.x + half, y1: s.label.y + dy - LABEL_LINE_PX, y2: s.label.y + dy };
      if (boxes.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1) && k < 9) continue;
      s.label = { ...s.label, y: s.label.y + dy };
      boxes.push(box);
      break;
    }
  }
  return shapes;
}

// ───────────────────────── Fuerzas del resultado ─────────────────────────

export interface ForceShape {
  key: string;
  id: string;
  crossing: number;
  status: ForceStatus;
  /** `true` si la fuerza se aplicó (flecha del color del refuerzo); si no, gris con su rótulo. */
  applied: boolean;
  application: ReinforcementApplication;
  /** Cruce con la superficie, en píxeles. */
  at: PxPoint;
  /** Punta de la flecha (a favor de `fx`, `fy`), o `null` si la fuerza es nula. */
  tip: PxPoint | null;
  label: { x: number; y: number; text: string };
  title: string;
}

export const FORCE_ARROW_MIN_PX = 30;
export const FORCE_ARROW_MAX_PX = 60;

/** Unidad de las fuerzas del informe: por metro de talud. */
export function forceUnit(units?: string | null): string {
  return isImperialUnits(units) ? 'lbf/ft' : 'kN/m';
}

/**
 * Rótulo de una fuerza: «anclaje-1: 100 kN/m (activa)»; una pasiva dice «pasiva, dividida por F» en el título y la tabla, y en el
 * rótulo corto del dibujo solo «pasiva» (`short`), para que los rótulos no se pisen. Sin aplicar: «id: fuera de la masa».
 */
export function forceLabelText(f: ReinforcementForce, units?: string | null, short = false): string {
  const magnitude = Math.hypot(f.fx, f.fy);
  const unit = forceUnit(units);
  if (!isAppliedStatus(f.status)) return `${f.id}: ${FORCE_STATUS_LABEL[f.status]}`;
  const kind = f.application === 'passive' ? (short ? 'pasiva' : 'pasiva, dividida por F') : 'activa';
  return `${f.id}: ${formatNumber(magnitude, 1, 2)} ${unit} (${kind})`;
}

/**
 * Flechas de las fuerzas de `reinforcement_forces`: una por cruce, con la dirección de (fx, fy) y la cola en el cruce
 * (la fuerza que el refuerzo ejerce sobre la masa). El largo crece con la magnitud entre 30 y 60 px. Los cruces que no se
 * aplicaron (`outside_mass`, `compression_ignored`, `no_capacity`) llevan una marca gris y su estado; sin fuerza aplicada no hay flecha.
 */
export function forceShapes(forces: readonly ReinforcementForce[] | undefined, vp: Viewport, units?: string | null): ForceShape[] {
  const list = forces ?? [];
  const max = Math.max(0, ...list.filter((f) => isAppliedStatus(f.status)).map((f) => Math.hypot(f.fx, f.fy)));
  return list.map((f): ForceShape => {
    const at = worldToScreen(vp, f.x, f.y) as PxPoint;
    const applied = isAppliedStatus(f.status);
    const magnitude = Math.hypot(f.fx, f.fy);
    let tip: PxPoint | null = null;
    let dir: PxPoint = [0, -1];
    if (applied && magnitude > 0 && Number.isFinite(magnitude)) {
      // Pantalla: y hacia abajo, así que la componente vertical cambia de signo.
      dir = [f.fx / magnitude, -f.fy / magnitude];
      const length = FORCE_ARROW_MIN_PX + (FORCE_ARROW_MAX_PX - FORCE_ARROW_MIN_PX) * (max > 0 ? magnitude / max : 0);
      tip = add(at, dir, length);
    }
    const text = forceLabelText(f, units);
    const shortText = forceLabelText(f, units, true);
    const anchor = tip ?? at;
    return {
      key: `${f.id}-${f.crossing}`,
      id: f.id,
      crossing: f.crossing,
      status: f.status,
      applied,
      application: f.application,
      at,
      tip,
      label: { x: anchor[0] + dir[0] * 8, y: anchor[1] + dir[1] * 8 - (dir[1] >= 0 ? -10 : 4), text: shortText },
      title: `${text}. Cruce ${f.crossing + 1}, estación ${formatNumber(f.station)} ${lengthUnitOf(units)}`,
    };
  });
}
