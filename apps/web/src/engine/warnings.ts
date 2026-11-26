// Avisos del motor: código estable (en inglés, contrato E6) → texto en español sin voseo.
//
// Severidad:
// - `nota`: información sobre el resultado, no un problema del cálculo. Se muestra con estilo neutro.
// - `aviso`: el resultado está condicionado o no es admisible. Se destaca.
//
// Un código que no está en el catálogo se muestra tal cual, como `aviso`: nunca se oculta.

import type { MethodKind, MethodReport } from './types';
import { isPolylineReport } from './surface';

export type WarningSeverity = 'nota' | 'aviso';

/**
 * Contexto de un aviso (R10B-03): la superficie y el método que lo emitió. Algunos textos sugieren otro método y la
 * sugerencia depende de la superficie: Bishop simplificado solo existe en círculos, Janbu es el contraste en polilíneas.
 * Sin contexto (el aviso no se asocia a un método) la sugerencia es genérica.
 */
export interface WarningContext {
  surface?: 'circle' | 'polyline';
  method?: MethodKind;
  /**
   * El análisis ya tiene una grieta de tracción (el resultado trae `tension_crack` con `depth > 0`; con 0 no se cortó ninguna): el aviso de normal efectiva negativa no debe
   * sugerir «considere una grieta de tracción», que ya está, sino revisar su profundidad.
   */
  tensionCrack?: boolean;
}

/** Contexto de los avisos de un resultado: su método, el tipo de superficie que informó y si el análisis tiene grieta de tracción. */
export function warningContext(r: Pick<MethodReport, 'method' | 'surface'> & { tension_crack?: MethodReport['tension_crack'] | null }): WarningContext {
  const ctx: WarningContext = { method: r.method, surface: isPolylineReport(r.surface) ? 'polyline' : 'circle' };
  if (r.tension_crack && r.tension_crack.depth > 0) ctx.tensionCrack = true; // depth 0 = «sin grieta» (E15l-15)
  return ctx;
}

/**
 * Aviso `ito_matsui_spacing_range` (E15i-8): la fórmula de Ito-Matsui pierde validez con S/D < 2 o S/D > 8. Con `ratio` el texto cita el
 * valor («con S/D = 1,5»); sin él, el del catálogo de avisos del motor.
 */
export function itoMatsuiRangeText(ratio?: number | null): string {
  const shown = typeof ratio === 'number' && Number.isFinite(ratio) ? ` = ${String(Math.round(ratio * 100) / 100).replace('.', ',')}` : '';
  return `Pilote Ito-Matsui con S/D${shown} fuera de 2 a 8: la fórmula pierde validez (sobrestima la fuerza con S/D pequeño y la subestima con S/D grande; Ukritchon y Keawsawasvong 2017). Revise el espaciamiento.`;
}

/** ¿Está S/D fuera de 2 a 8 (E15i-8)? Con una tolerancia de 1e-9 para que 6,4/0,8 no avise por el ruido de coma flotante. */
export function itoMatsuiOutOfRange(ratio: number): boolean {
  return Number.isFinite(ratio) && (ratio < 2 - 1e-9 || ratio > 8 + 1e-9);
}

/** «compare con Bishop simplificado» (círculos), «compare con Janbu» (polilíneas) o «compare con otro método». */
export function compareSuggestion(ctx: WarningContext = {}): string {
  if (ctx.surface === 'polyline') {
    // Un resultado de Janbu no se compara con Janbu: el contraste es otro método de equilibrio.
    return ctx.method === 'janbu_simplified' || ctx.method === 'janbu_corrected'
      ? 'compare con Spencer o Morgenstern-Price'
      : 'compare con Janbu';
  }
  if (ctx.surface === 'circle') return 'compare con Bishop simplificado';
  return 'compare con otro método (Bishop simplificado en círculos, Janbu en polilíneas)';
}

export interface WarningInfo {
  /** Código tal como lo emite el motor. */
  code: string;
  severity: WarningSeverity;
  /** Texto para el usuario. */
  text: string;
}

