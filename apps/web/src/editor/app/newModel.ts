// Modelos de partida de «Nuevo»: «Modelo vacío» (sin regiones, con un material por defecto) y «Talud simple…» (un talud
// parametrizado: altura, ángulo o pendiente H:V, anchos de corona y de pie, profundidad bajo el pie, material y piezométrica).
// Lógica pura: sin React ni DOM. El motor verifica el talud simple en `newModel.test.ts` (con `OGS_BIN`).
//
// Geometría del talud simple (x a la derecha, y hacia arriba; el terreno baja de izquierda a derecha):
//
//   (0, H) ─ corona ─ (c, H)
//    │                   ╲  talud (ángulo β, o H:V)
//    │                    ╲
//    │                  (c + H/tan β, 0) ── pie ── (W, 0)
//    │                                              │
//   (0, −D) ──────────── base ───────────────────  (W, −D)
//
// con c = ancho de corona, W = c + H/tan β + ancho de pie y D = profundidad bajo el pie. La dirección del deslizamiento
// es «de izquierda a derecha» (el motor la comprueba: «auto» da el mismo resultado y la contraria no halla superficie).

import type { Material, Point, SearchSpec } from '../../engine/types';
import {
  defaultSearch,
  defaultWaterUnitWeight,
  formatNumber,
  materialFromForm,
  newMaterialForm,
  parseNumber,
  unitLabels,
  type FieldErrors,
  type FormOutcome,
  type MaterialForm,
} from '../panels/forms';
import type { ModelDoc } from '../types';

/** Búsqueda por defecto de los modelos nuevos: rangos automáticos y una malla que responde en poco tiempo. */
function startSearch(): SearchSpec {
  return { ...defaultSearch(), n_entry: 15, n_exit: 15, n_radius: 10 };
}

function baseAnalysis(): ModelDoc['analysis'] {
  return {
    methods: ['bishop', 'spencer'],
    slices: 50,
    tolerance: 1e-5,
    max_iterations: 500,
    min_m_alpha: 0.2,
    search: startSearch(),
  };
}

function defaultMaterial(units: 'SI' | 'imperial', name = 'Suelo'): Material {
  const f = newMaterialForm([], units);
  return {
    id: 'suelo',
    name,
    model: 'mohr_coulomb',
    unit_weight: Number(f.unit_weight),
    unit_weight_sat: null,
    cohesion: Number(f.cohesion),
    friction_angle: Number(f.friction_angle),
    ru: null,
  };
}

/** «Modelo vacío»: sin regiones y con un material por defecto; el lienzo invita a «Dibujar región». */
export function emptyModel(units: 'SI' | 'imperial' = 'SI'): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { id: 'nuevo', title: 'Modelo nuevo', notes: null },
    units,
    materials: [defaultMaterial(units)],
    regions: [],
    water: null,
    loads: [],
    slope: { direction: 'auto' },
    analysis: baseAnalysis(),
  };
}

// ───────────────────────── Talud simple ─────────────────────────

export type SlopeShape = { kind: 'angle'; degrees: number } | { kind: 'ratio'; horizontal: number };
export type SlopeWater = 'none' | 'toe' | 'crown';

export interface SlopeInput {
  units: 'SI' | 'imperial';
  /** Altura H del talud. */
  height: number;
  /** Ángulo β (grados) o pendiente H:V (`horizontal` unidades horizontales por 1 vertical). */
  slope: SlopeShape;
  /** Ancho de la corona (parte plana superior). */
  crownWidth: number;
  /** Ancho del terreno plano que sigue al pie. */
  toeWidth: number;
  /** Profundidad del modelo bajo el pie del talud. */
  depth: number;
  material: Pick<Material, 'name' | 'unit_weight' | 'cohesion' | 'friction_angle'>;
  water: SlopeWater;
}

/** Ángulos admitidos para el talud simple, en grados (el diálogo no genera taludes casi planos ni casi verticales). */
export const SLOPE_ANGLE_MIN = 1;
export const SLOPE_ANGLE_MAX = 89;

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

function slopeTangent(shape: SlopeShape): number {
  return shape.kind === 'angle' ? Math.tan((shape.degrees * Math.PI) / 180) : 1 / shape.horizontal;
}

/** Título del modelo: «Talud simple H = 10 m, β = 45°» o «… 1,5H:1V». */
export function slopeTitle(input: SlopeInput): string {
  const u = unitLabels(input.units).length;
  const shape = input.slope.kind === 'angle' ? `β = ${formatNumber(input.slope.degrees)}°` : `${formatNumber(input.slope.horizontal)}H:1V`;
  return `Talud simple H = ${formatNumber(input.height)} ${u}, ${shape}`;
}

/** Quita los vértices consecutivos repetidos (también el último frente al primero). */
function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

