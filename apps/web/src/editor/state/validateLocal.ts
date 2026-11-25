// Validación local e inmediata del documento (X3 §2.5, nivel 1). Función pura, sin motor.
//
// Códigos `editor.*` de F1.4. La geometría sigue la semántica E12c (briefs/01_CONTRATOS_FASE1.md §F1.3):
// auto-intersección y solape son errores; aristas compartidas, tramos colineales compartidos y uniones en T
// son válidos. Los rangos numéricos son los de briefs/00_CONTRATOS.md §1 y §4.5, más F1.1 (sismo y cargas).
// `path` es un puntero JSON. Los números de región y de arista de los textos son de base 1 (como en la UI).

import type { Material, Model, Point } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { isFiniteNumber } from './docUtils';
import { boundsOf, dedupeConsecutive, findSelfIntersection, polygonsOverlap } from './polygonChecks';

/**
 * Fragmentos de mensaje de cada regla numérica. Se exportan para que los formularios (panels/forms.ts) usen los
 * mismos textos que la validación local.
 */
export const RULE_TEXT = {
  materialId: 'el id del material no puede estar vacío',
  unitWeight: 'el peso unitario debe ser > 0',
  unitWeightSat: 'el peso unitario saturado debe ser > 0',
  cohesion: 'la cohesión debe ser ≥ 0',
  frictionAngle: 'el ángulo de fricción debe estar en [0, 90)',
  ru: 'ru debe estar en [0, 1)',
  waterUnitWeight: 'el peso unitario del agua debe ser > 0',
  piezoMinPoints: 'la piezométrica necesita al menos 2 puntos',
  piezoOrder: 'la piezométrica debe tener x estrictamente creciente',
  methodsEmpty: 'debe haber al menos un método de análisis',
  methodsRepeated: 'hay métodos de análisis repetidos',
  slices: 'las dovelas deben ser un entero en [3, 2000]',
  tolerance: 'la tolerancia debe estar en (0, 0,01]',
  maxIterations: 'las iteraciones máximas deben ser un entero en [1, 100000]',
  minMAlpha: 'min_m_alpha debe estar en (0, 1]',
  surfaceRadius: 'el radio de la superficie debe ser > 0',
  surfaceCenter: 'el centro de la superficie debe ser finito',
  searchCount: 'debe ser un entero en [1, 200]',
  searchProduct: 'el producto n_entry · n_exit · n_radius no puede superar 2 000 000',
  maxRadiusFactor: 'el factor de radio máximo debe ser > 0,51',
  minWidth: 'el ancho mínimo debe ser ≥ 0',
  rangeOrder: 'el rango debe cumplir mínimo ≤ máximo',
  rangeExtent: 'el rango debe estar dentro de la extensión x del modelo',
  kh: 'kh debe estar en [0, 1)',
  kv: 'kv debe estar en (-1, 1)',
  udlOrder: 'x1 debe ser menor que x2',
  loadX: 'la posición debe estar dentro del rango x del modelo',
  loadQ: 'q debe ser ≥ 0',
  loadP: 'p debe ser ≥ 0',
  loadAngle: 'el ángulo debe estar en [-90, 90]',
  loadDuplicateId: 'el id de carga está repetido',
  loadType: 'el tipo de carga debe ser udl o line',
  version02: 'los campos loads y analysis.seismic requieren version "0.2"',
  finite: 'el valor debe ser un número finito',
} as const;

type Code = Issue['code'];

function error(code: Code, text: string, path: string | null): Issue {
  return { source: 'local', severity: 'error', code, text, path };
}

function isNum(v: unknown): v is number {
  return isFiniteNumber(v);
}

function isInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v);
}

/** Escala del modelo para la tolerancia geométrica: mayor lado del rectángulo envolvente de todos los vértices. */
function modelScale(points: readonly Point[]): number {
  if (points.length === 0) return 1;
  const b = boundsOf(points);
  const scale = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  return scale > 0 && Number.isFinite(scale) ? scale : 1;
}

