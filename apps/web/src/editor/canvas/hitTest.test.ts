import { describe, expect, it } from 'vitest';
import { makeDoc, toPx, VP } from './fakeStore';
import { hitTest, radiusHandlePoint } from './hitTest';

const R = 10;
const hit = (doc = makeDoc(), x = 0, y = 0) => hitTest(doc, VP, x, y, R);

describe('hitTest', () => {
  it('encuentra un vértice dentro de la tolerancia en píxeles', () => {
    const [sx, sy] = toPx(60, 0);
    expect(hit(undefined, sx + 3, sy - 4)).toMatchObject({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
    // a 11 px ya no es tirador: cae sobre la arista (borde del modelo)
    expect(hit(undefined, sx - 9, sy + 6).kind).not.toBe('vertex');
  });

  it('en vértices coincidentes gana el de la región de menor índice', () => {
    const [sx, sy] = toPx(0, 5);
    expect(hit(undefined, sx, sy)).toMatchObject({ kind: 'vertex', regionIndex: 0, vertexIndex: 3 });
  });

  it('el tirador más cercano gana', () => {
    const doc = makeDoc();
    doc.regions[1].polygon[4] = [20.5, 20]; // a 5 px del vértice (20,20) original... lo movemos a 0,5 m
    const [sx, sy] = toPx(20.4, 20);
    expect(hit(doc, sx, sy)).toMatchObject({ kind: 'vertex', regionIndex: 1, vertexIndex: 4 });
  });

  it('arista: devuelve índice, proyección y distancia', () => {
    const [sx, sy] = toPx(30, 0);
    const h = hit(undefined, sx, sy + 4); // 4 px bajo la arista y = 0
    expect(h.kind).toBe('edge');
    if (h.kind === 'edge') {
      expect(h.regionIndex).toBe(0);
      expect(h.afterIndex).toBe(0);
      expect(h.point[0]).toBeCloseTo(30, 9);
      expect(h.point[1]).toBeCloseTo(0, 9);
      expect(h.distPx).toBeCloseTo(4, 9);
    }
  });

  it('arista de cierre del polígono: afterIndex = último vértice', () => {
    const [sx, sy] = toPx(0, 12);
    const h = hit(undefined, sx - 3, sy); // arista izquierda de la región 1: (0,20)->(0,5)
    expect(h).toMatchObject({ kind: 'edge', regionIndex: 1, afterIndex: 5 });
  });

  it('punto de la piezométrica y segmento de la piezométrica', () => {
    const [px, py] = toPx(30, 8);
    expect(hit(undefined, px + 2, py)).toMatchObject({ kind: 'piezo_point', index: 1 });
    const [qx, qy] = toPx(45, 7);
    const h = hit(undefined, qx, qy - 3);
    expect(h).toMatchObject({ kind: 'piezo_edge', afterIndex: 1 });
  });

  it('círculo: centro y tirador del radio', () => {
    const doc = makeDoc();
    const [cx, cy] = toPx(30, 30);
    expect(hit(doc, cx + 2, cy)).toMatchObject({ kind: 'circle_center' });
    const rp = radiusHandlePoint({ xc: 30, yc: 30, r: 25 });
    const [rx, ry] = toPx(rp[0], rp[1]);
    expect(hit(doc, rx, ry + 3)).toMatchObject({ kind: 'circle_radius' });
  });

  it('bandas de búsqueda sobre el terreno: por debajo de los tiradores y por encima de las aristas', () => {
    const doc = makeDoc();
    doc.analysis.search = { type: 'circular_entry_exit', entry: [0, 10], exit: [45, 55] };
    const [ex, ey] = toPx(5, 20);
    expect(hit(doc, ex, ey - 8)).toEqual({ kind: 'search_range', which: 'entry' });
    const [sx, sy] = toPx(50, 10);
    expect(hit(doc, sx, sy - 8)).toEqual({ kind: 'search_range', which: 'exit' });
    // en add_vertex las bandas se desactivan y gana la arista del terreno
    expect(hitTest(doc, VP, ex, ey - 8, R, { bands: false }).kind).toBe('edge');
    // justo sobre la arista del terreno, la banda (que llega 4 px por debajo) también cubre
    expect(hit(doc, ex, ey).kind).toBe('search_range');
    // fuera del rango x no hay banda
    const [fx, fy] = toPx(15, 20);
    expect(hit(doc, fx, fy - 8).kind).toBe('edge');
    expect(hit(doc, fx, fy - 12).kind).toBe('none');
  });

  it('interior de región: la última región dibujada queda encima; fuera no hay nada', () => {
    const [ix, iy] = toPx(10, 12);
    expect(hit(undefined, ix, iy)).toEqual({ kind: 'region', regionIndex: 1 });
    const [lx, ly] = toPx(30, 2.5);
    expect(hit(undefined, lx, ly)).toEqual({ kind: 'region', regionIndex: 0 });
    const [ox, oy] = toPx(30, 40);
    expect(hit(makeDocSinCirculo(), ox, oy)).toEqual({ kind: 'none' });
  });
});

function makeDocSinCirculo() {
  const d = makeDoc();
  d.analysis.surface = null;
  return d;
}