interface CatalogEntry {
  severity: WarningSeverity;
  /** Texto fijo, o función del contexto cuando incluye una sugerencia que depende de la superficie. */
  text: string | ((ctx: WarningContext) => string);
}

/**
 * Códigos de aviso que emite el motor, idénticos a la lista de E6 en briefs/00_CONTRATOS.md (§4.5).
 * Agregar uno exige actualizar esa lista, este array y CATALOG; warnings.test.ts comprueba el acuerdo.
 */
export const ENGINE_WARNING_CODES = [
  'm_alpha',
  'pole',
  'no_driving',
  'negative_effective_normal',
  'negative_effective_normal_major',
  'air_gap_thrust',
  'truncated_mass',
  'truncated_driving_mass',
  'effective_width_below_min',
  'effective_ends_outside_range',
  'load_outside_mass',
  'water_above_ground',
  'max_iterations',
  'non_finite',
  'no_slices',
  'no_lambda_root',
  'no_admissible_root',
  'negative_lambda',
  'multiple_admissible_roots',
  'polyline_no_ground_crossing',
  'polyline_outside_ground',
  'bishop_non_circular',
  'interslice_shear_exceeds_strength',
  'janbu_correction_extrapolated',
  'non_positive_fos',
  'reinforcement_outside_mass',
  'reinforcement_compression_ignored',
  'reinforcement_active_compression',
  'structural_checks_not_covered',
  'ito_matsui_spacing_range',
] as const;