function validateMaterials(doc: ModelDoc, issues: Issue[]): void {
  const seen = new Set<string>();
  doc.materials.forEach((m: Material, i) => {
    const base = `/materials/${i}`;
    const label = `Material '${m.id}'`;
    if (typeof m.id !== 'string' || m.id === '') {
      issues.push(error('editor.out_of_range', `Material ${i + 1}: ${RULE_TEXT.materialId}.`, `${base}/id`));
    } else if (seen.has(m.id)) {
      issues.push(error('editor.duplicate_material', `${label}: el id está repetido.`, `${base}/id`));
    } else {
      seen.add(m.id);
    }
    if (!(isNum(m.unit_weight) && m.unit_weight > 0)) {
      issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.unitWeight}.`, `${base}/unit_weight`));
    }
    if (m.unit_weight_sat !== undefined && m.unit_weight_sat !== null && !(isNum(m.unit_weight_sat) && m.unit_weight_sat > 0)) {
      issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.unitWeightSat}.`, `${base}/unit_weight_sat`));
    }
    if (!(isNum(m.cohesion) && m.cohesion >= 0)) {
      issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.cohesion}.`, `${base}/cohesion`));
    }
    if (!(isNum(m.friction_angle) && m.friction_angle >= 0 && m.friction_angle < 90)) {
      issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.frictionAngle}.`, `${base}/friction_angle`));
    }
    if (m.ru !== undefined && m.ru !== null && !(isNum(m.ru) && m.ru >= 0 && m.ru < 1)) {
      issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.ru}.`, `${base}/ru`));
    }
  });
}

interface CleanRegion {
  index: number;
  polygon: Point[];
}

function validateRegions(doc: ModelDoc, tol: number, issues: Issue[]): void {
  const materialIds = new Set(doc.materials.map((m) => m.id));
  const clean: CleanRegion[] = [];
  if (doc.regions.length === 0) {
    issues.push(error('editor.out_of_range', 'El modelo no tiene regiones.', '/regions'));
  }
  doc.regions.forEach((region, k) => {
    const base = `/regions/${k}`;
    const label = `Región ${k + 1}`;
    if (!materialIds.has(region.material)) {
      issues.push(error('editor.missing_material', `${label}: usa el material '${region.material}', que no existe.`, `${base}/material`));
    }
    const polygon = region.polygon;
    if (polygon.length < 3) {
      issues.push(error('editor.too_few_vertices', `${label}: tiene menos de 3 vértices (${polygon.length}).`, `${base}/polygon`));
      return;
    }
    let finite = true;
    polygon.forEach((p, i) => {
      if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
        finite = false;
        issues.push(error('editor.out_of_range', `${label}, vértice ${i + 1}: las coordenadas deben ser números finitos.`, `${base}/polygon/${i}`));
      }
    });
    if (!finite) return;
    const { points, indices } = dedupeConsecutive(polygon, tol);
    let duplicated = false;
    // Un vértice repetido es el que desaparece al deduplicar: se informa el segundo de cada par consecutivo.
    const kept = new Set(indices);
    polygon.forEach((_, i) => {
      if (!kept.has(i)) {
        duplicated = true;
        issues.push(error('editor.duplicate_vertex', `${label}, vértice ${i + 1}: repite al vértice anterior.`, `${base}/polygon/${i}`));
      }
    });
    if (points.length < 3) {
      if (duplicated) {
        issues.push(error('editor.too_few_vertices', `${label}: tiene menos de 3 vértices distintos.`, `${base}/polygon`));
      }
      return;
    }
    const si = findSelfIntersection(points, tol);
    if (si) {
      const vi = indices[si.edgeA] ?? 0;
      const detail = si.kind === 'spike' ? 'dos aristas consecutivas se superponen' : 'dos aristas se tocan o se cruzan';
      issues.push(
        error(
          'editor.self_intersection',
          `${label}: se auto-intersecta (aristas ${si.edgeA + 1} y ${si.edgeB + 1}; ${detail}).`,
          `${base}/polygon/${vi}`,
        ),
      );
      return;
    }
    clean.push({ index: k, polygon: points });
  });
  for (let a = 0; a < clean.length; a += 1) {
    for (let b = a + 1; b < clean.length; b += 1) {
      const ra = clean[a] as CleanRegion;
      const rb = clean[b] as CleanRegion;
      if (polygonsOverlap(ra.polygon, rb.polygon, tol)) {
        issues.push(error('editor.region_overlap', `Las regiones ${ra.index + 1} y ${rb.index + 1} se solapan.`, `/regions/${rb.index}`));
      }
    }
  }
}

function validateWater(doc: ModelDoc, issues: Issue[]): void {
  const water = doc.water;
  if (!water) return;
  if (water.unit_weight !== undefined && !(isNum(water.unit_weight) && water.unit_weight > 0)) {
    issues.push(error('editor.out_of_range', `Agua: ${RULE_TEXT.waterUnitWeight}.`, '/water/unit_weight'));
  }
  const line = water.piezometric_line;
  if (line === undefined || line === null) return;
  const base = '/water/piezometric_line';
  if (line.length < 2) {
    issues.push(error('editor.out_of_range', `Piezométrica: ${RULE_TEXT.piezoMinPoints}.`, base));
  }
  let finite = true;
  line.forEach((p, i) => {
    if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
      finite = false;
      issues.push(error('editor.out_of_range', `Piezométrica, punto ${i + 1}: las coordenadas deben ser números finitos.`, `${base}/${i}`));
    }
  });
  if (!finite) return;
  for (let i = 1; i < line.length; i += 1) {
    const prev = line[i - 1] as Point;
    const cur = line[i] as Point;
    if (!(cur[0] > prev[0])) {
      issues.push(error('editor.piezo_order', `Piezométrica, punto ${i + 1}: ${RULE_TEXT.piezoOrder}.`, `${base}/${i}`));
    }
  }
}

function validateRange(
  value: unknown,
  name: 'entry' | 'exit',
  extent: { min: number; max: number } | null,
  tol: number,
  issues: Issue[],
): void {
  if (value === undefined || value === null) return;
  const path = `/analysis/search/${name}`;
  const label = `Búsqueda, rango de ${name === 'entry' ? 'entrada' : 'salida'}`;
  if (!(Array.isArray(value) && value.length === 2 && isNum(value[0]) && isNum(value[1]))) {
    issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.finite}.`, path));
    return;
  }
  const lo = value[0] as number;
  const hi = value[1] as number;
  if (lo > hi) {
    issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.rangeOrder}.`, path));
  } else if (extent && (lo < extent.min - tol || hi > extent.max + tol)) {
    issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.rangeExtent}.`, path));
  }
}

