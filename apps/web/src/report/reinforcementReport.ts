// Refuerzos en el informe (F4.8, F4.9 y E14m-4): datos de entrada, tabla de fuerzas por cruce y el texto del límite
// estructural. Puro y sin DOM: lo consumen el PDF (`content.ts`), el CSV, la vista Casos y la Ayuda.

import { APPLICATION_LABEL, FORCE_STATUS_LABEL, REINFORCEMENT_TYPE_LABEL, forceUnit, type ForceStatus } from '../editor/canvas/reinforcements';
import { isImperialUnits } from '../editor/state/units';
import type { ModelDoc } from '../editor/types';
import type { MethodKind, MethodReport, PileGoverns, Reinforcement, ReinforcementForce } from '../engine/types';

/**
 * Límite declarado de F4.8: lo dicen siempre el informe, el PDF y la Ayuda cuando el modelo tiene un `pile` o una `sheet_pile`
 * (el motor emite además la nota `structural_checks_not_covered`).
 */
export const STRUCTURAL_LIMIT_TEXT =
  'Pilotes y tablestacas: OpenGeoSlide calcula la estabilidad global con el elemento incluido. No calcula el empuje sobre el elemento, ' +
  'el empotramiento, el momento flector, la deflexión ni las comprobaciones internas o externas de un muro.';

/**
 * Límite declarado con un pilote de presión del suelo (E15i-8): ahora sí calcula el empuje del suelo sobre ese pilote. Lo dicen el informe, el
 * PDF, el panel «Refuerzos» y la Ayuda cuando el modelo tiene un pilote con `lateral_pressure`.
 */
export const ITO_MATSUI_STRUCTURAL_LIMIT_TEXT =
  'Pilotes y tablestacas: OpenGeoSlide calcula la estabilidad global con el elemento incluido. Calcula el empuje del suelo solo en un pilote con ' +
  'presión del suelo (Ito-Matsui), con el tope por corte y por momento que usted indique; en los demás elementos la fuerza es un dato. ' +
  'No calcula el empotramiento, el diagrama de momento flector, la deflexión ni las comprobaciones internas o externas de un muro.';

/** Texto del límite que corresponde a los refuerzos del modelo: el de Ito-Matsui si hay un pilote con `lateral_pressure`, si no el de F4.8. */
export function structuralLimitText(list: readonly Reinforcement[] | undefined): string {
  return (list ?? []).some(isItoMatsuiPile) ? ITO_MATSUI_STRUCTURAL_LIMIT_TEXT : STRUCTURAL_LIMIT_TEXT;
}

/** ¿Es un pilote con la presión del suelo de Ito-Matsui (v0.5, E15i-1)? */
export function isItoMatsuiPile(r: Reinforcement): boolean {
  return r.type === 'pile' && r.lateral_pressure !== undefined && r.lateral_pressure !== null;
}

/** Explicación de las columnas de Ito-Matsui (E15i-4, E15i-5, E15i-7): el informe, la web y la Ayuda dicen lo mismo. */
export const ITO_MATSUI_NOTE =
  'Presión del suelo de Ito y Matsui (1975): p(z) = c·A1 + σ′v·A2 por pilote, integrada desde la cabeza hasta el cruce, con pilotes rígidos, ' +
  'deformación plana y dos superficies plásticas. La fuerza por pilote es el menor de la resultante del suelo, la capacidad al corte y la capacidad a ' +
  'momento dividida por el brazo, y se divide por el espaciamiento. «Fuerza del suelo» es la fuerza por metro antes del tope; «Gobierna» dice cuál fija ' +
  'la fuerza aplicada (suelo, corte o flexión); «Brazo» es la distancia de la resultante al cruce, donde actúa la fuerza si la ubicación es el centroide.';

/** Etiquetas de «Gobierna» (E15i-4). */
export const GOVERNS_LABEL: Readonly<Record<PileGoverns, string>> = { soil: 'Suelo', shear: 'Corte', bending: 'Flexión' };

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
export const CSV_ITO_MATSUI_NOTE = 'empuje del suelo (Ito-Matsui); no calcula empotramiento, momento a lo largo del pilote ni deflexión';

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

/** Momento por pilote: kN·m o lbf·ft. */
const momentUnit = (u: ReturnType<typeof reinforcementUnits>): string => (u.force === 'lbf' ? 'lbf·ft' : 'kN·m');

