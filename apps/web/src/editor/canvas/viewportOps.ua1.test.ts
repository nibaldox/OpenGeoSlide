// UA1-C: encuadre con márgenes (fitToDocInsets), líneas mayores de la rejilla y texto de la píldora de coordenadas.
import { describe, expect, it } from 'vitest';
import { worldToScreen } from '../../geometry/viewport';
import type { ModelDoc } from '../types';
import { makeDoc } from './fakeStore';
import { FIT_MIN_AVAILABLE, coordinateReadout, docBounds, fitToDoc, fitToDocInsets, isMajorGridLine, paddedBounds } from './viewportOps';
import { gridLines } from './layout';

const INSETS = { top: 24, right: 92, bottom: 72, left: 24 };

/** Esquinas del cuadro con espacio de dibujo, en pantalla. */
function paddedCorners(doc: ModelDoc, vp: ReturnType<typeof fitToDocInsets>): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = paddedBounds(docBounds(doc));
  const [x0, y0] = worldToScreen(vp, b.minX, b.maxY);
  const [x1, y1] = worldToScreen(vp, b.maxX, b.minY);
  return { minX: x0, maxX: x1, minY: y0, maxY: y1 };
}

describe('fitToDocInsets', () => {
  it('con márgenes simétricos y uniformes equivale a fitToDoc', () => {
    const doc = makeDoc();
    const a = fitToDocInsets(doc, 900, 600, { top: 24, right: 24, bottom: 24, left: 24 });
    const b = fitToDoc(doc, 900, 600, 24);
    expect(a.scale).toBeCloseTo(b.scale, 9);
    expect(a.tx).toBeCloseTo(b.tx, 9);
    expect(a.ty).toBeCloseTo(b.ty, 9);
    expect(a.width).toBe(900);
    expect(a.height).toBe(600);
  });

  it('con márgenes asimétricos el modelo cabe en el rectángulo libre y queda centrado en él', () => {
    const doc = makeDoc();
    const w = 1200;
    const h = 700;
    const vp = fitToDocInsets(doc, w, h, INSETS);
    const c = paddedCorners(doc, vp);
    const eps = 1e-6;
    expect(c.minX).toBeGreaterThanOrEqual(INSETS.left - eps);
    expect(c.maxX).toBeLessThanOrEqual(w - INSETS.right + eps);
    expect(c.minY).toBeGreaterThanOrEqual(INSETS.top - eps);
    expect(c.maxY).toBeLessThanOrEqual(h - INSETS.bottom + eps);
    // centrado en el rectángulo libre
    expect((c.minX + c.maxX) / 2).toBeCloseTo((INSETS.left + w - INSETS.right) / 2, 6);
    expect((c.minY + c.maxY) / 2).toBeCloseTo((INSETS.top + h - INSETS.bottom) / 2, 6);
    // y toca el rectángulo por el eje que limita
    const touchX = Math.abs(c.maxX - c.minX - (w - INSETS.left - INSETS.right)) < 1e-6;
    const touchY = Math.abs(c.maxY - c.minY - (h - INSETS.top - INSETS.bottom)) < 1e-6;
    expect(touchX || touchY).toBe(true);
  });

  it('un margen mayor a la derecha mueve el modelo a la izquierda', () => {
    const doc = makeDoc();
    const sym = fitToDocInsets(doc, 1200, 700, { top: 24, right: 24, bottom: 24, left: 24 });
    const asym = fitToDocInsets(doc, 1200, 700, { top: 24, right: 200, bottom: 24, left: 24 });
    const b = paddedBounds(docBounds(doc));
    const cx = (b.minX + b.maxX) / 2;
    expect(worldToScreen(asym, cx, 0)[0]).toBeLessThan(worldToScreen(sym, cx, 0)[0]);
  });

  it('un modelo vacío (cuadro por defecto) y uno de un solo punto dan una vista finita y con escala positiva', () => {
    const empty = makeDoc();
    empty.regions = [];
    empty.water = null;
    const v0 = fitToDocInsets(empty, 800, 500, INSETS);
    expect(Number.isFinite(v0.scale) && v0.scale > 0).toBe(true);
    expect(Number.isFinite(v0.tx) && Number.isFinite(v0.ty)).toBe(true);

    const dot = makeDoc();
    dot.water = null;
    dot.regions = [{ ...dot.regions[0]!, polygon: [[5, 5], [5, 5], [5, 5]] }];
    const v1 = fitToDocInsets(dot, 800, 500, INSETS);
    expect(Number.isFinite(v1.scale) && v1.scale > 0).toBe(true);
    expect(Number.isFinite(v1.tx) && Number.isFinite(v1.ty)).toBe(true);
  });

  it('si el ancho o el alto no alcanzan para los márgenes, los reduce y conserva el 40 % del lado para el modelo', () => {
    const doc = makeDoc();
    for (const [w, h] of [[100, 600], [600, 50], [60, 60], [1, 1]] as const) {
      const vp = fitToDocInsets(doc, w, h, INSETS);
      expect(Number.isFinite(vp.scale) && vp.scale > 0).toBe(true);
      const c = paddedCorners(doc, vp);
      const availW = c.maxX - c.minX;
      const availH = c.maxY - c.minY;
      // el modelo ocupa a lo sumo el 100 % del lado y, en el eje limitante, al menos la fracción mínima
      expect(availW).toBeLessThanOrEqual(w + 1e-6);
      expect(availH).toBeLessThanOrEqual(h + 1e-6);
      expect(Math.max(availW / w, availH / h)).toBeGreaterThanOrEqual(FIT_MIN_AVAILABLE - 1e-6);
      expect(c.minX).toBeGreaterThanOrEqual(-1e-6);
      expect(c.minY).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('tamaño cero, márgenes negativos o no finitos no dan NaN', () => {
    const doc = makeDoc();
    const vp = fitToDocInsets(doc, 0, 0, { top: -5, right: Number.NaN, bottom: Infinity, left: 10 });
    expect([vp.scale, vp.tx, vp.ty].every(Number.isFinite)).toBe(true);
    expect(vp.scale).toBeGreaterThan(0);
  });
});

describe('rejilla mayor', () => {
  it('marca las líneas múltiplo de 5 pasos, en x y en y', () => {
    const vp = { scale: 10, tx: 20, ty: 300, width: 800, height: 600 };
    const g = gridLines(vp);
    const major = g.vertical.filter((l) => isMajorGridLine(vp, 'x', l.px, g.step));
    expect(major.length).toBeGreaterThan(0);
    expect(major.length).toBeLessThan(g.vertical.length);
    for (const l of major) expect(Math.round(Number(l.label.replace(',', '.')) / g.step) % 5).toBe(0);
    for (const l of g.vertical) {
      const n = Math.round(Number(l.label.replace(',', '.')) / g.step);
      expect(isMajorGridLine(vp, 'x', l.px, g.step)).toBe(n % 5 === 0);
    }
    for (const l of g.horizontal) {
      const n = Math.round(Number(l.label.replace(',', '.')) / g.step);
      expect(isMajorGridLine(vp, 'y', l.px, g.step)).toBe(n % 5 === 0);
    }
  });

  it('el cero y los negativos múltiplos de 5 pasos también son mayores; paso o escala inválidos, no', () => {
    const vp = { scale: 10, tx: 0, ty: 0, width: 800, height: 600 };
    expect(isMajorGridLine(vp, 'x', 0, 10)).toBe(true);
    expect(isMajorGridLine(vp, 'x', -500, 10)).toBe(true);
    expect(isMajorGridLine(vp, 'x', 100, 10)).toBe(false);
    expect(isMajorGridLine(vp, 'x', 0, 0)).toBe(false);
    expect(isMajorGridLine({ ...vp, scale: 0 }, 'x', 0, 10)).toBe(false);
  });
});

describe('píldora de coordenadas', () => {
  it('«x 41,32 m · y 29,76 m»: dos decimales, coma y unidades del documento', () => {
    expect(coordinateReadout([41.32, 29.76])).toBe('x 41,32 m · y 29,76 m');
    expect(coordinateReadout([41.3249, 29.7551], 'SI')).toBe('x 41,32 m · y 29,76 m');
    expect(coordinateReadout([103, -8.2], 'imperial')).toBe('x 103,00 ft · y -8,20 ft');
    expect(coordinateReadout([0, -0.0001])).toBe('x 0,00 m · y 0,00 m');
  });
});
