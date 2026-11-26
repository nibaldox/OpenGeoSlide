// Escena de dibujo: regiones, piezométrica, superficie crítica y dovelas, en metros (mundo).

import { reportCircle } from '../engine/surface';
import type { Circle, MethodReport, Model, Point, Slice } from '../engine/types';
import type { Bounds } from '../geometry/viewport';
import { piezoExtension, type PiezoExtension } from '../editor/canvas/piezoExtension';

/** Número de tonos de material del tema (`--canvas-mat-0` … `--canvas-mat-6`); los materiales siguientes los reciclan. */
export const MATERIAL_SLOTS = 7;

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
}

export interface Scene {
  regions: SceneRegion[];
  materials: SceneMaterial[];
  piezo: Point[] | null;
  /** Tramos horizontales que el motor extrapola a cada lado de la piezométrica hasta los bordes del modelo (R9-05d); `null` si no hay o ya cubre el ancho. */
  piezoExtension?: PiezoExtension | null;
  /** `converged: false` = última superficie evaluada de un método que no convergió: se dibuja discontinua (R9-12b). Ausente = convergió. */
  surface: { circle: Circle; slices: Slice[]; converged?: boolean } | null;
  bounds: Bounds;
  /** Unidades del modelo (`SI` o `imperial`); los ejes de `drawSection` las usan para rotular m o ft. */
  units?: string;
}

export function buildScene(model: Model, method: MethodReport | null): Scene {
  const regions = model.regions.map((region) => ({
    polygon: region.polygon,
    materialIndex: Math.max(0, model.materials.findIndex((m) => m.id === region.material)),
  }));
  const materials = model.materials.map((m, i) => ({ id: m.id, name: m.name, color: materialColor(i) }));
  const piezo = model.water?.piezometric_line?.length ? [...model.water.piezometric_line].sort((a, b) => a[0] - b[0]) : null;
  // La superficie polilínea (`{points}`) no se dibuja todavía: llega con F3-W1f.
  const circle = method ? reportCircle(method.surface) : null;
  const surface =
    method && circle && method.slices.length > 0 ? { circle, slices: method.slices, converged: method.status === 'converged' } : null;

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
  for (const s of surface?.slices ?? []) {
    xs.push(s.x_left, s.x_right);
    ys.push(s.y_base_left, s.y_base_right, s.y_top_mid);
  }

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
  return {
    regions,
    materials,
    piezo,
    piezoExtension: piezoExt,
    surface,
    bounds: { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY },
    units: model.units,
  };
}
