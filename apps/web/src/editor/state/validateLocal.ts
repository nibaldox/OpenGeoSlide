// Validación local e inmediata del documento (X3 §2.5, nivel 1). Función pura, sin motor.
//
// Códigos `editor.*` de F1.4. La geometría sigue la semántica E12c (briefs/01_CONTRATOS_FASE1.md §F1.3):
// auto-intersección y solape son errores; aristas compartidas, tramos colineales compartidos y uniones en T
// son válidos. E12j (paridad con el motor): la región degenerada (área ≤ 1e-12·escala²) y el modelo sin `surface`
// ni `search` son errores; un vértice consecutivo repetido es un aviso (el motor lo acepta). Los rangos numéricos son los de briefs/00_CONTRATOS.md §1 y §4.5, más F1.1 (sismo y cargas).
// `path` es un puntero JSON. Los números de región y de arista de los textos son de base 1 (como en la UI).

import type { Material, Model, Point } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { isFiniteNumber } from './docUtils';
import { geotechAdvisories } from './geotech';
import { isImperialUnits } from './units';
import { boundsOf, dedupeConsecutive, findSelfIntersection, isDegenerateRegion, polygonsOverlap } from './polygonChecks';

// Los mensajes se redactan con las etiquetas de la interfaz (paneles y tabla), indican el rango válido con un
// ejemplo cuando ayuda y la acción a tomar. No nombran campos internos del JSON ni del motor: el código estable
// y el puntero JSON viajan aparte en `Issue.code` y `Issue.path`.

/**
 * Mensajes de cada regla numérica, completos y con la etiqueta del campo (también los usa panels/forms.ts, que los
 * muestra tal cual junto al campo). Empiezan con mayúscula y no terminan en punto.
 */
