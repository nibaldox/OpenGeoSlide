import { describe, expect, it } from 'vitest';
import { screenToWorld, worldToScreen } from '../../geometry/viewport';
import { VP } from './fakeStore';
import { EDGE_SCROLL_MAX_PX, EDGE_SCROLL_ZONE_PX, MAX_SCALE, ZOOM_STEP, edgeScrollDelta, ensureVisible, paddedBounds, pinchViewport, revealCursor, zoomStep } from './viewportOps';

describe('zoom y encuadre por teclado y botones', () => {
  it('zoomStep acerca y aleja por ZOOM_STEP manteniendo fijo el punto ancla', () => {
    const anchor: [number, number] = [200, 100];
    const w0 = screenToWorld(VP, anchor[0], anchor[1]);
    const inn = zoomStep(VP, 1, anchor);
    expect(inn.scale).toBeCloseTo(VP.scale * ZOOM_STEP, 9);
    const w1 = screenToWorld(inn, anchor[0], anchor[1]);
    expect(w1[0]).toBeCloseTo(w0[0], 9);
    expect(w1[1]).toBeCloseTo(w0[1], 9);
    expect(zoomStep(VP, -1, anchor).scale).toBeCloseTo(VP.scale / ZOOM_STEP, 9);
  });

  it('sin ancla el zoom es alrededor del centro del lienzo', () => {
    const c: [number, number] = [VP.width / 2, VP.height / 2];
    const w0 = screenToWorld(VP, c[0], c[1]);
    const w1 = screenToWorld(zoomStep(VP, 1), c[0], c[1]);
    expect(w1[0]).toBeCloseTo(w0[0], 9);
    expect(w1[1]).toBeCloseTo(w0[1], 9);
  });

  it('la escala queda acotada', () => {
    expect(zoomStep({ ...VP, scale: MAX_SCALE }, 1).scale).toBe(MAX_SCALE);
  });

  it('ensureVisible no mueve la vista si el punto está dentro y la centra en él si queda fuera', () => {
    expect(ensureVisible(VP, 400, 300, 24)).toBe(VP);
    const moved = ensureVisible(VP, 900, 300, 24);
    expect(moved).not.toBe(VP);
    expect(moved.scale).toBe(VP.scale);
    // el punto que estaba en (900, 300) ahora queda en el centro
    const [wx, wy] = screenToWorld(VP, 900, 300);
    const [sx, sy] = worldToScreen(moved, wx, wy);
    expect(sx).toBeCloseTo(VP.width / 2, 9);
    expect(sy).toBeCloseTo(VP.height / 2, 9);
  });
});

describe('pellizco con dos punteros', () => {
  it('separar los dedos acerca alrededor del punto medio; el punto medio queda bajo los dedos', () => {
    const prev: [[number, number], [number, number]] = [[300, 300], [500, 300]];
    const next: [[number, number], [number, number]] = [[200, 300], [600, 300]];
    const vp = pinchViewport(VP, prev, next);
    expect(vp.scale).toBeCloseTo(VP.scale * 2, 9);
    const w = screenToWorld(VP, 400, 300);
    const [sx, sy] = worldToScreen(vp, w[0], w[1]);
    expect(sx).toBeCloseTo(400, 9);
    expect(sy).toBeCloseTo(300, 9);
  });

  it('juntar los dedos aleja; arrastrar con los dos dedos desplaza la vista', () => {
    const closer = pinchViewport(VP, [[200, 300], [600, 300]], [[300, 300], [500, 300]]);
    expect(closer.scale).toBeCloseTo(VP.scale / 2, 9);
    const pan = pinchViewport(VP, [[300, 300], [500, 300]], [[330, 320], [530, 320]]);
    expect(pan.scale).toBeCloseTo(VP.scale, 9);
    expect(pan.tx - VP.tx).toBeCloseTo(30, 9);
    expect(pan.ty - VP.ty).toBeCloseTo(20, 9);
  });

  it('dedos superpuestos (distancia 0) no rompen la escala', () => {
    const vp = pinchViewport(VP, [[300, 300], [300, 300]], [[310, 300], [320, 300]]);
    expect(Number.isFinite(vp.scale)).toBe(true);
    expect(vp.scale).toBeCloseTo(VP.scale, 9);
  });
});

describe('autodesplazamiento y espacio al dibujar (UX9-01)', () => {
  it('edgeScrollDelta: nulo en el interior, hacia el lado contrario del borde que se toca y creciente al acercarse', () => {
    expect(edgeScrollDelta(800, 600, 400, 300)).toEqual([0, 0]);
    expect(edgeScrollDelta(800, 600, 24, 300)).toEqual([0, 0]); // justo a 24 px: aún no
    const [dxNear] = edgeScrollDelta(800, 600, 12, 300);
    const [dxEdge] = edgeScrollDelta(800, 600, 0, 300);
    expect(dxNear).toBeGreaterThan(0); // borde izquierdo: el contenido va a la derecha
    expect(dxEdge).toBeGreaterThan(dxNear);
    expect(edgeScrollDelta(800, 600, 799, 300)[0]).toBeLessThan(0);
    expect(edgeScrollDelta(800, 600, 400, 599)[1]).toBeLessThan(0); // borde inferior: el contenido sube y aparece lo de abajo
    expect(edgeScrollDelta(800, 600, 400, 1)[1]).toBeGreaterThan(0);
    expect(edgeScrollDelta(800, 600, 0, 0)).toEqual([EDGE_SCROLL_MAX_PX, EDGE_SCROLL_MAX_PX]);
  });
  it('edgeScrollDelta: un lienzo diminuto no se desplaza solo', () => {
    expect(edgeScrollDelta(40, 40, 2, 2)).toEqual([0, 0]);
  });
  it('revealCursor deja la vista igual dentro de los 24 px y, fuera, deja el punto bien adentro del borde', () => {
    expect(revealCursor(VP, 400, 300)).toBe(VP);
    expect(revealCursor(VP, 24, 300)).toBe(VP);
    const moved = revealCursor(VP, 700 + 90, 580);
    expect(moved).not.toBe(VP);
    expect(moved.scale).toBe(VP.scale);
    const [wx, wy] = screenToWorld(VP, 790, 580);
    const [sx, sy] = worldToScreen(moved, wx, wy);
    expect(sx).toBeLessThan(VP.width - EDGE_SCROLL_ZONE_PX);
    expect(sy).toBeLessThan(VP.height - EDGE_SCROLL_ZONE_PX);
    expect(sx).toBeGreaterThanOrEqual(EDGE_SCROLL_ZONE_PX);
  });
  it('paddedBounds deja 25 % del alto bajo la base y a los lados, y 10 % arriba', () => {
    expect(paddedBounds({ minX: 0, maxX: 60, minY: -10, maxY: 15 })).toEqual({ minX: -6.25, maxX: 66.25, minY: -16.25, maxY: 17.5 });
  });
});
