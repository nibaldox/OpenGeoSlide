import { expect, it } from 'vitest';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';
import { geotechAdvisories } from './geotech';
import { convertDocUnits } from './units';

it('exige D y rechaza campos incompatibles con el mensaje del motor', () => {
  const doc = baseDoc(); doc.version = '0.6';
  doc.materials[0] = { id: 'roca', name: 'roca', model: 'hoek_brown', unit_weight: 25, ucs: 30000, gsi: 50, mi: 10, cohesion: 3 };
  const texts = validateLocal(doc).map(x => x.text);
  expect(texts).toContain(`el material 'roca' con model "hoek_brown" requiere el campo 'disturbance'`);
  expect(texts).toContain(`el material 'roca' con model "hoek_brown" no admite el campo 'cohesion'`);
});
it('valida OCR exclusivo, tabla creciente y Bishop con búsqueda no circular', () => {
  const doc = baseDoc(); doc.version = '0.6';
  doc.materials[0] = { id: 'arcilla', name: 'arcilla', model: 'shansep', unit_weight: 18, shansep: { ratio: .25, ocr: 1, pop: 3, ocr_by_elevation: [[1, 2], [0, 1]] } };
  doc.analysis.search = { type: 'circular_entry_exit', non_circular: { seeds: 11, max_vertices: 12 } };
  doc.analysis.methods = ['bishop'];
  const texts = validateLocal(doc).map(x => x.text);
  expect(texts).toContain(`el material 'arcilla' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation`);
  expect(texts).toContain(`el shansep.ocr_by_elevation del material 'arcilla' debe tener y estrictamente creciente`);
  expect(texts).toContain('el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)');
  expect(texts).toContain('analysis.search.non_circular.seeds debe estar en [1, 10], no 11');
  expect(texts).toContain('analysis.search.non_circular.max_vertices debe ser 9, 17 o 33, no 12');
});
it('rechaza grieta automática e Ito-Matsui antes del cálculo', () => {
  const doc = baseDoc(); doc.version = '0.6';
  doc.materials[0] = { id: 'r', name: 'r', model: 'hoek_brown', unit_weight: 25, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 };
  doc.analysis.tension_crack = { depth: 'auto', water_fill: 0 };
  doc.reinforcements = [{ id: 'p', type: 'pile', x1: 0, y1: 10, x2: 0, y2: 0, direction: 'perpendicular', application: 'passive', lateral_pressure: { model: 'ito_matsui', diameter: 1, location: 'centroid' }, spacing: 2 }];
  const texts = validateLocal(doc).map(x => x.text);
  expect(texts).toContain('analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep; use una profundidad fija');
  expect(texts).toContain('lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep');
});
it('aviso σci con unidades equivalentes', () => {
  const doc = baseDoc(); doc.units = 'SI'; doc.version = '0.6';
  doc.materials[0] = { id: 'r', name: 'r', model: 'hoek_brown', unit_weight: 25, ucs: 30, gsi: 50, mi: 10, disturbance: 0.7 };
  expect(geotechAdvisories(doc).some(x => x.code === 'editor.hoek_brown_ucs')).toBe(true);
  expect(geotechAdvisories(convertDocUnits(doc, 'imperial')).some(x => x.code === 'editor.hoek_brown_ucs')).toBe(true);
  doc.materials[0].ucs = 1000;
  expect(geotechAdvisories(doc).some(x => x.code === 'editor.hoek_brown_ucs')).toBe(false);
});
