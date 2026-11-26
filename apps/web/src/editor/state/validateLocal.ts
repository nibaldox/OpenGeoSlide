// Validación local e inmediata del documento (X3 §2.5, nivel 1). Función pura, sin motor.
//
// Códigos `editor.*` de F1.4. La geometría sigue la semántica E12c (briefs/01_CONTRATOS_FASE1.md §F1.3):
// auto-intersección y solape son errores; aristas compartidas, tramos colineales compartidos y uniones en T
// son válidos. E12j (paridad con el motor): la región degenerada (área ≤ 1e-12·escala²) y el modelo sin `surface`
// ni `search` son errores; un vértice consecutivo repetido es un aviso (el motor lo acepta). Los rangos numéricos son los de briefs/00_CONTRATOS.md §1 y §4.5, más F1.1 (sismo y cargas).
// `path` es un puntero JSON. Los números de región y de arista de los textos son de base 1 (como en la UI).

import type { AnalysisSettings, Material, Model, Point, Reinforcement } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { v03Fields, v04Fields, v05Fields } from '../../io/ogsJson';
import { isFiniteNumber } from './docUtils';
import { geotechAdvisories } from './geotech';
import { checkPolylineAgainstModel } from './polylineGround';
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
  methodsEmpty: 'Métodos de análisis: marque al menos uno',
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
  undrainedStrength: 'Resistencia no drenada Su: use un valor igual o mayor que 0 (ej. 25 kPa o 500 psf)',
  strengthDatum: 'Cota de referencia de Su: escriba un número (ej. 30 m); es una cota y, no una profundidad',
  strengthGradient: 'Gradiente de Su: escriba un número, positivo si Su crece hacia abajo (ej. 1,5 kPa/m o 10 psf/ft)',
  strengthLimit: 'Límite de Su: use un valor igual o mayor que 0, o déjelo vacío (ej. 60 kPa o 1200 psf)',
  suPair: 'Su variable con la cota: la cota de referencia y el gradiente van juntos; indique los dos o quite los dos',
  suLimitNeedsGradient: 'Límite de Su: solo se admite junto con el gradiente; indique el gradiente o quite el límite',
  mohrCoulombForbidsSu:
    'el modelo «Mohr-Coulomb» no admite la resistencia no drenada Su ni su variación con la cota; cambie el modelo a «No drenado (Su)» o quite ese dato',
  undrainedForbidsMohrCoulomb:
    'el modelo «No drenado (Su)» no admite cohesión ni ángulo de fricción (φ = 0); cambie el modelo a «Mohr-Coulomb» o quite ese dato',
  polylineMinPoints: 'Superficie fija (polilínea): indique al menos 2 puntos',
  polylineFinite: 'Superficie fija (polilínea): las coordenadas x e y deben ser números',
  polylineOrder:
    'Superficie fija (polilínea): la x debe ser estrictamente creciente, con una separación de al menos 1e-9 por el ancho del modelo; ordene los puntos de izquierda a derecha',
  // Texto del motor (`lib.rs`, F3.6), con el nombre del campo de la interfaz delante.
  bishopPolyline: "Métodos de análisis: el método 'bishop' solo admite superficies circulares; use spencer, morgenstern_price o janbu",
  intersliceNeedsMp:
    'Función de fuerzas entre dovelas: solo se usa con el método Morgenstern-Price; marque ese método o quite la función',
  intersliceNeedsPoints: 'Función de fuerzas entre dovelas: la función «Definida por puntos» requiere una tabla de puntos (ξ, f)',
  intersliceOnlyDataPoints: 'Función de fuerzas entre dovelas: la tabla de puntos solo se admite con la función «Definida por puntos»',
  intersliceMinPoints: 'Función de fuerzas entre dovelas: la tabla necesita al menos 2 puntos',
  intersliceFinite: 'Función de fuerzas entre dovelas: todos los valores de la tabla deben ser números finitos',
  intersliceStart: 'Función de fuerzas entre dovelas: la tabla debe empezar en ξ = 0',
  intersliceEnd: 'Función de fuerzas entre dovelas: la tabla debe terminar en ξ = 1',
  intersliceOrder: 'Función de fuerzas entre dovelas: ξ debe ser estrictamente creciente de un punto al siguiente',
  intersliceNegative: 'Función de fuerzas entre dovelas: f debe ser igual o mayor que 0 en todos los puntos',
  intersliceAllZero: 'Función de fuerzas entre dovelas: la tabla debe tener algún f > 0',
  waterUnitWeightImperial:
    'Peso unitario del agua γw: el modelo está en unidades imperiales y γw no se indica o es menor que 20 pcf (un valor como 9,81 es de kN/m³), así que el cálculo usaría un peso del agua ' +
    'varias veces menor que el real (62,4 pcf), las presiones de poros saldrían muy bajas y el factor de seguridad quedaría del lado inseguro. Escriba 62,4 pcf en la pestaña «Agua»',
} as const;

