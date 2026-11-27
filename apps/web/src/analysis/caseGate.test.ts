import { describe, expect, it } from 'vitest';
import { loadBuiltinCases } from '../cases';
import type { Model } from '../engine/types';
import { blockedMessage, caseBlockers } from './caseGate';

const imperial = (units: string, unit_weight?: number): Model =>
  ({
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    units,
    materials: [{ id: 'm', name: 'm', model: 'mohr_coulomb', unit_weight: 115, cohesion: 100, friction_angle: 25 }],
    regions: [{ material: 'm', polygon: [[0, 0], [100, 0], [100, 50], [0, 50]] }],
    water: { ...(unit_weight === undefined ? {} : { unit_weight }), piezometric_line: [[0, 20], [100, 30]] },
    analysis: { surface: { type: 'circle', xc: 50, yc: 90, r: 70 } },
  }) as unknown as Model;

describe('R9-03a: «Comprobar caso» ejecuta la validación local', () => {
  it('E15m-9: JSON imperial con piezométrica y sin γw ya no bloquea (lleva una nota); el 9,8 explícito bloquea con el mensaje del editor', () => {
    expect(caseBlockers(imperial('imperial'))).toEqual([]);
    const texts = caseBlockers(imperial('imperial', 9.8));
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Escriba 62,4 pcf');
    expect(texts[0]).toContain('menor que 20 pcf');
  });
  it('9,8 · 9,80665 · units «Imperial» explícitos bloquean; sin γw, 62,4 y 64,0 pasan', () => {
    expect(caseBlockers(imperial('imperial', 9.8))).toHaveLength(1);
    expect(caseBlockers(imperial('imperial', 9.80665))).toHaveLength(1);
    expect(caseBlockers(imperial('Imperial', 9.81))).toHaveLength(1);
    expect(caseBlockers(imperial('Imperial'))).toEqual([]);
    expect(caseBlockers(imperial('imperial', 62.4))).toEqual([]);
    expect(caseBlockers(imperial('Imperial', 64))).toEqual([]);
  });
  it('los avisos geotécnicos no bloquean (un material con γsat)', () => {
    const m = imperial('imperial', 62.4);
    m.materials[0] = { ...m.materials[0]!, unit_weight_sat: 125 };
    expect(caseBlockers(m)).toEqual([]);
  });
  it('los casos de verificación publicados no tienen ningún error local', () => {
    const cases = loadBuiltinCases();
    expect(cases.length).toBeGreaterThanOrEqual(21);
    for (const c of cases) expect(caseBlockers(c.caseData.model), c.key).toEqual([]);
  });
  it('mensaje de bloqueo: cuenta los errores y no pasa de tres textos', () => {
    expect(blockedMessage(['Uno'])).toBe('No se calculó el caso: el modelo tiene un error. Uno.');
    const m = blockedMessage(['A.', 'B.', 'C.', 'D.', 'E.']);
    expect(m).toContain('5 errores');
    expect(m).toContain('A. B. C.');
    expect(m).toContain('Y 2 más.');
  });
});