function validateAnalysis(doc: ModelDoc, extent: { min: number; max: number } | null, tol: number, issues: Issue[]): void {
  const a = doc.analysis;
  if (a.methods !== undefined) {
    if (a.methods.length === 0) {
      issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.methodsEmpty}.`, '/analysis/methods'));
    } else if (new Set(a.methods).size !== a.methods.length) {
      issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.methodsRepeated}.`, '/analysis/methods'));
    }
  }
  if (a.slices !== undefined && !(isInt(a.slices) && a.slices >= 3 && a.slices <= 2000)) {
    issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.slices}.`, '/analysis/slices'));
  }
  if (a.tolerance !== undefined && !(isNum(a.tolerance) && a.tolerance > 0 && a.tolerance <= 0.01)) {
    issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.tolerance}.`, '/analysis/tolerance'));
  }
  if (a.max_iterations !== undefined && !(isInt(a.max_iterations) && a.max_iterations >= 1 && a.max_iterations <= 100000)) {
    issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.maxIterations}.`, '/analysis/max_iterations'));
  }
  if (a.min_m_alpha !== undefined && !(isNum(a.min_m_alpha) && a.min_m_alpha > 0 && a.min_m_alpha <= 1)) {
    issues.push(error('editor.out_of_range', `Análisis: ${RULE_TEXT.minMAlpha}.`, '/analysis/min_m_alpha'));
  }
  const s = a.surface;
  if (s !== undefined && s !== null) {
    if (!(isNum(s.xc) && isNum(s.yc))) {
      issues.push(error('editor.out_of_range', `Superficie fija: ${RULE_TEXT.surfaceCenter}.`, '/analysis/surface'));
    }
    if (!(isNum(s.r) && s.r > 0)) {
      issues.push(error('editor.out_of_range', `Superficie fija: ${RULE_TEXT.surfaceRadius}.`, '/analysis/surface/r'));
    }
  }
  const q = a.search;
  if (q !== undefined && q !== null) {
    const counts: [string, number | undefined][] = [
      ['n_entry', q.n_entry],
      ['n_exit', q.n_exit],
      ['n_radius', q.n_radius],
    ];
    for (const [name, value] of counts) {
      if (value !== undefined && !(isInt(value) && value >= 1 && value <= 200)) {
        issues.push(error('editor.out_of_range', `Búsqueda, ${name}: ${RULE_TEXT.searchCount}.`, `/analysis/search/${name}`));
      }
    }
    const product = (q.n_entry ?? 20) * (q.n_exit ?? 20) * (q.n_radius ?? 20);
    if (counts.every(([, v]) => v === undefined || isInt(v)) && product > 2e6) {
      issues.push(error('editor.out_of_range', `Búsqueda: ${RULE_TEXT.searchProduct}.`, '/analysis/search'));
    }
    if (q.max_radius_factor !== undefined && !(isNum(q.max_radius_factor) && q.max_radius_factor > 0.51)) {
      issues.push(error('editor.out_of_range', `Búsqueda: ${RULE_TEXT.maxRadiusFactor}.`, '/analysis/search/max_radius_factor'));
    }
    if (q.min_width !== undefined && q.min_width !== null && !(isNum(q.min_width) && q.min_width >= 0)) {
      issues.push(error('editor.out_of_range', `Búsqueda: ${RULE_TEXT.minWidth}.`, '/analysis/search/min_width'));
    }
    validateRange(q.entry, 'entry', extent, tol, issues);
    validateRange(q.exit, 'exit', extent, tol, issues);
  }
  const seismic = a.seismic;
  if (seismic !== undefined && seismic !== null) {
    const kh = seismic.kh ?? 0;
    const kv = seismic.kv ?? 0;
    if (!(isNum(kh) && kh >= 0 && kh < 1)) {
      issues.push(error('editor.out_of_range', `Sismo: ${RULE_TEXT.kh}.`, '/analysis/seismic/kh'));
    }
    if (!(isNum(kv) && kv > -1 && kv < 1)) {
      issues.push(error('editor.out_of_range', `Sismo: ${RULE_TEXT.kv}.`, '/analysis/seismic/kv'));
    }
  }
}

function validateLoads(doc: ModelDoc, extent: { min: number; max: number } | null, tol: number, issues: Issue[]): void {
  const loads = doc.loads ?? [];
  const ids = new Set<string>();
  const inExtent = (x: number): boolean => extent === null || (x >= extent.min - tol && x <= extent.max + tol);
  loads.forEach((load, i) => {
    const base = `/loads/${i}`;
    const label = `Carga ${i + 1}`;
    if (load.id !== undefined && load.id !== null) {
      if (ids.has(load.id)) {
        issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.loadDuplicateId}.`, `${base}/id`));
      }
      ids.add(load.id);
    }
    if (load.type === 'udl') {
      if (!(isNum(load.x1) && isNum(load.x2))) {
        issues.push(error('editor.load_range', `${label}: x1 y x2 deben ser números finitos.`, base));
      } else {
        if (!(load.x1 < load.x2)) issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.udlOrder}.`, `${base}/x1`));
        if (!inExtent(load.x1)) issues.push(error('editor.load_range', `${label}: x1 ${RULE_TEXT.loadX}.`, `${base}/x1`));
        if (!inExtent(load.x2)) issues.push(error('editor.load_range', `${label}: x2 ${RULE_TEXT.loadX}.`, `${base}/x2`));
      }
      if (!(isNum(load.q) && load.q >= 0)) issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.loadQ}.`, `${base}/q`));
    } else if (load.type === 'line') {
      if (!(isNum(load.x) && inExtent(load.x))) {
        issues.push(error('editor.load_range', `${label}: x ${RULE_TEXT.loadX}.`, `${base}/x`));
      }
      if (!(isNum(load.p) && load.p >= 0)) issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.loadP}.`, `${base}/p`));
      if (!(isNum(load.angle) && load.angle >= -90 && load.angle <= 90)) {
        issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.loadAngle}.`, `${base}/angle`));
      }
    } else {
      issues.push(error('editor.load_range', `${label}: ${RULE_TEXT.loadType}.`, `${base}/type`));
    }
  });
}

