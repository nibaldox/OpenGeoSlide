import { expect, it } from 'vitest';
import { defaultSearch, materialFromForm, materialToForm, methodDisabledReason, newMaterialForm, searchFromForm, searchesEqual, searchToForm, switchMaterialModel } from './forms';

it('formularios HB y SHANSEP no agregan campos de otras leyes', () => {
  const base = newMaterialForm([], 'SI');
  const hb = materialFromForm({ ...base, model: 'hoek_brown', ucs: '30000', gsi: '50', mi: '10', disturbance: '0,7' }, { otherIds: [], editing: null });
  expect(hb.ok).toBe(true);
  if (!hb.ok) return;
  expect(hb.value).toMatchObject({ model: 'hoek_brown', ucs: 30000, disturbance: .7 });
  expect(hb.value.cohesion).toBeUndefined();
  expect(materialFromForm({ ...materialToForm(hb.value), disturbance: '' }, { otherIds: [], editing: hb.value }).ok).toBe(false);
  const switched = switchMaterialModel(hb.value, 'shansep');
  expect(switched.ucs).toBeUndefined();
  const sh = materialFromForm({ ...materialToForm(switched), ratio: '0,25', ocrSource: 'table', ocrRows: [{ y: '0', ocr: '1' }, { y: '3', ocr: '2' }] }, { otherIds: [], editing: switched });
  expect(sh.ok).toBe(true);
  if (sh.ok) expect(sh.value.shansep).toEqual({ ratio: .25, ocr_by_elevation: [[0, 1], [3, 2]] });
});
it('búsqueda no circular sobrevive al formulario y deshabilita Bishop', () => {
  const spec = { ...defaultSearch(), non_circular: { seeds: 4, max_vertices: 17 } };
  const r = searchFromForm(searchToForm(spec), { xRange: null });
  expect(r.ok).toBe(true);
  if (r.ok) expect(searchesEqual(r.value, spec)).toBe(true);
  expect(methodDisabledReason('bishop', { search: spec })).toContain('no se admite');
  expect(methodDisabledReason('spencer', { search: spec })).toBeNull();
});
