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

/**
 * Aclaración de la tabla de fuerzas (E14o-14, R11B-03): la web, el PDF y el CSV dicen lo mismo. «Disponible» y «Aplicada» son la fuerza antes de
 * dividir por el factor de seguridad F del método; «Movilizada» es la que actúa en el equilibrio: la pasiva, dividida por F, y la activa, la aplicada.
 */
export const FORCE_TABLE_NOTE =
  `Pasiva: ${PASSIVE_LEGEND}. En la tabla va la fuerza disponible, antes de dividir por el factor de seguridad F de cada método. ` +
  'La fuerza movilizada es la que actúa en el equilibrio: en una pasiva, la aplicada dividida por F; en una activa, la aplicada.';

/** Notas de las filas del CSV de fuerzas (E14o-13). */
export const CSV_PASSIVE_NOTE = `pasiva: ${PASSIVE_LEGEND}`;
export const CSV_STRUCTURAL_NOTE = 'solo estabilidad global: no calcula empuje, empotramiento, momento ni deflexión';

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

export function reinforcementUnits(units: string | null | undefined): { length: string; force: string; line: string; stress: string } {
  return isImperialUnits(units) ? { length: 'ft', force: 'lbf', line: 'lbf/ft', stress: 'psf' } : { length: 'm', force: 'kN', line: 'kN/m', stress: 'kPa' };
}

const DIRECTION_LABEL: Record<string, string> = { axial: 'Axial', tangent: 'Tangente', bisector: 'Bisectriz', perpendicular: 'Perpendicular' };

function directionText(r: Reinforcement): string {
  if (r.type === 'pile' || r.type === 'sheet_pile') return r.direction === 'angle' ? `Ángulo ${p(r.angle)}°` : (DIRECTION_LABEL[r.direction] ?? r.direction);
  return DIRECTION_LABEL[r.direction] ?? r.direction;
}

function capacityText(r: Reinforcement, u: ReturnType<typeof reinforcementUnits>): string {
  if (r.type === 'pile') return `Fuerza ${p(r.force)} ${u.force} por pilote`;
  if (r.type === 'sheet_pile') return `Fuerza ${p(r.force)} ${u.line} de muro`;
  return `Tracción ${p(r.tensile_capacity)} ${u.force} · cabeza ${p(r.end1_capacity ?? 0)} ${u.force} · punta ${p(r.end2_capacity ?? 0)} ${u.force}`;
}

function pulloutText(r: Reinforcement, u: ReturnType<typeof reinforcementUnits>): string {
  if (r.type === 'pile' || r.type === 'sheet_pile') return DASH;
  const po = r.pullout;
  if (!po) return 'Sin arrancamiento: totalmente anclado';
  switch (po.model) {
    case 'bond':
      return `Adherencia ${p(po.strength)} ${u.line}${po.bonded_length ? ` en los últimos ${p(po.bonded_length)} ${u.length}` : ''}`;
    case 'interface':
      return `Interfaz: adhesión ${p(po.adhesion)} ${u.stress}, δ ${p(po.friction_angle)}°, Rc ${p(po.coverage)}`;
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
  /** FS (F) del método que dio la fuerza; `null` si no lo trae. */
  fs: number | null;
}

/**
 * Fuerza que actúa en el equilibrio: una pasiva se moviliza dividida por F; una activa es la aplicada. `null` si F no es un número
 * positivo (no hay con qué dividir).
 */
export function mobilizedForce(r: Pick<ForceRecord, 'application' | 'fx' | 'fy' | 'fs'>): [number, number] | null {
  if (r.application !== 'passive') return [r.fx, r.fy];
  if (r.fs === null || !Number.isFinite(r.fs) || !(r.fs > 0)) return null;
  return [r.fx / r.fs, r.fy / r.fs];
}

/** Nota de la fila del CSV: la de las pasivas y, en un pilote o una tablestaca, el límite estructural (F4.8). */
export function csvRowNote(r: Pick<ForceRecord, 'application' | 'type'>): string {
  const notes: string[] = [];
  if (r.application === 'passive') notes.push(CSV_PASSIVE_NOTE);
  if (r.type === 'pile' || r.type === 'sheet_pile') notes.push(CSV_STRUCTURAL_NOTE);
  return notes.join('; ');
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
        fs: typeof r.fos === 'number' && Number.isFinite(r.fos) ? r.fos : null,
      }),
    ),
  );
}

/** ¿El resultado viene del motor simulado? No calcula fuerzas de refuerzo: la ausencia de cruces no significa nada. */
export const isMockResult = (r: Pick<MethodReport, 'warnings'>): boolean => (r.warnings ?? []).includes('mock_engine');

/**
 * Refuerzos del modelo que no aparecen en las fuerzas de un método **convergido** (E14o-16, R11B-06): no cruzaron la superficie final.
 * Solo cuenta los métodos del motor real que convergieron; vacío si el método no tiene refuerzos sin cruce.
 */
export function uncrossedByMethod(results: readonly MethodReport[], list: readonly Reinforcement[] | undefined): { method: MethodKind; ids: string[] }[] {
  const out: { method: MethodKind; ids: string[] }[] = [];
  for (const r of results) {
    if (r.status !== 'converged' || isMockResult(r)) continue;
    const crossed = new Set((r.reinforcement_forces ?? []).map((f) => f.id));
    const ids = (list ?? []).map((x) => x.id).filter((id) => !crossed.has(id));
    if (ids.length > 0) out.push({ method: r.method, ids });
  }
  return out;
}

const cap = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

/** «Activa» o «Pasiva: se moviliza dividida por F» (F4.9). */
export function applicationText(application: ReinforcementForce['application']): string {
  return application === 'passive' ? `Pasiva: ${PASSIVE_LEGEND}` : 'Activa';
}

export function statusText(status: ForceStatus): string {
  return cap(FORCE_STATUS_LABEL[status] ?? String(status));
}

/** Tabla de fuerzas de un método: id, tipo, cruce, estación, disponible, aplicada (fx; fy), movilizada (fx; fy), activa o pasiva y estado. */
export function forcesTable(records: readonly ForceRecord[], units: string | null | undefined): { header: string[]; rows: string[][] } {
  const u = reinforcementUnits(units);
  return {
    header: ['Id', 'Tipo', 'Cruce', `Estación (${u.length})`, `Disponible (${u.line})`, `Aplicada fx; fy (${u.line})`, `Movilizada fx; fy (${u.line})`, 'Aplicación', 'Estado'],
    rows: records.map((r) => {
      const m = mobilizedForce(r);
      return [
        r.id,
        r.type ? REINFORCEMENT_TYPE_LABEL[r.type] : DASH,
        String(r.crossing),
        f3(r.station),
        f3(r.available),
        `${f3(r.fx)}; ${f3(r.fy)}`,
        m ? `${f3(m[0])}; ${f3(m[1])}` : DASH,
        applicationText(r.application),
        statusText(r.status),
      ];
    }),
  };
}

/** Unidad de fuerza por metro del informe, la misma del lienzo. */
export const forcesUnit = forceUnit;
