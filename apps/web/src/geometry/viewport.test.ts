import { describe, expect, it } from 'vitest';
import { fitViewport, screenToWorld, worldToScreen, type Bounds } from './viewport';

const bounds: Bounds = { minX: 20, maxX: 70, minY: 10, maxY: 90 };

describe('viewport', () => {
  it('ida y vuelta mundo → pantalla → mundo con error < 1e-9', () => {
    const vp = fitViewport(bounds, 900, 420, 40);
    const samples: [number, number][] = [
      [20, 10],
      [70, 90],
      [45.5, 37.25],
      [-12.3, 140.7],
      [0, 0],
    ];
    for (const [x, y] of samples) {
      const [sx, sy] = worldToScreen(vp, x, y);
      const [x2, y2] = screenToWorld(vp, sx, sy);
      expect(Math.abs(x2 - x)).toBeLessThan(1e-9);
      expect(Math.abs(y2 - y)).toBeLessThan(1e-9);
    }
  });

  it('aspecto 1:1: misma escala en x e y', () => {
    const vp = fitViewport(bounds, 900, 420, 40);
    const [ax, ay] = worldToScreen(vp, 20, 10);
    const [bx, by] = worldToScreen(vp, 21, 11);
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    expect(dx).toBeCloseTo(vp.scale, 9);
    expect(dy).toBeCloseTo(vp.scale, 9);
  });

  it('ajusta el contenido dentro de los márgenes', () => {
    const margin = 40;
    const vp = fitViewport(bounds, 900, 420, margin);
    const [left, top] = worldToScreen(vp, bounds.minX, bounds.maxY);
    const [right, bottom] = worldToScreen(vp, bounds.maxX, bounds.minY);
    expect(left).toBeGreaterThanOrEqual(margin - 1e-9);
    expect(top).toBeGreaterThanOrEqual(margin - 1e-9);
    expect(right).toBeLessThanOrEqual(900 - margin + 1e-9);
    expect(bottom).toBeLessThanOrEqual(420 - margin + 1e-9);
    // Al menos una dimensión toca su margen (ajuste ajustado).
    const touches = Math.abs(left - margin) < 1e-6 || Math.abs(top - margin) < 1e-6;
    expect(touches || Math.abs(right - (900 - margin)) < 1e-6 || Math.abs(bottom - (420 - margin)) < 1e-6).toBe(true);
  });

  it('y crece hacia arriba en el mundo (y pequeña queda abajo en pantalla)', () => {
    const vp = fitViewport(bounds, 900, 420, 40);
    const [, syLow] = worldToScreen(vp, 30, 10);
    const [, syHigh] = worldToScreen(vp, 30, 90);
    expect(syLow).toBeGreaterThan(syHigh);
  });
});