export const RULE_TEXT = {
  materialId: 'Identificador del material: no puede estar vacío; escriba un nombre corto (ej. arcilla)',
  unitWeight: 'Peso unitario γ: use un valor mayor que 0 (ej. 18 kN/m³ o 115 pcf)',
  unitWeightSat: 'Peso unitario saturado γsat: use un valor mayor que 0 (ej. 20 kN/m³ o 125 pcf), o déjelo vacío para usar γ',
  cohesion: 'Cohesión c: use un valor igual o mayor que 0 (ej. 5 kPa o 100 psf)',
  frictionAngle: 'Ángulo de fricción φ: use un valor desde 0° hasta menos de 90° (ej. 30)',
  ru: 'Coeficiente de presión de poros ru: use un valor desde 0 hasta menos de 1 (ej. 0,2), o déjelo vacío',
  waterUnitWeight: 'Peso unitario del agua γw: use un valor mayor que 0 (ej. 9,81 kN/m³ o 62,4 pcf)',
  piezoMinPoints: 'Línea piezométrica: indique al menos 2 puntos, o quítela si no hay nivel freático',
  piezoOrder: 'Línea piezométrica: la coordenada x debe aumentar de un punto al siguiente; ordene los puntos de izquierda a derecha',
  methodsEmpty: 'Métodos de análisis: marque al menos uno (Bishop simplificado o Spencer)',
  methodsRepeated: 'Métodos de análisis: hay un método repetido; marque cada uno una sola vez',
  slices: 'Dovelas: use un número entero entre 3 y 2000 (ej. 50)',
  tolerance: 'Tolerancia: use un valor mayor que 0 y hasta 0,01 (ej. 0,00001)',
  maxIterations: 'Iteraciones máximas: use un número entero entre 1 y 100000 (ej. 500)',
  minMAlpha: 'm_α mínimo: use un valor mayor que 0 y hasta 1 (ej. 0,2)',
  surfaceCenterX: 'Centro xc del círculo de falla: escriba un número (ej. 45,5)',
  surfaceCenterY: 'Centro yc del círculo de falla: escriba un número (ej. 38,75)',
  surfaceCenter: 'Centro (xc, yc) del círculo de falla: escriba dos números (ej. 45,5 y 38,75)',
  surfaceRadius: 'Radio r del círculo de falla: use un valor mayor que 0 (ej. 25)',
  searchProduct:
    'Búsqueda: puntos de entrada × puntos de salida × radios por par no puede superar 2 000 000 de candidatos; reduzca alguno de los tres',
  maxRadiusFactor: 'Factor de radio máximo: use un valor mayor que 0,51 (ej. 5)',
  minWidth: 'Ancho mínimo: use un valor igual o mayor que 0, o déjelo vacío',
  kh: 'Coeficiente sísmico horizontal kh: use un valor entre 0 y 0,99 (ej. 0,15)',
  kv: 'Coeficiente sísmico vertical kv: use un valor entre −0,99 y 0,99 (ej. 0 o 0,05)',
  udlOrder: 'Carga distribuida: el inicio x1 debe ser menor que el fin x2; intercambie los valores',
  loadQ: 'Carga distribuida q: use un valor igual o mayor que 0 (ej. 20 kPa o 400 psf)',
  loadP: 'Carga lineal p: use un valor igual o mayor que 0 (ej. 50 kN/m o 3400 lbf/ft)',
  loadAngle: 'Ángulo de la carga lineal: use un valor entre −90° y 90° desde la vertical (ej. 0 = vertical hacia abajo)',
  loadDuplicateId: 'Identificador de carga: ya lo usa otra carga; use uno distinto',
  loadType: 'Tipo de carga: debe ser distribuida o lineal',
  version02:
    'Formato del archivo: las cargas y el sismo requieren el formato 0.2, pero este modelo declara el 0.1; cambie la versión del archivo a 0.2',
  noSurface:
    'Superficie de falla: no hay ninguna definida; en el panel «Superficie de falla» elija «Búsqueda» (superficie crítica automática) o «Fija» (círculo con centro y radio)',
  waterUnitWeightImperial:
    'Peso unitario del agua γw: el modelo está en unidades imperiales y γw no se indica o es menor que 20 pcf (un valor como 9,81 es de kN/m³), así que el cálculo usaría un peso del agua ' +
    'varias veces menor que el real (62,4 pcf), las presiones de poros saldrían muy bajas y el factor de seguridad quedaría del lado inseguro. Escriba 62,4 pcf en la pestaña «Agua»',
} as const;

// ───────────────────────── Formato de números y textos ─────────────────────────

/** Número con coma decimal (hasta 6 decimales, sin ceros sobrantes) para citar el valor actual en un mensaje. */
function fmt(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'no es un número';
  return String(Number(v.toPrecision(8))).replace('.', ',');
}

function lcFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** «Valor actual: 1,2» para añadir al mensaje de un campo fuera de rango. */
function withValue(text: string, v: unknown): string {
  const shown = v === undefined || v === null ? 'vacío' : fmt(v);
  return `${text}. Valor actual: ${shown}.`;
}

/** `Sujeto, etiqueta en minúscula: regla` (p. ej. «Material «arcilla», peso unitario γ: use…»). */
function under(subject: string, text: string): string {
  return `${subject}, ${lcFirst(text)}`;
}

/** Unidad de longitud según `units` del modelo. */
function lengthUnit(units: string | undefined): string {
  return isImperialUnits(units) ? 'ft' : 'm';
}

/** γw mínimo plausible en un modelo imperial (pcf): el agua pesa ≈ 62,4 pcf; por debajo de esto el valor es de otro sistema (R9-03b). */
export const MIN_IMPERIAL_GAMMA_W = 20;

const COUNT_LABEL = { n_entry: 'Puntos de entrada', n_exit: 'Puntos de salida', n_radius: 'Radios por par' } as const;
const RANGE_LABEL = { entry: 'Entrada (coronamiento)', exit: 'Salida (pie)' } as const;
const LOAD_X_LABEL = {
  x: 'Posición x de la carga lineal',
  x1: 'Inicio x1 de la carga distribuida',
  x2: 'Fin x2 de la carga distribuida',
} as const;

