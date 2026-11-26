// Conversión de unidades del modelo (R8 A-02): SI (m, kN/m³, kPa, kN/m, kPa/m) ⇄ imperial (ft, pcf, psf, lbf/ft, psf/ft). Puro.
//
// El motor no convierte unidades: `units` es una etiqueta y los números se calculan tal cual (`ogs-core/src/model.rs`). Cambiar
// solo la etiqueta deja un modelo con números en otro sistema. Esta función reescribe los valores con los factores de abajo, de modo
// que el factor de seguridad no cambia (lo verifican `units.test.ts` con el motor, para Bishop y Spencer, con agua, cargas y sismo).
//
// Factores: se derivan de dos definiciones exactas, así que son coherentes entre sí y el FS se conserva hasta el redondeo de coma flotante:
//   1 ft  = 0,3048 m                 (yarda y libra internacionales, 1959)
//   1 lbf = 4,4482216152605 N        (= 0,45359237 kg × 9,80665 m/s², definición de la libra-fuerza)
// Resultan 1 m = 3,280840 ft · 1 kN/m³ = 6,365880 pcf · 1 kPa = 20,885434 psf · 1 kN/m = 68,521766 lbf/ft · 1 kN = 224,808943 lbf.
//
// γw: el agua es 9,81 kN/m³ en SI y, convertida con estos factores, 62,4493 pcf (se muestra 62,45). No se redondea a 62,4 al
// convertir: ese redondeo cambia el FS en la 6.ª cifra. Con piezométrica, el γw (explícito o el 9,81 por defecto) se escribe
// siempre explícito al pasar a imperial, porque el motor usaría 9,81 «pcf» si faltara.

import type { Load, Material, PileCapacity, PileReinforcement, Point, Pullout, Reinforcement, SearchSpec, SurfaceSpec, Water } from '../../engine/types';
import type { ModelDoc } from '../types';

export type UnitSystem = 'SI' | 'imperial';

const FT_PER_M = 1 / 0.3048;
const N_PER_LBF = 4.4482216152605;
const LBF_PER_KN = 1000 / N_PER_LBF;

/** Factores SI → imperial (multiplicar para ir a imperial; dividir para volver). */
export const UNIT_FACTORS = {
  /** m → ft. */
  length: FT_PER_M,
  /** kN/m³ → pcf (γ, γsat y γw). */
  unitWeight: LBF_PER_KN / FT_PER_M ** 3,
  /** kPa → psf (c, q). */
  stress: LBF_PER_KN / FT_PER_M ** 2,
  /** kN/m → lbf/ft (carga lineal p, adherencia por metro y fuerza de la tablestaca por metro de muro). */
  lineForce: LBF_PER_KN / FT_PER_M,
  /** kN → lbf (capacidades y fuerza de un refuerzo, por elemento). */
  force: LBF_PER_KN,
  /** kN·m → lbf·ft (la capacidad a momento de un pilote con presión del suelo, E15i-1): el factor de la fuerza por el de la longitud. */
  moment: LBF_PER_KN * FT_PER_M,
  /** kPa/m → psf/ft (gradiente de Su, un esfuerzo por unidad de longitud): el factor del esfuerzo entre el de la longitud (= el de γ). */
  stressGradient: LBF_PER_KN / FT_PER_M ** 2 / FT_PER_M,
} as const;

/** γw por defecto del motor, en kN/m³. */
const WATER_UNIT_WEIGHT_SI = 9.81;

/**
 * ¿La etiqueta `units` del modelo es imperial? Única detección de la aplicación (R9-03b): no distingue mayúsculas ni espacios
 * (`imperial`, `Imperial`, ` IMPERIAL `) y acepta la abreviatura `imp…`. El motor trata `units` como un texto libre, así que un
 * archivo con `"Imperial"` también llega al cálculo con números en pcf: debe tratarse igual que `imperial` en todas partes.
 */
export function isImperialUnits(units: string | null | undefined): boolean {
  return typeof units === 'string' && /^\s*imp/i.test(units);
}

/** Sistema en el que están expresados los valores del documento: todo lo que no sea imperial cuenta como SI. */
export function unitSystemOf(doc: Pick<ModelDoc, 'units'>): UnitSystem {
  return isImperialUnits(doc.units) ? 'imperial' : 'SI';
}

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === 'SI' || value === 'imperial';
}

type Scale = (v: number) => number;

