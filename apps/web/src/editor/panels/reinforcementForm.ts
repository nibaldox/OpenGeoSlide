// Lógica pura del panel «Refuerzos» (v0.4, F4.2, F4.11): rótulos por tipo, valores iniciales, formulario (todo texto) ↔ refuerzo y
// comandos del editor. Las reglas y los textos son los de `validateLocal` (`REINFORCEMENT_RULE`): lo que el formulario rechaza lo
// rechaza también el diagnóstico, y con las mismas palabras. No depende de React ni del DOM.

import type {
  PileDirection,
  Pullout,
  Reinforcement,
  ReinforcementApplication,
  TensionDirection,
} from '../../engine/types';
import { deepEqual } from '../state/docUtils';
import { isImperialUnits } from '../state/units';
import { REINFORCEMENT_LABEL, REINFORCEMENT_RULE } from '../state/validateLocal';
import type { EditorCommand, ModelDoc } from '../types';
import { done, finite, formatNumber, modelBounds, parseNumber, take, terrainY, type FieldErrors, type FormOutcome, type NumberRule } from './forms';

export type ReinforcementType = Reinforcement['type'];

export const REINFORCEMENT_TYPES: readonly ReinforcementType[] = ['anchor', 'nail', 'geosynthetic', 'pile', 'sheet_pile'];

/** Rótulos de los tipos (F4.11). */
export const REINFORCEMENT_TYPE_LABELS: Readonly<Record<ReinforcementType, string>> = {
  anchor: 'Anclaje',
  nail: 'Clavo',
  geosynthetic: 'Geosintético',
  pile: 'Pilote',
  sheet_pile: 'Tablestaca',
};

export const REINFORCEMENT_ADD_LABELS: Readonly<Record<ReinforcementType, string>> = {
  anchor: 'Agregar anclaje',
  nail: 'Agregar clavo',
  geosynthetic: 'Agregar geosintético',
  pile: 'Agregar pilote',
  sheet_pile: 'Agregar tablestaca',
};

export const APPLICATION_OPTIONS: ReadonlyArray<{ value: ReinforcementApplication; label: string }> = [
  { value: 'active', label: 'Activa (fuerza conocida, no se divide por F)' },
  { value: 'passive', label: 'Pasiva (se moviliza con el deslizamiento, se divide por F)' },
];

export const TENSION_DIRECTION_OPTIONS: ReadonlyArray<{ value: TensionDirection; label: string }> = [
  { value: 'axial', label: 'Axial (a lo largo del elemento)' },
  { value: 'tangent', label: 'Tangente a la superficie de falla' },
  { value: 'bisector', label: 'Bisectriz entre el elemento y la superficie' },
];

export const PILE_DIRECTION_OPTIONS: ReadonlyArray<{ value: PileDirection; label: string }> = [
  { value: 'angle', label: 'Ángulo sobre la horizontal' },
  { value: 'tangent', label: 'Tangente a la superficie de falla' },
  { value: 'perpendicular', label: 'Perpendicular al elemento' },
];

export type PulloutKind = 'none' | 'bond' | 'interface' | 'development';

export const PULLOUT_OPTIONS: ReadonlyArray<{ value: PulloutKind; label: string }> = [
  { value: 'none', label: 'Ninguno (anclado en todo su largo)' },
  { value: 'bond', label: 'Adherencia' },
  { value: 'interface', label: 'Interfaz suelo-geosintético' },
  { value: 'development', label: 'Desarrollo lineal de la capacidad' },
];

export const isTensionType = (type: ReinforcementType): type is 'anchor' | 'nail' | 'geosynthetic' => type === 'anchor' || type === 'nail' || type === 'geosynthetic';

// ───────────────────────── Unidades ─────────────────────────

export interface ReinforcementUnits {
  length: string;
  /** Fuerza por elemento (capacidades, fuerza del pilote). */
  force: string;
  /** Fuerza por metro (adherencia, fuerza de la tablestaca). */
  forcePerLength: string;
  /** Esfuerzo (adhesión de la interfaz). */
  stress: string;
}

