// Búsqueda global (v0.7, F7.1, F7.2, F7.5): constantes compartidas, `isAnalysisReport` con `GlobalStats`, los dos avisos nuevos y el
// rechazo del motor simulado.
import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { warningCounts } from '../editor/app/resultSummary';
import { EngineError } from './engine';
import {
  GLOBAL_ALGORITHMS,
  GLOBAL_ALGORITHM_LABEL,
  GLOBAL_DEFAULTS,
  GLOBAL_GENERATED_MAX,
  GLOBAL_GENERATED_MIN,
  GLOBAL_SEED_MAX,
  globalAlgorithmLabel,
  globalWinnerLabel,
  isGlobalAlgorithm,
} from './globalSearch';
import { analyzeMock, createMockEngine } from './mockEngine';
import type { GlobalStats, MethodReport, VerificationCase } from './types';
import { isAnalysisReport } from './validate';
import { ENGINE_WARNING_CODES, describeResultWarnings, describeWarning, warningPath } from './warnings';

const VOSEO = /\b(usted|vos|podés|tenés|sabés|querés|considerá|indicá|revisá|comparé)\b/i;

const GLOBAL: GlobalStats = {
  algorithm: 'block',
  generated: 500,
  attempts: 912,
  converged: 498,
  eligible: 431,
  tension_rejected: 67,
  refined: 3,
  evaluated: 7120,
  polish_evaluated: 1480,
  global_fos: 1.0395,
  winner: 'global',
};

function report(global: unknown, over: Record<string, unknown> = {}) {
  return {
    engine: 'ogs-core 0.6.0',
    results: [
      {
        method: 'spencer',
        fos: 1.0395,
        status: 'converged',
        iterations: 7,
        lambda: 0.2,
        surface: { points: [[0, 10], [10, 5], [20, 0]] },
        slices: [],
        search: { evaluated: 7500, valid: 4000, non_circular: { seeds: 3, evaluated: 4500, seed_fos: 1.12, polyline_fos: 1.08, ...(global === undefined ? {} : { global }) } },
        warnings: [],
        ...over,
      },
    ],
  };
}

describe('F7.1: constantes compartidas de la búsqueda global', () => {
  it('los valores por defecto y los rangos son los del contrato', () => {
    expect(GLOBAL_DEFAULTS).toEqual({ algorithm: 'auto', generated: 500, seed: 0, polish: true });
    expect([GLOBAL_GENERATED_MIN, GLOBAL_GENERATED_MAX]).toEqual([50, 2000]);
    expect(GLOBAL_SEED_MAX).toBe(2 ** 53 - 1);
    expect(GLOBAL_ALGORITHMS).toEqual(['auto', 'block', 'annealing']);
    expect(GLOBAL_ALGORITHM_LABEL).toEqual({ auto: 'Automático', block: 'Bloque sobre capas débiles', annealing: 'Recocido' });
  });

  it('los textos del algoritmo y del ganador', () => {
    expect(globalAlgorithmLabel('block')).toBe('Bloque sobre capas débiles');
    expect(globalAlgorithmLabel('annealing')).toBe('Recocido');
    expect(globalAlgorithmLabel('otro')).toBe('otro');
    expect(globalWinnerLabel('global')).toBe('búsqueda global');
    expect(globalWinnerLabel('refinement')).toBe('refinamiento');
    expect(isGlobalAlgorithm('auto')).toBe(true);
    expect(isGlobalAlgorithm('path')).toBe(false);
    expect(isGlobalAlgorithm(3)).toBe(false);
  });
});

describe('F7.2: isAnalysisReport acepta GlobalStats opcional', () => {
  it('acepta un informe sin global (v0.6) y con global válido, incluido global_fos nulo', () => {
    expect(isAnalysisReport(report(undefined))).toBe(true);
    expect(isAnalysisReport(report(GLOBAL))).toBe(true);
    expect(isAnalysisReport(report({ ...GLOBAL, algorithm: 'annealing', eligible: 0, global_fos: null, winner: 'refinement' }))).toBe(true);
  });

  it('rechaza un global corrupto: algoritmo desconocido (nunca auto), contadores negativos o no enteros, FS no finito, ganador desconocido', () => {
    expect(isAnalysisReport(report('CORRUPT'))).toBe(false);
    expect(isAnalysisReport(report({ ...GLOBAL, algorithm: 'auto' }))).toBe(false);
    expect(isAnalysisReport(report({ ...GLOBAL, algorithm: 'path' }))).toBe(false);
    for (const key of ['generated', 'attempts', 'converged', 'eligible', 'tension_rejected', 'refined', 'evaluated', 'polish_evaluated'] as const) {
      expect(isAnalysisReport(report({ ...GLOBAL, [key]: -1 })), key).toBe(false);
      expect(isAnalysisReport(report({ ...GLOBAL, [key]: 1.5 })), key).toBe(false);
      const { [key]: _omit, ...rest } = GLOBAL;
      expect(isAnalysisReport(report(rest)), `sin ${key}`).toBe(false);
    }
    expect(isAnalysisReport(report({ ...GLOBAL, global_fos: Number.NaN }))).toBe(false);
    expect(isAnalysisReport(report({ ...GLOBAL, global_fos: 'x' }))).toBe(false);
    expect(isAnalysisReport(report({ ...GLOBAL, winner: 'both' }))).toBe(false);
  });
});