/** Etiquetas de los campos de un refuerzo (v0.4); las usan los mensajes de aquí y los del panel «Refuerzos». */
export const REINFORCEMENT_LABEL = {
  id: 'Identificador',
  x1: 'Cabeza x1',
  y1: 'Cabeza y1',
  x2: 'Punta x2',
  y2: 'Punta y2',
  tensile_capacity: 'Capacidad a tracción',
  end1_capacity: 'Capacidad del extremo 1 (cabeza)',
  end2_capacity: 'Capacidad del extremo 2 (punta)',
  spacing: 'Espaciamiento',
  force: 'Fuerza de corte',
  angle: 'Ángulo',
  pressureModel: 'Modelo de presión del suelo',
  diameter: 'Diámetro',
  location: 'Ubicación de la fuerza',
  shear: 'Capacidad al corte',
  moment: 'Capacidad a momento',
  capacity: 'Capacidad',
  strength: 'Resistencia de adherencia por metro',
  bonded_length: 'Longitud adherida',
  adhesion: 'Adhesión de la interfaz',
  friction_angle: 'Fricción de la interfaz δ',
  coverage: 'Cobertura Rc',
  length1: 'Longitud de desarrollo en la cabeza',
  length2: 'Longitud de desarrollo en la punta',
} as const;

/** Reglas de los campos de un refuerzo, sin sujeto (siguen a la etiqueta: «<etiqueta>: <regla>»). */
export const REINFORCEMENT_RULE = {
  emptyId: 'no puede estar vacío; escriba un nombre corto (ej. ancla-1)',
  finite: 'escriba un número finito',
  nonNegative: 'use un valor igual o mayor que 0',
  positive: 'use un valor mayor que 0 (ej. 1)',
  friction: 'use un valor desde 0° hasta menos de 90° (ej. 25)',
  coverage: 'use un valor mayor que 0 y hasta 1 (ej. 0,8)',
  angleRange: 'use un valor entre −90° y 90°, sin incluirlos (0 es horizontal)',
  angleRequired: 'es obligatorio con la dirección «Ángulo»; escriba un valor entre −90° y 90°, sin incluirlos (0 es horizontal)',
  angleForbidden: 'solo se admite con la dirección «Ángulo»; quítelo o cambie la dirección',
  pressureBoth: 'un pilote lleva la fuerza de corte o la presión del suelo (Ito-Matsui), no las dos; quite una',
  pressureNeither: 'falta el dato; indique la fuerza de corte o elija la presión del suelo (Ito-Matsui)',
  pressureModel: 'solo se admite «ito_matsui»',
  pressureLocation: 'elija el centroide de la resultante («centroid») o la superficie de falla («slip_surface»)',
  capacityAlone: 'solo se admite junto con la presión del suelo (Ito-Matsui); quítela o elija la presión del suelo',
  capacityEmpty: 'indique la capacidad al corte, a momento o ambas; no puede quedar vacía',
} as const;

/** Mensaje de un campo del refuerzo `index` (base 0): `Refuerzo 2, capacidad a tracción: use un valor…`. */
export function reinforcementFieldText(index: number, label: string, rule: string): string {
  return `Refuerzo ${index + 1}, ${lcFirst(label)}: ${rule}`;
}

/** Texto del motor (`reinforcements requiere version "0.4"`) con las palabras de la interfaz (E14a). */
function version04Text(declared: string): string {
  return `Formato del archivo: los refuerzos requieren el formato 0.4, pero este modelo declara el ${declared}; cambie la versión del archivo a 0.4`;
}

