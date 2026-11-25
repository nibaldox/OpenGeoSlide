// Planes de importación (DXF y CSV): de lo leído del archivo y del mapeo elegido por el usuario a las regiones y
// materiales nuevos que se aplican al documento. Lógica pura (sin React ni DOM).

import type { Material, Point, Region } from '../../engine/types';
import type { DxfEntity, DxfParseResult } from '../../io/dxf';
import type { ModelDoc } from '../types';

export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in';
export const LENGTH_UNITS: readonly LengthUnit[] = ['m', 'cm', 'mm', 'ft', 'in'];

/** Valor del mapeo que crea un material nuevo con el nombre de la capa. */
export const NEW_MATERIAL = '__new__';
/** Valor del mapeo que omite la capa. */
export const SKIP_LAYER = '';

const METERS_PER_UNIT: Record<LengthUnit, number> = { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 };

/** Unidad de longitud del modelo: `ft` si es imperial, `m` en cualquier otro caso. */
export function modelLengthUnit(units: string | undefined): 'm' | 'ft' {
  return units === 'imperial' ? 'ft' : 'm';
}

/** Factor que lleva una longitud de `from` a la unidad del modelo. */
export function unitFactor(from: LengthUnit, modelUnits: string | undefined): number {
  const target = METERS_PER_UNIT[modelLengthUnit(modelUnits)];
  return METERS_PER_UNIT[from] / target;
}

/** Unidad propuesta: la del encabezado del DXF si existe; si no, la del modelo. */
export function defaultUnit(fromHeader: LengthUnit | null, modelUnits: string | undefined): LengthUnit {
  return fromHeader ?? modelLengthUnit(modelUnits);
}

/** `true` si la polilínea es abierta y no tiene los extremos coincidentes (no es región). */
export function isOpenPolyline(e: DxfEntity): boolean {
  if (e.type === 'LINE' || e.closed || e.points.length < 2) return false;
  const a = e.points[0] as Point;
  const b = e.points[e.points.length - 1] as Point;
  return !(e.points.length >= 4 && a[0] === b[0] && a[1] === b[1]);
}

export function openPolylines(result: Pick<DxfParseResult, 'entities'>): DxfEntity[] {
  return result.entities.filter(isOpenPolyline);
}

/** Capas con geometría importable (regiones y polilíneas abiertas), con su material sugerido, en orden de aparición. */
export function importableLayers(
  result: Pick<DxfParseResult, 'regions' | 'entities' | 'layers'>,
): { name: string; suggestedMaterialId: string | null; regions: number; open: number }[] {
  const order: string[] = [];
  const stats = new Map<string, { regions: number; open: number }>();
  const touch = (name: string): { regions: number; open: number } => {
    let s = stats.get(name);
    if (!s) {
      s = { regions: 0, open: 0 };
      stats.set(name, s);
      order.push(name);
    }
    return s;
  };
  for (const r of result.regions) touch(r.layer).regions += 1;
  for (const e of openPolylines(result)) touch(e.layer).open += 1;
  return order.map((name) => ({
    name,
    suggestedMaterialId: result.layers.find((l) => l.name === name)?.suggestedMaterialId ?? null,
    ...(stats.get(name) as { regions: number; open: number }),
  }));
}

/** Mapeo inicial: el material sugerido, o crear uno nuevo si no hay coincidencia. */
export function defaultMapping(layers: { name: string; suggestedMaterialId: string | null }[]): Record<string, string> {
  // `fromEntries` define propiedades propias: una capa llamada «__proto__» no se pierde en el prototipo.
  return Object.fromEntries(layers.map((l) => [l.name, l.suggestedMaterialId ?? NEW_MATERIAL]));
}

