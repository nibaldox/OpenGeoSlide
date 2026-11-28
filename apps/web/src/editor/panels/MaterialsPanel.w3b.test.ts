// CM-W3B (RCM-B-04 y 05), con el panel real sobre el renderizador mínimo (`hookHarness.ts`) y el almacén real:
//  - 04: «Nuevo material» es un borrador y se reinicia con `docEpoch` (Nuevo, Abrir);
//  - 05: la tabla `ocr_by_elevation` de SHANSEP cumple W1-1c: con una fila pendiente no se agrega ni se quita, y no se inserta un NaN.
import { createElement, useSyncExternalStore, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('./hookHarness')).hookOverrides }));

import { makeDoc } from '../canvas/fakeStore';
import { createEditorStore } from '../state';
import type { EditorStore, ModelDoc } from '../types';
import { ROWS_PENDING_NOTE, ROWS_PENDING_REASON, getPendingDrafts, hasPendingDrafts } from './forms';
import { changeEvent, keyEvent, mount, type Mounted } from './hookHarness';
import { MaterialsPanel, NewMaterial, nextOcrRowY, shansepRowsPending } from './MaterialsPanel';
import { DocEpochContext } from './useStoreSelector';

const clone = (): ModelDoc => structuredClone(makeDoc()) as unknown as ModelDoc;
/** Como `EditorApp`: el contexto de la época se entrega desde un componente que sigue al almacén y repinta a sus hijos al cambiarla. */
function EpochHost({ store, children }: { store: EditorStore; children: ReactNode }) {
  const epoch = useSyncExternalStore(store.subscribe, () => store.getState().docEpoch);
  return createElement(DocEpochContext as never, { value: epoch }, children);
}
function mountIn(store: EditorStore, make: () => unknown): Mounted {
  return mount(() => createElement(EpochHost as never, { store }, make() as never));
}
const type = (m: Mounted, node: { props: Record<string, any> }, value: string): void => m.act(() => node.props.onChange(changeEvent(value)));
const press = (m: Mounted, node: { props: Record<string, any> }, key: string): void => m.act(() => node.props.onKeyDown(keyEvent(key)));
const disabled = (n: { props: Record<string, any> }): boolean => n.props.disabled === true;

// ───────────────────────── RCM-B-04 ─────────────────────────
describe('RCM-B-04: «Nuevo material» se reinicia con docEpoch', () => {
  const NEW = { type: 'doc/load' as const, fileName: null };
  const nameInput = (m: Mounted) => m.find((n) => n.type === 'input' && n.props.value === 'mi_borrador_viejo');

  it('abierto y con texto escrito, «Nuevo» o «Abrir» lo cierran y quitan el borrador pendiente', () => {
    const store = createEditorStore(clone());
    const m = mountIn(store, () => createElement(NewMaterial as never, { store, ids: ['soil'], units: 'SI' }));
    m.act(() => m.byText('button', 'Nuevo material…').props.onClick());
    const idField = m.find((n) => n.type === 'input' && typeof n.props.value === 'string' && n.props['data-path'] === undefined)!;
    type(m, idField, 'mi_borrador_viejo');
    expect(nameInput(m)).toBeDefined();
    expect(hasPendingDrafts(store)).toBe(true);

    store.dispatch({ ...NEW, doc: clone() });
    expect(nameInput(m)).toBeUndefined();
    expect(m.text()).not.toContain('Agregar material');
    expect(m.byText('button', 'Nuevo material…')).toBeDefined();
    expect(hasPendingDrafts(store)).toBe(false);
    expect(getPendingDrafts(store)).toEqual([]);
  });

  it('abrir otro documento (misma referencia de materiales) también lo reinicia', () => {
    const doc = clone();
    const store = createEditorStore(doc);
    const m = mountIn(store, () => createElement(NewMaterial as never, { store, ids: ['soil'], units: 'SI' }));
    m.act(() => m.byText('button', 'Nuevo material…').props.onClick());
    store.dispatch({ type: 'doc/load', doc, fileName: 'otro.ogs.json' });
    expect(m.text()).not.toContain('Agregar material');
  });

  it('con `initiallyOpen` vuelve al formulario inicial, sin cambios pendientes', () => {
    const store = createEditorStore(clone());
    const m = mountIn(store, () => createElement(NewMaterial as never, { store, ids: ['soil'], units: 'SI', initiallyOpen: true }));
    const idField = m.find((n) => n.type === 'input')!;
    const initial = idField.props.value as string;
    type(m, m.find((n) => n.type === 'input')!, 'cambiado');
    expect(hasPendingDrafts(store)).toBe(true);
    store.dispatch({ ...NEW, doc: clone() });
    expect(m.find((n) => n.type === 'input')!.props.value).toBe(initial);
    expect(hasPendingDrafts(store)).toBe(false);
    expect(m.text()).toContain('Agregar material');
  });

  it('sin cambio de documento, cancelar y agregar siguen funcionando como antes', () => {
    const store = createEditorStore(clone());
    const m = mountIn(store, () => createElement(NewMaterial as never, { store, ids: ['soil'], units: 'SI' }));
    m.act(() => m.byText('button', 'Nuevo material…').props.onClick());
    m.act(() => m.byText('button', 'Cancelar').props.onClick());
    expect(m.text()).not.toContain('Agregar material');
    expect(hasPendingDrafts(store)).toBe(false);
  });
});

