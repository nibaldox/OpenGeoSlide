// CM-WA: los cuatro defectos de borradores de la v0.5.x (1a a 1d), con los paneles reales sobre un renderizador mínimo
// (`hookHarness.ts`: estado, efectos y contexto de verdad, sin DOM). Cada prueba falla en la base y pasa con la corrección.
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('./hookHarness')).hookOverrides }));

import { makeDoc } from '../canvas/fakeStore';
import { shortcutFor } from '../app/shortcuts';
import { createEditorStore } from '../state';
import type { EditorStore, ModelDoc } from '../types';
import { AnalysisPanel } from './AnalysisPanel';
import { TextInput } from './Fields';
import { GeometryPanel } from './GeometryPanel';
import { SearchPanel } from './SearchPanel';
import { SeismicPanel } from './SeismicPanel';
import { SurfacePanel } from './SurfacePanel';
import { WaterPanel } from './WaterPanel';
import { ROWS_PENDING_NOTE, ROWS_PENDING_REASON, getPendingDrafts, hasPendingDrafts } from './forms';
import { changeEvent, keyEvent, mount, type Mounted } from './hookHarness';
import { DocEpochContext } from './useStoreSelector';

type Doc = ModelDoc;
const docWith = (patch: (d: Doc) => void): Doc => {
  const d = structuredClone(makeDoc()) as unknown as Doc;
  patch(d);
  return d;
};

/** Monta un panel como lo hace `EditorApp`: dentro del contexto de la época del documento. */
function mountPanel(store: EditorStore, panel: (props: { store: EditorStore }) => unknown): Mounted {
  return mount(() => createElement(DocEpochContext as never, { value: store.getState().docEpoch }, createElement(panel as never, { store })));
}
const type = (m: Mounted, node: { props: Record<string, any> }, value: string): void => m.act(() => node.props.onChange(changeEvent(value)));
const press = (m: Mounted, node: { props: Record<string, any> }, key: string, mods = {}): ReturnType<typeof keyEvent> => {
  const e = keyEvent(key, mods);
  m.act(() => node.props.onKeyDown(e));
  return e;
};
const blur = (m: Mounted, node: { props: Record<string, any> }): void => m.act(() => node.props.onBlur());
const disabled = (n: { props: Record<string, any> }): boolean => n.props.disabled === true;

describe('1a · los borradores se reinician al cambiar de documento (docEpoch), aunque el valor sea el mismo', () => {
  it('Sismo: kh inválido y «Nuevo» con sismo nulo antes y después → formulario vacío y sin borrador pendiente', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, SeismicPanel);
    const kh = '/analysis/seismic/kh';
    type(m, m.byPath(kh), 'abc');
    expect(m.byPath(kh).props.value).toBe('abc');
    expect(m.byPath(kh).props['aria-invalid']).toBe(true);
    expect(hasPendingDrafts(store)).toBe(true);

    store.dispatch({ type: 'doc/load', doc: makeDoc(), fileName: null }); // Nuevo: otro documento, seismic nulo en los dos
    expect(m.byPath(kh).props.value).toBe('');
    expect(m.byPath(kh).props['aria-invalid']).toBeUndefined();
    expect(hasPendingDrafts(store)).toBe(false);
  });

  it('Sismo: control, un kh aplicado se reinicia con «Nuevo» (ya funcionaba)', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, SeismicPanel);
    type(m, m.byPath('/analysis/seismic/kh'), '0,1');
    press(m, m.byPath('/analysis/seismic/kh'), 'Enter');
    expect(store.getState().doc.analysis.seismic).toMatchObject({ kh: 0.1 });
    store.dispatch({ type: 'doc/load', doc: makeDoc(), fileName: null });
    expect(m.byPath('/analysis/seismic/kh').props.value).toBe('');
  });

  it('Búsqueda: un campo inválido se reinicia al abrir otro documento con la misma búsqueda (misma referencia)', () => {
    const doc = docWith((d) => {
      d.analysis.search = { type: 'circular_entry_exit', entry: [10, 20], exit: [30, 40], n_entry: 20, n_exit: 20, n_radius: 20, max_radius_factor: 5, min_width: null, refine: true };
    });
    const store = createEditorStore(doc);
    const m = mountPanel(store, SearchPanel);
    const path = '/analysis/search/n_entry';
    expect(m.byPath(path).props.value).toBe('20');
    type(m, m.byPath(path), 'xx');
    expect(m.byPath(path).props.value).toBe('xx');
    expect(hasPendingDrafts(store)).toBe(true);
    store.dispatch({ type: 'doc/load', doc, fileName: 'otro.ogs.json' }); // «Abrir» entrega el mismo valor de búsqueda
    expect(m.byPath(path).props.value).toBe('20');
    expect(hasPendingDrafts(store)).toBe(false);
  });

  it('Análisis: un campo inválido se reinicia al cargar otro documento con los mismos ajustes (misma referencia)', () => {
    const doc = makeDoc();
    const store = createEditorStore(doc);
    const m = mountPanel(store, AnalysisPanel);
    const path = '/analysis/slices';
    const before = m.byPath(path).props.value;
    type(m, m.byPath(path), 'abc');
    expect(m.byPath(path).props.value).toBe('abc');
    store.dispatch({ type: 'doc/load', doc, fileName: null });
    expect(m.byPath(path).props.value).toBe(before);
  });
});