const CATALOG: Readonly<Record<string, CatalogEntry>> = {
  negative_effective_normal: {
    severity: 'nota',
    text: (ctx) =>
      ctx.tensionCrack
        ? 'Normal efectiva negativa en algunas dovelas (zona de tracción) a pesar de la grieta de tracción del análisis; revise su profundidad.'
        : 'Normal efectiva negativa en algunas dovelas (zona de tracción; considere una grieta de tracción).',
  },
  negative_effective_normal_major: {
    severity: 'aviso',
    text: (ctx) =>
      ctx.tensionCrack
        ? 'Normal efectiva negativa en una parte importante de la base (tracción o subpresión) a pesar de la grieta de tracción del análisis: revise la presión de poros y la profundidad de la grieta.'
        : 'Normal efectiva negativa en una parte importante de la base (tracción o subpresión): revise la presión de poros y considere grietas de tracción.',
  },
  air_gap_thrust: {
    severity: 'aviso',
    text: 'La superficie transmite empuje a través de un tramo sin suelo; revise la geometría.',
  },
  truncated_mass: {
    severity: 'nota',
    text: 'Se analizó solo el bloque principal de la superficie; las demás masas separadas por tramos aéreos se eliminaron.',
  },
  truncated_driving_mass: {
    severity: 'aviso',
    text: 'Un bloque descartado de la superficie es motriz: podría ser un mecanismo más crítico. Revise otros círculos de falla.',
  },
  effective_width_below_min: {
    severity: 'aviso',
    text: 'El bloque analizado es más angosto que el ancho mínimo pedido; revise la superficie o reduzca el ancho mínimo en «Búsqueda».',
  },
  effective_ends_outside_range: {
    severity: 'aviso',
    text: 'Los extremos reales del bloque analizado caen fuera de los rangos de entrada y salida; amplíe esos rangos en «Búsqueda» o revise la superficie.',
  },
  load_outside_mass: {
    severity: 'nota',
    text: 'Alguna carga declarada no actúa sobre la masa analizada.',
  },
  water_above_ground: {
    severity: 'nota',
    text: 'La piezométrica queda sobre el terreno: el agua embalsada se incluye con su peso y su empuje horizontal (sin sismo).',
  },
  max_iterations: {
    severity: 'aviso',
    text: 'Se alcanzó el número máximo de iteraciones sin converger. El FS no es un resultado definitivo; aumente las iteraciones máximas en «Análisis» o revise la superficie.',
  },
  m_alpha: {
    severity: 'aviso',
    text: 'Algún m_α queda por debajo del m_α mínimo: la superficie no es admisible. Revise el sentido de deslizamiento y los rangos de entrada y salida, o evite tramos de base muy inclinados.',
  },
  pole: {
    severity: 'aviso',
    text: (ctx) =>
      `El cálculo llegó a un punto singular (división por un valor casi nulo): la superficie no es admisible. Pruebe otra superficie, revise el sentido de deslizamiento o ${compareSuggestion(ctx)}.`,
  },
  no_driving: {
    severity: 'aviso',
    text: 'Las fuerzas que provocan el deslizamiento son casi nulas (Σ W·sen α ≈ 0): la superficie no es admisible. Revise el sentido de deslizamiento y que la superficie cruce el talud.',
  },
  non_finite: {
    severity: 'aviso',
    text: 'El cálculo produjo valores no finitos. Revise que los pesos unitarios, la cohesión, los ángulos y la geometría sean razonables, y que la superficie corte el terreno.',
  },
  no_lambda_root: {
    severity: 'aviso',
    text: (ctx) =>
      `El método no encontró ningún equilibrio (ningún λ lo satisface) en el rango de búsqueda. El FS no es un resultado definitivo; pruebe otra superficie o ${compareSuggestion(ctx)}.`,
  },
  no_admissible_root: {
    severity: 'aviso',
    text: (ctx) =>
      `El método halló soluciones de equilibrio, pero ninguna cumple los límites de admisibilidad (cierre de fuerzas, Φ/F y m_α): la superficie no es admisible. Revise el sentido de deslizamiento, la superficie o el m_α mínimo en «Análisis», o ${compareSuggestion(ctx)}.`,
  },
  negative_lambda: {
    severity: 'nota',
    text: (ctx) =>
      `El método seleccionó una raíz de equilibrio con λ negativo; revise el resultado o ${compareSuggestion(ctx)}.`,
  },
  multiple_admissible_roots: {
    severity: 'nota',
    text: (ctx) =>
      `Hay varias soluciones de equilibrio admisibles; se reporta la de menor factor de seguridad. Para contrastarla, ${compareSuggestion(ctx)}.`,
  },
  no_slices: {
    severity: 'aviso',
    text: 'La superficie no tiene dovelas de suelo: no atraviesa el terreno. Revise su centro y su radio, o los rangos de búsqueda.',
  },
  polyline_no_ground_crossing: {
    severity: 'aviso',
    text: 'La polilínea de falla, prolongada desde sus extremos, no corta el terreno dentro del modelo. Acerque sus extremos al terreno.',
  },
  polyline_outside_ground: {
    severity: 'aviso',
    text: 'La polilínea de falla pasa por encima del terreno o fuera del modelo entre sus extremos. Mueva sus vértices interiores bajo el terreno.',
  },
  bishop_non_circular: {
    severity: 'aviso',
    text: 'Bishop simplificado solo es válido en superficies circulares: en una polilínea su FS depende de un eje arbitrario. Use Spencer, Morgenstern-Price o Janbu.',
  },
  interslice_shear_exceeds_strength: {
    severity: 'aviso',
    text: 'Las fuerzas de corte entre dovelas superan la resistencia de las caras verticales (Chen y Morgenstern, 1983): este FS puede no ser físico. Compárelo con Janbu o revise la forma de la superficie.',
  },
  janbu_correction_extrapolated: {
    severity: 'nota',
    text: 'La superficie es más profunda que el rango del gráfico de Janbu (1973) (d/L mayor que su límite); el factor de corrección f₀ es una extrapolación.',
  },
  non_positive_fos: {
    severity: 'aviso',
    text: 'El método llegó a un factor de seguridad no positivo o no finito; no se informa ningún FS. Revise la superficie.',
  },
  reinforcement_outside_mass: {
    severity: 'nota',
    text: 'Un refuerzo no cruza la masa deslizante de esta superficie: no aporta fuerza.',
  },
  reinforcement_compression_ignored: {
    severity: 'nota',
    text: 'Un refuerzo pasivo quedaría comprimido por el deslizamiento y no aporta fuerza (solo trabaja a tracción; Clouterre, 1991; FHWA GEC 7).',
  },
  // E14o-8 (R11A-08): el activo comprimido se aplica con su fuerza; con φ > 0 su componente normal confina la base y puede subir el FS.
  reinforcement_active_compression: {
    severity: 'nota',
    text: 'Un refuerzo activo se aplica con su fuerza aunque el deslizamiento lo comprimiría; en suelos con fricción esa fuerza puede aumentar el FS. Verifique la orientación y la carga de bloqueo.',
  },
  structural_checks_not_covered: {
    severity: 'nota',
    text: 'El modelo tiene pilotes o tablestacas. OpenGeoSlide calcula la estabilidad global con el elemento incluido. Solo calcula el empuje del suelo en un pilote con presión del suelo (Ito-Matsui); no calcula el empotramiento, el momento flector a lo largo del elemento ni la deflexión.',
  },
  // E15i-8: el texto del contrato, sin el valor de S/D (el código es estable y no lo lleva); la tarjeta del pilote muestra el valor.
  ito_matsui_spacing_range: {
    severity: 'aviso',
    text: () => itoMatsuiRangeText(),
  },
  mock_engine: {
    severity: 'aviso',
    text: 'Motor simulado (solo para desarrollo): el FS es una aproximación de Fellenius, no el cálculo de Bishop o Spencer del motor real.',
  },
  mock_search: {
    severity: 'nota',
    text: 'Búsqueda simulada en rejilla, sin refinamiento de patrones.',
  },
};

