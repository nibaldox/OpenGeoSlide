// Refuerzos en el informe (F4.8, F4.9 y E14m-4): datos de entrada, tabla de fuerzas por cruce y el texto del límite
// estructural. Puro y sin DOM: lo consumen el PDF (`content.ts`), el CSV, la vista Casos y la Ayuda.

import { APPLICATION_LABEL, FORCE_STATUS_LABEL, REINFORCEMENT_TYPE_LABEL, forceUnit, type ForceStatus } from '../editor/canvas/reinforcements';
import { isImperialUnits } from '../editor/state/units';
import type { ModelDoc } from '../editor/types';
import type { MethodKind, MethodReport, Reinforcement, ReinforcementForce } from '../engine/types';

/**
 * Límite declarado de F4.8: lo dicen siempre el informe, el PDF y la Ayuda cuando el modelo tiene un `pile` o una `sheet_pile`
 * (el motor emite además la nota `structural_checks_not_covered`).
 */
export const STRUCTURAL_LIMIT_TEXT =
  'Pilotes y tablestacas: OpenGeoSlide calcula la estabilidad global con el elemento incluido. No calcula el empuje sobre el elemento, ' +
  'el empotramiento, el momento flector, la deflexión ni las comprobaciones internas o externas de un muro.';

/** Leyenda de una fuerza pasiva (F4.9). */
export const PASSIVE_LEGEND = 'se moviliza dividida por F';

export const REINFORCEMENT_FORCE_BASIS =
  'Las fuerzas del resultado son por metro de talud y actúan sobre la masa deslizante en cada cruce del refuerzo con la superficie. ' +
  'Las capacidades de entrada son por elemento: el espaciamiento las pasa a fuerza por metro.';

const DASH = '—';

/** Misma regla que `fmtParam` del informe (se repite aquí para no depender de `content.ts`). */
function p(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return String(Number(n.toPrecision(6))).replace('.', ',');
}
function f3(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return n.toFixed(3).replace('.', ',');
}

export function reinforcementsOf(model: ModelDoc): readonly Reinforcement[] {
  return model.reinforcements ?? [];
}

/** ¿El modelo tiene un pilote o una tablestaca? Entonces el informe dice el límite de F4.8. */
export function hasStructuralElements(list: readonly Reinforcement[] | undefined): boolean {
  return (list ?? []).some((r) => r.type === 'pile' || r.type === 'sheet_pile');
}

export function reinforcementUnits(units: string | null | undefined): { length: string; force: string; line: string } {
  return isImperialUnits(units) ? { length: 'ft', force: 'lbf', line: 'lbf/ft' } : { length: 'm', force: 'kN', line: 'kN/m' };
}

const DIRECTION_LABEL: Record<string, string> = { axial: 'Axial', tangent: 'Tangente', bisector: 'Bisectriz', perpendicular: 'Perpendicular' };

function directionText(r: Reinforcement): string {
  if (r.type === 'pile' || r.type === 'sheet_pile') return r.direction === 'angle' ? `Ángulo ${p(r.angle)}°` : (DIRECTION_LABEL[r.direction] ?? r.direction);
  return DIRECTION_LABEL[r.direction] ?? r.direction;
}

function capacityText(r: Reinforcement, u: ReturnType<typeof reinforcementUnits>): string {
  if (r.type === 'pile') return `Fuerza ${p(r.force)} ${u.force} por pilote`;
  if (r.type === 'sheet_pile') return `Fuerza ${p(r.force)} ${u.line} de muro`;
  return `Tracción ${p(r.tensile_capacity)} ${u.force} · cabeza ${p(r.end1_capacity ?? 0)} · punta ${p(r.end2_capacity ?? 0)}`;
}

function pulloutText(r: Reinforcement, u: ReturnType<typeof reinforcementUnits>): string {
  if (r.type === 'pile' || r.type === 'sheet_pile') return DASH;
  const po = r.pullout;
  if (!po) return 'Sin arrancamiento: totalmente anclado';
  switch (po.model) {
    case 'bond':
      return `Adherencia ${p(po.strength)} ${u.line}${po.bonded_length ? ` en los últimos ${p(po.bonded_length)} ${u.length}` : ''}`;
    case 'interface':
      return `Interfaz: adhesión ${p(po.adhesion)}, δ ${p(po.friction_angle)}°, Rc ${p(po.coverage)}`;
    case 'development':
      return `Rampa: ℓ₁ ${p(po.length1)} ${u.length}, ℓ₂ ${p(po.length2)} ${u.length}`;
  }
}

