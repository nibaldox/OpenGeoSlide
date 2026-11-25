import { describe, expect, it } from 'vitest';
import { createRunGuard } from './runGuard';

describe('createRunGuard', () => {
  it('solo la última petición es vigente', () => {
    const g = createRunGuard();
    const a = g.next();
    expect(g.isCurrent(a)).toBe(true);
    const b = g.next();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
  });
  it('invalidate descarta la petición en curso sin abrir otra', () => {
    const g = createRunGuard();
    const a = g.next();
    g.invalidate();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(g.next())).toBe(true);
  });
});