/** Talud simple de un material con búsqueda de superficie crítica y dirección de izquierda a derecha. */
export function simpleSlope(input: SlopeInput): ModelDoc {
  const { height: h, crownWidth, toeWidth, depth, units } = input;
  const run = r6(h / slopeTangent(input.slope));
  const xCrest = r6(crownWidth);
  const xToe = r6(crownWidth + run);
  const width = r6(crownWidth + run + toeWidth);
  const polygon = dedupe([
    [0, -depth],
    [width, -depth],
    [width, 0],
    [xToe, 0],
    [xCrest, h],
    [0, h],
  ]);

  let water: ModelDoc['water'] = null;
  if (input.water !== 'none') {
    // El nivel freático aflora en el pie; atrás llega a la mitad de la altura («en el pie») o a la cota de la corona.
    const back = input.water === 'toe' ? r6(h / 2) : h;
    const line: Point[] = dedupe([
      [0, back],
      [xToe, 0],
      [width, 0],
    ]);
    water = { unit_weight: defaultWaterUnitWeight(units), piezometric_line: line };
  }

  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { id: 'talud-simple', title: slopeTitle(input), notes: null },
    units,
    materials: [
      {
        id: 'suelo',
        name: input.material.name.trim() === '' ? 'Suelo' : input.material.name.trim(),
        model: 'mohr_coulomb',
        unit_weight: input.material.unit_weight,
        unit_weight_sat: null,
        cohesion: input.material.cohesion,
        friction_angle: input.material.friction_angle,
        ru: null,
      },
    ],
    regions: [{ material: 'suelo', polygon }],
    water,
    loads: [],
    slope: { direction: 'left_to_right' },
    analysis: baseAnalysis(),
  };
}

// ───────────────────────── Formulario del diálogo ─────────────────────────

/** Valores del diálogo «Talud simple…», todo texto (como los demás formularios del editor). */
export interface SlopeForm {
  units: 'SI' | 'imperial';
  height: string;
  /** Qué se da: el ángulo β o la pendiente H:V. */
  mode: 'angle' | 'ratio';
  angle: string;
  ratio: string;
  crown: string;
  toe: string;
  depth: string;
  name: string;
  unit_weight: string;
  cohesion: string;
  friction_angle: string;
  water: SlopeWater;
}

export function slopeFormDefaults(units: 'SI' | 'imperial' = 'SI'): SlopeForm {
  const imperial = units === 'imperial';
  return {
    units,
    height: imperial ? '30' : '10',
    mode: 'angle',
    angle: '45',
    ratio: '1',
    crown: imperial ? '30' : '10',
    toe: imperial ? '60' : '20',
    depth: imperial ? '30' : '10',
    name: 'Suelo',
    unit_weight: imperial ? '125' : '20',
    cohesion: imperial ? '200' : '10',
    friction_angle: '30',
    water: 'none',
  };
}

/** Un número del formulario: error con el mensaje dado si falta, no es número o no cumple `accept`. */
function field(errors: FieldErrors, key: string, text: string, message: string, accept: (v: number) => boolean): number | null {
  const parsed = parseNumber(text);
  if (parsed.kind !== 'ok' || !accept(parsed.value)) {
    errors[key] = message;
    return null;
  }
  return parsed.value;
}

export function slopeFromForm(form: SlopeForm): FormOutcome<SlopeInput> {
  const errors: FieldErrors = {};
  const len = unitLabels(form.units).length;
  const e = len === 'ft' ? '30' : '10';

  const height = field(errors, 'height', form.height, `Altura H: use un valor mayor que 0 (ej. ${e} ${len})`, (v) => v > 0);
  let slope: SlopeShape | null = null;
  if (form.mode === 'angle') {
    const deg = field(errors, 'angle', form.angle, `Ángulo β: use un valor entre ${SLOPE_ANGLE_MIN}° y ${SLOPE_ANGLE_MAX}° (ej. 45)`, (v) => v >= SLOPE_ANGLE_MIN && v <= SLOPE_ANGLE_MAX);
    if (deg !== null) slope = { kind: 'angle', degrees: deg };
  } else {
    const lo = 1 / Math.tan((SLOPE_ANGLE_MAX * Math.PI) / 180);
    const hi = 1 / Math.tan((SLOPE_ANGLE_MIN * Math.PI) / 180);
    const ratio = field(
      errors,
      'ratio',
      form.ratio,
      `Pendiente H:V: use un valor mayor que 0 que equivalga a un ángulo entre ${SLOPE_ANGLE_MIN}° y ${SLOPE_ANGLE_MAX}° (ej. 1,5 para 1,5H:1V)`,
      (v) => v >= lo && v <= hi,
    );
    if (ratio !== null) slope = { kind: 'ratio', horizontal: ratio };
  }
  const crown = field(errors, 'crown', form.crown, `Ancho de corona: use un valor igual o mayor que 0 (ej. ${e} ${len})`, (v) => v >= 0);
  const toe = field(errors, 'toe', form.toe, `Ancho de pie: use un valor igual o mayor que 0 (ej. 20 ${len})`, (v) => v >= 0);
  const depth = field(errors, 'depth', form.depth, `Profundidad bajo el pie: use un valor mayor que 0 (ej. ${e} ${len})`, (v) => v > 0);

  const matForm: MaterialForm = {
    id: 'suelo',
    name: form.name,
    unit_weight: form.unit_weight,
    unit_weight_sat: '',
    cohesion: form.cohesion,
    friction_angle: form.friction_angle,
    ru: '',
  };
  const mat = materialFromForm(matForm, { otherIds: [], editing: null });
  if (!mat.ok) {
    for (const [k, v] of Object.entries(mat.errors)) if (k !== 'id') errors[k] = v;
  }

  if (Object.keys(errors).length > 0 || height === null || slope === null || crown === null || toe === null || depth === null || !mat.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      units: form.units,
      height,
      slope,
      crownWidth: crown,
      toeWidth: toe,
      depth,
      material: { name: mat.value.name, unit_weight: mat.value.unit_weight, cohesion: mat.value.cohesion, friction_angle: mat.value.friction_angle },
      water: form.water,
    },
  };
}