describe('1b · un borrador por eje en la fila de un vértice', () => {
  const xs = '/regions/0/polygon/0/x';
  const ys = '/regions/0/polygon/0/y';

  it('con y inválida, confirmar x no toca el texto de y ni su error', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, GeometryPanel);
    const y0 = m.byPath(ys).props.value;
    type(m, m.byPath(ys), 'abc');
    press(m, m.byPath(ys), 'Enter');
    expect(m.byPath(ys).props['aria-invalid']).toBe(true);
    type(m, m.byPath(xs), '7,5');
    press(m, m.byPath(xs), 'Enter');
    expect(store.getState().doc.regions[0]!.polygon[0]![0]).toBe(7.5);
    expect(m.byPath(xs).props.value).toBe('7,5');
    expect(m.byPath(ys).props.value).toBe('abc');
    expect(m.byPath(ys).props['aria-invalid']).toBe(true);
    expect(y0).not.toBe('abc');
    expect(hasPendingDrafts(store)).toBe(true);
  });

  it('con x inválida, confirmar y no toca el texto de x', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, GeometryPanel);
    type(m, m.byPath(xs), 'zz');
    type(m, m.byPath(ys), '3');
    press(m, m.byPath(ys), 'Enter');
    expect(store.getState().doc.regions[0]!.polygon[0]![1]).toBe(3);
    expect(m.byPath(xs).props.value).toBe('zz');
    expect(m.byPath(xs).props['aria-invalid']).toBe(true);
  });

  it('Esc sigue descartando la fila entera', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, GeometryPanel);
    const [x0, y0] = [m.byPath(xs).props.value, m.byPath(ys).props.value];
    type(m, m.byPath(xs), 'q');
    type(m, m.byPath(ys), 'w');
    press(m, m.byPath(ys), 'Escape');
    expect([m.byPath(xs).props.value, m.byPath(ys).props.value]).toEqual([x0, y0]);
    expect(hasPendingDrafts(store)).toBe(false);
  });
});

