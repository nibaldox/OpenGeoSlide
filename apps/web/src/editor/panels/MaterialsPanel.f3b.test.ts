// Panel de materiales de la v0.6 (B2a): cifras de mb, s y a, nota de rangos y tabla de OCR por cota (W1-UX-1, UX-2 y UX-3).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import type { ModelDoc } from '../types';
import { hoekBrownParameters } from '../state/hoekBrown';
import { createFakeStore } from './fakeStore';
import { formatHoekBrownParameters, formatScientific, formatSignificant, MATERIAL_RANGES_NOTE, MaterialsPanel } from './MaterialsPanel';

const rock: Material = { id: 'rock', name: 'Roca', model: 'hoek_brown', unit_weight: 25, ucs: 30000, gsi: 25, mi: 10, disturbance: 0.7 };
const clay: Material = {
  id: 'clay', name: 'Arcilla', model: 'shansep', unit_weight: 18,
  shansep: { ratio: 0.25, exponent: 0.8, ocr_by_elevation: [[-12, 3], [0, 2], [10, 1]] },
};

function html(materials: Material[]): string {
  const doc = {
    format: 'opengeoslide', version: '0.6', meta: {}, units: 'SI', materials,
    regions: [{ material: materials[0]!.id, polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
    water: null, slope: { direction: 'auto' }, analysis: { methods: ['spencer'], slices: 50, surface: { type: 'circle', xc: 20, yc: 25, r: 20 } },
  } as unknown as ModelDoc;
  return renderToStaticMarkup(createElement(MaterialsPanel, { store: createFakeStore(doc) }));
}

describe('W1-UX-1: mb, s y a con 4 cifras significativas', () => {
  it('formatea con coma decimal y deja s en notación científica', () => {
    expect(formatSignificant(0.641037286646)).toBe('0,6410');
    expect(formatSignificant(0.505733559924)).toBe('0,5057');
    expect(formatScientific(0.000712752151494)).toBe('7,128·10⁻⁴');
    expect(formatScientific(1.5e-12)).toBe('1,500·10⁻¹²');
    expect(formatSignificant(12345678)).toBe('1,235·10⁷');
    expect(formatHoekBrownParameters({ mb: 0.641037286646, s: 0.000712752151494, a: 0.505733559924 })).toEqual({ mb: '0,6410', s: '7,128·10⁻⁴', a: '0,5057' });
  });

  it('un s mayor que 0,01 se escribe en decimales', () => {
    expect(formatHoekBrownParameters({ mb: 5, s: 0.1084, a: 0.5 }).s).toBe('0,1084');
    expect(formatHoekBrownParameters({ mb: 10, s: 1, a: 0.5 }).s).toBe('1,000');
  });

  it('el panel muestra mb, s y a abreviados y nunca los 12 decimales', () => {
    const p = hoekBrownParameters(25, 10, 0.7);
    const shown = formatHoekBrownParameters(p);
    const out = html([rock]);
    expect(out).toContain(`mb = ${shown.mb}; s = ${shown.s}; a = ${shown.a}`);
    expect(out).toMatch(/s = \d,\d{3}·10⁻[⁰-⁹]+;/);
    expect(out).not.toMatch(/\d,\d{6,}/);
  });
});

describe('W1-UX-2: nota de rangos con Hoek-Brown y SHANSEP', () => {
  it('cita los rangos de strength.rs', () => {
    for (const text of ['σci mayor que 0', 'GSI en [0, 100]', 'mi mayor que 0', 'D en [0, 1]', 'S mayor que 0', 'exponente m en [0, 1]',
      'exactamente una fuente de OCR', 'OCR ≥ 1', 'POP ≥ 0', 'Mohr-Coulomb', 'ru en [0, 1)']) {
      expect(MATERIAL_RANGES_NOTE, text).toContain(text);
    }
    expect(html([rock])).toContain(MATERIAL_RANGES_NOTE);
  });
});

describe('W1-UX-3: tabla de OCR por cota', () => {
  const out = html([clay]);
  const table = /<table class="ep-table">[\s\S]*?<\/table>/.exec(out)?.[0] ?? '';

  it('es una tabla de dos columnas de datos (Cota, OCR) con su cabecera y un botón Quitar por fila', () => {
    expect(table).not.toBe('');
    expect(table).toContain('<th scope="col">Cota (m)</th>');
    expect(table).toContain('<th scope="col">OCR</th>');
    expect(table.match(/<tbody>[\s\S]*<\/tbody>/)![0].match(/<tr>/g)).toHaveLength(3);
    expect(table.match(/>Quitar</g)).toHaveLength(3);
  });

  it('cada celda y cada botón tienen nombre accesible único', () => {
    const names = [...table.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(names).toContain('Material clay: fila 1, Cota');
    expect(names).toContain('Material clay: fila 3, OCR');
    expect(names).toContain('Material clay: quitar la fila 2');
    expect(new Set(names).size).toBe(names.length);
    expect(out).toContain('role="region" aria-label="Material clay: OCR por cota"');
  });

  it('muestra los valores del modelo', () => {
    expect(table).toContain('value="-12"');
    expect(table).toContain('value="3"');
    expect(table).toContain('value="10"');
  });
});
