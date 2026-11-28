// Constantes compartidas de la búsqueda global no circular (v0.7, F7.1 y F7.5): valores por defecto, rangos y textos.
// Los valores por defecto NO se escriben en el documento mientras el usuario no los cambie: `global: {}` queda vacío.

import type { GlobalAlgorithm } from './types';

/** Valores por defecto de `analysis.search.non_circular.global` (F7.1). */
export const GLOBAL_DEFAULTS = {
  algorithm: 'auto' as GlobalAlgorithm,
  generated: 500,
  seed: 0,
  polish: true,
} as const;

/** Rangos de F7.1. */
export const GLOBAL_GENERATED_MIN = 50;
export const GLOBAL_GENERATED_MAX = 2000;
export const GLOBAL_SEED_MIN = 0;
/** 2^53 − 1: el mayor entero que `JSON.parse` conserva sin perder precisión. */
export const GLOBAL_SEED_MAX = Number.MAX_SAFE_INTEGER;

export const GLOBAL_ALGORITHMS: readonly GlobalAlgorithm[] = ['auto', 'block', 'annealing'];

export const GLOBAL_ALGORITHM_LABEL: Readonly<Record<GlobalAlgorithm, string>> = {
  auto: 'Automático',
  block: 'Bloque sobre capas débiles',
  annealing: 'Recocido',
};

/** Etiqueta del algoritmo que corrió (`GlobalStats.algorithm`). */
export function globalAlgorithmLabel(algorithm: string): string {
  return (GLOBAL_ALGORITHM_LABEL as Record<string, string>)[algorithm] ?? algorithm;
}

/** Etiqueta del ganador (`GlobalStats.winner`). */
export function globalWinnerLabel(winner: string): string {
  return winner === 'global' ? 'búsqueda global' : winner === 'refinement' ? 'refinamiento' : winner;
}

export function isGlobalAlgorithm(v: unknown): v is GlobalAlgorithm {
  return typeof v === 'string' && (GLOBAL_ALGORITHMS as readonly string[]).includes(v);
}

/** Presupuesto aproximado de evaluaciones adicionales por método con los valores por defecto (F7.3). */
export const GLOBAL_BUDGET_APPROX = 5700;
