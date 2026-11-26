import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { VerificationCase } from '../../engine/types';
import { analyzeMock } from '../../engine/mockEngine';
import { saveOgsJson } from '../../io/ogsJson';
import { validateLocal } from '../state';
import { loadCaseModelV02 } from '../../report/fixtures';
import { docFromCase, newDoc } from './docTemplates';

describe('newDoc', () => {
  it('es v0.2, no tiene errores locales y calcula con el motor simulado', () => {
    const doc = newDoc();
    expect(doc.version).toBe('0.2');
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
    const report = analyzeMock(saveOgsJson(doc));
    expect(report.results.length).toBe(2);
  });

  it('devuelve un documento nuevo en cada llamada (sin estado compartido)', () => {
    const a = newDoc();
    a.regions[0]!.polygon[0] = [99, 99];
    expect(newDoc().regions[0]!.polygon[0]).toEqual([0, 0]);
  });
});

const url = new URL('../../../../../verification/cases/V047a.json', import.meta.url);

describe('docFromCase', () => {
  it('abre el modelo de V047a (ACADS 1(a)) como v0.2 sin errores locales', () => {
    // El caso publicado ya es 0.3 (Morgenstern-Price y Janbu): el modelo v0.1 explícito se deriva con Bishop y Spencer.
    const model = loadCaseModelV02('V047a');
    expect(model.version).toBe('0.1');
    const c = { ...(JSON.parse(readFileSync(url, 'utf8')) as VerificationCase), model } as unknown as VerificationCase;
    const r = docFromCase(c);
    expect(r).not.toBeNull();
    expect(r!.doc.version).toBe('0.2');
    expect(r!.doc.analysis.methods).toEqual(['bishop', 'spencer']);
    expect(validateLocal(r!.doc).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('abre el caso V047a publicado en 0.3, con sus cuatro métodos, sin errores locales', () => {
    const r = docFromCase(JSON.parse(readFileSync(url, 'utf8')) as VerificationCase);
    expect(r).not.toBeNull();
    expect(r!.doc.version).toBe('0.3');
    expect(r!.doc.analysis.methods).toEqual(['bishop', 'spencer', 'morgenstern_price', 'janbu_corrected']);
    expect(validateLocal(r!.doc).filter((i) => i.severity === 'error')).toEqual([]);
  });
});
