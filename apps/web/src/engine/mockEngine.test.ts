import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { analyzeMock, createMockEngine, MOCK_SLICE_COUNT, MOCK_WARNING } from './mockEngine';
import { EngineError } from './engine';
import { resolveSliding, yBottom, yTop } from './groundGeometry';
import { isAnalysisReport } from './validate';
import type { VerificationCase } from './types';

const caseData = acads1a as unknown as VerificationCase;
const acadsJson = JSON.stringify(caseData.model);

function withoutSearch(json: string): string {
  const model = JSON.parse(json);
  model.analysis.search = null;
  return JSON.stringify(model);
}

describe('ground geometry (§1)', () => {
  const model = caseData.model;

  it('envolventes superior e inferior en las verticales conocidas', () => {
    expect(yTop(model, 20)).toBe(25);
    expect(yTop(model, 25)).toBe(25);
    expect(yTop(model, 55)).toBe(35);
    expect(yTop(model, 70)).toBe(35);
    expect(yBottom(model, 40)).toBe(20);
    expect(yTop(model, 100)).toBeNull();
  });

  it('dirección auto del ejemplo: masa hacia −x (right_to_left)', () => {
    expect(resolveSliding(model)).toBe('right_to_left');
  });
});

describe('mockEngine (motor simulado)', () => {
  it('devuelve un AnalysisReport válido con engine = "mock" y los métodos pedidos en orden', () => {
    const report = analyzeMock(acadsJson);
    expect(isAnalysisReport(report)).toBe(true);
    expect(report.engine).toBe('mock');
    expect(report.results.map((r) => r.method)).toEqual(['bishop', 'spencer']);
  });

  it('búsqueda: estadísticas exactas de la rejilla 20 × 20 × 20 y FS finito', () => {
    const report = analyzeMock(acadsJson);
    for (const r of report.results) {
      expect(r.search).not.toBeNull();
      expect(r.search?.evaluated).toBe(20 * 20 * 20);
      expect(r.search?.valid).toBeGreaterThan(0);
      expect(r.search?.valid).toBeLessThanOrEqual(8000);
      expect(r.status).toBe('converged');
      expect(r.fos).not.toBeNull();
      expect(r.fos as number).toBeGreaterThan(0);
      expect(r.slices).toHaveLength(MOCK_SLICE_COUNT);
      expect(r.warnings).toContain(MOCK_WARNING);
    }
  });

  it('dovelas ordenadas del pie al coronamiento y con signos de la convención (α > 0 hacia el coronamiento)', () => {
    const [r] = analyzeMock(acadsJson).results;
    // Masa hacia −x: el pie está a menor x.
    expect(r.slices[0].x_left).toBeLessThan(r.slices[r.slices.length - 1].x_left);
    // Motriz positiva: Σ W·sen α > 0 implícito en un FS finito; cada dovela de ancho > 0.
    for (const s of r.slices) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.base_length).toBeGreaterThanOrEqual(s.width - 1e-12);
      expect(s.weight).toBeGreaterThan(0);
      expect(s.material).toBe(0);
    }
    const driving = r.slices.reduce((acc, s) => acc + s.weight * Math.sin(s.alpha), 0);
    expect(driving).toBeGreaterThan(0);
  });

  it('es determinista: dos ejecuciones producen el mismo JSON byte a byte', async () => {
    const engine = createMockEngine();
    const a = await engine.analyze(acadsJson);
    const b = await engine.analyze(acadsJson);
    expect(a).toBe(b);
    expect(await engine.version()).toBe('0.1.0');
    expect(engine.name).toBe('mock');
  });

  it('superficie fija: analiza el círculo dado o informa estado invalid con el motivo', () => {
    const report = analyzeMock(withoutSearch(acadsJson));
    for (const r of report.results) {
      expect(r.search).toBeNull();
      expect(r.surface).toEqual({ xc: 120, yc: 90, r: 80 });
      if (r.status === 'invalid') {
        expect(r.fos).toBeNull();
        expect(r.warnings.join(' ')).toMatch(/OutsideModel|NoIntersection|AboveGround|NoMaterial|no_driving/);
      } else {
        expect(r.fos).not.toBeNull();
      }
    }
  });

  it('errores: JSON malformado, sin superficie y método desconocido', () => {
    expect(() => analyzeMock('{no es json')).toThrow(EngineError);
    expect(() => analyzeMock('{no es json')).toThrow(/^Json/);

    const noSurface = JSON.parse(acadsJson);
    noSurface.analysis.surface = null;
    noSurface.analysis.search = null;
    expect(() => analyzeMock(JSON.stringify(noSurface))).toThrow(/^NoSurface/);

    const badMethod = JSON.parse(acadsJson);
    badMethod.analysis.methods = ['fellenius'];
    expect(() => analyzeMock(JSON.stringify(badMethod))).toThrow(/^InvalidModel/);
  });
});