function scalesFor(to: UnitSystem): Record<keyof typeof UNIT_FACTORS, Scale> {
  const up = to === 'imperial';
  const make = (f: number): Scale => (up ? (v) => v * f : (v) => v / f);
  return {
    length: make(UNIT_FACTORS.length),
    unitWeight: make(UNIT_FACTORS.unitWeight),
    stress: make(UNIT_FACTORS.stress),
    lineForce: make(UNIT_FACTORS.lineForce),
    force: make(UNIT_FACTORS.force),
    moment: make(UNIT_FACTORS.moment),
    stressGradient: make(UNIT_FACTORS.stressGradient),
  };
}

const optional = (v: number | null | undefined, f: Scale): number | null | undefined => (typeof v === 'number' ? f(v) : v);

/**
 * Reescribe los valores del documento al sistema `to`. Convierte longitudes (coordenadas, piezométrica, círculo, puntos de la polilínea
 * fija, rangos y ancho mínimo de la búsqueda, x de las cargas, cota de referencia de Su), pesos unitarios (γ, γsat, γw), tensiones (c, q,
 * Su y su límite), la carga lineal p y el gradiente de Su (esfuerzo por longitud). No cambian φ, ru, kh, kv, los ángulos, la tolerancia,
 * el número de dovelas ni de intentos, ni los puntos (ξ, f) de la función entre dovelas, que son adimensionales. Si ya está en `to`, devuelve el mismo documento.
 */
export function convertDocUnits(doc: ModelDoc, to: UnitSystem): ModelDoc {
  if (unitSystemOf(doc) === to && (doc.units === to || (to === 'SI' && (doc.units === undefined || doc.units === null)))) return doc;
  if (unitSystemOf(doc) === to) return { ...doc, units: to };
  const k = scalesFor(to);
  const pt = (p: Point): Point => [k.length(p[0]), k.length(p[1])];

  const materials = doc.materials.map((m): Material => {
    const out: Material = { ...m, unit_weight: k.unitWeight(m.unit_weight) };
    if (typeof m.cohesion === 'number') out.cohesion = k.stress(m.cohesion);
    // Material no drenado (F3.2): Su y su límite son esfuerzos, la cota de referencia es una longitud y el gradiente es un esfuerzo por
    // longitud. Solo se convierten los que existen: un `null` o un campo ausente se queda como está.
    if (typeof m.undrained_strength === 'number') out.undrained_strength = k.stress(m.undrained_strength);
    if (typeof m.strength_limit === 'number') out.strength_limit = k.stress(m.strength_limit);
    if (typeof m.strength_datum === 'number') out.strength_datum = k.length(m.strength_datum);
    if (typeof m.strength_gradient === 'number') out.strength_gradient = k.stressGradient(m.strength_gradient);
    if (typeof m.unit_weight_sat === 'number') out.unit_weight_sat = k.unitWeight(m.unit_weight_sat);
    return out;
  });

  let water: Water | null | undefined = doc.water;
  if (doc.water) {
    const w: Water = { ...doc.water };
    const hasPiezo = Array.isArray(w.piezometric_line) && w.piezometric_line.length >= 2;
    if (Array.isArray(w.piezometric_line)) w.piezometric_line = w.piezometric_line.map(pt);
    if (typeof w.unit_weight === 'number') w.unit_weight = k.unitWeight(w.unit_weight);
    else if (to === 'imperial' && hasPiezo) w.unit_weight = k.unitWeight(WATER_UNIT_WEIGHT_SI); // 62,45 pcf, explícito
    // De imperial a SI sin γw explícito: el motor usa 9,81, que en SI es lo correcto.
    water = w;
  }

  const loads = doc.loads?.map((l): Load => (l.type === 'udl' ? { ...l, x1: k.length(l.x1), x2: k.length(l.x2), q: k.stress(l.q) } : { ...l, x: k.length(l.x), p: k.lineForce(l.p) }));

  const reinforcements = doc.reinforcements?.map((r) => convertReinforcement(r, k));

  const analysis = { ...doc.analysis };
  const surf = doc.analysis.surface;
  if (surf) analysis.surface = (surf.type === 'polyline' ? { ...surf, points: surf.points.map(pt) } : { ...surf, xc: k.length(surf.xc), yc: k.length(surf.yc), r: k.length(surf.r) }) as SurfaceSpec;
  if (doc.analysis.search) {
    const s = doc.analysis.search;
    const search: SearchSpec = { ...s };
    if (Array.isArray(s.entry)) search.entry = [k.length(s.entry[0]), k.length(s.entry[1])];
    if (Array.isArray(s.exit)) search.exit = [k.length(s.exit[0]), k.length(s.exit[1])];
    const w = optional(s.min_width, k.length);
    if (w !== undefined) search.min_width = w;
    analysis.search = search;
  }
  // F5.7: `depth` es una longitud (la cadena «auto» queda igual) y `water_fill` no tiene unidad. El FS no cambia.
  const crack = doc.analysis.tension_crack;
  if (crack) analysis.tension_crack = { ...crack, depth: typeof crack.depth === 'number' ? k.length(crack.depth) : crack.depth };

  const next: ModelDoc = {
    ...doc,
    units: to,
    materials,
    regions: doc.regions.map((r) => ({ ...r, polygon: r.polygon.map(pt) })),
    analysis,
  };
  if (water !== doc.water) next.water = water;
  if (loads) next.loads = loads;
  if (reinforcements) next.reinforcements = reinforcements;
  return next;
}