// ───────────────────────── RCM-B-05 ─────────────────────────
describe('RCM-B-05: la tabla ocr_by_elevation de SHANSEP cumple W1-1c', () => {
  const docShansep = (): ModelDoc => {
    const d = clone();
    d.materials = [{ id: 'clay', name: 'Arcilla', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.25, exponent: 0.8, ocr_by_elevation: [[0, 3], [5, 2]] } }];
    d.regions = d.regions.map((r) => ({ ...r, material: 'clay' }));
    d.version = '0.6';
    return d;
  };
  const mountPanel = (store: EditorStore): Mounted => mountIn(store, () => createElement(MaterialsPanel as never, { store }));
  const cell = (m: Mounted, row: number, col: 0 | 1) => m.byPath(`/materials/0/shansep/ocr_by_elevation/${row}/${col}`);
  const addRow = (m: Mounted) => m.byText('button', 'Agregar fila');
  const rows = (store: EditorStore) => store.getState().doc.materials[0]!.shansep!.ocr_by_elevation;

  it('sin borrador pendiente: agregar suma una fila (última cota + 1) y quitar sigue funcionando', () => {
    const store = createEditorStore(docShansep());
    const m = mountPanel(store);
    expect(disabled(addRow(m))).toBe(false);
    m.act(() => addRow(m).props.onClick());
    expect(rows(store)).toEqual([[0, 3], [5, 2], [6, 2]]);
    m.act(() => m.byLabel('Material clay: quitar la fila 3').props.onClick());
    expect(rows(store)).toEqual([[0, 3], [5, 2]]);
    expect(m.text()).not.toContain(ROWS_PENDING_NOTE);
  });

  it('con una cota inválida en una fila, «Agregar fila» y «Quitar» quedan deshabilitados, con el motivo, la nota y aria-describedby', () => {
    const store = createEditorStore(docShansep());
    const m = mountPanel(store);
    type(m, cell(m, 1, 0), 'abc');
    expect(cell(m, 1, 0).props.value).toBe('abc');
    const quitar = m.byLabel('Material clay: quitar la fila 1');
    for (const b of [addRow(m), quitar]) {
      expect(disabled(b)).toBe(true);
      expect(b.props.title).toBe(ROWS_PENDING_REASON);
      expect(b.props['aria-describedby']).toBeTruthy();
    }
    const note = m.find((n) => n.props['data-testid'] === 'rows-pending-note')!;
    expect(note.props.id).toBe(addRow(m).props['aria-describedby']);
    expect(m.text()).toContain(ROWS_PENDING_NOTE);
    expect(rows(store)).toEqual([[0, 3], [5, 2]]); // el documento no cambió
    // Con OCR inválido en otra fila también.
    press(m, cell(m, 1, 0), 'Escape');
    expect(disabled(addRow(m))).toBe(false);
    type(m, cell(m, 0, 1), '0');
    expect(disabled(addRow(m))).toBe(true);
    press(m, cell(m, 0, 1), 'Escape');
    expect(disabled(addRow(m))).toBe(false);
    expect(m.text()).not.toContain(ROWS_PENDING_NOTE);
  });

  it('«Agregar fila» nunca inserta un NaN: aunque se llame con la última cota inválida, la tabla no cambia', () => {
    const store = createEditorStore(docShansep());
    const m = mountPanel(store);
    type(m, cell(m, 1, 0), 'abc');
    m.act(() => addRow(m).props.onClick()); // un clic forzado sobre el botón deshabilitado
    expect(m.nodes.filter((n) => typeof n.props['data-path'] === 'string' && n.props['data-path'].includes('/ocr_by_elevation/2/')).length).toBe(0);
    expect(rows(store)).toEqual([[0, 3], [5, 2]]);
  });

  it('funciones puras: qué es una fila pendiente y la cota de la fila nueva', () => {
    expect(shansepRowsPending({})).toBe(false);
    expect(shansepRowsPending({ ocr: 'x' })).toBe(false);
    expect(shansepRowsPending({ row1y: 'Indique la cota' })).toBe(true);
    expect(shansepRowsPending({ row0ocr: 'OCR debe ser ≥ 1' })).toBe(true);
    expect(shansepRowsPending({ ocrRows: 'La tabla requiere…' })).toBe(true);
    expect(nextOcrRowY([{ y: '0' }, { y: '5' }])).toBe('6');
    expect(nextOcrRowY([{ y: '0' }, { y: '2,5' }])).toBe('3,5');
    expect(nextOcrRowY([{ y: '0' }, { y: 'abc' }])).toBeNull();
    expect(nextOcrRowY([{ y: '0' }, { y: '' }])).toBeNull();
    expect(nextOcrRowY([])).toBeNull();
  });
});
