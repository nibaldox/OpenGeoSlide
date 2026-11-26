// R10B-04b: `validateLocal` revisa la polilínea fija contra el terreno y la base con la misma regla que el motor (`checkPolylineAgainstModel`):
// `polyline_no_ground_crossing`, `polyline_outside_ground` y `polyline_outside_model` (NoValidSurface «la polilínea sale del modelo»).
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

// baseDoc: dos cuadrados de 0 a 20 en x y de 0 a 10 en y: terreno llano en y = 10 y base llana en y = 0.
const poly = (points: Point[], extra: Record<string, unknown> = {}): ModelDoc =>
  ({ ...baseDoc(), version: '0.3', analysis: { ...baseDoc().analysis, methods: ['spencer'], surface: { type: 'polyline', points }, ...extra } }) as ModelDoc;
const surfaceIssues = (doc: ModelDoc) => validateLocal(doc).filter((i) => i.path === '/analysis/surface');

describe('validateLocal: polilínea contra el terreno y la base', () => {
  it('una polilínea admisible no da incidencias', () => {
    expect(validateLocal(poly([[2, 9], [5, 4], [8, 9]]))).toEqual([]);
  });
  it('un vértice interior sobre el terreno: polyline_outside_ground, como el motor', () => {
    const [i] = surfaceIssues(poly([[0, 10], [5, 10], [10, 10]]));
    expect(i).toMatchObject({ source: 'local', severity: 'error', code: 'editor.polyline_outside_ground', path: '/analysis/surface' });
    expect(i!.text).toMatch(/Superficie fija \(polilínea\)/);
  });
  it('un vértice interior a menos de la tolerancia del terreno cuenta como sobre él (1e-9·escala); apenas más abajo, no', () => {
    expect(surfaceIssues(poly([[0, 10], [5, 9.99999], [10, 10]])).length).toBe(0); // bajo el terreno por más que la tolerancia: admisible
    expect(surfaceIssues(poly([[0, 10], [5, 10.0000001], [10, 10]]))).toHaveLength(1);
  });
  it('los extremos que no cortan el terreno: polyline_no_ground_crossing', () => {
    const [i] = surfaceIssues(poly([[2, 5], [8, 5]]));
    expect(i).toMatchObject({ severity: 'error', code: 'editor.polyline_no_ground_crossing' });
  });
  it('bajo la base: polyline_outside_model', () => {
    const [i] = surfaceIssues(poly([[2, 9], [5, -1], [8, 9]]));
    expect(i).toMatchObject({ severity: 'error', code: 'editor.polyline_outside_model' });
    expect(i!.text).toMatch(/base/);
  });
  it('con búsqueda activa la polilínea se ignora: no se comprueba contra el modelo', () => {
    const d = poly([[2, 9], [5, -1], [8, 9]], { search: { type: 'circular_entry_exit', n_entry: 5, n_exit: 5, n_radius: 5 } });
    expect(surfaceIssues(d)).toEqual([]);
  });
  it('si la tabla es inválida (x no creciente) solo se informa del formato, no del terreno', () => {
    const issues = validateLocal(poly([[5, 4], [2, 9], [8, 9]]));
    expect(issues.map((i) => i.code)).toEqual(['editor.out_of_range']);
  });
  it('una región degenerada no provoca excepciones ni incidencias de polilínea', () => {
    const d = poly([[2, 9], [5, 4], [8, 9]]);
    d.regions = [{ material: 'm1', polygon: [[0, 0], [1, 1]] }];
    expect(() => validateLocal(d)).not.toThrow();
    expect(validateLocal(d).some((i) => i.code.startsWith('editor.polyline_'))).toBe(false);
  });
});
