// CM-W3B (RCM-B-03): un `global.algorithm` desconocido (de un borrador viejo) se ve como error de campo y nunca se reemplaza en
// silencio. Con el panel real sobre el renderizador mínimo (`hookHarness.ts`) y el almacén real.
import { createElement, useSyncExternalStore, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('./hookHarness')).hookOverrides }));

import { makeDoc } from '../canvas/fakeStore';
import { createEditorStore } from '../state';
import type { EditorStore, ModelDoc } from '../types';
import { searchFromForm, searchToForm } from './forms';
import { mount, type Mounted } from './hookHarness';
import { SearchPanel } from './SearchPanel';
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

// ───────────────────────── RCM-B-03 ─────────────────────────
describe('RCM-B-03: un algoritmo desconocido no se reemplaza en silencio', () => {
  const GLOBAL = '/analysis/search/non_circular/global';
  const docTypo = (): ModelDoc => {
    const d = clone();
    d.analysis = {
      methods: ['spencer'],
      search: { type: 'circular_entry_exit', n_entry: 20, n_exit: 20, n_radius: 20, max_radius_factor: 5, min_width: null, refine: true, non_circular: { global: { algorithm: 'typo', generated: 50, seed: 0, polish: false } as never } },
    };
    d.version = '0.7';
    return d;
  };

  it('searchFromForm da un error de campo con el valor y no devuelve una búsqueda con el algoritmo cambiado', () => {
    const doc = docTypo();
    const form = searchToForm(doc.analysis.search!);
    expect(form.global_algorithm).toBe('typo');
    const r = searchFromForm(form, { xRange: [0, 100] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.global_algorithm).toContain('«typo»');
    // Los valores válidos y el vacío (ausente) siguen siendo válidos.
    for (const a of ['', 'auto', 'block', 'annealing']) expect(searchFromForm({ ...form, global_algorithm: a }, { xRange: [0, 100] }).ok, a).toBe(true);
  });

  it('el panel muestra el valor desconocido como opción no válida, con el error enlazado, y no «Automático»', () => {
    const store = createEditorStore(docTypo());
    const m = mountIn(store, () => createElement(SearchPanel as never, { store }));
    const select = m.byPath(`${GLOBAL}/algorithm`);
    expect(select.props.value).toBe('typo');
    expect(select.props['aria-invalid']).toBe(true);
    const err = m.find((n) => n.props.id === select.props['aria-describedby'])!;
    expect(err.props.role).toBe('alert');
    expect(m.text()).toContain('«typo» no es válido');
    const options = select.children.filter((c): c is Exclude<typeof c, string> => typeof c !== 'string').map((o) => o.props.value);
    expect(options).toEqual(['auto', 'block', 'annealing', 'typo']);
  });

  it('tocar otro control no borra el error ni cambia el modelo; elegir un algoritmo válido lo corrige', () => {
    const store = createEditorStore(docTypo());
    const m = mountIn(store, () => createElement(SearchPanel as never, { store }));
    const before = store.getState().doc;
    m.act(() => m.byPath(`${GLOBAL}/polish`).props.onChange({ target: { checked: true } }));
    expect(store.getState().doc).toBe(before); // «typo» no se descartó ni se reemplazó
    expect(m.byPath(`${GLOBAL}/algorithm`).props.value).toBe('typo');
    expect(m.byPath(`${GLOBAL}/algorithm`).props['aria-invalid']).toBe(true);
    m.act(() => m.byPath(`${GLOBAL}/algorithm`).props.onChange({ target: { value: 'block' } }));
    expect(store.getState().doc.analysis.search?.non_circular?.global).toMatchObject({ algorithm: 'block' });
    expect(m.byPath(`${GLOBAL}/algorithm`).props['aria-invalid']).toBeUndefined();
    expect(m.text()).not.toContain('no es válido');
  });

  it('con un algoritmo válido el panel no cambia: tres opciones y sin error', () => {
    const d = docTypo();
    d.analysis.search!.non_circular = { global: { algorithm: 'annealing' } };
    const store = createEditorStore(d);
    const m = mountIn(store, () => createElement(SearchPanel as never, { store }));
    const select = m.byPath(`${GLOBAL}/algorithm`);
    expect(select.props['aria-invalid']).toBeUndefined();
    expect(select.children.filter((c) => typeof c !== 'string')).toHaveLength(3);
  });
});