describe('1c · los botones de las tablas de puntos se deshabilitan con una fila pendiente', () => {
  it('piezométrica: «Agregar punto», «Quitar» y «Quitar piezométrica»', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, WaterPanel);
    const before = JSON.stringify(store.getState().doc.water);
    expect(disabled(m.byText('button', 'Agregar punto'))).toBe(false);
    expect(disabled(m.byText('button', 'Quitar piezométrica'))).toBe(false);
    expect(disabled(m.byLabel('Quitar el punto 1 de la piezométrica'))).toBe(false);

    type(m, m.byPath('/water/piezometric_line/0/y'), 'abc');
    const buttons = [m.byText('button', 'Agregar punto'), m.byText('button', 'Quitar piezométrica'), m.byLabel('Quitar el punto 1 de la piezométrica'), m.byLabel('Quitar el punto 3 de la piezométrica')];
    const note = m.find((n) => n.props['data-testid'] === 'rows-pending-note');
    expect(note?.props.id).toBeTruthy();
    expect(m.text()).toContain(ROWS_PENDING_NOTE);
    for (const b of buttons) {
      expect(disabled(b)).toBe(true);
      expect(b.props.title).toBe(ROWS_PENDING_REASON);
      expect(b.props['aria-describedby']).toBe(note!.props.id);
    }
    expect(JSON.stringify(store.getState().doc.water)).toBe(before);

    press(m, m.byPath('/water/piezometric_line/0/y'), 'Escape'); // descarta el borrador: vuelven a estar disponibles
    expect(m.find((n) => n.props['data-testid'] === 'rows-pending-note')).toBeUndefined();
    expect(disabled(m.byText('button', 'Agregar punto'))).toBe(false);
    expect(disabled(m.byText('button', 'Quitar piezométrica'))).toBe(false);
    expect(m.byText('button', 'Agregar punto').props['aria-describedby']).toBeUndefined();
  });

  it('piezométrica: con la fila corregida y confirmada, «Agregar punto» agrega', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, WaterPanel);
    type(m, m.byPath('/water/piezometric_line/0/y'), 'abc');
    type(m, m.byPath('/water/piezometric_line/0/y'), '7,5');
    press(m, m.byPath('/water/piezometric_line/0/y'), 'Enter');
    expect(disabled(m.byText('button', 'Agregar punto'))).toBe(false);
    m.act(() => m.byText('button', 'Agregar punto').props.onClick());
    expect(store.getState().doc.water?.piezometric_line).toHaveLength(4);
    expect(store.getState().doc.water?.piezometric_line?.[0]?.[1]).toBe(7.5);
  });

  it('polilínea de falla: «Agregar» y «Quitar» con el motivo, y sin perder el borrador', () => {
    const doc = docWith((d) => {
      d.analysis.surface = { type: 'polyline', points: [[0, 0], [30, 10], [60, 20]] } as never;
    });
    const store = createEditorStore(doc);
    const m = mountPanel(store, SurfacePanel);
    expect(disabled(m.byLabel('Quitar el punto 2 de la polilínea'))).toBe(false);
    type(m, m.byPath('/analysis/surface/points/1/1'), 'abc');
    for (const label of ['Agregar un punto después del punto 1 de la polilínea', 'Quitar el punto 1 de la polilínea', 'Quitar el punto 3 de la polilínea']) {
      const b = m.byLabel(label);
      expect(disabled(b)).toBe(true);
      expect(b.props.title).toBe(ROWS_PENDING_REASON);
      expect(b.props['aria-describedby']).toBeTruthy();
    }
    expect(m.byPath('/analysis/surface/points/1/1').props.value).toBe('abc');
    expect(m.text()).toContain(ROWS_PENDING_NOTE);
  });

  it('función entre dovelas (puntos): «Agregar» y «Quitar» se deshabilitan con una fila pendiente', () => {
    const doc = docWith((d) => {
      d.analysis.methods = ['morgenstern_price'] as never;
      d.analysis.interslice = { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] } as never;
    });
    const store = createEditorStore(doc);
    const m = mountPanel(store, AnalysisPanel);
    const quitar = 'Quitar el punto 2 de la función entre dovelas';
    expect(disabled(m.byLabel(quitar))).toBe(false);
    type(m, m.byPath('/analysis/interslice/points/1/1'), 'abc');
    for (const label of [quitar, 'Agregar un punto después del punto 1 de la función entre dovelas']) {
      expect(disabled(m.byLabel(label))).toBe(true);
      expect(m.byLabel(label).props.title).toBe(ROWS_PENDING_REASON);
    }
    expect(m.text()).toContain(ROWS_PENDING_NOTE);
  });

  it('geometría: «Agregar después» y «Eliminar» se deshabilitan mientras haya un vértice pendiente en la tabla', () => {
    const store = createEditorStore(makeDoc());
    const m = mountPanel(store, GeometryPanel);
    const add = (n: number): ReturnType<Mounted['byLabel']> => m.byLabel(`Agregar después del vértice ${n} de la región 2`.replace('región 2', 'región 1'));
    expect(disabled(add(1))).toBe(false);
    type(m, m.byPath('/regions/0/polygon/2/y'), 'abc'); // el vértice 3 queda pendiente
    expect(getPendingDrafts(store)).toHaveLength(1);
    for (const n of [1, 2, 3, 4]) {
      expect(disabled(add(n))).toBe(true);
      expect(add(n).props.title).toBe(ROWS_PENDING_REASON);
      expect(disabled(m.byLabel(`Eliminar el vértice ${n} de la región 1`))).toBe(true);
    }
    expect(m.text()).toContain(ROWS_PENDING_NOTE);
    blur(m, m.byPath('/regions/0/polygon/2/y'));
    press(m, m.byPath('/regions/0/polygon/2/y'), 'Escape');
    expect(disabled(add(1))).toBe(false);
  });
});

describe('1d · Ctrl+Intro calcula con el foco en un campo', () => {
  it('el campo de texto no cancela Ctrl/Cmd+Intro ni lo confirma por su cuenta; Intro sin modificadores sigue igual', () => {
    let commits = 0;
    const m = mount(() => createElement(TextInput as never, { value: '1', onChange: () => undefined, onCommit: () => void (commits += 1) }));
    const input = m.nodes.find((n) => n.type === 'input')!;
    const plain = keyEvent('Enter');
    input.props.onKeyDown(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(commits).toBe(1);
    for (const mods of [{ ctrlKey: true }, { metaKey: true }]) {
      const e = keyEvent('Enter', mods);
      input.props.onKeyDown(e);
      expect(e.defaultPrevented).toBe(false);
      expect(shortcutFor({ key: 'Enter', ctrlKey: !!mods.ctrlKey, metaKey: !!mods.metaKey, shiftKey: false, altKey: false, defaultPrevented: e.defaultPrevented, inField: true })).toBe('check');
    }
    expect(commits).toBe(1);
    const esc = keyEvent('Escape');
    input.props.onKeyDown(esc);
    expect(esc.defaultPrevented).toBe(false);
  });
});