function slug(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s === '' ? 'material' : s;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}_${n}`;
  used.add(id);
  return id;
}

/** Material con valores típicos de un suelo, para una capa sin coincidencia (el usuario los ajusta en el panel). */
export function materialForLayer(layer: string, id: string, units: string | undefined): Material {
  const imperial = units === 'imperial';
  return {
    id,
    name: layer,
    model: 'mohr_coulomb',
    unit_weight: imperial ? 115 : 18,
    unit_weight_sat: null,
    cohesion: imperial ? 100 : 5,
    friction_angle: 30,
    ru: null,
  };
}

export interface RegionImportInput {
  /** Regiones leídas (cerradas) y polilíneas abiertas, ya en las unidades del archivo. */
  regions: { layer: string; polygon: Point[] }[];
  open: { layer: string; points: Point[] }[];
  mapping: Record<string, string>;
  /** Factor a las unidades del modelo (ver `unitFactor`). */
  factor: number;
  /** Cierre de las polilíneas abiertas: base `y = baseY` (en unidades del modelo) o descartarlas. */
  openMode: 'close' | 'discard';
  baseY: number | null;
}

export interface RegionImportPlan {
  regions: Region[];
  newMaterials: Material[];
  /** Capas omitidas por el usuario y polilíneas abiertas descartadas. */
  skipped: number;
  notes: string[];
}

function scale(points: readonly Point[], factor: number): Point[] {
  return points.map(([x, y]) => [x * factor, y * factor]);
}

/** Polígono que cierra una polilínea abierta con una base horizontal `y = baseY`. `null` si no es posible. */
export function closeWithBase(points: readonly Point[], baseY: number): Point[] | null {
  if (points.length < 2) return null;
  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;
  const polygon: Point[] = points.map((p): Point => [p[0], p[1]]);
  for (const c of [[last[0], baseY], [first[0], baseY]] as Point[]) {
    const end = polygon[polygon.length - 1] as Point;
    if (end[0] !== c[0] || end[1] !== c[1]) polygon.push(c);
  }
  const end = polygon[polygon.length - 1] as Point;
  if (polygon.length > 3 && end[0] === first[0] && end[1] === first[1]) polygon.pop();
  return polygon.length >= 3 ? polygon : null;
}

/** Aplica unidades, mapeo de capas y cierre de polilíneas abiertas. No modifica el documento. */
export function planRegionImport(doc: Pick<ModelDoc, 'materials' | 'units'>, input: RegionImportInput): RegionImportPlan {
  const used = new Set(doc.materials.map((m) => m.id));
  const created = new Map<string, Material>(); // capa → material nuevo
  const notes: string[] = [];
  let skipped = 0;

  const materialFor = (layer: string): string | null => {
    // `Object.hasOwn`: una capa llamada «constructor» o «toString» no debe heredar nada de Object.prototype.
    const choice = Object.hasOwn(input.mapping, layer) ? (input.mapping[layer] ?? SKIP_LAYER) : SKIP_LAYER;
    if (choice === SKIP_LAYER) return null;
    if (choice !== NEW_MATERIAL) return choice;
    let m = created.get(layer);
    if (!m) {
      m = materialForLayer(layer, uniqueId(slug(layer), used), doc.units);
      created.set(layer, m);
    }
    return m.id;
  };

  const regions: Region[] = [];
  for (const r of input.regions) {
    const material = materialFor(r.layer);
    if (material === null) {
      skipped += 1;
      continue;
    }
    regions.push({ material, polygon: scale(r.polygon, input.factor) });
  }

  for (const o of input.open) {
    if (input.openMode === 'discard') {
      skipped += 1;
      continue;
    }
    const material = materialFor(o.layer);
    if (material === null) {
      skipped += 1;
      continue;
    }
    if (input.baseY === null || !Number.isFinite(input.baseY)) {
      notes.push('Falta el valor de la base y para cerrar las polilíneas abiertas.');
      skipped += 1;
      continue;
    }
    const polygon = closeWithBase(scale(o.points, input.factor), input.baseY);
    if (polygon === null) {
      skipped += 1;
      continue;
    }
    regions.push({ material, polygon });
  }
  return { regions, newMaterials: [...created.values()], skipped, notes };
}

/** Documento resultante de aplicar el plan: reemplaza las regiones o las agrega a las existentes. */
export function applyPlanToDoc(doc: ModelDoc, plan: RegionImportPlan, mode: 'replace' | 'add'): ModelDoc {
  return {
    ...doc,
    materials: [...doc.materials, ...plan.newMaterials],
    regions: mode === 'replace' ? plan.regions : [...doc.regions, ...plan.regions],
  };
}

/** Valor sugerido para la base: la y mínima de la geometría importada (en unidades del modelo), redondeada hacia abajo. */
export function suggestBaseY(points: readonly Point[], factor: number): number | null {
  if (points.length === 0) return null;
  const minY = Math.min(...points.map((p) => p[1])) * factor;
  return Math.floor(minY * 10) / 10 - 1;
}
