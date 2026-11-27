import { describe, expect, it } from 'vitest';
import { hoekBrownParameters } from './hoekBrown';

describe('Hoek-Brown: paridad con strength.rs y f3b_format.rs', () => {
  // X25 §1.2 y §1.3; mismas referencias y tolerancias de f3b_format.rs.
  it.each([
    [20, 10, 1, 0.0329851, 1.6196e-6, 0.543721, 1e-7, 1e-10, 1e-6],
    [5, 2, 0, 0.067225, 2.6048e-5, 0.61921, 1e-6, 1e-9, 1e-5],
  ])('GSI %s mi %s D %s', (gsi, mi, d, mb, s, a, mbTol, sTol, aTol) => {
    const p = hoekBrownParameters(gsi, mi, d);
    expect(Math.abs(p.mb - mb)).toBeLessThan(mbTol);
    expect(Math.abs(p.s - s)).toBeLessThan(sTol);
    expect(Math.abs(p.a - a)).toBeLessThan(aTol);
  });
});
