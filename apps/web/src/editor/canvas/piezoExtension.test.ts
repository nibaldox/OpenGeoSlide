import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';
import { modelXRange, piezoExtension } from './piezoExtension';

// Misma regla que `PreparedModel::piezometric_y` (crates/ogs-core/src/geometry.rs:621-627): fuera del rango de x de la línea se usa el
// valor del extremo más cercano, y el modelo va de x_min a x_max de los vértices de todas las regiones (geometry.rs:533-557).
function engineY(line: Point[], x: number): number {
  const first = line[0]!;
  const last = line[line.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  const i = line.findIndex((p) => p[0] > x);
  const a = line[i - 1]!;
  const b = line[i]!;
  return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
}

describe('R9-05d: tramo extrapolado de la piezométrica', () => {
  it('el rango del modelo es el de los vértices de todas las regiones', () => {
    expect(modelXRange(makeDoc())).toEqual([0, 60]);
    expect(modelXRange({ ...makeDoc(), regions: [] })).toBeNull();
  });

  it('una piezométrica que cubre todo el ancho no tiene tramo extrapolado', () => {
    expect(piezoExtension(makeDoc())).toBeNull();
  });

  it('una piezométrica corta se prolonga en horizontal con el valor del extremo, hasta los bordes del modelo', () => {
    const doc = makeDoc();
    doc.water = { unit_weight: 9.81, piezometric_line: [[10, 8], [30, 8], [50, 6]] };
    const ext = piezoExtension(doc);
    expect(ext).toEqual({ left: [[0, 8], [10, 8]], right: [[50, 6], [60, 6]] });
    // Coincide con lo que el motor evalúa en esos x.
    const line = doc.water.piezometric_line as Point[];
    for (const seg of [ext!.left!, ext!.right!]) for (const [x, y] of seg) expect(engineY(line, x)).toBe(y);
  });

  it('solo un lado: sale únicamente el tramo que falta', () => {
    const doc = makeDoc();
    doc.water = { unit_weight: 9.81, piezometric_line: [[0, 8], [40, 7]] };
    expect(piezoExtension(doc)).toEqual({ left: null, right: [[40, 7], [60, 7]] });
    doc.water = { unit_weight: 9.81, piezometric_line: [[20, 8], [60, 7]] };
    expect(piezoExtension(doc)).toEqual({ left: [[0, 8], [20, 8]], right: null });
  });

  it('sin piezométrica, con menos de 2 puntos o sin regiones no hay tramo', () => {
    const doc = makeDoc();
    doc.water = { unit_weight: 9.81 };
    expect(piezoExtension(doc)).toBeNull();
    doc.water = null;
    expect(piezoExtension(doc)).toBeNull();
    doc.water = { unit_weight: 9.81, piezometric_line: [[10, 8]] };
    expect(piezoExtension(doc)).toBeNull();
    expect(piezoExtension({ ...makeDoc(), regions: [] })).toBeNull();
  });

  it('el lienzo dibuja el tramo con trazo distinto (punteado), sin tiradores, y no lo dibuja si la línea cubre el modelo', () => {
    const render = (patch: (d: ReturnType<typeof makeDoc>) => void): string => {
      const doc = makeDoc();
      patch(doc);
      return renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(doc, {}) }));
    };
    const short = render((d) => {
      d.water = { unit_weight: 9.81, piezometric_line: [[10, 8], [30, 8], [50, 6]] };
    });
    expect(short).toContain('data-layer="piezometric-extrapolated"');
    expect((short.match(/data-piezo-extrapolated="(left|right)"/g) ?? []).length).toBe(2);
    expect(short).toContain('data-piezo-extrapolated="left"');
    expect((short.match(/data-handle="piezo_point"/g) ?? []).length).toBe(3); // el tramo extrapolado no se edita
    const layer = /<g data-layer="piezometric-extrapolated"[^>]*>([\s\S]*?)<\/g>/.exec(short)?.[1] ?? '';
    expect(layer).toMatch(/stroke-dasharray="1 5"/); // distinto del "8 4" de la línea definida
    expect(layer).toContain('var(--canvas-piezo)');
    expect(render(() => undefined)).not.toContain('piezometric-extrapolated');
  });
});
