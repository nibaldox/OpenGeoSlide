// E15l-17 (R12 B-08): el motor simulado no calcula el agua embalsada (ni su peso ni su empuje) y rechaza un modelo con la piezométrica sobre
// el terreno, como ya hace con los refuerzos y la grieta: antes devolvía un FS sin ese peso y con el aviso `water_above_ground` que decía lo contrario.
import { describe, expect, it } from 'vitest';
import acads1a from '../examples/acads1a.json';
import { EngineError } from './engine';
import { analyzeMock, createMockEngine } from './mockEngine';
import { isAnalysisReport } from './validate';
import { humanizeEngineError } from './errors';
import type { VerificationCase } from './types';

const base = (caseData: VerificationCase) => JSON.parse(JSON.stringify(caseData.model)) as Record<string, any>;
const acads = acads1a as unknown as VerificationCase;
const MESSAGE = 'InvalidModel: El motor simulado no modela el agua embalsada; use el motor WASM.';

/** ACADS 1(a): el terreno llega a y = 25 a la izquierda y a y = 35 a la derecha. */
function withPiezo(line: [number, number][], version = '0.2'): string {
  const m = base(acads);
  m.version = version;
  m.water = { piezometric_line: line };
  return JSON.stringify(m);
}

describe('E15l-17: motor simulado y agua embalsada', () => {
  it('rechaza la piezométrica sobre el terreno, en cualquier versión, con el mensaje del contrato', () => {
    for (const version of ['0.2', '0.3', '0.4', '0.5']) {
      const json = withPiezo([[0, 60], [100, 60]], version);
      expect(() => analyzeMock(json), version).toThrow(EngineError);
      expect(() => analyzeMock(json), version).toThrow(MESSAGE);
    }
  });
  it('el texto para el usuario va en español y no dice «0.5»', () => {
    expect(humanizeEngineError(MESSAGE)).toBe('Modelo no válido: El motor simulado no modela el agua embalsada; use el motor WASM.');
  });
  it('el motor simulado asíncrono también rechaza', async () => {
    await expect(createMockEngine().analyze(withPiezo([[0, 60], [100, 60]]))).rejects.toThrow(MESSAGE);
  });
  it('una piezométrica bajo el terreno sigue calculando (sin agua embalsada)', () => {
    const report = analyzeMock(withPiezo([[0, 21], [100, 21]]));
    expect(isAnalysisReport(report)).toBe(true);
    expect(report.results[0]?.warnings).not.toContain('water_above_ground');
  });
  it('agua en la grieta: se rechaza (la grieta ya se rechazaba; con water_fill > 0 sigue sin devolver FS)', () => {
    const m = base(acads);
    m.version = '0.5';
    m.analysis.tension_crack = { depth: 2, water_fill: 1 };
    expect(() => analyzeMock(JSON.stringify(m))).toThrow(EngineError);
  });
});
