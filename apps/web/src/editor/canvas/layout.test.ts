import { describe, expect, it } from 'vitest';
import { createFakeStore, makeDoc, toPx, VP } from './fakeStore';
import {
  circleCenterLabel,
  circleRadiusLabel,
  formatNumber,
  gridLines,
  lengthUnitOf,
  loadShapes,
  niceStep,
  piezoLabel,
  rangeBand,
  rangeLabel,
  seismicBadge,
  seismicLabel,
  slideDirection,
  vertexLabel,
} from './layout';
import { docBounds, fitToDoc, panBy, resizeViewport, wheelFactor, zoomAt } from './viewportOps';
import { screenToWorld, worldToScreen } from '../../geometry/viewport';

describe('formato en español', () => {
  it('coma decimal, mínimo de decimales y recorte de ceros', () => {
    expect(formatNumber(30)).toBe('30,0');
    expect(formatNumber(30.25)).toBe('30,25');
    expect(formatNumber(30.123456)).toBe('30,123');
    expect(formatNumber(-0.0001)).toBe('0,0');
    expect(formatNumber(0.1, 2, 4)).toBe('0,10');
    expect(formatNumber(5, 0, 0)).toBe('5');
    expect(formatNumber(NaN)).toBe('—');
  });

  it('aria-label de vértices como en X3 §2.3', () => {
    expect(vertexLabel(0, 2, [30, 25])).toBe('Región 1, vértice 3: x 30,0 m, y 25,0 m');
    expect(piezoLabel(0, [1.5, 2])).toBe('Piezométrica, punto 1: x 1,5 m, y 2,0 m');
  });

  it('las etiquetas accesibles usan la unidad del modelo: m en SI, ft en imperial (R7-22)', () => {
    expect(lengthUnitOf(undefined)).toBe('m');
    expect(lengthUnitOf('SI')).toBe('m');
    expect(lengthUnitOf('imperial')).toBe('ft');
    expect(lengthUnitOf(null)).toBe('m');
    expect(vertexLabel(0, 2, [30, 25], 'imperial')).toBe('Región 1, vértice 3: x 30,0 ft, y 25,0 ft');
    expect(piezoLabel(0, [1.5, 2], 'imperial')).toBe('Piezométrica, punto 1: x 1,5 ft, y 2,0 ft');
    expect(circleCenterLabel(45, 38.75)).toBe('Círculo de falla, centro: x 45,0 m, y 38,75 m');
    expect(circleCenterLabel(45, 38.75, 'imperial')).toBe('Círculo de falla, centro: x 45,0 ft, y 38,75 ft');
    expect(circleRadiusLabel(25)).toBe('Círculo de falla, radio: 25,0 m');
    expect(circleRadiusLabel(25, 'imperial')).toBe('Círculo de falla, radio: 25,0 ft');
    expect(rangeLabel('entry', [10, 0])).toBe('Entrada: x 0,0 a 10,0 m');
    expect(rangeLabel('exit', [0, 10], 'imperial')).toBe('Salida: x 0,0 a 10,0 ft');
    // Con unidades imperiales ninguna etiqueta conserva la «m».
    for (const label of [vertexLabel(0, 0, [1, 2], 'imperial'), piezoLabel(0, [1, 2], 'imperial'), circleCenterLabel(1, 2, 'imperial'), circleRadiusLabel(1, 'imperial'), rangeLabel('entry', [0, 1], 'imperial')]) {
      expect(label, label).not.toMatch(/\d m\b/);
    }
  });

  it('indicador sísmico «kh = … · kv = …»', () => {
    expect(seismicLabel({ kh: 0.1, kv: 0 })).toBe('kh = 0,10 · kv = 0,00');
    expect(seismicLabel({ kh: 0.125, kv: -0.05 })).toBe('kh = 0,125 · kv = -0,05');
    expect(seismicLabel({})).toBe('kh = 0,00 · kv = 0,00');
  });

  it('sentido de deslizamiento: explícito o, con auto, hacia el lado bajo', () => {
    const doc = makeDoc();
    expect(slideDirection(doc)).toBe(1);
    doc.slope = { direction: 'right_to_left' };
    expect(slideDirection(doc)).toBe(-1);
    doc.slope = { direction: 'auto' };
    expect(slideDirection(doc)).toBe(1); // izquierda más alta
    doc.slope = undefined;
    expect(slideDirection(doc)).toBe(1);
  });
});

