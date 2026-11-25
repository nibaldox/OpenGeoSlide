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

const CATALOG: Readonly<Record<string, CatalogEntry>> = {
  negative_effective_normal: {
    severity: 'nota',
    text: 'Normal efectiva negativa en algunas dovelas (zona de tracción; considere una grieta de tracción).',
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
  m_alpha_pole: {
    severity: 'aviso',
    text: 'Polo en m_α durante la iteración de Bishop: la superficie no es admisible.',
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
  lambda_undefined: {
    severity: 'aviso',
    text: 'No se pudo calcular λ en Spencer.',
  },
  fos_nonpositive: {
    severity: 'aviso',
    text: 'El FS calculado no es positivo.',
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