/** Datos de entrada de los refuerzos en dos tablas (geometría y capacidades) para que las columnas no se partan en la página. */
export function reinforcementInputTables(model: ModelDoc): { geometry: { header: string[]; rows: string[][] }; capacity: { header: string[]; rows: string[][] } } {
  const u = reinforcementUnits(model.units);
  const list = reinforcementsOf(model);
  return {
    geometry: {
      header: ['Id', 'Tipo', 'Aplicación', `Cabeza (x; y) (${u.length})`, `Punta (x; y) (${u.length})`, `Longitud (${u.length})`, 'Dirección'],
      rows: list.map((r) => [
        r.id,
        REINFORCEMENT_TYPE_LABEL[r.type],
        APPLICATION_LABEL[r.application][0]!.toUpperCase() + APPLICATION_LABEL[r.application].slice(1),
        `${p(r.x1)}; ${p(r.y1)}`,
        `${p(r.x2)}; ${p(r.y2)}`,
        p(Math.hypot(r.x2 - r.x1, r.y2 - r.y1)),
        directionText(r),
      ]),
    },
    capacity: {
      header: ['Id', 'Capacidad o fuerza (por elemento)', `Espaciamiento (${u.length})`, 'Arrancamiento'],
      rows: list.map((r) => [r.id, capacityText(r, u), r.type === 'sheet_pile' ? DASH : p(r.spacing ?? 1), pulloutText(r, u)]),
    },
  };
}

// ───────────────────────── Fuerzas por cruce ─────────────────────────

export interface ForceRecord {
  method: MethodKind;
  id: string;
  /** Tipo del refuerzo en el modelo, o `null` si el id no está en `reinforcements`. */
  type: Reinforcement['type'] | null;
  /** Número del cruce desde 1. */
  crossing: number;
  x: number;
  y: number;
  station: number;
  available: number;
  fx: number;
  fy: number;
  application: ReinforcementForce['application'];
  status: ForceStatus;
}

/** Filas de fuerzas de todos los métodos que las traen, en el orden del informe. */
export function forceRecords(results: readonly MethodReport[], list: readonly Reinforcement[] | undefined): ForceRecord[] {
  const types = new Map((list ?? []).map((r) => [r.id, r.type] as const));
  return results.flatMap((r) =>
    (r.reinforcement_forces ?? []).map(
      (f): ForceRecord => ({
        method: r.method,
        id: f.id,
        type: types.get(f.id) ?? null,
        crossing: f.crossing + 1,
        x: f.x,
        y: f.y,
        station: f.station,
        available: f.available,
        fx: f.fx,
        fy: f.fy,
        application: f.application,
        status: f.status as ForceStatus,
      }),
    ),
  );
}

const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

/** «Activa» o «Pasiva: se moviliza dividida por F» (F4.9). */
export function applicationText(application: ReinforcementForce['application']): string {
  return application === 'passive' ? `Pasiva: ${PASSIVE_LEGEND}` : 'Activa';
}

export function statusText(status: ForceStatus): string {
  return cap(FORCE_STATUS_LABEL[status] ?? String(status));
}

/** Tabla de fuerzas de un método: id, tipo, cruce, estación, disponible, aplicada (fx; fy), activa o pasiva y estado. */
export function forcesTable(records: readonly ForceRecord[], units: string | null | undefined): { header: string[]; rows: string[][] } {
  const u = reinforcementUnits(units);
  return {
    header: ['Id', 'Tipo', 'Cruce', `Estación (${u.length})`, `Disponible (${u.line})`, `Aplicada fx; fy (${u.line})`, 'Aplicación', 'Estado'],
    rows: records.map((r) => [
      r.id,
      r.type ? REINFORCEMENT_TYPE_LABEL[r.type] : DASH,
      String(r.crossing),
      f3(r.station),
      f3(r.available),
      `${f3(r.fx)}; ${f3(r.fy)}`,
      applicationText(r.application),
      statusText(r.status),
    ]),
  };
}

/** Unidad de fuerza por metro del informe, la misma del lienzo. */
export const forcesUnit = forceUnit;
