// E15m-9 (R13B-01): un modelo imperial sin γw deja de bloquearse y lleva la nota `editor.water_unit_weight_default`; un γw explícito en
// unidades equivocadas (9,81 pcf) sigue siendo un error. Los textos de ayuda dicen lo que hace el motor (E15l-6): vacío = 62,4 pcf en imperial.
import { describe, expect, it } from 'vitest';
import { caseBlockers } from '../../analysis/caseGate';
import { composeDiagnostics } from '../app/diagnostics';
import { describeWarning, ENGINE_WARNING_CODES, warningPath } from '../../engine/warnings';
import { LIMITATIONS } from '../../onboarding/helpContent';
import { waterUnitWeightHint } from '../panels/forms';
import type { Issue, ModelDoc } from '../types';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

const CODE = 'editor.water_unit_weight_default';
const piezo: ModelDoc['water'] = { piezometric_line: [[0, 5], [20, 5]] };
const withCrack = (units: string, water: ModelDoc['water'], water_fill: number): ModelDoc =>
  ({ ...baseDoc(), version: '0.5', units, water, analysis: { ...baseDoc().analysis, tension_crack: { depth: 2, water_fill } } }) as ModelDoc;
const only = (d: ModelDoc, code: string): Issue[] => validateLocal(d).filter((i) => i.code === code);

describe('E15m-9: imperial sin γw = nota, no bloqueo', () => {
  it('piezométrica sin γw: ningún error, una nota con el texto y el puntero a γw', () => {
    const issues = validateLocal({ ...baseDoc(), units: 'imperial', water: piezo });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const notes = only({ ...baseDoc(), units: 'imperial', water: piezo }, CODE);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ source: 'local', severity: 'nota', path: '/water/unit_weight' });
    expect(notes[0]!.text).toContain('62,4 pcf');
    expect(notes[0]!.text).toContain('9,81 kN/m³');
    expect(notes[0]!.text).toMatch(/anteriores a la v0\.4\.0/);
    expect(notes[0]!.text).not.toMatch(/water\.unit_weight|voseo/);
  });
  it('agua solo en la grieta (water_fill > 0), con y sin bloque water: también nota', () => {
    expect(only(withCrack('imperial', {}, 1), CODE)).toHaveLength(1);
    expect(only(withCrack('imperial', undefined, 0.5), CODE)).toHaveLength(1);
    expect(validateLocal(withCrack('imperial', {}, 1)).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('sin nota: SI, γw explícito, sin agua, grieta seca', () => {
    expect(only({ ...baseDoc(), units: 'SI', water: piezo }, CODE)).toEqual([]);
    expect(only({ ...baseDoc(), units: 'imperial', water: { ...piezo, unit_weight: 62.4 } }, CODE)).toEqual([]);
    expect(only({ ...baseDoc(), units: 'imperial', water: {} }, CODE)).toEqual([]);
    expect(only(withCrack('imperial', {}, 0), CODE)).toEqual([]);
    expect(only(withCrack('SI', {}, 1), CODE)).toEqual([]);
  });
  it('γw explícito en unidades equivocadas (9,81 pcf) sigue siendo un error, sin nota', () => {
    const d: ModelDoc = { ...baseDoc(), units: 'imperial', water: { ...piezo, unit_weight: 9.81 } };
    expect(only(d, 'editor.water_unit_weight')).toHaveLength(1);
    expect(only(d, 'editor.water_unit_weight')[0]!.severity).toBe('error');
    expect(only(d, CODE)).toEqual([]);
  });
  it('«Comprobar caso» (caseGate) ya no bloquea el modelo imperial sin γw, pero sí el 9,81 explícito', () => {
    const d: ModelDoc = { ...baseDoc(), units: 'imperial', water: piezo };
    expect(caseBlockers(d)).toEqual([]);
    expect(caseBlockers({ ...d, water: { ...piezo, unit_weight: 9.81 } })).toHaveLength(1);
  });
  it('la nota local no se repite cuando el motor trae su propio aviso', () => {
    const local = validateLocal({ ...baseDoc(), units: 'imperial', water: piezo });
    const engine = [{ source: 'engine', severity: 'nota', code: 'water_unit_weight_default', text: 'Bishop simplificado: x', path: '/water/unit_weight' } as Issue];
    const merged = composeDiagnostics(local, { status: 'ok', issues: engine, revision: 3 }, 3).issues;
    expect(merged.filter((i) => i.code === CODE)).toEqual([]);
    expect(merged.filter((i) => i.code === 'water_unit_weight_default')).toHaveLength(1);
    expect(composeDiagnostics(local, null, 3).issues.filter((i) => i.code === CODE)).toHaveLength(1);
  });
});

describe('E15m-9: textos de ayuda coherentes con el motor', () => {
  it('waterUnitWeightHint: vacío usa 9,81 kN/m³ o 62,4 pcf según las unidades', () => {
    expect(waterUnitWeightHint('SI')).toBe('Vacío = se usa 9,81 kN/m³.');
    const imp = waterUnitWeightHint('imperial');
    expect(imp).toContain('62,4 pcf');
    expect(imp).not.toMatch(/cálculo usa 9,81/);
  });
  it('la Ayuda ya no dice que γw debe ser explícito: solo bloquea el valor explícito menor que 20 pcf', () => {
    const text = LIMITATIONS.join('\n');
    expect(text).not.toMatch(/γw debe ser explícito/);
    expect(text).not.toMatch(/γw debe ser explícito|peso del agua debe ser explícito/);
    expect(text).toMatch(/explícito menor que 20 pcf[^.]*bloquea/); // lo que sigue bloqueando es el valor explícito en kN/m³
    expect(text).toMatch(/vacío.*62,4 pcf|62,4 pcf.*vacío|sin γw.*62,4 pcf/);
  });
  it('warnings.ts declara el código (nota, con el texto web y puntero a γw)', () => {
    expect(ENGINE_WARNING_CODES).toContain('water_unit_weight_default');
    const w = describeWarning('water_unit_weight_default');
    expect(w.severity).toBe('nota');
    expect(w.text).toContain('62,4 pcf (9,81 kN/m³)');
    expect(warningPath('water_unit_weight_default')).toBe('/water/unit_weight');
  });
});