/** Entero con espacios como separador de miles (independiente del ICU del entorno). */
function groups(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** `Puntos de entrada: use un número entero entre 1 y 200 (ej. 20)`. */
export function searchCountText(field: keyof typeof COUNT_LABEL): string {
  return `${COUNT_LABEL[field]}: use un número entero entre 1 y 200 (ej. 20)`;
}

/** Candidatos de la rejilla de búsqueda, con separador de miles. */
export function searchProductText(candidates: number): string {
  return `${RULE_TEXT.searchProduct} (ahora son ${groups(candidates)})`;
}

/** Rango con mínimo mayor que máximo. `current` es el par escrito, si se conoce. */
export function rangeOrderText(which: 'entry' | 'exit', current?: readonly [number, number]): string {
  const shown = current ? ` (mínimo ${fmt(current[0])}, máximo ${fmt(current[1])})` : '';
  return `${RANGE_LABEL[which]}: el mínimo no puede ser mayor que el máximo${shown}; intercambie los valores`;
}

/** Rango fuera del ancho del modelo. `extent` y `unit` dan el límite válido. */
export function rangeExtentText(which: 'entry' | 'exit', extent?: { min: number; max: number } | null, unit?: string): string {
  const limit = extent ? ` (de ${fmt(extent.min)} a ${fmt(extent.max)}${unit ? ` ${unit}` : ''})` : '';
  return `${RANGE_LABEL[which]}: el rango debe quedar dentro del ancho del modelo${limit}; ajuste el mínimo y el máximo`;
}

/** Posición de una carga fuera del ancho del modelo. */
export function loadXText(field: keyof typeof LOAD_X_LABEL, extent?: { min: number; max: number } | null, unit?: string): string {
  const limit = extent ? ` (de ${fmt(extent.min)} a ${fmt(extent.max)}${unit ? ` ${unit}` : ''})` : '';
  return `${LOAD_X_LABEL[field]}: la posición debe estar dentro del ancho del modelo${limit}`;
}

/** Los dos rótulos de rango tal como los muestra el panel de búsqueda. */
export const SEARCH_RANGE_LABEL = RANGE_LABEL;

type Code = Issue['code'];

function error(code: Code, text: string, path: string | null): Issue {
  return { source: 'local', severity: 'error', code, text, path };
}

function warning(code: Code, text: string, path: string | null): Issue {
  return { source: 'local', severity: 'aviso', code, text, path };
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
    const label = `Material «${m.id}»`;
    if (typeof m.id !== 'string' || m.id === '') {
      issues.push(error('editor.out_of_range', `Material ${i + 1}: ${lcFirst(RULE_TEXT.materialId)}.`, `${base}/id`));
    } else if (seen.has(m.id)) {
      issues.push(
        error('editor.duplicate_material', `${label}: el identificador está repetido; cada material necesita uno distinto.`, `${base}/id`),
      );
    } else {
      seen.add(m.id);
    }
    if (!(isNum(m.unit_weight) && m.unit_weight > 0)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.unitWeight), m.unit_weight), `${base}/unit_weight`));
    }
    if (m.unit_weight_sat !== undefined && m.unit_weight_sat !== null && !(isNum(m.unit_weight_sat) && m.unit_weight_sat > 0)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.unitWeightSat), m.unit_weight_sat), `${base}/unit_weight_sat`));
    }
    if (!(isNum(m.cohesion) && m.cohesion >= 0)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.cohesion), m.cohesion), `${base}/cohesion`));
    }
    if (!(isNum(m.friction_angle) && m.friction_angle >= 0 && m.friction_angle < 90)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.frictionAngle), m.friction_angle), `${base}/friction_angle`));
    }
    if (m.ru !== undefined && m.ru !== null && !(isNum(m.ru) && m.ru >= 0 && m.ru < 1)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.ru), m.ru), `${base}/ru`));
    }
  });
}