/** Texto del motor (`lateral_pressure requiere version "0.5"`, E15i-1) con las palabras de la interfaz. */
function version05PressureText(declared: string): string {
  return `Formato del archivo: la presión del suelo de un pilote (Ito-Matsui) y su capacidad requieren el formato 0.5, pero este modelo declara el ${declared}; cambie la versión del archivo a 0.5`;
}

/** Texto del motor (`tension_crack requiere version "0.5"`) con las palabras de la interfaz (E15a). */
function version05Text(declared: string): string {
  return `Formato del archivo: la grieta de tracción requiere el formato 0.5, pero este modelo declara el ${declared}; cambie la versión del archivo a 0.5`;
}

const crackValue = (v: unknown): string => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : fmt(v));

/**
 * Texto del motor (`analysis.tension_crack.depth debe ser finito y mayor que 0 (o "auto"), no {d}`) con las palabras de la interfaz
 * (E15b). Sin la cita del valor cuando el campo falta.
 */
export function crackDepthText(depth: unknown): string {
  return `Grieta de tracción, profundidad: debe ser finito y mayor que 0 (o «Automática»), no ${crackValue(depth)}`;
}

/** Texto del motor (`analysis.tension_crack.water_fill debe ser finito y estar en [0, 1], no {w}`) con las palabras de la interfaz (E15b). */
export function crackWaterFillText(fill: unknown): string {
  return `Grieta de tracción, fracción de agua: debe ser finito y estar en [0, 1], no ${crackValue(fill)}`;
}

/** Texto del motor (`analysis.tension_crack.<campo> es obligatorio`) con la etiqueta del campo; `water_fill` no tiene valor por defecto. */
export function crackMissingText(field: 'depth' | 'water_fill'): string {
  return field === 'depth'
    ? 'Grieta de tracción, profundidad: es obligatoria; escriba un valor mayor que 0 o elija «Automática»'
    : 'Grieta de tracción, fracción de agua: es obligatoria y no tiene valor por defecto; escriba un valor de 0 (seca) a 1 (llena)';
}

/** Texto del motor (`<campo> requiere version "0.3"`) con el nombre del campo de la interfaz (R10B-08). */
function version03Text(what: string, declared: string): string {
  return `Formato del archivo: ${what} requiere el formato 0.3, pero este modelo declara el ${declared}; cambie la versión del archivo a 0.3`;
}

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

const isPresent = (v: unknown): boolean => v !== undefined && v !== null;