/** Valida el documento sin llamar al motor. Devuelve las incidencias ordenadas por sección del documento. */
export function validateLocal(doc: ModelDoc): Issue[] {
  const issues: Issue[] = [];
  const allPoints: Point[] = [];
  for (const r of doc.regions) {
    for (const p of r.polygon) {
      if (Array.isArray(p) && isNum(p[0]) && isNum(p[1])) allPoints.push(p);
    }
  }
  const scale = modelScale(allPoints);
  const tol = 1e-9 * scale;
  let extent: { min: number; max: number } | null = null;
  if (allPoints.length > 0) {
    const b = boundsOf(allPoints);
    extent = { min: b.minX, max: b.maxX };
  }
  const hasV02Fields =
    (doc.loads !== undefined && doc.loads.length > 0) || (doc.analysis.seismic !== undefined && doc.analysis.seismic !== null);
  if (doc.version === '0.1' && hasV02Fields) {
    issues.push(error('editor.out_of_range', `Modelo: ${RULE_TEXT.version02}.`, '/version'));
  }
  validateMaterials(doc, issues);
  validateRegions(doc, tol, issues);
  validateWater(doc, issues);
  validateLoads(doc, extent, tol, issues);
  validateAnalysis(doc, extent, tol, issues);
  return issues;
}

const cache = new WeakMap<Model, Issue[]>();

/** `validateLocal` memorizado por referencia del documento (los documentos del editor son inmutables). */
export function validateLocalCached(doc: ModelDoc): Issue[] {
  let issues = cache.get(doc);
  if (!issues) {
    issues = validateLocal(doc);
    cache.set(doc, issues);
  }
  return issues;
}
