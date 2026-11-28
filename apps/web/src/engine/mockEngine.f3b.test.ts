// Motor simulado frente a los campos v0.6 (F6.13): rechaza materiales `hoek_brown` y `shansep`, sus campos y `analysis.search.non_circular`.
import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { EngineError } from './engine';
import { analyzeMock, createMockEngine } from './mockEngine';
import { isAnalysisReport } from './validate';
import type { VerificationCase } from './types';

const caseData = acads1a as unknown as VerificationCase;
const acadsJson = JSON.stringify(caseData.model);

function mutate(fn: (m: Record<string, any>) => void, version = '0.6'): string {
  const m = JSON.parse(acadsJson);
  m.version = version;
  fn(m);
  return JSON.stringify(m);
}

describe('mockEngine: rechazo de los campos v0.6 (F6.13)', () => {
  const CASES: [string, RegExp, (m: Record<string, any>) => void][] = [
    [
      'material hoek_brown',
      /^InvalidModel: el motor simulado no admite .*Hoek-Brown.*0\.6/,
      (m) => {
        m.materials[0] = { id: m.materials[0].id, name: 'Roca', model: 'hoek_brown', unit_weight: 26, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 };
      },
    ],
    [
      'material shansep (ocr)',
      /^InvalidModel: el motor simulado no admite .*SHANSEP.*0\.6/,
      (m) => {
        m.materials[0] = { id: m.materials[0].id, name: 'Arcilla', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.25, ocr: 1.5 } };
      },
    ],
    [
      'material shansep (pop)',
      /^InvalidModel: el motor simulado no admite .*SHANSEP.*0\.6/,
      (m) => {
        m.materials[0] = { id: m.materials[0].id, name: 'Arcilla', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.25, pop: 30 } };
      },
    ],
    [
      'material shansep (ocr_by_elevation)',
      /^InvalidModel: el motor simulado no admite .*SHANSEP.*0\.6/,
      (m) => {
        m.materials[0] = {
          id: m.materials[0].id,
          name: 'Arcilla',
          model: 'shansep',
          unit_weight: 18,
          shansep: { ratio: 0.25, ocr_by_elevation: [[20, 2], [35, 1.2]] },
        };
      },
    ],
    [
      'campo ucs',
      /^InvalidModel: el motor simulado no admite .*materials\[0\]\.ucs.*0\.6/,
      (m) => {
        m.materials[0].ucs = 30000;
      },
    ],
    [
      'campo gsi',
      /^InvalidModel: el motor simulado no admite .*materials\[0\]\.gsi.*0\.6/,
      (m) => {
        m.materials[0].gsi = 50;
      },
    ],
    [
      'campo mi',
      /^InvalidModel: el motor simulado no admite .*materials\[0\]\.mi.*0\.6/,
      (m) => {
        m.materials[0].mi = 10;
      },
    ],
    [
      'campo disturbance',
      /^InvalidModel: el motor simulado no admite .*materials\[0\]\.disturbance.*0\.6/,
      (m) => {
        m.materials[0].disturbance = 0.7;
      },
    ],
    [
      'campo shansep en otro modelo',
      /^InvalidModel: el motor simulado no admite .*materials\[0\]\.shansep.*0\.6/,
      (m) => {
        m.materials[0].shansep = { ratio: 0.25, ocr: 1.5 };
      },
    ],
    [
      'non_circular vacío {}',
      /^InvalidModel: el motor simulado no admite .*analysis\.search\.non_circular.*0\.6/,
      (m) => {
        m.analysis.search.non_circular = {};
      },
    ],
    [
      'non_circular con parámetros',
      /^InvalidModel: el motor simulado no admite .*analysis\.search\.non_circular.*0\.6/,
      (m) => {
        m.analysis.search.non_circular = { seeds: 3, max_vertices: 33 };
      },
    ],
  ];

  it.each(CASES)('rechaza %s con un error explícito y nunca devuelve un FS', async (_name, pattern, fn) => {
    for (const v of ['0.6', '0.5', '0.2']) {
      const json = mutate(fn, v);
      expect(() => analyzeMock(json), v).toThrow(EngineError);
      expect(() => analyzeMock(json), v).toThrow(pattern);
    }
    await expect(createMockEngine().analyze(mutate(fn))).rejects.toThrow(pattern);
  });

  it('un modelo "0.6" sin campos nuevos (o con opcionales en null) sigue funcionando', () => {
    const plain = mutate((m) => {
      m.materials[0].ucs = null;
      m.materials[0].shansep = null;
      m.analysis.search.non_circular = null;
    }, '0.6');
    expect(isAnalysisReport(analyzeMock(plain))).toBe(true);
  });

  it('rechaza una versión desconocida ("0.8") con el mensaje exacto del motor', () => {
    const bad = mutate(() => {}, '0.8');
    expect(() => analyzeMock(bad)).toThrow(
      'InvalidModel: version debe ser "0.1", "0.2", "0.3", "0.4", "0.5", "0.6" o "0.7", no "0.8"',
    );
  });
});