/** Mohr-Coulomb (F3.2): ninguno de los campos del no drenado; cohesión y fricción obligatorias y en rango. */
function validateMohrCoulombFields(m: Material, base: string, label: string, issues: Issue[]): void {
  for (const key of ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'] as const) {
    if (isPresent(m[key])) issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.mohrCoulombForbidsSu}.`, `${base}/${key}`));
  }
  if (!(isNum(m.cohesion) && m.cohesion >= 0)) {
    issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.cohesion), m.cohesion), `${base}/cohesion`));
  }
  if (!(isNum(m.friction_angle) && m.friction_angle >= 0 && m.friction_angle < 90)) {
    issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.frictionAngle), m.friction_angle), `${base}/friction_angle`));
  }
}

/**
 * No drenado (F3.2): Su obligatoria, finita y ≥ 0; la cota y el gradiente van juntos; el límite solo con gradiente y ≥ 0; sin cohesión ni
 * fricción. Un `null` cuenta como ausente, como en el motor.
 */
function validateUndrainedFields(m: Material, base: string, label: string, issues: Issue[]): void {
  for (const key of ['cohesion', 'friction_angle'] as const) {
    if (isPresent(m[key])) issues.push(error('editor.out_of_range', `${label}: ${RULE_TEXT.undrainedForbidsMohrCoulomb}.`, `${base}/${key}`));
  }
  if (!(isNum(m.undrained_strength) && m.undrained_strength >= 0)) {
    issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.undrainedStrength), m.undrained_strength), `${base}/undrained_strength`));
  }
  const datum = isPresent(m.strength_datum);
  const gradient = isPresent(m.strength_gradient);
  if (datum && !isNum(m.strength_datum)) {
    issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.strengthDatum), m.strength_datum), `${base}/strength_datum`));
  }
  if (gradient && !isNum(m.strength_gradient)) {
    issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.strengthGradient), m.strength_gradient), `${base}/strength_gradient`));
  }
  if (datum !== gradient) {
    issues.push(error('editor.out_of_range', `${label}: ${lcFirst(RULE_TEXT.suPair)}.`, datum ? `${base}/strength_gradient` : `${base}/strength_datum`));
  }
  if (isPresent(m.strength_limit)) {
    if (!gradient) {
      issues.push(error('editor.out_of_range', `${label}: ${lcFirst(RULE_TEXT.suLimitNeedsGradient)}.`, `${base}/strength_limit`));
    } else if (!(isNum(m.strength_limit) && m.strength_limit >= 0)) {
      issues.push(error('editor.out_of_range', withValue(under(label, RULE_TEXT.strengthLimit), m.strength_limit), `${base}/strength_limit`));
    }
  }
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
    if (m.model === 'undrained') validateUndrainedFields(m, base, label, issues);
    else validateMohrCoulombFields(m, base, label, issues);
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

/** Formato de la polilínea fija (F3.3, `validate_polyline`): al menos 2 puntos finitos, x estrictamente creciente con separación mínima 1e-9·ancho. */
function validatePolyline(points: unknown, extent: { min: number; max: number } | null, issues: Issue[]): void {
  const base = '/analysis/surface/points';
  if (!Array.isArray(points) || points.length < 2) {
    const n = Array.isArray(points) ? points.length : 0;
    issues.push(error('editor.out_of_range', `${RULE_TEXT.polylineMinPoints} (ahora hay ${n}).`, base));
    return;
  }
  let finite = true;
  points.forEach((p, i) => {
    if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
      finite = false;
      issues.push(error('editor.out_of_range', `${RULE_TEXT.polylineFinite}; corrija el punto ${i + 1}.`, `${base}/${i}`));
    }
  });
  if (!finite) return;
  const minDx = extent ? 1e-9 * (extent.max - extent.min) : 0;
  const pts = points as Point[];
  for (let i = 1; i < pts.length; i += 1) {
    const dx = (pts[i] as Point)[0] - (pts[i - 1] as Point)[0];
    if (!(dx > 0 && dx >= minDx)) {
      issues.push(error('editor.out_of_range', `${RULE_TEXT.polylineOrder}. Fallan los puntos ${i} y ${i + 1}.`, `${base}/${i}`));
      return;
    }
  }
}

/** Texto de cada razón con que el motor rechaza una polilínea fija bien formada (R10B-04b), con las etiquetas de la interfaz. */
const POLYLINE_MODEL_TEXT = {
  polyline_no_ground_crossing:
    'Superficie fija (polilínea): prolongada desde sus extremos no corta el terreno dentro del modelo; acerque los extremos al terreno o mueva el punto vecino',
  polyline_outside_ground:
    'Superficie fija (polilínea): pasa por encima del terreno, o sus puntos intermedios no quedan bajo él, entre los extremos; mueva los puntos intermedios bajo el terreno',
  polyline_outside_model:
    'Superficie fija (polilínea): sale del modelo por debajo de su base; suba los puntos intermedios para que queden dentro de las regiones',
} as const;

/** La polilínea bien formada es admisible contra el terreno y la base (`checkPolylineAgainstModel`); si no, un error con el motivo del motor. */
function validatePolylineAgainstModel(doc: ModelDoc, points: readonly Point[], issues: Issue[]): void {
  const regions = doc.regions;
  const sane =
    regions.length > 0 &&
    regions.every((r) => Array.isArray(r.polygon) && r.polygon.length >= 3 && r.polygon.every((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1])));
  if (!sane) return;
  const check = checkPolylineAgainstModel(regions, points);
  if (check.ok) return;
  issues.push(error(`editor.${check.reason}`, `${POLYLINE_MODEL_TEXT[check.reason]}.`, '/analysis/surface'));
}

/** `analysis.interslice` (F3.4, `validate_interslice`): solo con morgenstern_price; `points` solo, y siempre, con data_points. */
function validateInterslice(a: AnalysisSettings, issues: Issue[]): void {
  const spec = a.interslice;
  if (spec === undefined || spec === null) return;
  const base = '/analysis/interslice';
  if (!(a.methods ?? []).includes('morgenstern_price')) {
    issues.push(error('editor.out_of_range', `${RULE_TEXT.intersliceNeedsMp}.`, base));
    return;
  }
  const points = spec.points;
  const has = points !== undefined && points !== null;
  if (spec.function === 'data_points') {
    if (!has) {
      issues.push(error('editor.out_of_range', `${RULE_TEXT.intersliceNeedsPoints}.`, `${base}/points`));
      return;
    }
    const e = intersliceTableError(points);
    if (e) issues.push(error('editor.out_of_range', `${e.text}.`, `${base}/points${e.index === null ? '' : `/${e.index}`}`));
  } else if (has) {
    issues.push(error('editor.out_of_range', `${RULE_TEXT.intersliceOnlyDataPoints}.`, `${base}/points`));
  }
}

/**
 * Primera regla que incumple la tabla de puntos (ξ, f) de la función «Definida por puntos» (F3.4): al menos 2 puntos finitos, ξ de 0 a 1
 * estrictamente creciente, f ≥ 0 y algún f > 0. `index` es el punto (desde 0) o `null` si la regla es de toda la tabla. Lo usa también el
 * formulario del panel «Análisis».
 */
export function intersliceTableError(points: unknown): { text: string; index: number | null } | null {
  if (!Array.isArray(points) || points.length < 2) return { text: RULE_TEXT.intersliceMinPoints, index: null };
  const bad = points.findIndex((p) => !(Array.isArray(p) && isNum(p[0]) && isNum(p[1])));
  if (bad >= 0) return { text: RULE_TEXT.intersliceFinite, index: bad };
  const pts = points as Point[];
  if ((pts[0] as Point)[0] !== 0) return { text: RULE_TEXT.intersliceStart, index: 0 };
  if ((pts[pts.length - 1] as Point)[0] !== 1) return { text: RULE_TEXT.intersliceEnd, index: pts.length - 1 };
  const order = pts.findIndex((p, i) => i > 0 && !(p[0] > (pts[i - 1] as Point)[0]));
  if (order > 0) return { text: RULE_TEXT.intersliceOrder, index: order };
  const negative = pts.findIndex((p) => p[1] < 0);
  if (negative >= 0) return { text: RULE_TEXT.intersliceNegative, index: negative };
  if (!pts.some((p) => p[1] > 0)) return { text: RULE_TEXT.intersliceAllZero, index: null };
  return null;
}

/** `analysis.tension_crack` (E15b): `depth` finito y mayor que 0 (o «auto») y `water_fill` finito y en [0, 1]; los dos son obligatorios. */
function validateCrack(a: AnalysisSettings, issues: Issue[]): void {
  const c = a.tension_crack;
  if (c === undefined || c === null) return;
  const base = '/analysis/tension_crack';
  const raw = c as unknown as Record<string, unknown>;
  if (raw.depth === undefined || raw.depth === null) {
    issues.push(error('editor.crack_depth', `${crackMissingText('depth')}.`, `${base}/depth`));
  } else if (raw.depth !== 'auto' && !(isNum(raw.depth) && raw.depth > 0)) {
    issues.push(error('editor.crack_depth', `${crackDepthText(raw.depth)}.`, `${base}/depth`));
  }
  if (raw.water_fill === undefined || raw.water_fill === null) {
    issues.push(error('editor.crack_water_fill', `${crackMissingText('water_fill')}.`, `${base}/water_fill`));
  } else if (!(isNum(raw.water_fill) && raw.water_fill >= 0 && raw.water_fill <= 1)) {
    issues.push(error('editor.crack_water_fill', `${crackWaterFillText(raw.water_fill)}.`, `${base}/water_fill`));
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
  if (s !== undefined && s !== null && s.type === 'polyline') {
    const before = issues.length;
    validatePolyline(s.points, extent, issues);
    // R10B-04b: con el formato correcto y la polilínea en uso (sin búsqueda, que la ignora), admisibilidad contra el terreno y la base, con el
    // mismo código que el motor (`checkPolylineAgainstModel`).
    if (issues.length === before && (a.search === undefined || a.search === null)) validatePolylineAgainstModel(doc, s.points, issues);
    // F3.6: Bishop depende del eje de momentos en una polilínea; solo importa cuando la polilínea es la superficie que se analiza (sin búsqueda).
    if ((a.search === undefined || a.search === null) && (a.methods ?? ['bishop']).includes('bishop')) {
      issues.push(error('editor.out_of_range', `${RULE_TEXT.bishopPolyline}.`, '/analysis/methods'));
    }
  }
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
  validateInterslice(a, issues);
  validateCrack(a, issues);
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

/** `14,56 m` para citar una longitud de un refuerzo en un mensaje. */
function lengthText(v: number, unit: string): string {
  return `${fmt(Math.round(v * 100) / 100)} ${unit}`;
}

/**
 * Reglas de F4.2 de `reinforcements`, las mismas que el motor (`reinforcement::validate`): id no vacío y único, números
 * finitos, longitud > 0, capacidades y fuerza ≥ 0, `spacing` > 0, `pullout`, `bonded_length` ≤ L, `angle` solo con
 * `direction: "angle"` y en (−90, 90), y `x1 = x2` en la tablestaca. Un campo no finito no genera además un error de rango.
 */
function validateReinforcements(doc: ModelDoc, tol: number, issues: Issue[]): void {
  const list: readonly Reinforcement[] = doc.reinforcements ?? [];
  const unit = lengthUnit(doc.units);
  const L = REINFORCEMENT_LABEL;
  const R = REINFORCEMENT_RULE;
  const seen = new Map<string, number>();
  list.forEach((r, i) => {
    const base = `/reinforcements/${i}`;
    const put = (code: Code, path: string, label: string, rule: string, value?: unknown, withCurrent = true): void => {
      const text = reinforcementFieldText(i, label, rule);
      issues.push(error(code, withCurrent ? withValue(text, value) : `${text}.`, path));
    };
    // Número obligatorio: `true` si es finito; si no, anota `non_finite`.
    const finite = (path: string, label: string, v: unknown): v is number => {
      if (isNum(v)) return true;
      put('editor.reinforcement_non_finite', path, label, R.finite, v);
      return false;
    };
    // Número opcional: ausente (`undefined` o `null`) vale.
    const optional = (path: string, label: string, v: unknown): v is number => isPresent(v) && finite(path, label, v);
    const atLeastZero = (code: Code, path: string, label: string, v: unknown): void => {
      if (finite(path, label, v) && v < 0) put(code, path, label, R.nonNegative, v);
    };

    if (typeof r.id !== 'string' || r.id === '') {
      put('editor.reinforcement_empty_id', `${base}/id`, L.id, R.emptyId, undefined, false);
    } else if (seen.has(r.id)) {
      issues.push(
        error(
          'editor.reinforcement_duplicate_id',
          `Refuerzo ${i + 1}, identificador: «${r.id}» ya lo usa el refuerzo ${(seen.get(r.id) ?? 0) + 1}; use uno distinto.`,
          `${base}/id`,
        ),
      );
    } else seen.set(r.id, i);

    const coordsOk = [
      finite(`${base}/x1`, L.x1, r.x1),
      finite(`${base}/y1`, L.y1, r.y1),
      finite(`${base}/x2`, L.x2, r.x2),
      finite(`${base}/y2`, L.y2, r.y2),
    ].every(Boolean);
    const length = coordsOk ? Math.hypot(r.x2 - r.x1, r.y2 - r.y1) : Number.NaN;
    if (coordsOk && !(length > 0)) {
      issues.push(error('editor.reinforcement_zero_length', `Refuerzo ${i + 1}: la cabeza y la punta coinciden, así que la longitud es 0; separe los dos extremos.`, base));
    }

    if (r.type === 'anchor' || r.type === 'nail' || r.type === 'geosynthetic') {
      atLeastZero('editor.reinforcement_capacity', `${base}/tensile_capacity`, L.tensile_capacity, r.tensile_capacity);
      for (const key of ['end1_capacity', 'end2_capacity'] as const) {
        if (isPresent(r[key])) atLeastZero('editor.reinforcement_capacity', `${base}/${key}`, L[key], r[key]);
      }
      if (optional(`${base}/spacing`, L.spacing, r.spacing) && !(r.spacing > 0)) put('editor.reinforcement_spacing', `${base}/spacing`, L.spacing, R.positive, r.spacing);
      const p = r.pullout;
      if (p === undefined || p === null) return;
      const pb = `${base}/pullout`;
      const bad = (key: string, label: string, rule: string, v: unknown): void => put('editor.reinforcement_pullout', `${pb}/${key}`, label, rule, v);
      if (p.model === 'bond') {
        if (finite(`${pb}/strength`, L.strength, p.strength) && p.strength < 0) bad('strength', L.strength, R.nonNegative, p.strength);
        if (optional(`${pb}/bonded_length`, L.bonded_length, p.bonded_length)) {
          if (!(p.bonded_length > 0)) bad('bonded_length', L.bonded_length, R.positive, p.bonded_length);
          else if (coordsOk && p.bonded_length > length) {
            put(
              'editor.reinforcement_bonded_length',
              `${pb}/bonded_length`,
              L.bonded_length,
              `no puede superar la longitud del refuerzo (${lengthText(length, unit)}); reduzca la longitud adherida o alargue el refuerzo`,
              p.bonded_length,
            );
          }
        }
      } else if (p.model === 'interface') {
        if (finite(`${pb}/adhesion`, L.adhesion, p.adhesion) && p.adhesion < 0) bad('adhesion', L.adhesion, R.nonNegative, p.adhesion);
        if (finite(`${pb}/friction_angle`, L.friction_angle, p.friction_angle) && !(p.friction_angle >= 0 && p.friction_angle < 90)) {
          bad('friction_angle', L.friction_angle, R.friction, p.friction_angle);
        }
        if (finite(`${pb}/coverage`, L.coverage, p.coverage) && !(p.coverage > 0 && p.coverage <= 1)) bad('coverage', L.coverage, R.coverage, p.coverage);
      } else if (p.model === 'development') {
        for (const key of ['length1', 'length2'] as const) {
          if (finite(`${pb}/${key}`, L[key], p[key]) && p[key] < 0) bad(key, L[key], R.nonNegative, p[key]);
        }
      }
    } else if (r.type === 'pile' || r.type === 'sheet_pile') {
      // E15i-1: en un pilote, `force` y `lateral_pressure` se excluyen y tiene que haber exactamente uno.
      const lat = r.type === 'pile' && isPresent(r.lateral_pressure) ? r.lateral_pressure : null;
      const forcePresent = isPresent(r.force);
      if (r.type === 'pile' && lat && forcePresent) {
        put('editor.reinforcement_pressure_xor', `${base}/lateral_pressure`, L.pressureModel, R.pressureBoth, undefined, false);
      } else if (r.type === 'pile' && !lat && !forcePresent) {
        put('editor.reinforcement_pressure_xor', `${base}/force`, L.force, R.pressureNeither, undefined, false);
      } else if (!lat) {
        atLeastZero('editor.reinforcement_capacity', `${base}/force`, L.force, r.force);
      }
      if (r.type === 'pile' && optional(`${base}/spacing`, L.spacing, r.spacing) && !(r.spacing > 0)) {
        put('editor.reinforcement_spacing', `${base}/spacing`, L.spacing, R.positive, r.spacing);
      }
      if (r.type === 'pile') {
        const cap = r.capacity;
        if (lat) {
          const lb = `${base}/lateral_pressure`;
          if (lat.model !== 'ito_matsui') put('editor.reinforcement_pressure_model', `${lb}/model`, L.pressureModel, R.pressureModel, lat.model);
          const diameterOk = finite(`${lb}/diameter`, L.diameter, lat.diameter);
          if (diameterOk && !(lat.diameter > 0)) put('editor.reinforcement_pressure_diameter', `${lb}/diameter`, L.diameter, R.positive, lat.diameter);
          if (lat.location !== 'centroid' && lat.location !== 'slip_surface') {
            put('editor.reinforcement_pressure_location', `${lb}/location`, L.location, R.pressureLocation, lat.location, lat.location !== undefined && lat.location !== null);
          }
          // E15i-1: el pilote es vertical, |x2 − x1| ≤ tol, y `spacing > diameter` (sin `spacing`, vale 1).
          if (coordsOk && Math.abs(r.x2 - r.x1) > tol) {
            issues.push(
              error(
                'editor.reinforcement_pile_vertical',
                `Refuerzo ${i + 1}, punta x2: un pilote con presión del suelo es vertical; la x de la punta debe ser igual a la de la cabeza (x1 = ${lengthText(r.x1, unit)}). Valor actual: ${fmt(r.x2)}.`,
                `${base}/x2`,
              ),
            );
          }
          const s = isNum(r.spacing) ? r.spacing : isPresent(r.spacing) ? Number.NaN : 1;
          if (diameterOk && lat.diameter > 0 && Number.isFinite(s) && s > 0 && !(s > lat.diameter)) {
            put(
              'editor.reinforcement_spacing',
              `${base}/spacing`,
              L.spacing,
              `debe ser mayor que el diámetro del pilote (${lengthText(lat.diameter, unit)}); aumente el espaciamiento o reduzca el diámetro`,
              isNum(r.spacing) ? r.spacing : s,
            );
          }
        }
        if (cap !== undefined && cap !== null) {
          const cb = `${base}/capacity`;
          if (!lat) put('editor.reinforcement_capacity_alone', cb, L.capacity, R.capacityAlone, undefined, false);
          else if (!isPresent(cap.shear) && !isPresent(cap.moment)) put('editor.reinforcement_capacity_empty', cb, L.capacity, R.capacityEmpty, undefined, false);
          for (const key of ['shear', 'moment'] as const) {
            const v = cap[key];
            if (isPresent(v) && finite(`${cb}/${key}`, L[key], v) && !(v > 0)) put('editor.reinforcement_capacity', `${cb}/${key}`, L[key], R.positive, v);
          }
        }
      }
      if (r.type === 'sheet_pile' && coordsOk && r.x1 !== r.x2) {
        issues.push(
          error(
            'editor.reinforcement_sheet_pile_vertical',
            `Refuerzo ${i + 1}, punta x2: la tablestaca es vertical; la x de la punta debe ser igual a la de la cabeza (x1 = ${lengthText(r.x1, unit)}). Valor actual: ${fmt(r.x2)}.`,
            `${base}/x2`,
          ),
        );
      }
      const a = r.angle;
      if (r.direction === 'angle') {
        if (!isPresent(a)) put('editor.reinforcement_angle', `${base}/angle`, L.angle, R.angleRequired, undefined, false);
        else if (finite(`${base}/angle`, L.angle, a) && !(a > -90 && a < 90)) put('editor.reinforcement_angle', `${base}/angle`, L.angle, R.angleRange, a);
      } else if (isPresent(a)) {
        put('editor.reinforcement_angle', `${base}/angle`, L.angle, R.angleForbidden, a);
      }
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
  // R10B-08: como el motor (`<campo> requiere version "0.3"`), con el primer campo de la 0.3 que el documento usa.
  const first = doc.version === '0.3' || doc.version === '0.4' || doc.version === '0.5' ? undefined : v03Fields(doc)[0];
  if (first) {
    issues.push(error('editor.out_of_range', `${version03Text(first.what, String(doc.version))}.`, '/version'));
  }
  // F4.1: como el motor (`reinforcements requiere version "0.4"`); la 0.5 también los admite.
  if (doc.version !== '0.4' && doc.version !== '0.5' && v04Fields(doc).length > 0) {
    issues.push(error('editor.reinforcement_version', `${version04Text(String(doc.version))}.`, '/version'));
  }
  // F5.1: como el motor (`tension_crack requiere version "0.5"`); E15i-1: `lateral_pressure` y `capacity` también.
  if (doc.version !== '0.5') {
    const fields = v05Fields(doc);
    if (fields.some((f) => f.path.startsWith('/analysis/'))) issues.push(error('editor.crack_version', `${version05Text(String(doc.version))}.`, '/version'));
    if (fields.some((f) => f.path.startsWith('/reinforcements/'))) {
      issues.push(error('editor.reinforcement_pressure_version', `${version05PressureText(String(doc.version))}.`, '/version'));
    }
  }
  validateMaterials(doc, issues);
  validateRegions(doc, scale, tol, issues);
  validateWater(doc, issues);
  validateLoads(doc, extent, tol, issues);
  validateReinforcements(doc, tol, issues);
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