describe('rejilla', () => {
  it('paso 1-2-5 con al menos 70 px entre líneas', () => {
    expect(niceStep(10)).toBe(10);
    expect(niceStep(100)).toBe(1);
    expect(niceStep(3)).toBe(50);
    expect(niceStep(1000)).toBe(0.1);
  });

  it('líneas dentro de la pantalla con etiquetas en coma decimal', () => {
    const g = gridLines(VP);
    expect(g.step).toBe(10);
    expect(g.vertical.every((l) => l.px >= 0 && l.px <= VP.width)).toBe(true);
    expect(g.vertical[0]).toEqual({ px: toPx(0, 0)[0], label: '0' });
    const fine = gridLines({ ...VP, scale: 1000 });
    expect(fine.step).toBe(0.1);
    expect(fine.vertical.some((l) => /,/.test(l.label))).toBe(true);
  });
});

describe('bandas de búsqueda', () => {
  it('siguen el terreno e incluyen los vértices intermedios', () => {
    const doc = makeDoc();
    doc.analysis.search = { type: 'circular_entry_exit', entry: [10, 30] };
    const band = rangeBand(doc, VP, 'entry');
    expect(band).not.toBeNull();
    // inferior: x=10 (y 20), x=20 (vértice, y 20), x=30 (y 15); superior igual 14 px más arriba, en orden inverso
    expect(band).toHaveLength(6);
    expect(band?.[0]).toEqual(toPx(10, 20));
    expect(band?.[1]).toEqual(toPx(20, 20));
    expect(band?.[2]).toEqual(toPx(30, 15));
    expect(band?.[3]).toEqual([toPx(30, 15)[0], toPx(30, 15)[1] - 14]);
    expect(rangeBand(doc, VP, 'exit')).toBeNull();
  });
});

describe('cargas', () => {
  it('udl: flechas verticales hacia el terreno en el rango x1..x2', () => {
    const doc = makeDoc();
    doc.loads = [{ type: 'udl', id: 'u1', x1: 40, x2: 60, q: 20 }];
    const [s] = loadShapes(doc, VP);
    expect(s.kind).toBe('udl');
    if (s.kind !== 'udl') return;
    expect(s.arrows.length).toBe(Math.round((20 * VP.scale) / 24) + 1);
    const first = s.arrows[0];
    const [px, py] = toPx(40, 10);
    expect([first.x2, first.y2]).toEqual([px, py]);
    expect(first.x1).toBe(first.x2);
    expect(first.y1).toBe(first.y2 - 26);
    expect(s.label.text).toBe('q = 20,0 kPa');
  });

  it('line: la flecha termina en el terreno y se inclina hacia +x con ángulo positivo', () => {
    const doc = makeDoc();
    doc.loads = [
      { type: 'line', x: 50, p: 15, angle: 0 },
      { type: 'line', x: 50, p: 15, angle: 30 },
    ];
    const [vertical, tilted] = loadShapes(doc, VP);
    if (vertical.kind !== 'line' || tilted.kind !== 'line') throw new Error('se esperaban cargas lineales');
    const tip = toPx(50, 10);
    expect([vertical.arrow.x2, vertical.arrow.y2]).toEqual(tip);
    expect(vertical.arrow.x1).toBeCloseTo(tip[0], 9);
    expect(vertical.arrow.y1).toBeCloseTo(tip[1] - 46, 9);
    // con +30°, la carga viaja hacia +x: la cola queda a la izquierda de la punta
    expect(tilted.arrow.x1).toBeLessThan(tilted.arrow.x2);
    expect(tilted.arrow.x2 - tilted.arrow.x1).toBeCloseTo(46 * Math.sin(Math.PI / 6), 9);
    expect(tilted.label.text).toBe('p = 15,0 kN/m · 30°');
  });

  it('unidades imperiales y cargas fuera del terreno', () => {
    const doc = makeDoc();
    doc.units = 'imperial';
    doc.loads = [{ type: 'udl', x1: 40, x2: 60, q: 20 }, { type: 'line', x: 500, p: 1, angle: 0 }];
    const shapes = loadShapes(doc, VP);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].kind === 'udl' && shapes[0].label.text).toBe('q = 20,0 psf');
  });
});

