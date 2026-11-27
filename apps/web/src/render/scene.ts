// Escena de dibujo: regiones, piezométrica, superficie crítica y dovelas, en metros (mundo).

import { reportCircle } from '../engine/surface';
import { analyzedPolyline } from '../report/methodInfo';
import type { Circle, CrackReport, MaterialModel, MethodReport, Model, Point, Reinforcement, ReinforcementForce, Slice } from '../engine/types';
import type { Bounds } from '../geometry/viewport';
import { piezoExtension, type PiezoExtension } from '../editor/canvas/piezoExtension';
import { crackGeometry, type CrackGeometry } from './crack';
import { pondPolygons } from './pond';

/** Número de tonos de material del tema (`--canvas-mat-0` … `--canvas-mat-6`); los materiales siguientes los reciclan. */
export const MATERIAL_SLOTS = 7;

/** Rótulo legible de cada ley constitutiva para la leyenda de materiales (F6.2, F6.3, F6.13). */
export const MATERIAL_MODEL_LABEL: Readonly<Record<MaterialModel, string>> = {
  mohr_coulomb: 'Mohr-Coulomb',
  undrained: 'No drenado (Su)',
  hoek_brown: 'Hoek-Brown',
  shansep: 'SHANSEP',
};

/** Rótulo del modelo de un material (`Mohr-Coulomb` si se omite). */
export function materialModelLabel(model: MaterialModel | undefined | null): string {
  return MATERIAL_MODEL_LABEL[model ?? 'mohr_coulomb'] ?? 'Mohr-Coulomb';
}

/** Casilla de color (0 a 6) del material de índice `index`. */
export function materialSlot(index: number): number {
  return ((index % MATERIAL_SLOTS) + MATERIAL_SLOTS) % MATERIAL_SLOTS;
}

/** Color del material para SVG y CSS: referencia al token, que cambia solo con el tema. El Canvas 2D usa `SectionPalette`. */
export function materialColor(index: number): string {
  return `var(--canvas-mat-${materialSlot(index)})`;
}

export interface SceneRegion {
  polygon: Point[];
  materialIndex: number;
}

export interface SceneMaterial {
  id: string;
  name: string;
  color: string;
  model: MaterialModel;
  modelLabel: string;
}

export interface Scene {
  regions: SceneRegion[];
  materials: SceneMaterial[];
  piezo: Point[] | null;
  /** Tramos horizontales que el motor extrapola a cada lado de la piezométrica hasta los bordes del modelo (R9-05d); `null` si no hay o ya cubre el ancho. */
  piezoExtension?: PiezoExtension | null;
  /** Agua embalsada (F5.3): polígonos entre la piezométrica y el terreno donde la piezométrica pasa sobre el terreno; ausente si no hay. Capa propia bajo la piezométrica. */
  pond?: Point[][];
  /** Grieta de tracción de la superficie dibujada (F5.4): `x_c`, profundidad y `Pw`; ausente sin grieta. */
  crack?: CrackGeometry;
  /** E15m-12: el resultado trae la grieta con `depth = 0` (el motor no cortó nada, E15l-15): Casos dibuja «Sin grieta (z = 0)», como el editor. Excluyente con `crack`. */
  noCrack?: CrackReport;
  /**
   * Superficie del informe: `circle` (círculo `{xc, yc, r}`) o `polyline` (la polilínea ajustada al terreno o crítica no circular, F3.7/F6.10); nunca las dos.
   * `converged: false` = última superficie evaluada de un método que no convergió: se dibuja discontinua (R9-12b).
   * `search: true` = proviene de `analysis.search` (incluida la búsqueda no circular).
   */
  surface: { circle?: Circle | null; polyline?: Point[] | null; slices: Slice[]; converged?: boolean; search?: boolean } | null;
  /** Refuerzos del modelo (v0.4); ausente sin refuerzos. */
  reinforcements?: Reinforcement[];
  /** `reinforcement_forces` del método dibujado (F4.9); ausente si no hay. */
  reinforcementForces?: ReinforcementForce[];
  bounds: Bounds;
  /** Unidades del modelo (`SI` o `imperial`); los ejes de `drawSection` las usan para rotular m o ft. */
  units?: string;
}