interface CleanRegion {
  index: number;
  polygon: Point[];
}

function validateRegions(doc: ModelDoc, scale: number, tol: number, issues: Issue[]): void {
  const materialIds = new Set(doc.materials.map((m) => m.id));
  const clean: CleanRegion[] = [];
  if (doc.regions.length === 0) {
    issues.push(error('editor.out_of_range', 'El modelo no tiene regiones: dibuje una con la herramienta «Dibujar región» (tecla R), cree un «Talud simple…» desde Archivo ▸ Nuevo, importe un DXF o abra un ejemplo.', '/regions'));
  }
  doc.regions.forEach((region, k) => {
    const base = `/regions/${k}`;
    const label = `Región ${k + 1}`;
    if (!materialIds.has(region.material)) {
      issues.push(
        error(
          'editor.missing_material',
          `${label}: usa el material «${region.material}», que no existe. Asígnele uno de los materiales definidos o cree ese material en el panel «Materiales».`,
          `${base}/material`,
        ),
      );
    }
    const polygon = region.polygon;
    if (polygon.length < 3) {
      issues.push(
        error(
          'editor.too_few_vertices',
          `${label}: tiene ${polygon.length} ${polygon.length === 1 ? 'vértice' : 'vértices'} y necesita al menos 3. Agregue vértices o elimine la región.`,
          `${base}/polygon`,
        ),
      );
      return;
    }
    let finite = true;
    polygon.forEach((p, i) => {
      if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
        finite = false;
        issues.push(
          error(
            'editor.out_of_range',
            `${label}, vértice ${i + 1}: las coordenadas x e y deben ser números. Corrija el valor (ej. 12,5).`,
            `${base}/polygon/${i}`,
          ),
        );
      }
    });
    if (!finite) return;
    // Igual que el motor, la degeneración se evalúa sobre el polígono tal como está (con sus repetidos).
    if (isDegenerateRegion(polygon, scale)) {
      issues.push(
        error(
          'editor.degenerate_region',
          `${label}: no encierra superficie (los vértices están alineados o casi coinciden). Mueva algún vértice para que el contorno tenga área.`,
          `${base}/polygon`,
        ),
      );
      return;
    }
    const { points, indices } = dedupeConsecutive(polygon, tol);
    let duplicated = false;
    // Un vértice repetido es el que desaparece al deduplicar: se informa el segundo de cada par consecutivo.
    const kept = new Set(indices);
    polygon.forEach((_, i) => {
      if (!kept.has(i)) {
        duplicated = true;
        issues.push(
          warning(
            'editor.duplicate_vertex',
            `${label}, vértice ${i + 1}: repite al vértice anterior. No afecta al cálculo, pero puede eliminarlo.`,
            `${base}/polygon/${i}`,
          ),
        );
      }
    });
    if (points.length < 3) {
      if (duplicated) {
        issues.push(
          error(
            'editor.too_few_vertices',
            `${label}: tiene menos de 3 vértices distintos. Elimine los repetidos o agregue vértices.`,
            `${base}/polygon`,
          ),
        );
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
          `${label}: el contorno se cruza consigo mismo (aristas ${si.edgeA + 1} y ${si.edgeB + 1}; ${detail}). Mueva los vértices para que el contorno no se cruce.`,
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
        issues.push(
          error(
            'editor.region_overlap',
            `Las regiones ${ra.index + 1} y ${rb.index + 1} se solapan. Ajuste sus vértices para que solo compartan bordes.`,
            `/regions/${rb.index}`,
          ),
        );
      }
    }
  }
}