describe('F7.2: avisos nuevos de la búsqueda global', () => {
  const CODES = ['non_circular_global_no_candidates', 'non_circular_global_tension_rejected'] as const;

  it('están en ENGINE_WARNING_CODES, en el catálogo y en el puntero a la búsqueda global', () => {
    for (const code of CODES) {
      expect(ENGINE_WARNING_CODES as readonly string[]).toContain(code);
      expect(describeWarning(code).text).not.toBe(code);
      expect(describeWarning(code).text).not.toMatch(VOSEO);
      expect(warningPath(code)).toBe('/analysis/search/non_circular/global');
    }
  });

  it('sin candidatos es una nota y explica qué hacer; el rechazo por tracción es un aviso con la comparación y N′', () => {
    const none = describeWarning('non_circular_global_no_candidates');
    expect(none.severity).toBe('nota');
    expect(none.text).toContain('refinamiento');
    const rejected = describeWarning('non_circular_global_tension_rejected');
    expect(rejected.severity).toBe('aviso');
    expect(rejected.text).toContain('menor');
    expect(rejected.text).toContain('tracción');
    expect(rejected.text).toContain('búsqueda circular');
    expect(rejected.text).toContain('N′');
  });

  it('en la franja de resultados, el rechazo cuenta como aviso y la ausencia de candidatos como nota', () => {
    const r = { method: 'spencer', fos: 1.04, status: 'converged', iterations: 5, lambda: 0.1, surface: { points: [[0, 1], [1, 0], [2, 1]] }, slices: [], search: null } as unknown as MethodReport;
    const rep = { engine: 'ogs-core', results: [{ ...r, warnings: ['non_circular_global_tension_rejected'] }, { ...r, method: 'janbu_simplified' as const, warnings: ['non_circular_global_no_candidates'] }] };
    expect(warningCounts(rep)).toEqual({ avisos: 1, notas: 1 });
    expect(describeResultWarnings(rep.results[0]!).map((w) => w.code)).toEqual(['non_circular_global_tension_rejected']);
  });
});

describe('F7.5: el motor simulado rechaza los campos 0.7', () => {
  const caseData = acads1a as unknown as VerificationCase;
  const withGlobal = (version: string, global: unknown): string => {
    const m = JSON.parse(JSON.stringify(caseData.model)) as Record<string, any>;
    m.version = version;
    m.analysis.search.non_circular = { global };
    return JSON.stringify(m);
  };

  it('con global, y en cualquier versión declarada, falla con un error explícito y nunca devuelve un FS', async () => {
    const pattern = /InvalidModel: el motor simulado no admite la búsqueda global \(analysis\.search\.non_circular\.global\), un campo de la versión 0\.7; use el motor WASM/;
    for (const v of ['0.7', '0.6', '0.2']) {
      for (const g of [{}, { algorithm: 'block', generated: 100 }]) {
        expect(() => analyzeMock(withGlobal(v, g)), `${v} ${JSON.stringify(g)}`).toThrow(EngineError);
        expect(() => analyzeMock(withGlobal(v, g)), `${v} ${JSON.stringify(g)}`).toThrow(pattern);
      }
    }
    await expect(createMockEngine().analyze(withGlobal('0.7', {}))).rejects.toThrow(pattern);
  });

  it('global null cuenta como ausente: un modelo 0.7 sin global útil sigue la regla de 0.6 (non_circular se rechaza igual)', () => {
    expect(() => analyzeMock(withGlobal('0.7', null))).toThrow(/búsqueda no circular \(analysis\.search\.non_circular\), un campo de la versión 0\.6/);
  });
});