export function reinforcementUnits(units: string | undefined): ReinforcementUnits {
  return isImperialUnits(units)
    ? { length: 'ft', force: 'lbf', forcePerLength: 'lbf/ft', stress: 'psf' }
    : { length: 'm', force: 'kN', forcePerLength: 'kN/m', stress: 'kPa' };
}

// ───────────────────────── Valores iniciales ─────────────────────────

const PREFIX: Readonly<Record<ReinforcementType, string>> = { anchor: 'a', nail: 'n', geosynthetic: 'g', pile: 'p', sheet_pile: 's' };

/** Siguiente id libre del tipo: `a1`, `n1`, `g1`, `p1`, `s1`. */
export function nextReinforcementId(list: readonly Reinforcement[], type: ReinforcementType): string {
  const used = new Set(list.map((r) => r.id));
  for (let n = 1; ; n += 1) {
    const id = `${PREFIX[type]}${n}`;
    if (!used.has(id)) return id;
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Valores iniciales (SI, imperial): del mismo orden de magnitud en los dos sistemas. */
const DEFAULTS = {
  anchor: { capacity: [200, 45000], spacing: [2.5, 8] },
  nail: { capacity: [100, 22000], spacing: [1.5, 5], bond: [50, 3400] },
  geosynthetic: { capacity: [40, 2700], spacing: [1, 1] },
  pile: { force: [100, 22000], spacing: [2, 6] },
  sheet_pile: { force: [100, 6800] },
} as const;

/**
 * Refuerzo nuevo, válido y dentro del modelo; `null` si no hay geometría donde situarlo. La cabeza queda sobre el terreno, a media
 * extensión del modelo; la punta, hacia el lado alto del terreno (el lado estable, detrás de la masa que se desliza) para los
 * elementos de tracción, y hacia abajo para pilotes y tablestacas. Un anclaje nuevo propone `end1_capacity = tensile_capacity`
 * (E14m-2).
 */
export function defaultReinforcement(type: ReinforcementType, doc: ModelDoc): Reinforcement | null {
  const bounds = modelBounds(doc);
  if (!bounds) return null;
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  if (!(width > 0) || !(height > 0)) return null;
  const imperial = isImperialUnits(doc.units);
  const k = imperial ? 1 : 0;
  const tol = 1e-9 * Math.max(1, width);
  const ground = (x: number): number => {
    const y = terrainY(doc.regions, x, tol);
    return Number.isFinite(y) ? y : bounds.yMax;
  };
  const x1 = round2(bounds.xMin + 0.5 * width);
  const y1 = round2(ground(x1));
  const id = nextReinforcementId(doc.reinforcements ?? [], type);

  if (type === 'pile' || type === 'sheet_pile') {
    const y2 = round2(Math.max(bounds.yMin + 0.05 * height, y1 - 0.4 * height));
    const common = { id, x1, y1, x2: x1, y2, application: 'passive' as const, direction: 'tangent' as const };
    return type === 'pile'
      ? { type, ...common, force: DEFAULTS.pile.force[k], spacing: DEFAULTS.pile.spacing[k] }
      : { type, ...common, force: DEFAULTS.sheet_pile.force[k] };
  }

  // Lado estable: el de la cota más alta del terreno (con un sentido explícito, el opuesto al del deslizamiento).
  const dir = doc.slope?.direction;
  const toward: 1 | -1 = dir === 'left_to_right' ? -1 : dir === 'right_to_left' ? 1 : ground(bounds.xMax) > ground(bounds.xMin) ? 1 : -1;
  const length = round2(Math.max(0.35 * height, 0.1 * width));
  const slopeDown = type === 'geosynthetic' ? 0 : Math.tan((15 * Math.PI) / 180);
  const x2 = round2(x1 + toward * length);
  const y2 = round2(y1 - slopeDown * length);
  const base = { id, x1, y1, x2, y2 };
  if (type === 'anchor') {
    const capacity = DEFAULTS.anchor.capacity[k];
    return { type, ...base, application: 'active', direction: 'axial', tensile_capacity: capacity, end1_capacity: capacity, spacing: DEFAULTS.anchor.spacing[k] };
  }
  if (type === 'nail') {
    return {
      type,
      ...base,
      application: 'passive',
      direction: 'axial',
      tensile_capacity: DEFAULTS.nail.capacity[k],
      spacing: DEFAULTS.nail.spacing[k],
      pullout: { model: 'bond', strength: DEFAULTS.nail.bond[k] },
    };
  }
  return { type, ...base, application: 'passive', direction: 'tangent', tensile_capacity: DEFAULTS.geosynthetic.capacity[k], spacing: DEFAULTS.geosynthetic.spacing[k] };
}

// ───────────────────────── Formulario ─────────────────────────

export interface ReinforcementForm {
  type: ReinforcementType;
  id: string;
  application: ReinforcementApplication;
  /** `TensionDirection` en anclaje, clavo y geosintético; `PileDirection` en pilote y tablestaca. */
  direction: string;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  tensile_capacity: string;
  end1_capacity: string;
  end2_capacity: string;
  spacing: string;
  pullout: PulloutKind;
  strength: string;
  bonded_length: string;
  adhesion: string;
  friction_angle: string;
  coverage: string;
  length1: string;
  length2: string;
  force: string;
  angle: string;
}

export function reinforcementToForm(r: Reinforcement): ReinforcementForm {
  const form: ReinforcementForm = {
    type: r.type,
    id: r.id,
    application: r.application,
    direction: r.direction,
    x1: formatNumber(r.x1),
    y1: formatNumber(r.y1),
    x2: formatNumber(r.x2),
    y2: formatNumber(r.y2),
    tensile_capacity: '',
    end1_capacity: '',
    end2_capacity: '',
    spacing: '',
    pullout: 'none',
    strength: '',
    bonded_length: '',
    adhesion: '',
    friction_angle: '',
    coverage: '',
    length1: '',
    length2: '',
    force: '',
    angle: '',
  };
  if ('tensile_capacity' in r) {
    form.tensile_capacity = formatNumber(r.tensile_capacity);
    form.end1_capacity = formatNumber(r.end1_capacity);
    form.end2_capacity = formatNumber(r.end2_capacity);
    form.spacing = formatNumber(r.spacing);
    const p = r.pullout;
    if (p) {
      form.pullout = p.model;
      if (p.model === 'bond') {
        form.strength = formatNumber(p.strength);
        form.bonded_length = formatNumber(p.bonded_length);
      } else if (p.model === 'interface') {
        form.adhesion = formatNumber(p.adhesion);
        form.friction_angle = formatNumber(p.friction_angle);
        form.coverage = formatNumber(p.coverage);
      } else {
        form.length1 = formatNumber(p.length1);
        form.length2 = formatNumber(p.length2);
      }
    }
  } else {
    form.force = formatNumber(r.force);
    form.angle = formatNumber(r.angle);
    if (r.type === 'pile') form.spacing = formatNumber(r.spacing);
  }
  return form;
}

/** Valores que se proponen al elegir un modelo de arrancamiento (los campos que ya tienen texto se conservan). */
export function switchPullout(form: ReinforcementForm, kind: PulloutKind, units: string | undefined): ReinforcementForm {
  const imperial = isImperialUnits(units);
  const fill = (current: string, value: number): string => (current.trim() === '' ? formatNumber(value) : current);
  const next: ReinforcementForm = { ...form, pullout: kind };
  if (kind === 'bond') next.strength = fill(form.strength, DEFAULTS.nail.bond[imperial ? 1 : 0]);
  else if (kind === 'interface') {
    next.adhesion = fill(form.adhesion, 0);
    next.friction_angle = fill(form.friction_angle, 30);
    next.coverage = fill(form.coverage, 1);
  } else if (kind === 'development') {
    const ramp = imperial ? 6.5 : 2;
    next.length1 = fill(form.length1, ramp);
    next.length2 = fill(form.length2, ramp);
  }
  return next;
}

/** Cambia la dirección de la fuerza: con «Ángulo» propone 0 (horizontal) si no hay valor; al salir, vacía el ángulo. */
export function switchDirection(form: ReinforcementForm, direction: string): ReinforcementForm {
  if (isTensionType(form.type)) return { ...form, direction };
  if (direction === 'angle') return { ...form, direction, angle: form.angle.trim() === '' ? '0' : form.angle };
  return { ...form, direction, angle: '' };
}

export interface ReinforcementFormContext {
  /** Ids de los demás refuerzos (sin contar el que se edita). */
  otherIds: readonly string[];
  /** Unidades del modelo (`doc.units`), para citar longitudes en los mensajes. */
  units?: string;
  /** Posición (0-based) del refuerzo que se edita; `null` = nuevo. Solo sirve para redactar mensajes. */
  index: number | null;
}

const L = REINFORCEMENT_LABEL;
const R = REINFORCEMENT_RULE;

const required = (label: string, rule: string, accept: (v: number) => boolean): NumberRule => ({
  required: true,
  missing: `${label}: falta el valor; ${rule}`,
  accept,
  range: `${label}: ${rule}`,
  label,
});
const optional = (label: string, rule: string, accept: (v: number) => boolean): NumberRule => ({ required: false, missing: '', accept, range: `${label}: ${rule}`, label });

const atLeastZero = (v: number): boolean => finite(v) && v >= 0;
const moreThanZero = (v: number): boolean => finite(v) && v > 0;

/** Longitud L del refuerzo a partir de sus extremos. */
export function reinforcementLength(r: Pick<Reinforcement, 'x1' | 'y1' | 'x2' | 'y2'>): number {
  return Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
}

/**
 * F4.2: formulario → refuerzo, con las mismas reglas que `validateLocal` y el motor. En la tablestaca la x de la punta es la de la
 * cabeza. Los opcionales vacíos no se escriben; el ángulo solo con la dirección «Ángulo».
 */
export function reinforcementFromForm(form: ReinforcementForm, ctx: ReinforcementFormContext): FormOutcome<Reinforcement> {
  const errors: FieldErrors = {};
  const type = form.type;
  const tension = isTensionType(type);
  const id = form.id.trim();
  if (id === '') errors.id = `${L.id}: ${R.emptyId}`;
  else if (ctx.otherIds.includes(id)) errors.id = `${L.id}: «${id}» ya lo usa otro refuerzo; use uno distinto`;

  const x1 = take(errors, 'x1', form.x1, required(L.x1, R.finite, finite));
  const y1 = take(errors, 'y1', form.y1, required(L.y1, R.finite, finite));
  const x2 = type === 'sheet_pile' ? x1 : take(errors, 'x2', form.x2, required(L.x2, R.finite, finite));
  const y2 = take(errors, 'y2', form.y2, required(L.y2, R.finite, finite));
  const coords = x1 !== null && y1 !== null && x2 !== null && y2 !== null;
  const length = coords ? Math.hypot(x2 - x1, y2 - y1) : Number.NaN;
  if (coords && !(length > 0)) {
    errors[type === 'sheet_pile' ? 'y2' : 'x2'] = 'La cabeza y la punta coinciden, así que la longitud es 0; separe los dos extremos';
  }

  let value: Reinforcement | null = null;
  if (tension) {
    const direction = form.direction as TensionDirection;
    const tensile = take(errors, 'tensile_capacity', form.tensile_capacity, required(L.tensile_capacity, R.nonNegative, atLeastZero));
    const end1 = take(errors, 'end1_capacity', form.end1_capacity, optional(L.end1_capacity, R.nonNegative, atLeastZero));
    const end2 = take(errors, 'end2_capacity', form.end2_capacity, optional(L.end2_capacity, R.nonNegative, atLeastZero));
    const spacing = take(errors, 'spacing', form.spacing, optional(L.spacing, R.positive, moreThanZero));
    let pullout: Pullout | undefined;
    if (form.pullout === 'bond') {
      const strength = take(errors, 'strength', form.strength, required(L.strength, R.nonNegative, atLeastZero));
      const bonded = take(errors, 'bonded_length', form.bonded_length, optional(L.bonded_length, R.positive, moreThanZero));
      if (bonded !== null && !errors.bonded_length && coords && bonded > length) {
        errors.bonded_length = `${L.bonded_length}: no puede superar la longitud del refuerzo (${formatNumber(round2(length))} ${reinforcementUnits(ctx.units).length}); reduzca la longitud adherida o alargue el refuerzo`;
      }
      pullout = { model: 'bond', strength: strength ?? 0, ...(bonded === null ? {} : { bonded_length: bonded }) };
    } else if (form.pullout === 'interface') {
      const adhesion = take(errors, 'adhesion', form.adhesion, required(L.adhesion, R.nonNegative, atLeastZero));
      const friction = take(errors, 'friction_angle', form.friction_angle, required(L.friction_angle, R.friction, (v) => finite(v) && v >= 0 && v < 90));
      const coverage = take(errors, 'coverage', form.coverage, required(L.coverage, R.coverage, (v) => finite(v) && v > 0 && v <= 1));
      pullout = { model: 'interface', adhesion: adhesion ?? 0, friction_angle: friction ?? 0, coverage: coverage ?? 1 };
    } else if (form.pullout === 'development') {
      const length1 = take(errors, 'length1', form.length1, required(L.length1, R.nonNegative, atLeastZero));
      const length2 = take(errors, 'length2', form.length2, required(L.length2, R.nonNegative, atLeastZero));
      pullout = { model: 'development', length1: length1 ?? 0, length2: length2 ?? 0 };
    }
    value = {
      type: type as 'anchor' | 'nail' | 'geosynthetic',
      id,
      x1: x1 ?? 0,
      y1: y1 ?? 0,
      x2: x2 ?? 0,
      y2: y2 ?? 0,
      application: form.application,
      tensile_capacity: tensile ?? 0,
      ...(end1 === null ? {} : { end1_capacity: end1 }),
      ...(end2 === null ? {} : { end2_capacity: end2 }),
      ...(spacing === null ? {} : { spacing }),
      direction,
      ...(pullout ? { pullout } : {}),
    };
  } else {
    const direction = form.direction as PileDirection;
    const force = take(errors, 'force', form.force, required(L.force, R.nonNegative, atLeastZero));
    const spacing = type === 'pile' ? take(errors, 'spacing', form.spacing, optional(L.spacing, R.positive, moreThanZero)) : null;
    let angle: number | null = null;
    if (direction === 'angle') {
      angle = take(errors, 'angle', form.angle, {
        required: true,
        missing: `${L.angle}: falta el valor; ${R.angleRange}`,
        accept: (v: number) => finite(v) && v > -90 && v < 90,
        range: `${L.angle}: ${R.angleRange}`,
        label: L.angle,
      });
    }
    const common = { id, x1: x1 ?? 0, y1: y1 ?? 0, x2: x2 ?? 0, y2: y2 ?? 0, application: form.application, force: force ?? 0, direction, ...(angle === null ? {} : { angle }) };
    value = type === 'pile' ? { type: 'pile', ...common, ...(spacing === null ? {} : { spacing }) } : { type: 'sheet_pile', ...common };
  }
  return done(errors, () => value as Reinforcement);
}

export function reinforcementsEqual(a: Reinforcement, b: Reinforcement): boolean {
  return deepEqual(a, b);
}

export function reinforcementUpsertCommand(index: number | null, reinforcement: Reinforcement): EditorCommand {
  return { type: 'reinforcement/upsert', index, reinforcement };
}

export function reinforcementRemoveCommand(index: number): EditorCommand {
  return { type: 'reinforcement/remove', index };
}

/** Número de `parseNumber` o `null`: para quien quiera leer un campo suelto sin reglas. */
export function parseField(text: string): number | null {
  const p = parseNumber(text);
  return p.kind === 'ok' ? p.value : null;
}