function itoMatsuiText(r: Reinforcement & { type: 'pile' }, u: ReturnType<typeof reinforcementUnits>): string {
  const lp = r.lateral_pressure!;
  const ratio = typeof r.spacing === 'number' ? r.spacing / lp.diameter : 1 / lp.diameter;
  const where = lp.location === 'slip_surface' ? 'en la superficie de falla' : 'en el centroide';
  const cap = r.capacity;
  const parts: string[] = [];
  if (typeof cap?.shear === 'number') parts.push(`corte ${p(cap.shear)} ${u.force}`);
  if (typeof cap?.moment === 'number') parts.push(`momento ${p(cap.moment)} ${momentUnit(u)}`);
  const limit = parts.length > 0 ? `tope: ${parts.join(', ')} por pilote` : 'sin tope';
  return `Presión del suelo (Ito-Matsui): D = ${p(lp.diameter)} ${u.length}, S/D = ${p(Math.round(ratio * 100) / 100)}, ${where} · ${limit}`;
}

function capacityText(r: Reinforcement, u: ReturnType<typeof reinforcementUnits>): string {
  if (r.type === 'pile' && r.lateral_pressure) return itoMatsuiText(r, u);
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
  /** Solo en un pilote con presión del suelo (E15i-7): fuerza del suelo por metro antes del tope. */
  soilForce?: number;
  /** Solo en un pilote con presión del suelo: qué fija la fuerza aplicada. */
  governs?: PileGoverns;
  /** Solo en un pilote con presión del suelo: brazo `L_m` de la resultante sobre el cruce. */
  arm?: number;
}

/** ¿Alguna fila es de un pilote con presión del suelo? Entonces la tabla y el CSV llevan las columnas de Ito-Matsui. */
export function hasItoMatsui(records: readonly ForceRecord[]): boolean {
  return records.some((r) => r.governs !== undefined || r.soilForce !== undefined || r.arm !== undefined);
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
export function csvRowNote(r: Pick<ForceRecord, 'application' | 'type'> & { governs?: PileGoverns }): string {
  const notes: string[] = [];
  if (r.application === 'passive') notes.push(CSV_PASSIVE_NOTE);
  // E15i-7: `governs` solo existe en un pilote con presión del suelo; ese pilote sí calcula el empuje.
  if (r.governs !== undefined) notes.push(CSV_ITO_MATSUI_NOTE);
  else if (r.type === 'pile' || r.type === 'sheet_pile') notes.push(CSV_STRUCTURAL_NOTE);
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
        // Se omiten en un pilote con `force`, como en el motor (E15i-7).
        ...(f.soil_force === undefined ? {} : { soilForce: f.soil_force }),
        ...(f.governs === undefined ? {} : { governs: f.governs }),
        ...(f.arm === undefined ? {} : { arm: f.arm }),
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

export interface ForcesTable {
  header: string[];
  rows: string[][];
  /** Una marca por columna: ¿es numérica (se alinea a la derecha)? */
  numeric: boolean[];
}

/**
 * Tabla de fuerzas de un método: id, tipo, cruce, estación, disponible, aplicada (fx; fy), movilizada (fx; fy), activa o pasiva y estado. Con un
 * pilote de presión del suelo (E15i-7) suma, tras «Disponible», «Fuerza del suelo», «Gobierna» y «Brazo»; en los demás pilotes llevan un guion.
 */
export function forcesTable(records: readonly ForceRecord[], units: string | null | undefined): ForcesTable {
  const u = reinforcementUnits(units);
  const ito = hasItoMatsui(records);
  const header = ['Id', 'Tipo', 'Cruce', `Estación (${u.length})`, `Disponible (${u.line})`];
  const numeric = [false, false, true, true, true];
  if (ito) {
    header.push(`Fuerza del suelo (${u.line})`, 'Gobierna', `Brazo (${u.length})`);
    numeric.push(true, false, true);
  }
  header.push(`Aplicada fx; fy (${u.line})`, `Movilizada fx; fy (${u.line})`, 'Aplicación', 'Estado');
  numeric.push(true, true, false, false);
  return {
    header,
    numeric,
    rows: records.map((r) => {
      const m = mobilizedForce(r);
      return [
        r.id,
        r.type ? REINFORCEMENT_TYPE_LABEL[r.type] : DASH,
        String(r.crossing),
        f3(r.station),
        f3(r.available),
        ...(ito ? [f3(r.soilForce), r.governs ? GOVERNS_LABEL[r.governs] : DASH, f3(r.arm)] : []),
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
