// Motor simulado: NO es ogs-core. Calcula un FS aproximado con Fellenius (ordinario) en TypeScript
// para cada método pedido, con ~30 dovelas, y reproduce la estructura del AnalysisReport (§3).
// Es determinista: el mismo modelo produce el mismo JSON byte a byte.
//
// Solo simula la versión 0.2 del formato: rechaza con un error explícito todo modelo con campos de la versión 0.3
// (material no drenado, polilínea, Morgenstern-Price, Janbu, interslice; F3.9) o de la 0.4 (refuerzos; F4.11). Nunca
// inventa un FS para ellos.
//
// Diferencias con el motor real (se avisan en `warnings` de cada resultado):
// - Fellenius en lugar de Bishop/Spencer; `lambda` es null e `iterations` vale 1.
// - Búsqueda de rejilla sin refinamiento de patrones.
// - Bordes de dovela uniformes (sin puntos de quiebre).

import { EngineError, type Engine } from './engine';
import {
  modelXRange,
  piezoY,
  resolveSliding,
  verticalIntervals,
  yBottom,
  yTop,
  type Sliding,
} from './groundGeometry';
import type {
  AnalysisReport,
  Circle,
  Material,
  MethodKind,
  MethodReport,
  Model,
  SearchSpec,
  SearchStats,
  Slice,
  SolveStatus,
} from './types';

export const MOCK_VERSION = '0.1.0';
export const MOCK_SLICE_COUNT = 30;
/** Código de aviso (ver warnings.ts) que marca el resultado como simulado. */
export const MOCK_WARNING = 'mock_engine';

const GAMMA_W_DEFAULT = 9.81;
const GROUND_TOL = 1e-7;
const KNOWN_METHODS: readonly MethodKind[] = ['bishop', 'spencer'];

/**
 * Primer campo de la versión 0.3 (F3.1) que usa el modelo, o null si no usa ninguno. Cada uno exige el motor real:
 * el simulado no sabe resolverlos y no debe devolver un FS que no calculó.
 */
function firstV03Field(model: Model): string | null {
  const analysis = (model.analysis ?? {}) as Partial<Model['analysis']>;
  for (const [i, m] of (Array.isArray(model.materials) ? model.materials : []).entries()) {
    const mat = m as Partial<Material>;
    if (mat.model === 'undrained') return `materials[${i}].model "undrained"`;
    for (const key of ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'] as const) {
      if (mat[key] != null) return `materials[${i}].${key}`;
    }
  }
  if (analysis.surface?.type === 'polyline') return 'analysis.surface.type "polyline"';
  for (const method of analysis.methods ?? []) {
    if (method === 'morgenstern_price' || method === 'janbu_simplified' || method === 'janbu_corrected') {
      return `analysis.methods "${method}"`;
    }
  }
  if (analysis.interslice != null) return 'analysis.interslice';
  return null;
}

/** Motivo por el que una superficie candidata no es válida. No es un error de la petición. */
class SliceFailure extends Error {}

interface Context {
  model: Model;
  sliding: Sliding;
  /** +1 si la masa se mueve hacia +x, −1 en otro caso. */
  sign: 1 | -1;
  gammaW: number;
  /** Material de cada región (índice = índice de región). */
  regionMaterial: Material[];
  /** Índice en model.materials de cada región. */
  regionMaterialIndex: number[];
  warnings: Set<string>;
}

interface Outcome {
  circle: Circle;
  slices: Slice[];
  fos: number | null;
  status: SolveStatus;
  search: SearchStats | null;
  notes: string[];
}

