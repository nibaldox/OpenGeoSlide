// R10B-02: el respaldo de `initialPolyline` (sin cruces del arco con el terreno) ya no es la recta horizontal que daba `polyline_no_ground_crossing`:
// es una V que cruza la corona y el pie, y es admisible contra el terreno y la base.
import { describe, expect, it } from 'vitest';
import { loadPublishedDoc } from '../../report/fixtures';
import { simpleSlope, slopeFormDefaults, slopeFromForm } from '../app/newModel';
import { checkPolylineAgainstModel } from '../state/polylineGround';
import type { ModelDoc } from '../types';
import { fallbackPolyline, initialPolyline } from './forms';

const talud = (): ModelDoc => {
  const out = slopeFromForm({ ...slopeFormDefaults('SI'), lowerOn: false });
  if (!out.ok) throw new Error('formulario inválido');
  return simpleSlope(out.value);
};
const withCircle = (doc: ModelDoc, c: { xc: number; yc: number; r: number }): ModelDoc => ({ ...doc, analysis: { ...doc.analysis, surface: { type: 'circle', ...c }, search: undefined } }) as ModelDoc;

describe('respaldo de la polilínea inicial', () => {
  it('el círculo (45, 100, 5) del hallazgo en V047a (no cruza el terreno) ya no da la recta horizontal', () => {
    const doc = loadPublishedDoc('V047a');
    const pts = initialPolyline(withCircle(doc, { xc: 45, yc: 100, r: 5 }));
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pts.map((p) => p[1])).size).toBeGreaterThan(1);
    expect(checkPolylineAgainstModel(doc.regions, pts)).toMatchObject({ ok: true });
  });
  it('en un talud, una V cuyos extremos están sobre el terreno a ambos lados y cuyo vértice queda entre el terreno y la base', () => {
    const doc = talud();
    const pts = fallbackPolyline(doc);
    expect(pts).toHaveLength(3);
    expect(checkPolylineAgainstModel(doc.regions, pts)).toMatchObject({ ok: true });
    const [a, m, b] = pts as unknown as [number[], number[], number[]];
    expect(m[1]!).toBeLessThan(Math.min(a[1]!, b[1]!));
  });
  it('en terreno llano usa la paralela al terreno (con puntos interiores)', () => {
    const doc = loadPublishedDoc('V077');
    const pts = fallbackPolyline(doc);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(checkPolylineAgainstModel(doc.regions, pts)).toMatchObject({ ok: true });
  });
  it('sin regiones devuelve una polilínea definida y sin lanzar', () => {
    const doc = { ...talud(), regions: [] } as ModelDoc;
    expect(fallbackPolyline(doc)).toEqual([[0, 0], [1, 0]]);
    expect(initialPolyline(doc)).toEqual([[0, 0], [1, 0]]);
  });
});