/**
 * `spacing` en el otro sistema, **siempre explícito** (E14o-12, R11B-01). Un `spacing` omitido o `null` vale 1 en la unidad de longitud
 * del modelo (1 m en SI, 1 ft en imperial): dejarlo omitido al convertir lo cambiaba de 1 m a 1 ft y las capacidades por elemento, que sí
 * se escalan, daban una fuerza por metro 3,28 veces mayor (FS +203 %). Se escribe `k.length(1)` o `k.length(valor)`, de modo que el
 * espaciamiento implícito de 1 m pasa a 3,28084 ft y el de 1 ft, a 0,3048 m.
 */
function explicitSpacing(spacing: number | null | undefined, k: Record<keyof typeof UNIT_FACTORS, Scale>): number {
  return k.length(typeof spacing === 'number' ? spacing : 1);
}

/**
 * Refuerzo (v0.4) en el otro sistema: coordenadas, `spacing` (siempre explícito: el omitido es 1 en la unidad del modelo), `bonded_length`, `length1` y `length2` son longitudes; las capacidades
 * y la fuerza de un pilote, kN ⇄ lbf (con presión del suelo, `diameter` es una longitud, `capacity.shear` una fuerza y `capacity.moment` un momento, kN·m ⇄ lbf·ft); la adherencia por metro y la fuerza de la tablestaca (por metro de muro), kN/m ⇄ lbf/ft; la
 * adhesión de la interfaz, un esfuerzo. No cambian los ángulos, `friction_angle` ni `coverage`.
 */
function convertReinforcement(r: Reinforcement, k: Record<keyof typeof UNIT_FACTORS, Scale>): Reinforcement {
  const common = { x1: k.length(r.x1), y1: k.length(r.y1), x2: k.length(r.x2), y2: k.length(r.y2) };
  if (r.type === 'pile') {
    const out: PileReinforcement = { ...r, ...common, spacing: explicitSpacing(r.spacing, k) };
    // E15i-1: con `lateral_pressure`, `force` no existe y no se crea; `diameter` es una longitud.
    if (typeof r.force === 'number') out.force = k.force(r.force);
    if (r.lateral_pressure) out.lateral_pressure = { ...r.lateral_pressure, diameter: k.length(r.lateral_pressure.diameter) };
    // `shear` es una fuerza por pilote y `moment`, un momento (fuerza por longitud). Solo se convierten los que existen.
    if (r.capacity) {
      const cap: PileCapacity = {};
      if (typeof r.capacity.shear === 'number') cap.shear = k.force(r.capacity.shear);
      if (typeof r.capacity.moment === 'number') cap.moment = k.moment(r.capacity.moment);
      out.capacity = cap;
    }
    return out;
  }
  if (r.type === 'sheet_pile') return { ...r, ...common, force: k.lineForce(r.force) };
  const out = { ...r, ...common, tensile_capacity: k.force(r.tensile_capacity) };
  for (const key of ['end1_capacity', 'end2_capacity'] as const) {
    const v = optional(r[key], k.force);
    if (typeof v === 'number') out[key] = v;
  }
  out.spacing = explicitSpacing(r.spacing, k);
  if (r.pullout) out.pullout = convertPullout(r.pullout, k);
  return out;
}

function convertPullout(p: Pullout, k: Record<keyof typeof UNIT_FACTORS, Scale>): Pullout {
  if (p.model === 'bond') {
    const out: Pullout = { ...p, strength: k.lineForce(p.strength) };
    const bonded = optional(p.bonded_length, k.length);
    if (typeof bonded === 'number') out.bonded_length = bonded;
    return out;
  }
  if (p.model === 'interface') return { ...p, adhesion: k.stress(p.adhesion) };
  return { ...p, length1: k.length(p.length1), length2: k.length(p.length2) };
}
