// Los modelos de las pruebas de informe y PDF son v0.1/v0.2 explícitos; el simulado sigue rechazando 0.3 (F3.9).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeMock } from '../engine/mockEngine';
import type { VerificationCase } from '../engine/types';
import { loadCaseModelV02 } from './fixtures';

const published = (id: string): VerificationCase =>
  JSON.parse(readFileSync(new URL(`../../../../verification/cases/${id}.json`, import.meta.url), 'utf8')) as VerificationCase;

describe('fixtures: modelo v0.1/v0.2 explícito derivado del caso', () => {
  it('V047a: versión 0.1 con Bishop y Spencer, y el simulado lo calcula', () => {
    const m = loadCaseModelV02('V047a');
    expect(m.version).toBe('0.1');
    expect((m.analysis as { methods: string[] }).methods).toEqual(['bishop', 'spencer']);
    expect(analyzeMock(JSON.stringify(m)).results.map((r) => r.method)).toEqual(['bishop', 'spencer']);
  });

  it('el caso publicado V047a (0.3, con M-P y Janbu) sigue siendo rechazado por el simulado, sin inventar un FS', () => {
    const json = JSON.stringify(published('V047a').model);
    expect(() => analyzeMock(json)).toThrow(/motor simulado no admite analysis\.methods "morgenstern_price"/);
  });

  it('un caso con campos de 0.3 (V006, polilínea) no se puede derivar: exige el motor real', () => {
    expect(() => loadCaseModelV02('V006')).toThrow(/0\.3|sin Bishop ni Spencer/);
  });
});
