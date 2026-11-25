// Avisos del motor: código estable (en inglés, contrato E6) → texto en español sin voseo.
//
// Severidad:
// - `nota`: información sobre el resultado, no un problema del cálculo. Se muestra con estilo neutro.
// - `aviso`: el resultado está condicionado o no es admisible. Se destaca.
//
// Un código que no está en el catálogo se muestra tal cual, como `aviso`: nunca se oculta.

export type WarningSeverity = 'nota' | 'aviso';

export interface WarningInfo {
  /** Código tal como lo emite el motor. */
  code: string;
  severity: WarningSeverity;
  /** Texto para el usuario. */
  text: string;
}

interface CatalogEntry {
  severity: WarningSeverity;
  text: string;
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
] as const;

const CATALOG: Readonly<Record<string, CatalogEntry>> = {
  negative_effective_normal: {
    severity: 'nota',
    text: 'Normal efectiva negativa en algunas dovelas (zona de tracción; considere una grieta de tracción).',
  },
  negative_effective_normal_major: {
    severity: 'aviso',
    text: 'Normal efectiva negativa en una parte importante de la base (tracción o subpresión): revise la presión de poros y considere grietas de tracción',
  },
  air_gap_thrust: {
    severity: 'aviso',
    text: 'La superficie transmite empuje a través de un tramo sin suelo; revise la geometría',
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
    text: 'El bloque analizado es más angosto que el ancho mínimo pedido; revise la superficie.',
  },
  effective_ends_outside_range: {
    severity: 'aviso',
    text: 'Los extremos reales del bloque analizado caen fuera de los rangos de entrada/salida.',
  },
  load_outside_mass: {
    severity: 'nota',
    text: 'Alguna carga declarada no actúa sobre la masa analizada',
  },
  water_above_ground: {
    severity: 'aviso',
    text: 'La línea piezométrica queda sobre el terreno dentro de la masa deslizante. El agua sobre el terreno se ignora (no soportado en v0.1).',
  },
  max_iterations: {
    severity: 'aviso',
    text: 'Se alcanzó el número máximo de iteraciones sin converger. El FS no es un resultado definitivo.',
  },
  m_alpha: {
    severity: 'aviso',
    text: 'Algún m_α queda por debajo de min_m_alpha: la superficie no es admisible.',
  },
  pole: {
    severity: 'aviso',
    text: 'Polo en la iteración de Spencer: la superficie no es admisible.',
  },
  no_driving: {
    severity: 'aviso',
    text: 'Sin momento motor: Σ W·sen α es casi nulo. La superficie no es admisible.',
  },
  non_finite: {
    severity: 'aviso',
    text: 'El cálculo produjo valores no finitos.',
  },
  no_lambda_root: {
    severity: 'aviso',
    text: 'Spencer no encontró ninguna raíz de λ en el rango de búsqueda. El FS no es un resultado definitivo.',
  },
  no_admissible_root: {
    severity: 'aviso',
    text: 'Spencer halló raíces de λ, pero ninguna cumple la admisibilidad de Φ/F y m_α: la superficie no es admisible.',
  },
  negative_lambda: {
    severity: 'nota',
    text: 'Spencer seleccionó una raíz de equilibrio con λ negativo; revise el resultado',
  },
  multiple_admissible_roots: {
    severity: 'nota',
    text: 'Spencer tiene varias soluciones de equilibrio admisibles; se reporta la de menor factor de seguridad',
  },
  no_slices: {
    severity: 'aviso',
    text: 'La superficie no tiene dovelas de suelo.',
  },
  mock_engine: {
    severity: 'aviso',
    text: 'Motor simulado: FS con Fellenius (aproximación); no es el cálculo de Bishop o Spencer de ogs-core.',
  },
  mock_search: {
    severity: 'nota',
    text: 'Búsqueda simulada en rejilla, sin refinamiento de patrones.',
  },
};

/** Describe un código de aviso. Desconocido → su propio código como texto, severidad `aviso`. */
export function describeWarning(code: string): WarningInfo {
  const entry = Object.prototype.hasOwnProperty.call(CATALOG, code) ? CATALOG[code] : undefined;
  if (!entry) {
    return { code, severity: 'aviso', text: code };
  }
  return { code, severity: entry.severity, text: entry.text };
}

/** Avisos sin repetir, en orden de aparición, con su descripción. */
export function describeWarnings(codes: readonly string[]): WarningInfo[] {
  return Array.from(new Set(codes), describeWarning);
}
