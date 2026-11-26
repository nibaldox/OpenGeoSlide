import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { geotechAdvisories, piezoExtension } from './geotech';
import { baseDoc, mat } from './testFixtures';
import { validateLocal } from './validateLocal';

const codes = (doc: ModelDoc): string[] => geotechAdvisories(doc).map((a) => a.code);
const fullPiezo = (doc: ModelDoc): ModelDoc => ({ ...doc, water: { unit_weight: 9.81, piezometric_line: [[0, 5], [20, 5]] } });

describe('geotechAdvisories (R9-05c/d, R9-12a)', () => {
  it('un modelo sin γsat, ru ni piezométrica corta no tiene avisos', () => {
    expect(codes(baseDoc())).toEqual([]);
  });

  it('γsat: aviso no bloqueante de que no está verificado frente a otro programa (con y sin piezométrica)', () => {
    const doc = fullPiezo(baseDoc());
    doc.materials[0] = mat('m1', { unit_weight_sat: 20.5 });
    const [a] = geotechAdvisories(doc);
    expect(a?.code).toBe('editor.gamma_sat_unverified');
    expect(a?.text).toContain('«m1»');
    expect(a?.text).toContain('todavía no está verificado frente a otro programa');
    expect(a?.path).toBe('/materials/0/unit_weight_sat');
    const dry = { ...doc, water: undefined };
    expect(geotechAdvisories(dry)[0]?.text).toContain('Sin línea piezométrica γsat no interviene');
    // Va a Diagnósticos como aviso (no error).
    expect(validateLocal(doc).find((i) => i.code === 'editor.gamma_sat_unverified')).toMatchObject({ source: 'local', severity: 'aviso' });
  });

  it('γsat < γ: aviso con ambos valores; γsat ≥ γ no lo emite', () => {
    const doc = fullPiezo(baseDoc());
    doc.materials[0] = mat('m1', { unit_weight: 18, unit_weight_sat: 17 });
    const a = geotechAdvisories(doc).find((x) => x.code === 'editor.gamma_sat_lt_gamma');
    expect(a?.text).toContain('γsat (17) es menor que γ (18)');
    expect(a?.path).toBe('/materials/0/unit_weight_sat');
    doc.materials[0] = mat('m1', { unit_weight: 18, unit_weight_sat: 18 });
    expect(codes(doc)).not.toContain('editor.gamma_sat_lt_gamma');
  });

  it('ru con piezométrica: ru tiene precedencia en ese material; ru solo, o piezométrica sola, no avisan', () => {
    const doc = fullPiezo(baseDoc());
    doc.materials[1] = mat('m2', { ru: 0.2 });
    const a = geotechAdvisories(doc).find((x) => x.code === 'editor.ru_over_piezo');
    expect(a?.text).toContain('«m2»');
    expect(a?.text).toContain('ru tiene precedencia');
    expect(a?.path).toBe('/materials/1/ru');
    // ru = 0 también cuenta: el motor usa `Some(0)`, o sea presión de poros nula.
    doc.materials[1] = mat('m2', { ru: 0 });
    expect(codes(doc)).toContain('editor.ru_over_piezo');
    expect(codes({ ...doc, water: undefined })).not.toContain('editor.ru_over_piezo');
    doc.materials[1] = mat('m2');
    expect(codes(doc)).not.toContain('editor.ru_over_piezo');
  });

  it('piezométrica que no cubre todo el ancho: avisa de la extensión horizontal con la unidad del modelo', () => {
    const doc: ModelDoc = { ...baseDoc(), water: { unit_weight: 9.81, piezometric_line: [[4, 5], [12, 6]] } };
    const a = geotechAdvisories(doc).find((x) => x.code === 'editor.piezo_extrapolated');
    expect(a?.text).toContain('cubre x de 4 a 12 m');
    expect(a?.text).toContain('el modelo va de 0 a 20 m');
    expect(a?.text).toContain('extiende en horizontal');
    expect(geotechAdvisories({ ...doc, units: 'Imperial' })[0]?.text).toContain('ft');
    expect(piezoExtension(doc)).toEqual({ left: [[0, 5], [4, 5]], right: [[12, 6], [20, 6]] });
    expect(piezoExtension(fullPiezo(baseDoc()))).toBeNull();
  });

  it('un modelo malformado no lanza', () => {
    const bad = { ...baseDoc(), materials: [{ id: 'x', unit_weight_sat: 'a' }], water: { piezometric_line: [[0, 0], [Number.NaN, 1]] } } as unknown as ModelDoc;
    expect(() => geotechAdvisories(bad)).not.toThrow();
  });
});
