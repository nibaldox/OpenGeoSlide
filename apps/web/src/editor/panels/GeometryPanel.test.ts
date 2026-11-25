// Pruebas del panel «Geometría» (render estático con el store real) y de los comandos de la tabla de vértices contra el reductor.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { makeDoc } from '../canvas/fakeStore';
import { createEditorStore } from '../state';
import { applyCommands } from './dispatch';
import { GeometryPanel } from './GeometryPanel';
import { PAGE_SIZE, vertexCoordEdit, vertexInsertCommand, vertexRemoveCommand } from './geometry';

const render = (store: ReturnType<typeof createEditorStore>): string => renderToStaticMarkup(createElement(GeometryPanel, { store }));

describe('GeometryPanel (render estático)', () => {
  it('lista las regiones con su material, «Seleccionar en el lienzo» y «Eliminar región»', () => {
    const html = render(createEditorStore(makeDoc()));
    expect(html).toContain('Geometría');
    expect((html.match(/data-region-card=/g) ?? []).length).toBe(2);
    expect(html).toContain('Material de la región 1');
    expect(html).toContain('data-path="/regions/1/material"');
    expect(html).toContain('Seleccionar en el lienzo');
    expect(html).toContain('aria-label="Eliminar región 2"');
    expect(html).toContain('>Eliminar región<');
  });
  it('cada región muestra su material con su muestra de color (el tono del lienzo) y hay un botón «Dividir región…»', () => {
    const html = render(createEditorStore(makeDoc()));
    // región 1 = m2 (Roca, índice 1); región 2 = m1 (Arcilla, índice 0)
    expect(html).toMatch(/data-testid="region-material-0"[^>]*><span class="gp-swatch" data-swatch="1" style="background:var\(--canvas-mat-1\)" aria-hidden="true"><\/span>Roca/);
    expect(html).toMatch(/data-testid="region-material-1"[^>]*><span class="gp-swatch" data-swatch="0" style="background:var\(--canvas-mat-0\)" aria-hidden="true"><\/span>Arcilla/);
    expect(html).toContain('>Dividir región…<');
  });
  it('la tabla muestra los vértices de la región con x e y editables y sus acciones', () => {
    const store = createEditorStore(makeDoc());
    store.dispatch({ type: 'ui/select', selection: { kind: 'region', regionIndex: 1 } });
    const html = render(store);
    expect(html).toContain('Vértices de la región 2');
    expect((html.match(/data-vertex-row=/g) ?? []).length).toBe(6);
    expect(html).toContain('data-path="/regions/1/polygon/4/x"');
    expect(html).toContain('aria-label="Región 2, vértice 5: y"');
    expect(html).toContain('aria-label="Agregar después del vértice 5 de la región 2"');
    expect(html).toContain('aria-label="Eliminar el vértice 5 de la región 2"');
    expect(html).toMatch(/<table[^>]*aria-labelledby="gp-vertices-title"/);
  });
  it('un vértice seleccionado en el lienzo resalta su fila', () => {
    const store = createEditorStore(makeDoc());
    store.dispatch({ type: 'ui/select', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 2 } });
    expect(render(store)).toMatch(/<tr class="ep-row-selected" aria-current="true" data-vertex-row="2">/);
  });
  it('sin regiones: explica cómo crearlas y no hay tabla', () => {
    const store = createEditorStore({ ...makeDoc(), regions: [] });
    const html = render(store);
    expect(html).toContain('data-testid="geometry-empty"');
    expect(html).toContain('Dibujar región');
    expect(html).not.toContain('data-vertex-row');
  });
  it('con cientos de vértices la tabla se pagina (no pinta todas las filas)', () => {
    const big: Point[] = [];
    for (let i = 0; i < 360; i += 1) big.push([Math.cos((i / 360) * 2 * Math.PI) * 50, Math.sin((i / 360) * 2 * Math.PI) * 50]);
    const store = createEditorStore({ ...makeDoc(), regions: [{ material: 'm1', polygon: big }] });
    const html = render(store);
    expect((html.match(/data-vertex-row=/g) ?? []).length).toBe(PAGE_SIZE);
    expect(html).toContain('Vértices 1 a 100 de 360');
    expect(html).toContain('página 1 de 4');
    expect(html).toContain('Siguiente');
  });
  it('el ajuste ofrece la rejilla y los dos interruptores', () => {
    const html = render(createEditorStore(makeDoc()));
    expect(html).toContain('Rejilla de ajuste');
    expect(html).toContain('Sin rejilla');
    expect(html).toContain('Ajustar a los vértices existentes');
  });
  it('no escribe colores literales', () => {
    expect(render(createEditorStore(makeDoc()))).not.toMatch(/(#[0-9a-fA-F]{3,8}\b|rgba?\()/);
  });
});

describe('comandos de la tabla contra el reductor y el historial', () => {
  it('editar un vértice compartido mueve a los dos y un solo Deshacer los devuelve', () => {
    const store = createEditorStore(makeDoc());
    const r = vertexCoordEdit(store.getState().doc, { regionIndex: 0, vertexIndex: 3 }, 'y', '6');
    expect(r.ok).toBe(true);
    if (r.ok) applyCommands(store, 'Editar coordenadas del vértice', r.commands);
    expect(store.getState().doc.regions[0]!.polygon[3]).toEqual([0, 6]);
    expect(store.getState().doc.regions[1]!.polygon[0]).toEqual([0, 6]);
    expect(store.getState().history.past).toHaveLength(1);
    store.undo();
    expect(store.getState().doc.regions[0]!.polygon[3]).toEqual([0, 5]);
    expect(store.getState().doc.regions[1]!.polygon[0]).toEqual([0, 5]);
  });
  it('agregar después y eliminar son un paso cada uno', () => {
    const store = createEditorStore(makeDoc());
    store.dispatch(vertexInsertCommand(store.getState().doc, 0, 0)!);
    expect(store.getState().doc.regions[0]!.polygon).toHaveLength(5);
    expect(store.getState().doc.regions[0]!.polygon[1]).toEqual([30, 0]);
    store.dispatch(vertexRemoveCommand(store.getState().doc, 0, 1)!);
    expect(store.getState().doc.regions[0]!.polygon).toHaveLength(4);
    expect(store.getState().history.past).toHaveLength(2);
  });
  it('eliminar una región renumera la selección y se deshace', () => {
    const store = createEditorStore(makeDoc());
    store.dispatch({ type: 'ui/select', selection: { kind: 'region', regionIndex: 1 } });
    store.dispatch({ type: 'region/remove', regionIndex: 0 });
    expect(store.getState().ui.selection).toEqual({ kind: 'region', regionIndex: 0 });
    store.undo();
    expect(store.getState().doc.regions).toHaveLength(2);
  });
});
