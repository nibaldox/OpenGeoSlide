import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { checkModel, convergedFos, evaluateCheck, parseUploadedCase, runModel, summarizeTimes } from './runner';
import type { MethodReport } from '../engine/types';
import { isAnalysisReport } from '../engine/validate';
import { ticksBetween, niceStep } from '../render/drawSection';
import type { Model, VerificationCase, VerificationCheck } from '../engine/types';

const model = (acads1a as unknown as VerificationCase).model;

describe('convergedFos (R4-06)', () => {
  const report = (overrides: Partial<MethodReport>): MethodReport => ({
    method: 'bishop',
    fos: 1.2,
    status: 'converged',
    iterations: 4,
    lambda: null,
    surface: { xc: 0, yc: 0, r: 1 },
    slices: [],
    search: null,
    warnings: [],
    ...overrides,
  });

  it('usa el FS solo si el método convergió', () => {
    expect(convergedFos(report({ status: 'converged', fos: 1.2 }))).toBe(1.2);
  });

  it('no usa un FS finito con not_converged (Bishop agota iteraciones en bisección)', () => {
    expect(convergedFos(report({ status: 'not_converged', fos: 250.187978, warnings: ['max_iterations'] }))).toBeNull();
  });

  it('no usa el FS con estado invalid, ni la ausencia de resultado', () => {
    expect(convergedFos(report({ status: 'invalid', fos: null }))).toBeNull();
    expect(convergedFos(undefined)).toBeNull();
  });
});

describe('runner', () => {
  it('runModel fija solo los métodos y no modifica el original', () => {
    const copy = runModel(model, ['spencer']);
    expect(copy.analysis.methods).toEqual(['spencer']);
    expect(model.analysis.methods).toEqual(['bishop', 'spencer']);
  });

  it('checkModel: fija elimina la búsqueda; búsqueda elimina la superficie fija', () => {
    const base: VerificationCheck = { method: 'bishop', kind: 'fixed', published: 1, tolerance: 0.1 };
    const fixed = checkModel(model, base) as Model;
    expect(fixed.analysis.search).toBeNull();
    expect(fixed.analysis.surface).not.toBeNull();
    expect(fixed.analysis.methods).toEqual(['bishop']);

    const search = checkModel(model, { ...base, kind: 'search', options: { slices: 40 } });
    expect(search.analysis.surface).toBeNull();
    expect(search.analysis.search).not.toBeNull();
    expect(search.analysis.slices).toBe(40);
  });

  it('evaluateCheck aplica |FS − publicado| / publicado ≤ tolerancia', () => {
    const check: VerificationCheck = { method: 'bishop', kind: 'search', published: 1, tolerance: 0.05 };
    expect(evaluateCheck(check, 1.04).ok).toBe(true);
    expect(evaluateCheck(check, 1.06).ok).toBe(false);
    expect(evaluateCheck(check, 1.06).errorRel).toBeCloseTo(0.06, 12);
    expect(evaluateCheck(check, null)).toEqual({ fos: null, errorRel: null, ok: false });
  });

  it('summarizeTimes: promedio, mínimo y máximo', () => {
    expect(summarizeTimes([])).toBeNull();
    expect(summarizeTimes([2, 4, 6])).toEqual({ runs: 3, avg: 4, min: 2, max: 6 });
  });

  it('parseUploadedCase acepta caso o modelo suelto y rechaza lo demás', () => {
    const asCase = parseUploadedCase(JSON.stringify(acads1a), 'a.json');
    expect(asCase.id).toBe('V047a');
    expect(asCase.checks).toHaveLength(1);

    const bare = parseUploadedCase(JSON.stringify(acads1a.model), 'modelo.ogs.json');
    expect(bare.checks).toEqual([]);
    expect(bare.id).toBe('V047a');

    expect(() => parseUploadedCase('{x', 'roto.json')).toThrow(/no es JSON válido/);
    expect(() => parseUploadedCase('[]', 'lista.json')).toThrow(/objeto JSON/);
    expect(() => parseUploadedCase('{"foo":1}', 'otro.json')).toThrow(/no contiene un modelo/);
  });
});

describe('isAnalysisReport', () => {
  it('rechaza estructuras incompletas', () => {
    expect(isAnalysisReport({ engine: 'mock', results: [{ method: 'bishop' }] })).toBe(false);
    expect(isAnalysisReport(null)).toBe(false);
    expect(isAnalysisReport({ engine: 'mock', results: [] })).toBe(true);
  });
});

describe('escala de ejes', () => {
  it('niceStep devuelve 1, 2 o 5 × 10^k', () => {
    expect(niceStep(50)).toBe(5);
    expect(niceStep(10)).toBe(1);
    expect(niceStep(0.2)).toBeCloseTo(0.02, 12);
  });

  it('ticksBetween cubre el intervalo sin salirse', () => {
    expect(ticksBetween(20, 70, 10)).toEqual([20, 30, 40, 50, 60, 70]);
    expect(ticksBetween(-3, 12, 5)).toEqual([0, 5, 10]);
  });
});
