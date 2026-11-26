import { describe, expect, it } from 'vitest';
import { isPolylineReport, circleSpec, reportCircle } from './surface';
import type { SurfaceSpec } from './types';

const circle: SurfaceSpec = { type: 'circle', xc: 1, yc: 2, r: 3 };
const polyline: SurfaceSpec = {
  type: 'polyline',
  points: [
    [0, 0],
    [1, 1],
  ],
};

describe('acceso a superficies como círculo', () => {
  it('circleSpec devuelve el círculo y null ante polilínea o ausencia', () => {
    expect(circleSpec(circle)).toBe(circle);
    expect(circleSpec(polyline)).toBeNull();
    expect(circleSpec(null)).toBeNull();
    expect(circleSpec(undefined)).toBeNull();
  });

  it('reportCircle e isPolylineReport distinguen las dos formas del informe', () => {
    const c = { xc: 1, yc: 2, r: 3 };
    const p = { points: [[0, 0] as [number, number], [1, 1] as [number, number]] };
    expect(reportCircle(c)).toBe(c);
    expect(reportCircle(p)).toBeNull();
    expect(isPolylineReport(p)).toBe(true);
    expect(isPolylineReport(c)).toBe(false);
  });
});