export function buildScene(model: Model, method: MethodReport | null): Scene {
  const regions = model.regions.map((region) => ({
    polygon: region.polygon,
    materialIndex: Math.max(0, model.materials.findIndex((m) => m.id === region.material)),
  }));
  const hasF3bMaterials = model.materials.some((m) => m.model === 'hoek_brown' || m.model === 'shansep');
  const materials: SceneMaterial[] = model.materials.map((m, i) => {
    const matModel: MaterialModel = m.model ?? 'mohr_coulomb';
    const modelLabel = materialModelLabel(matModel);
    const base = m.name || m.id;
    return {
      id: m.id,
      // Identidad v0.5: el rótulo del modelo solo se agrega cuando el documento usa Hoek-Brown o SHANSEP.
      name: hasF3bMaterials ? `${base} · ${modelLabel}` : m.name,
      color: materialColor(i),
      model: matModel,
      modelLabel,
    };
  });
  const piezo = model.water?.piezometric_line?.length ? [...model.water.piezometric_line].sort((a, b) => a[0] - b[0]) : null;
  // Círculo `{xc, yc, r}` o polilínea ajustada/crítica `{points}` del informe (F3.7, F6.10).
  const circle = method ? reportCircle(method.surface) : null;
  // R10B-05: la polilínea se limita al rango de las dovelas analizadas, como el trazo de un círculo.
  const polyline = method ? analyzedPolyline(method) : null;
  const surface =
    method && (circle || polyline) && method.slices.length > 0
      ? { circle, polyline, slices: method.slices, converged: method.status === 'converged', search: method.search != null }
      : null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const region of regions) {
    for (const [x, y] of region.polygon) {
      xs.push(x);
      ys.push(y);
    }
  }
  for (const [x, y] of piezo ?? []) {
    xs.push(x);
    ys.push(y);
  }
  // Los extremos de la polilínea ajustada pueden salir del rango de las dovelas (prolongación o recorte al terreno).
  for (const [x, y] of surface?.polyline ?? []) {
    xs.push(x);
    ys.push(y);
  }
  for (const s of surface?.slices ?? []) {
    xs.push(s.x_left, s.x_right);
    ys.push(s.y_base_left, s.y_base_right, s.y_top_mid);
  }

  // Los extremos de los refuerzos entran en el encuadre (la punta de una tablestaca o la cabeza de un anclaje pueden salir de las regiones).
  const reinforcements = (model.reinforcements ?? []).map((r) => ({ ...r }));
  for (const r of reinforcements) {
    xs.push(r.x1, r.x2);
    ys.push(r.y1, r.y2);
  }
  const reinforcementForces = reinforcements.length > 0 && method?.reinforcement_forces ? [...method.reinforcement_forces] : [];

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    minX = 0;
    maxX = 1;
    minY = 0;
    maxY = 1;
  }
  const padX = (maxX - minX) * 0.04 || 1;
  const padY = (maxY - minY) * 0.04 || 1;

  // La misma regla que el editor (`piezoExtension`), sobre la línea ya ordenada por x como la que se dibuja.
  const piezoExt = piezo ? piezoExtension({ ...model, water: { ...model.water, piezometric_line: piezo } }) : null;
  const pond = pondPolygons(regions, piezo);
  // La grieta se dibuja solo con una superficie con dovelas; la fracción llena la da el modelo (`water_fill`).
  const crack = surface && method?.tension_crack ? crackGeometry(method.tension_crack, surface.slices, model.analysis?.tension_crack?.water_fill) : null;
  // E15m-12: sin geometría (profundidad 0) pero con grieta informada, la escena lo recuerda para el rótulo (E15m-15: con su `face_height`, que pasa
  // dentro del informe, el rótulo es el del corte de la masa sin grieta de tracción).
  const noCrack = surface && method?.tension_crack && !crack ? method.tension_crack : null;
  return {
    regions,
    materials,
    piezo,
    piezoExtension: piezoExt,
    ...(pond.length > 0 ? { pond } : {}),
    ...(crack ? { crack } : {}),
    ...(noCrack ? { noCrack } : {}),
    surface,
    ...(reinforcements.length > 0 ? { reinforcements, reinforcementForces } : {}),
    bounds: { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY },
    units: model.units,
  };
}
