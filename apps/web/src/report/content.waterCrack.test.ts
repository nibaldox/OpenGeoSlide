// E15l-14 (R12 B-01): el informe muestra γw cuando hay piezométrica, agua embalsada o agua en la grieta (`water_fill > 0`).
// «Sin agua (no aplica)» queda solo para el modelo sin ningún uso del agua. El por defecto de imperial es el de E15l-6 (9,81 kN/m³ convertido).
import { describe, expect, it } from 'vitest';
import { loadCaseDoc } from './fixtures';
import type { ModelDoc } from '../editor/types';
import { waterUnitWeightText } from './content';

function doc(units: string, water: ModelDoc['water'] | undefined, crack?: { depth: number | 'auto'; water_fill: number }): ModelDoc {
  const d = loadCaseDoc('V047a');
  delete d.water;
  if (water) d.water = water;
  d.units = units;
  d.version = '0.5';
  d.analysis = { ...d.analysis, ...(crack ? { tension_crack: crack } : {}) };
  return d;
}

describe('E15l-14: γw del informe con agua en la grieta', () => {
  it('grieta con agua y sin `water`: el valor por defecto de cada sistema, no «Sin agua»', () => {
    expect(waterUnitWeightText(doc('SI', undefined, { depth: 2, water_fill: 1 }), 'kN/m³')).toBe('9,81 kN/m³ (por defecto)');
    expect(waterUnitWeightText(doc('imperial', undefined, { depth: 6, water_fill: 0.5 }), 'pcf')).toBe('62,45 pcf (por defecto)');
  });
  it('grieta con agua y γw explícito, sin piezométrica: se imprime el γw (B-01 lo ocultaba)', () => {
    expect(waterUnitWeightText(doc('imperial', { unit_weight: 62.4 }, { depth: 6, water_fill: 1 }), 'pcf')).toBe('62,4 pcf');
  });
  it('piezométrica en imperial sin γw: 62,45 pcf por defecto (E15l-6)', () => {
    expect(waterUnitWeightText(doc('Imperial', { piezometric_line: [[0, 5], [80, 6]] }), 'pcf')).toBe('62,45 pcf (por defecto)');
  });
  it('sin ningún uso del agua: «Sin agua (no aplica)», también con water_fill = 0 o con un γw suelto', () => {
    expect(waterUnitWeightText(doc('SI', undefined), 'kN/m³')).toBe('Sin agua (no aplica)');
    expect(waterUnitWeightText(doc('SI', undefined, { depth: 2, water_fill: 0 }), 'kN/m³')).toBe('Sin agua (no aplica)');
    expect(waterUnitWeightText(doc('imperial', { unit_weight: 62.4 }), 'pcf')).toBe('Sin agua (no aplica)');
  });
});