function validateWater(doc: ModelDoc, issues: Issue[]): void {
  const water = doc.water;
  if (!water) return;
  if (water.unit_weight !== undefined && !(isNum(water.unit_weight) && water.unit_weight > 0)) {
    issues.push(error('editor.out_of_range', withValue(RULE_TEXT.waterUnitWeight, water.unit_weight), '/water/unit_weight'));
  }
  const line = water.piezometric_line;
  if (line === undefined || line === null) return;
  const base = '/water/piezometric_line';
  if (line.length < 2) {
    issues.push(error('editor.out_of_range', `${RULE_TEXT.piezoMinPoints}.`, base));
  }
  let finite = true;
  line.forEach((p, i) => {
    if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
      finite = false;
      issues.push(
        error(
          'editor.out_of_range',
          `Línea piezométrica, punto ${i + 1}: las coordenadas x e y deben ser números. Corrija el valor (ej. 12,5).`,
          `${base}/${i}`,
        ),
      );
    }
  });
  if (!finite) return;
  for (let i = 1; i < line.length; i += 1) {
    const prev = line[i - 1] as Point;
    const cur = line[i] as Point;
    if (!(cur[0] > prev[0])) {
      issues.push(
        error(
          'editor.piezo_order',
          `Línea piezométrica, punto ${i + 1}: la coordenada x (${fmt(cur[0])}) debe ser mayor que la del punto anterior (${fmt(prev[0])}); ordene los puntos de izquierda a derecha.`,
          `${base}/${i}`,
        ),
      );
    }
  }
  // El motor no convierte unidades: sin γw explícito usa 9,81 aunque el modelo esté en pcf (R7-22). Con piezométrica es un ERROR que
  // bloquea «Comprobar» (R8): con 9,81 pcf las presiones de poros salen 6,4 veces menores y el FS queda del lado inseguro.
  // R9-03b: no se compara con 9,81 exacto. En pcf el agua pesa ≈ 62,4; cualquier γw menor que 20 pcf (9,8; 9,80665; 10…) es un valor en
  // kN/m³ o un error de captura, y `units` se detecta sin distinguir mayúsculas (`isImperialUnits`).
  const gw = water.unit_weight;
  const gwMissing = gw === undefined || gw === null;
  if (isImperialUnits(doc.units) && line.length >= 2 && (gwMissing || (isNum(gw) && gw > 0 && gw < MIN_IMPERIAL_GAMMA_W))) {
    issues.push(error('editor.water_unit_weight', `${RULE_TEXT.waterUnitWeightImperial}.`, '/water/unit_weight'));
  }
}

function validateRange(
  value: unknown,
  name: 'entry' | 'exit',
  extent: { min: number; max: number } | null,
  tol: number,
  unit: string,
  issues: Issue[],
): void {
  if (value === undefined || value === null) return;
  const path = `/analysis/search/${name}`;
  if (!(Array.isArray(value) && value.length === 2 && isNum(value[0]) && isNum(value[1]))) {
    issues.push(error('editor.out_of_range', `${RANGE_LABEL[name]}: escriba dos números, el mínimo y el máximo.`, path));
    return;
  }
  const lo = value[0] as number;
  const hi = value[1] as number;
  if (lo > hi) {
    issues.push(error('editor.out_of_range', `${rangeOrderText(name, [lo, hi])}.`, path));
  } else if (extent && (lo < extent.min - tol || hi > extent.max + tol)) {
    issues.push(error('editor.out_of_range', `${rangeExtentText(name, extent, unit)}. Valor actual: ${fmt(lo)} a ${fmt(hi)}.`, path));
  }
}