function parseModel(modelJson: string): Model {
  let raw: unknown;
  try {
    raw = JSON.parse(modelJson);
  } catch (error) {
    throw new EngineError(`Json: ${(error as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new EngineError('Json: el modelo debe ser un objeto');
  }
  return raw as Model;
}

function validateModel(model: Model): void {
  if (model.format !== 'opengeoslide') {
    throw new EngineError(`InvalidModel: format "${String(model.format)}" no reconocido`);
  }
  if (Array.isArray(model.reinforcements) && model.reinforcements.length > 0) {
    throw new EngineError(
      'InvalidModel: el motor simulado no admite los refuerzos (reinforcements), un campo de la versión 0.4; use el motor WASM',
    );
  }
  // Grieta de tracción (v0.5, F3G): el motor simulado no la calcula. Se rechaza, como los refuerzos, en vez de ignorarla en
  // silencio y devolver un FS que no la incluye. `null` y `undefined` equivalen a «sin grieta».
  if (model.analysis != null && (model.analysis as { tension_crack?: unknown }).tension_crack != null) {
    throw new EngineError(
      'InvalidModel: el motor simulado no admite la grieta de tracción (analysis.tension_crack), un campo de la versión 0.5; use el motor WASM',
    );
  }
  const v03 = firstV03Field(model);
  if (v03 !== null) {
    throw new EngineError(
      `InvalidModel: el motor simulado no admite ${v03}, un campo de la versión 0.3; use el motor WASM`,
    );
  }
  if (!Array.isArray(model.materials) || model.materials.length === 0) {
    throw new EngineError('InvalidModel: el modelo no tiene materiales');
  }
  if (!Array.isArray(model.regions) || model.regions.length === 0) {
    throw new EngineError('InvalidModel: el modelo no tiene regiones');
  }
  model.regions.forEach((region, i) => {
    if (!Array.isArray(region.polygon) || region.polygon.length < 3) {
      throw new EngineError(`InvalidModel: la región ${i} tiene menos de 3 vértices`);
    }
    if (!model.materials.some((m) => m.id === region.material)) {
      throw new EngineError(`InvalidModel: el material "${region.material}" no está definido`);
    }
  });
  model.materials.forEach((m, i) => {
    // En 0.2 solo existe mohr_coulomb, que exige cohesión y ángulo de fricción (F3.2).
    if (m.cohesion == null || m.friction_angle == null) {
      throw new EngineError(`InvalidModel: el material ${i} (mohr_coulomb) requiere cohesion y friction_angle`);
    }
  });
  if (!model.analysis) {
    throw new EngineError('InvalidModel: falta el bloque analysis');
  }
  for (const method of model.analysis.methods ?? ['bishop']) {
    if (!KNOWN_METHODS.includes(method)) {
      throw new EngineError(`InvalidModel: método no soportado "${String(method)}"`);
    }
  }
  if (!model.analysis.surface && !model.analysis.search) {
    throw new EngineError('NoSurface: falta analysis.surface o analysis.search');
  }
}

/** `cohesion` y `friction_angle` son opcionales en el tipo; validateModel garantiza que existen en 0.2. */
const cohesion = (m: Material): number => m.cohesion ?? 0;
const frictionAngle = (m: Material): number => m.friction_angle ?? 0;

function makeContext(model: Model): Context {
  const regionMaterialIndex = model.regions.map((region) =>
    model.materials.findIndex((m) => m.id === region.material),
  );
  const sliding = resolveSliding(model);
  return {
    model,
    sliding,
    sign: sliding === 'left_to_right' ? 1 : -1,
    gammaW: model.water?.unit_weight ?? GAMMA_W_DEFAULT,
    regionMaterial: regionMaterialIndex.map((i) => model.materials[i]),
    regionMaterialIndex,
    warnings: new Set<string>(),
  };
}

function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/**
 * Construye las dovelas de un círculo entre los límites `bounds` (ordenados del pie al coronamiento).
 * Lanza SliceFailure si el arco no es válido sobre esos límites.
 */
function buildSlices(ctx: Context, circle: Circle, bounds: number[]): Slice[] {
  const { model } = ctx;
  const arc = (x: number): number => {
    const d = circle.r * circle.r - (x - circle.xc) ** 2;
    if (d < 0) throw new SliceFailure('OutsideModel: el arco sale del círculo');
    return circle.yc - Math.sqrt(d);
  };

  const slices: Slice[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const xl = Math.min(bounds[i], bounds[i + 1]);
    const xr = Math.max(bounds[i], bounds[i + 1]);
    const b = xr - xl;
    if (!(b > 0)) throw new SliceFailure('dovela de ancho nulo');
    const xm = (xl + xr) / 2;

    for (const x of [xl, xm, xr]) {
      const top = yTop(model, x);
      const bot = yBottom(model, x);
      if (top === null || bot === null) {
        throw new SliceFailure('OutsideModel: el arco sale del modelo');
      }
      const ya = arc(x);
      if (ya > top + GROUND_TOL) throw new SliceFailure('AboveGround: el arco queda sobre el terreno');
      if (ya < bot - GROUND_TOL) throw new SliceFailure('OutsideModel: el arco baja de la base del modelo');
    }

    const yl = arc(xl);
    const yr = arc(xr);
    const ybm = (yl + yr) / 2; // punto medio de la cuerda
    const ytm = yTop(model, xm) as number;
    // Positivo cuando la base sube hacia el coronamiento (upslope = −x si la masa va hacia +x).
    const alpha = Math.atan((-ctx.sign * (yr - yl)) / b);
    const baseLength = b / Math.cos(alpha);

    const ints = verticalIntervals(model, xm);
    const piezo = piezoY(model, xm);
    if (piezo !== null && piezo > ytm + GROUND_TOL) {
      ctx.warnings.add('water_above_ground');
    }

    // Σ γ_k h_k sobre la vertical x_mid entre la base y el terreno (kPa).
    let columnWeight = 0;
    for (const int of ints) {
      const lo = Math.max(int.lo, ybm);
      const hi = Math.min(int.hi, ytm);
      if (!(hi > lo)) continue;
      const mat = ctx.regionMaterial[int.region];
      if (mat.unit_weight_sat != null && piezo !== null) {
        const below = Math.max(0, Math.min(hi, piezo) - lo);
        columnWeight += below * mat.unit_weight_sat + (hi - lo - below) * mat.unit_weight;
      } else {
        columnWeight += (hi - lo) * mat.unit_weight;
      }
    }
    const weight = b * columnWeight;

    const baseInt = ints.find((int) => int.lo <= ybm + 1e-6 && ybm + 1e-6 < int.hi);
    if (!baseInt) throw new SliceFailure('NoMaterial: la base no pertenece a ningún material');
    const mat = ctx.regionMaterial[baseInt.region];

    let pore = 0;
    if (mat.ru != null) {
      pore = mat.ru * columnWeight;
    } else if (piezo !== null) {
      pore = ctx.gammaW * Math.max(0, piezo - ybm);
    }

    slices.push({
      x_left: xl,
      x_right: xr,
      y_base_left: yl,
      y_base_right: yr,
      y_top_mid: ytm,
      width: b,
      alpha,
      base_length: baseLength,
      weight,
      cohesion: cohesion(mat),
      tan_phi: Math.tan((frictionAngle(mat) * Math.PI) / 180),
      pore_pressure: pore,
      material: ctx.regionMaterialIndex[baseInt.region],
      // El simulado no resuelve sismo ni cargas (E12b): los cinco campos de la dovela valen 0.
      weight_extra: 0,
      h_force: 0,
      h_moment_base: 0,
      driving_extra: 0,
      y_centroid: 0,
    });
  }
  return slices;
}

/** Fellenius: FS = Σ(c·l + (W cos α − u·l) tan φ) / Σ W sin α. Null si no hay fuerza motriz. */
function fellenius(slices: Slice[]): number | null {
  let resisting = 0;
  let driving = 0;
  for (const s of slices) {
    resisting +=
      s.cohesion * s.base_length +
      (s.weight * Math.cos(s.alpha) - s.pore_pressure * s.base_length) * s.tan_phi;
    driving += s.weight * Math.sin(s.alpha);
  }
  if (!(driving > 0)) return null;
  const fos = resisting / driving;
  return Number.isFinite(fos) ? fos : null;
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  const aPositive = f(a) > 0;
  let lo = a;
  let hi = b;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if ((f(m) > 0) === aPositive) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Superficie fija (`analysis.surface`): el tramo del círculo bajo el terreno define la masa. */
function fixedOutcome(ctx: Context, circle: Circle): Outcome {
  const [xmin, xmax] = modelXRange(ctx.model);
  const lo = Math.max(xmin, circle.xc - circle.r);
  const hi = Math.min(xmax, circle.xc + circle.r);
  if (!(hi > lo)) {
    throw new SliceFailure('NoIntersection: el círculo no corta el terreno del modelo');
  }
  const N = 4000;
  const grid = linspace(lo, hi, N + 1);
  const g = (x: number): number => {
    const top = yTop(ctx.model, x);
    const d = circle.r * circle.r - (x - circle.xc) ** 2;
    if (top === null || d < 0) return -Infinity;
    return top - (circle.yc - Math.sqrt(d));
  };
  const below = grid.map((x) => g(x) > 0);

  let best: [number, number] | null = null;
  for (let k = 0; k <= N; ) {
    if (!below[k]) {
      k++;
      continue;
    }
    let j = k;
    while (j + 1 <= N && below[j + 1]) j++;
    if (!best || j - k > best[1] - best[0]) best = [k, j];
    k = j + 1;
  }
  if (!best) throw new SliceFailure('NoIntersection: el arco no queda bajo el terreno');
  const [i0, i1] = best;
  if (i0 === 0 || i1 === N) throw new SliceFailure('OutsideModel: el arco sale del modelo');

  const xa = bisect(g, grid[i0 - 1], grid[i0]);
  const xb = bisect(g, grid[i1], grid[i1 + 1]);
  // Pie = salida (cuesta abajo). Con la masa hacia +x, el pie está a la derecha.
  const toe = ctx.sign > 0 ? xb : xa;
  const crown = ctx.sign > 0 ? xa : xb;
  const slices = buildSlices(ctx, circle, linspace(toe, crown, MOCK_SLICE_COUNT + 1));
  const fos = fellenius(slices);
  return {
    circle,
    slices,
    fos,
    status: fos === null ? 'invalid' : 'converged',
    search: null,
    notes: fos === null ? ['no_driving'] : [],
  };
}

interface Best {
  circle: Circle;
  slices: Slice[];
  fos: number;
}

/**
 * Búsqueda `circular_entry_exit` en rejilla: entrada × salida × radio, arco único por cuerda.
 * Sin refinamiento de patrones (aviso en los resultados).
 */
function searchOutcome(ctx: Context, spec: SearchSpec): { best: Best | null; stats: SearchStats } {
  const { model } = ctx;
  const [xmin, xmax] = modelXRange(model);
  const width = xmax - xmin;
  const entryRange = spec.entry ?? [xmin, xmax];
  const exitRange = spec.exit ?? [xmin, xmax];
  const nEntry = spec.n_entry ?? 20;
  const nExit = spec.n_exit ?? 20;
  const nRadius = spec.n_radius ?? 20;
  const maxFactor = spec.max_radius_factor ?? 5;
  const minWidth = spec.min_width ?? 0.01 * width;

  const stats: SearchStats = { evaluated: 0, valid: 0 };
  let best: Best | null = null;

  for (const xe of linspace(entryRange[0], entryRange[1], nEntry)) {
    const ye = yTop(model, xe);
    if (ye === null) continue;
    for (const xs of linspace(exitRange[0], exitRange[1], nExit)) {
      const ys = yTop(model, xs);
      if (ys === null) continue;
      // La entrada debe estar cuesta arriba de la salida.
      const upslope = ctx.sign > 0 ? xe < xs : xe > xs;
      if (!upslope || Math.abs(xe - xs) < minWidth) continue;

      const chord = Math.hypot(xe - xs, ye - ys);
      const mx = (xe + xs) / 2;
      const my = (ye + ys) / 2;
      // Normal a la cuerda con componente y positiva: el centro queda por encima.
      let nx = -(ye - ys) / chord;
      let ny = (xe - xs) / chord;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const rMin = (chord / 2) * 1.0001;
      const rMax = maxFactor * chord;

      for (let k = 0; k < nRadius; k++) {
        const r = nRadius <= 1 ? rMin : rMin * (rMax / rMin) ** (k / (nRadius - 1));
        stats.evaluated++;
        const h = Math.sqrt(r * r - (chord / 2) ** 2);
        const circle: Circle = { xc: mx + h * nx, yc: my + h * ny, r };

        // Ambos extremos deben caer sobre el arco inferior (y = yc − √(r² − (x − xc)²)).
        const arcAt = (x: number): number => circle.yc - Math.sqrt(circle.r * circle.r - (x - circle.xc) ** 2);
        if (Math.abs(arcAt(xs) - ys) > 1e-6 * chord || Math.abs(arcAt(xe) - ye) > 1e-6 * chord) continue;

        let slices: Slice[];
        try {
          slices = buildSlices(ctx, circle, linspace(xs, xe, MOCK_SLICE_COUNT + 1));
        } catch (error) {
          if (error instanceof SliceFailure) continue;
          throw error;
        }
        const fos = fellenius(slices);
        if (fos === null) continue;
        stats.valid++;
        if (best === null || fos < best.fos) best = { circle, slices, fos };
      }
    }
  }
  return { best, stats };
}

/** Ejecuta el análisis simulado y devuelve el AnalysisReport. */
export function analyzeMock(modelJson: string): AnalysisReport {
  const model = parseModel(modelJson);
  validateModel(model);
  const ctx = makeContext(model);
  const analysis = model.analysis;

  let outcome: Outcome;
  if (analysis.search) {
    const { best, stats } = searchOutcome(ctx, analysis.search);
    if (!best) {
      throw new EngineError('NoValidSurface: la búsqueda no encontró ninguna superficie válida');
    }
    outcome = {
      circle: best.circle,
      slices: best.slices,
      fos: best.fos,
      status: 'converged',
      search: stats,
      notes: ['mock_search'],
    };
  } else {
    const surface = analysis.surface as NonNullable<typeof analysis.surface>;
    // validateModel ya rechazó la polilínea (campo de la versión 0.3).
    if (surface.type === 'polyline') throw new EngineError('InvalidModel: el motor simulado no admite polilíneas');
    const circle: Circle = { xc: surface.xc, yc: surface.yc, r: surface.r };
    try {
      outcome = fixedOutcome(ctx, circle);
    } catch (error) {
      if (!(error instanceof SliceFailure)) throw error;
      outcome = { circle, slices: [], fos: null, status: 'invalid', search: null, notes: [error.message] };
    }
  }

  const methods = analysis.methods ?? ['bishop'];
  const results: MethodReport[] = methods.map((method) => ({
    method,
    fos: outcome.fos,
    status: outcome.status,
    iterations: 1,
    lambda: null,
    surface: outcome.circle,
    slices: outcome.slices,
    search: outcome.search,
    warnings: [MOCK_WARNING, ...outcome.notes, ...ctx.warnings],
  }));
  return { engine: 'mock', results };
}

export function createMockEngine(): Engine {
  return {
    name: 'mock',
    version: () => Promise.resolve(MOCK_VERSION),
    analyze: (modelJson: string) => Promise.resolve().then(() => JSON.stringify(analyzeMock(modelJson))),
  };
}
