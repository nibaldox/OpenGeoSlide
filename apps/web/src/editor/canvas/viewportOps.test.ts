import { describe, expect, it } from 'vitest';
import { screenToWorld, worldToScreen } from '../../geometry/viewport';
import { VP } from './fakeStore';
import { MAX_SCALE, ZOOM_STEP, ensureVisible, pinchViewport, zoomStep } from './viewportOps';

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