function validateAnalysis(doc: ModelDoc, extent: { min: number; max: number } | null, tol: number, issues: Issue[]): void {
  const a = doc.analysis;
  const unit = lengthUnit(doc.units);
  if (a.methods !== undefined) {
    if (a.methods.length === 0) {
      issues.push(error('editor.out_of_range', `${RULE_TEXT.methodsEmpty}.`, '/analysis/methods'));
    } else if (new Set(a.methods).size !== a.methods.length) {
      issues.push(error('editor.out_of_range', `${RULE_TEXT.methodsRepeated}.`, '/analysis/methods'));
    }
  }
  if (a.slices !== undefined && !(isInt(a.slices) && a.slices >= 3 && a.slices <= 2000)) {
    issues.push(error('editor.out_of_range', withValue(RULE_TEXT.slices, a.slices), '/analysis/slices'));
  }
  if (a.tolerance !== undefined && !(isNum(a.tolerance) && a.tolerance > 0 && a.tolerance <= 0.01)) {
    issues.push(error('editor.out_of_range', withValue(RULE_TEXT.tolerance, a.tolerance), '/analysis/tolerance'));
  }
  if (a.max_iterations !== undefined && !(isInt(a.max_iterations) && a.max_iterations >= 1 && a.max_iterations <= 100000)) {
    issues.push(error('editor.out_of_range', withValue(RULE_TEXT.maxIterations, a.max_iterations), '/analysis/max_iterations'));
  }
  if (a.min_m_alpha !== undefined && !(isNum(a.min_m_alpha) && a.min_m_alpha > 0 && a.min_m_alpha <= 1)) {
    issues.push(error('editor.out_of_range', withValue(RULE_TEXT.minMAlpha, a.min_m_alpha), '/analysis/min_m_alpha'));
  }
  const s = a.surface;
  if ((s === undefined || s === null) && (a.search === undefined || a.search === null)) {
    issues.push(error('editor.no_surface', `${RULE_TEXT.noSurface}.`, '/analysis'));
  }
  // La validación de la polilínea llega con F3-W1e.
  if (s !== undefined && s !== null && s.type !== 'polyline') {
    if (!(isNum(s.xc) && isNum(s.yc))) {
      issues.push(
        error('editor.out_of_range', `${RULE_TEXT.surfaceCenter}. Valores actuales: xc ${fmt(s.xc)}, yc ${fmt(s.yc)}.`, '/analysis/surface'),
      );
    }
    if (!(isNum(s.r) && s.r > 0)) {
      issues.push(error('editor.out_of_range', withValue(RULE_TEXT.surfaceRadius, s.r), '/analysis/surface/r'));
    }
  }
  const q = a.search;
  if (q !== undefined && q !== null) {
    const counts: ['n_entry' | 'n_exit' | 'n_radius', number | undefined][] = [
      ['n_entry', q.n_entry],
      ['n_exit', q.n_exit],
      ['n_radius', q.n_radius],
    ];
    for (const [name, value] of counts) {
      if (value !== undefined && !(isInt(value) && value >= 1 && value <= 200)) {
        issues.push(error('editor.out_of_range', withValue(searchCountText(name), value), `/analysis/search/${name}`));
      }
    }
    const product = (q.n_entry ?? 20) * (q.n_exit ?? 20) * (q.n_radius ?? 20);
    if (counts.every(([, v]) => v === undefined || isInt(v)) && product > 2e6) {
      issues.push(error('editor.out_of_range', `${searchProductText(product)}.`, '/analysis/search'));
    }
    if (q.max_radius_factor !== undefined && !(isNum(q.max_radius_factor) && q.max_radius_factor > 0.51)) {
      issues.push(error('editor.out_of_range', withValue(RULE_TEXT.maxRadiusFactor, q.max_radius_factor), '/analysis/search/max_radius_factor'));
    }
    if (q.min_width !== undefined && q.min_width !== null && !(isNum(q.min_width) && q.min_width >= 0)) {
      issues.push(error('editor.out_of_range', withValue(RULE_TEXT.minWidth, q.min_width), '/analysis/search/min_width'));
    }
    validateRange(q.entry, 'entry', extent, tol, unit, issues);
    validateRange(q.exit, 'exit', extent, tol, unit, issues);
  }
  const seismic = a.seismic;
  if (seismic !== undefined && seismic !== null) {
    const kh = seismic.kh ?? 0;
    const kv = seismic.kv ?? 0;
    if (!(isNum(kh) && kh >= 0 && kh < 1)) {
      issues.push(error('editor.out_of_range', withValue(RULE_TEXT.kh, kh), '/analysis/seismic/kh'));
    }
    if (!(isNum(kv) && kv > -1 && kv < 1)) {
      issues.push(error('editor.out_of_range', withValue(RULE_TEXT.kv, kv), '/analysis/seismic/kv'));
    }
  }
}

