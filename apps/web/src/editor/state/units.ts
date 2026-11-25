// Conversión de unidades del modelo (R8 A-02): SI (m, kN/m³, kPa, kN/m) ⇄ imperial (ft, pcf, psf, lbf/ft). Puro.
//
// El motor no convierte unidades: `units` es una etiqueta y los números se calculan tal cual (`ogs-core/src/model.rs`). Cambiar
// solo la etiqueta deja un modelo con números en otro sistema. Esta función reescribe los valores con los factores de abajo, de modo
// que el factor de seguridad no cambia (lo verifican `units.test.ts` con el motor, para Bishop y Spencer, con agua, cargas y sismo).
//
// Factores: se derivan de dos definiciones exactas, así que son coherentes entre sí y el FS se conserva hasta el redondeo de coma flotante:
//   1 ft  = 0,3048 m                 (yarda y libra internacionales, 1959)
//   1 lbf = 4,4482216152605 N        (= 0,45359237 kg × 9,80665 m/s², definición de la libra-fuerza)
// Resultan 1 m = 3,280840 ft · 1 kN/m³ = 6,365880 pcf · 1 kPa = 20,885434 psf · 1 kN/m = 68,521766 lbf/ft.
//
// γw: el agua es 9,81 kN/m³ en SI y, convertida con estos factores, 62,4501 pcf (se muestra 62,45). No se redondea a 62,4 al
// convertir: ese redondeo cambia el FS en la 6.ª cifra. Con piezométrica, el γw (explícito o el 9,81 por defecto) se escribe
// siempre explícito al pasar a imperial, porque el motor usaría 9,81 «pcf» si faltara.

import type { Load, Material, Point, SearchSpec, SurfaceSpec, Water } from '../../engine/types';
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
  /** kN/m → lbf/ft (carga lineal p). */
  lineForce: LBF_PER_KN / FT_PER_M,
} as const;

/** γw por defecto del motor, en kN/m³. */
const WATER_UNIT_WEIGHT_SI = 9.81;

/** Sistema en el que están expresados los valores del documento: todo lo que no sea `imperial` cuenta como SI. */
export function unitSystemOf(doc: Pick<ModelDoc, 'units'>): UnitSystem {
  return doc.units === 'imperial' ? 'imperial' : 'SI';
}

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === 'SI' || value === 'imperial';
}

type Scale = (v: number) => number;

function scalesFor(to: UnitSystem): Record<keyof typeof UNIT_FACTORS, Scale> {
  const up = to === 'imperial';
  const make = (f: number): Scale => (up ? (v) => v * f : (v) => v / f);
  return { length: make(UNIT_FACTORS.length), unitWeight: make(UNIT_FACTORS.unitWeight), stress: make(UNIT_FACTORS.stress), lineForce: make(UNIT_FACTORS.lineForce) };
}

const optional = (v: number | null | undefined, f: Scale): number | null | undefined => (typeof v === 'number' ? f(v) : v);

/**
 * Reescribe los valores del documento al sistema `to`. Convierte longitudes (coordenadas, piezométrica, círculo, rangos y ancho mínimo
 * de la búsqueda, x de las cargas), pesos unitarios (γ, γsat, γw), tensiones (c, q) y la carga lineal p. No cambian φ, ru, kh, kv, los
 * ángulos, la tolerancia, el número de dovelas ni de intentos. Si ya está en `to`, devuelve el mismo documento.
 */
export function convertDocUnits(doc: ModelDoc, to: UnitSystem): ModelDoc {
  if (unitSystemOf(doc) === to && (doc.units === to || (to === 'SI' && (doc.units === undefined || doc.units === null)))) return doc;
  if (unitSystemOf(doc) === to) return { ...doc, units: to };
  const k = scalesFor(to);
  const pt = (p: Point): Point => [k.length(p[0]), k.length(p[1])];

  const materials = doc.materials.map((m): Material => {
    const out: Material = { ...m, unit_weight: k.unitWeight(m.unit_weight), cohesion: k.stress(m.cohesion) };
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

  const analysis = { ...doc.analysis };
  if (doc.analysis.surface) analysis.surface = { ...doc.analysis.surface, xc: k.length(doc.analysis.surface.xc), yc: k.length(doc.analysis.surface.yc), r: k.length(doc.analysis.surface.r) } as SurfaceSpec;
  if (doc.analysis.search) {
    const s = doc.analysis.search;
    const search: SearchSpec = { ...s };
    if (Array.isArray(s.entry)) search.entry = [k.length(s.entry[0]), k.length(s.entry[1])];
    if (Array.isArray(s.exit)) search.exit = [k.length(s.exit[0]), k.length(s.exit[1])];
    const w = optional(s.min_width, k.length);
    if (w !== undefined) search.min_width = w;
    analysis.search = search;
  }

  const next: ModelDoc = {
    ...doc,
    units: to,
    materials,
    regions: doc.regions.map((r) => ({ ...r, polygon: r.polygon.map(pt) })),
    analysis,
  };
  if (water !== doc.water) next.water = water;
  if (loads) next.loads = loads;
  return next;
}
