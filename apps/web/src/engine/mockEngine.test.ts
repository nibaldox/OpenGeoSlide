import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { analyzeMock, createMockEngine, MOCK_SLICE_COUNT, MOCK_WARNING } from './mockEngine';
import { EngineError } from './engine';
import { resolveSliding, yBottom, yTop } from './groundGeometry';
import { FIVE } from '../editor/state/reinforcementFixtures';
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

  describe('modelos con campos de la versión 0.3 (F3.9)', () => {
    const REJECT = /^InvalidModel: el motor simulado no admite .*0\.3/;
    const mutate = (fn: (m: Record<string, any>) => void, version = '0.3'): string => {
      const m = JSON.parse(acadsJson);
      m.version = version;
      fn(m);
      return JSON.stringify(m);
    };

    it('rechaza cada campo nuevo con un error explícito y nunca devuelve un FS', () => {
      const cases: Record<string, (m: Record<string, any>) => void> = {
        'material no drenado': (m) => {
          m.materials[0] = { id: m.materials[0].id, name: 'u', model: 'undrained', unit_weight: 18, undrained_strength: 20 };
        },
        undrained_strength: (m) => {
          m.materials[0].undrained_strength = 20;
        },
        strength_datum: (m) => {
          m.materials[0].strength_datum = 30;
        },
        strength_gradient: (m) => {
          m.materials[0].strength_gradient = 1;
        },
        strength_limit: (m) => {
          m.materials[0].strength_limit = 60;
        },
        'superficie polilínea': (m) => {
          m.analysis.surface = {
            type: 'polyline',
            points: [
              [0, 0],
              [1, 1],
            ],
          };
        },
        morgenstern_price: (m) => {
          m.analysis.methods = ['morgenstern_price'];
        },
        janbu_simplified: (m) => {
          m.analysis.methods = ['janbu_simplified'];
        },
        janbu_corrected: (m) => {
          m.analysis.methods = ['bishop', 'janbu_corrected'];
        },
        interslice: (m) => {
          m.analysis.interslice = { function: 'half_sine' };
        },
      };
      for (const [name, fn] of Object.entries(cases)) {
        expect(() => analyzeMock(mutate(fn)), name).toThrow(EngineError);
        expect(() => analyzeMock(mutate(fn)), name).toThrow(REJECT);
        // Con una versión menor, los campos nuevos tampoco se simulan.
        expect(() => analyzeMock(mutate(fn, '0.2')), `${name} (0.2)`).toThrow(REJECT);
      }
    });

    it('el motor simulado asíncrono también rechaza (nunca resuelve con un informe)', async () => {
      const engine = createMockEngine();
      const json = mutate((m) => {
        m.analysis.methods = ['morgenstern_price'];
      });
      await expect(engine.analyze(json)).rejects.toThrow(REJECT);
    });

    it('un modelo 0.2 sin campos nuevos sigue funcionando', () => {
      const ok = mutate(() => {}, '0.2');
      expect(isAnalysisReport(analyzeMock(ok))).toBe(true);
    });
  });

  describe('modelos con refuerzos, formato 0.4 (F4.11)', () => {
    const REJECT = /^InvalidModel: el motor simulado no admite .*refuerzos.*0\.4/;
    const withReinforcements = (version = '0.4', list: unknown = FIVE): string => {
      const m = JSON.parse(acadsJson);
      m.version = version;
      m.reinforcements = list;
      return JSON.stringify(m);
    };

    it('rechaza un modelo con refuerzos con un error explícito y nunca devuelve un FS', () => {
      for (const version of ['0.4', '0.3', '0.2']) {
        expect(() => analyzeMock(withReinforcements(version)), version).toThrow(EngineError);
        expect(() => analyzeMock(withReinforcements(version)), version).toThrow(REJECT);
      }
      expect(() => analyzeMock(withReinforcements('0.4', [FIVE[3]])), 'un solo pilote').toThrow(REJECT);
    });

    it('el motor simulado asíncrono también rechaza', async () => {
      await expect(createMockEngine().analyze(withReinforcements())).rejects.toThrow(REJECT);
    });

    it('una lista vacía o ausente sigue funcionando, también con la versión 0.4', () => {
      expect(isAnalysisReport(analyzeMock(withReinforcements('0.4', [])))).toBe(true);
      const plain = JSON.parse(acadsJson);
      plain.version = '0.4';
      expect(isAnalysisReport(analyzeMock(JSON.stringify(plain)))).toBe(true);
    });
  });
  describe('modelos con grieta de tracción, formato 0.5 (F3G)', () => {
    const REJECT = /^InvalidModel: el motor simulado no admite la grieta de tracción.*0\.5/;
    const withCrack = (crack: unknown, version = '0.5'): string => {
      const m = JSON.parse(acadsJson);
      m.version = version;
      m.analysis.tension_crack = crack;
      return JSON.stringify(m);
    };

    it('rechaza una grieta (fija o automática) con un error explícito y nunca devuelve un FS', () => {
      expect(() => analyzeMock(withCrack({ depth: 2, water_fill: 1 }))).toThrow(EngineError);
      expect(() => analyzeMock(withCrack({ depth: 2, water_fill: 1 }))).toThrow(REJECT);
      expect(() => analyzeMock(withCrack({ depth: 'auto', water_fill: 0.5 }))).toThrow(REJECT);
    });

    it('el motor simulado asíncrono también rechaza', async () => {
      await expect(createMockEngine().analyze(withCrack({ depth: 1, water_fill: 0 }))).rejects.toThrow(REJECT);
    });

    it('sin grieta (ausente o null) sigue funcionando, también con la versión 0.5', () => {
      expect(isAnalysisReport(analyzeMock(withCrack(null)))).toBe(true);
      const plain = JSON.parse(acadsJson);
      plain.version = '0.5';
      expect(isAnalysisReport(analyzeMock(JSON.stringify(plain)))).toBe(true);
    });
  });
});