function validateLoads(doc: ModelDoc, extent: { min: number; max: number } | null, tol: number, issues: Issue[]): void {
  const loads = doc.loads ?? [];
  const ids = new Set<string>();
  const unit = lengthUnit(doc.units);
  const inExtent = (x: number): boolean => extent === null || (x >= extent.min - tol && x <= extent.max + tol);
  loads.forEach((load, i) => {
    const base = `/loads/${i}`;
    const label = `Carga ${i + 1}`;
    if (load.id !== undefined && load.id !== null) {
      if (ids.has(load.id)) {
        issues.push(error('editor.load_range', `${label}: el identificador «${load.id}» ya lo usa otra carga; use uno distinto.`, `${base}/id`));
      }
      ids.add(load.id);
    }
    if (load.type === 'udl') {
      if (!(isNum(load.x1) && isNum(load.x2))) {
        issues.push(error('editor.load_range', `${label}: el inicio x1 y el fin x2 de la carga distribuida deben ser números.`, base));
      } else {
        if (!(load.x1 < load.x2)) {
          issues.push(
            error('editor.load_range', `${label}: ${lcFirst(RULE_TEXT.udlOrder)}. Valores actuales: x1 ${fmt(load.x1)}, x2 ${fmt(load.x2)}.`, `${base}/x1`),
          );
        }
        if (!inExtent(load.x1)) {
          issues.push(error('editor.load_range', withValue(under(label, loadXText('x1', extent, unit)), load.x1), `${base}/x1`));
        }
        if (!inExtent(load.x2)) {
          issues.push(error('editor.load_range', withValue(under(label, loadXText('x2', extent, unit)), load.x2), `${base}/x2`));
        }
      }
      if (!(isNum(load.q) && load.q >= 0)) {
        issues.push(error('editor.load_range', withValue(`${label}: ${lcFirst(RULE_TEXT.loadQ)}`, load.q), `${base}/q`));
      }
    } else if (load.type === 'line') {
      if (!(isNum(load.x) && inExtent(load.x))) {
        issues.push(error('editor.load_range', withValue(under(label, loadXText('x', extent, unit)), load.x), `${base}/x`));
      }
      if (!(isNum(load.p) && load.p >= 0)) {
        issues.push(error('editor.load_range', withValue(`${label}: ${lcFirst(RULE_TEXT.loadP)}`, load.p), `${base}/p`));
      }
      if (!(isNum(load.angle) && load.angle >= -90 && load.angle <= 90)) {
        issues.push(error('editor.load_range', withValue(`${label}: ${lcFirst(RULE_TEXT.loadAngle)}`, load.angle), `${base}/angle`));
      }
    } else {
      issues.push(error('editor.load_range', `${label}: ${lcFirst(RULE_TEXT.loadType)}.`, `${base}/type`));
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
    issues.push(error('editor.out_of_range', `${RULE_TEXT.version02}.`, '/version'));
  }
  validateMaterials(doc, issues);
  validateRegions(doc, scale, tol, issues);
  validateWater(doc, issues);
  validateLoads(doc, extent, tol, issues);
  validateAnalysis(doc, extent, tol, issues);
  for (const a of geotechAdvisories(doc)) issues.push(warning(a.code, a.text, a.path));
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