/**
 * Elemento del modelo donde conviene mirar para cada aviso (puntero JSON aproximado), o `null` si no hay uno claro.
 * Sirve para que el diagnóstico lleve al panel o al elemento del lienzo correspondiente.
 */
const WARNING_PATH: Readonly<Record<string, string>> = {
  water_above_ground: '/water/piezometric_line',
  negative_effective_normal_major: '/water/piezometric_line',
  load_outside_mass: '/loads',
  reinforcement_outside_mass: '/reinforcements',
  reinforcement_compression_ignored: '/reinforcements',
  reinforcement_active_compression: '/reinforcements',
  structural_checks_not_covered: '/reinforcements',
  ito_matsui_spacing_range: '/reinforcements',
  max_iterations: '/analysis/max_iterations',
  m_alpha: '/analysis/search',
  pole: '/analysis/search',
  no_driving: '/analysis/search',
  no_admissible_root: '/analysis/search',
  no_lambda_root: '/analysis/search',
  no_slices: '/analysis/search',
  non_finite: '/analysis',
  effective_width_below_min: '/analysis/search',
  effective_ends_outside_range: '/analysis/search',
  polyline_no_ground_crossing: '/analysis/surface',
  polyline_outside_ground: '/analysis/surface',
  bishop_non_circular: '/analysis/methods',
  interslice_shear_exceeds_strength: '/analysis/surface',
  janbu_correction_extrapolated: '/analysis/methods',
  non_positive_fos: '/analysis/methods',
};

/** Puntero JSON aproximado al que apunta un aviso (`/analysis/search`, `/loads`…), o `null`. */
export function warningPath(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(WARNING_PATH, code) ? (WARNING_PATH[code] as string) : null;
}

/** Describe un código de aviso. Desconocido → su propio código como texto, severidad `aviso`. `ctx` ajusta las sugerencias (R10B-03). */
export function describeWarning(code: string, ctx: WarningContext = {}): WarningInfo {
  const entry = Object.prototype.hasOwnProperty.call(CATALOG, code) ? CATALOG[code] : undefined;
  if (!entry) {
    return { code, severity: 'aviso', text: code };
  }
  return { code, severity: entry.severity, text: typeof entry.text === 'function' ? entry.text(ctx) : entry.text };
}

/** Avisos sin repetir, en orden de aparición, con su descripción. */
export function describeWarnings(codes: readonly string[], ctx: WarningContext = {}): WarningInfo[] {
  return Array.from(new Set(codes), (code) => describeWarning(code, ctx));
}

/** Avisos de un resultado, con el contexto de su método y su superficie. */
export function describeResultWarnings(r: Pick<MethodReport, 'method' | 'surface' | 'warnings' | 'tension_crack'>): WarningInfo[] {
  return describeWarnings(r.warnings, warningContext(r));
}