describe('viewportOps', () => {
  it('zoomAt mantiene fijo el punto bajo el cursor y acota la escala', () => {
    const before = screenToWorld(VP, 300, 200);
    const z = zoomAt(VP, 300, 200, 2);
    expect(z.scale).toBe(20);
    const after = screenToWorld(z, 300, 200);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
    expect(zoomAt(VP, 0, 0, 1e9).scale).toBe(1e5);
    expect(zoomAt(VP, 0, 0, 1e-9).scale).toBe(0.01);
  });

  it('panBy, wheelFactor, docBounds y fitToDoc', () => {
    expect(panBy(VP, 5, -3)).toEqual({ ...VP, tx: 25, ty: 297 });
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
    expect(docBounds(makeDoc())).toEqual({ minX: 0, maxX: 60, minY: 0, maxY: 20 });
    const empty = makeDoc();
    empty.regions = [];
    empty.water = null;
    expect(docBounds(empty)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
    const fit = fitToDoc(makeDoc(), 800, 600, 48);
    expect(fit.scale).toBeCloseTo(Math.min(704 / 60, 504 / 20), 9);
  });

  it('fitToDoc centra el modelo con el mismo margen a izquierda y derecha, y arriba y abajo', () => {
    for (const [w, h] of [[800, 600], [1400, 700], [500, 900]] as const) {
      const fit = fitToDoc(makeDoc(), w, h, 48);
      const [left, top] = worldToScreen(fit, 0, 20);
      const [right, bottom] = worldToScreen(fit, 60, 0);
      expect(left).toBeCloseTo(w - right, 6);
      expect(top).toBeCloseTo(h - bottom, 6);
      expect(Math.min(left, top)).toBeGreaterThanOrEqual(48 - 1e-9);
    }
  });

  it('resizeViewport conserva el centro: un modelo centrado en 800 × 600 sigue centrado al medir 1400 × 700', () => {
    const resized = resizeViewport(fitToDoc(makeDoc(), 800, 600, 48), 1400, 700);
    expect(resized.width).toBe(1400);
    expect(resized.height).toBe(700);
    const [left] = worldToScreen(resized, 0, 20);
    const [right] = worldToScreen(resized, 60, 0);
    expect(left).toBeCloseTo(1400 - right, 6);
    const [wx, wy] = screenToWorld(resized, 700, 350);
    expect(wx).toBeCloseTo(30, 6);
    expect(wy).toBeCloseTo(10, 6);
  });
});

describe('indicador de sismo', () => {
  it('va en la esquina superior derecha, dentro del lienzo y lejos de las etiquetas del eje Y (x = 4)', () => {
    for (const width of [800, 1400, 320]) {
      const b = seismicBadge({ width }, 1);
      expect(b.x).toBeGreaterThanOrEqual(Math.min(width - 206, 10));
      expect(b.x).toBeGreaterThan(30); // las etiquetas del eje Y ocupan x ≈ 4 a 30
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(b.y).toBeLessThanOrEqual(10);
    }
  });

  it('la flecha apunta en el sentido del deslizamiento y queda dentro del recuadro', () => {
    const right = seismicBadge({ width: 800 }, 1);
    const left = seismicBadge({ width: 800 }, -1);
    expect(right.arrowX2).toBeGreaterThan(right.arrowX1);
    expect(left.arrowX2).toBeLessThan(left.arrowX1);
    for (const b of [right, left]) {
      expect(Math.min(b.arrowX1, b.arrowX2)).toBeGreaterThanOrEqual(b.x);
      expect(Math.max(b.arrowX1, b.arrowX2)).toBeLessThanOrEqual(b.x + b.width);
      expect(b.arrowY).toBeLessThan(b.y + b.height);
    }
  });
});

describe('fake store', () => {
  it('es utilizable como EditorStore (suscripción y estado estable)', () => {
    const s = createFakeStore();
    let n = 0;
    const off = s.subscribe(() => n++);
    s.dispatch({ type: 'ui/tool', tool: 'pan' });
    expect(n).toBe(1);
    off();
    s.dispatch({ type: 'ui/tool', tool: 'select' });
    expect(n).toBe(1);
    // la instantánea es estable mientras no cambie nada y nueva después de un cambio
    const a = s.getState();
    expect(s.getState()).toBe(a);
    s.dispatch({ type: 'ui/tool', tool: 'pan' });
    expect(s.getState()).not.toBe(a);
  });
});
