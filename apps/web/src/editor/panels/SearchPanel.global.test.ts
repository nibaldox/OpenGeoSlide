// CM-C1W · F7.5: el sub-bloque «Búsqueda global» del panel de búsqueda, con el panel real sobre el renderizador mínimo
// (`hookHarness.ts`) y el almacén real. Casilla, cuatro campos, valores por defecto sin escribir, errores por campo y borradores.
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('./hookHarness')).hookOverrides }));

import { makeDoc } from '../canvas/fakeStore';
import { createEditorStore } from '../state';
import { saveOgsJson } from '../../io/ogsJson';
import type { EditorStore, ModelDoc } from '../types';
import { SearchPanel } from './SearchPanel';
import { hasPendingDrafts } from './forms';
import { changeEvent, keyEvent, mount, type Mounted } from './hookHarness';
import { DocEpochContext } from './useStoreSelector';

const P = '/analysis/search/non_circular';
const GLOBAL = `${P}/global`;

function docWith(nonCircular: unknown, methods: ModelDoc['analysis']['methods'] = ['spencer']): ModelDoc {
  const d = structuredClone(makeDoc()) as unknown as ModelDoc;
  d.analysis = {
    methods,
    search: { type: 'circular_entry_exit', n_entry: 20, n_exit: 20, n_radius: 20, max_radius_factor: 5, min_width: null, refine: true, ...(nonCircular === undefined ? {} : { non_circular: nonCircular as never }) },
  };
  return d;
}

function mountPanel(store: EditorStore): Mounted {
  return mount(() => createElement(DocEpochContext as never, { value: store.getState().docEpoch }, createElement(SearchPanel as never, { store })));
}
const has = (m: Mounted, path: string): boolean => m.find((n) => n.props['data-path'] === path) !== undefined;
const check = (m: Mounted, path: string, checked: boolean): void => m.act(() => m.byPath(path).props.onChange({ target: { checked } }));
const choose = (m: Mounted, path: string, value: string): void => m.act(() => m.byPath(path).props.onChange({ target: { value } }));
const type = (m: Mounted, path: string, value: string): void => m.act(() => m.byPath(path).props.onChange(changeEvent(value)));
const enter = (m: Mounted, path: string): void => m.act(() => m.byPath(path).props.onKeyDown(keyEvent('Enter')));
const typeAndEnter = (m: Mounted, path: string, value: string): void => {
  type(m, path, value);
  enter(m, path);
};
const nc = (store: EditorStore): Record<string, unknown> | undefined => store.getState().doc.analysis.search?.non_circular as Record<string, unknown> | undefined;
const saved = (store: EditorStore): Record<string, any> => JSON.parse(saveOgsJson(store.getState().doc));

describe('F7.5: casilla y campos de la búsqueda global', () => {
  it('sin «Superficie no circular» no hay sub-bloque; con ella aparece la casilla y, sin marcar, ningún campo', () => {
    const store = createEditorStore(docWith(undefined));
    const m = mountPanel(store);
    expect(has(m, P)).toBe(true);
    expect(has(m, GLOBAL)).toBe(false);
    check(m, P, true);
    expect(nc(store)).toEqual({});
    expect(has(m, GLOBAL)).toBe(true);
    expect(has(m, `${GLOBAL}/algorithm`)).toBe(false);
    expect(has(m, `${GLOBAL}/generated`)).toBe(false);
  });

  it('marcar la casilla escribe global: {} y sube la versión a 0.7; los cuatro campos aparecen con sus valores por defecto', () => {
    const store = createEditorStore(docWith({}));
    const m = mountPanel(store);
    expect(m.byPath(GLOBAL).props.checked).toBe(false);
    expect(store.getState().doc.version).toBe('0.2');
    check(m, GLOBAL, true);
    expect(nc(store)).toEqual({ global: {} });
    expect(store.getState().doc.version).toBe('0.7');
    expect(m.byPath(GLOBAL).props.checked).toBe(true);
    expect(m.byPath(`${GLOBAL}/algorithm`).props.value).toBe('auto');
    expect(m.byPath(`${GLOBAL}/generated`).props.value).toBe('');
    expect(m.byPath(`${GLOBAL}/seed`).props.value).toBe('');
    expect(m.byPath(`${GLOBAL}/polish`).props.checked).toBe(true);
    // Los valores por defecto se dicen en el texto de ayuda, no se escriben.
    expect(m.text()).toContain('vacío = 500');
    expect(m.text()).toContain('vacío = 0');
    expect(saved(store).version).toBe('0.7');
    expect(saved(store).analysis.search.non_circular).toEqual({ global: {} });
  });

  it('las opciones del algoritmo son Automático, «Bloque sobre capas débiles» y Recocido', () => {
    const store = createEditorStore(docWith({ global: {} }));
    const m = mountPanel(store);
    const select = m.byPath(`${GLOBAL}/algorithm`);
    const options = (select.children as { type: string; props: Record<string, any>; children: unknown[] }[]).map((o) => [o.props.value, o.children.join('')]);
    expect(options).toEqual([
      ['auto', 'Automático'],
      ['block', 'Bloque sobre capas débiles'],
      ['annealing', 'Recocido'],
    ]);
  });

  it('el algoritmo se escribe al elegirlo y vuelve a quedar ausente al elegir Automático', () => {
    const store = createEditorStore(docWith({ global: {} }));
    const m = mountPanel(store);
    choose(m, `${GLOBAL}/algorithm`, 'block');
    expect(nc(store)).toEqual({ global: { algorithm: 'block' } });
    expect(m.byPath(`${GLOBAL}/algorithm`).props.value).toBe('block');
    choose(m, `${GLOBAL}/algorithm`, 'annealing');
    expect(nc(store)).toEqual({ global: { algorithm: 'annealing' } });
    choose(m, `${GLOBAL}/algorithm`, 'auto');
    expect(nc(store)).toEqual({ global: {} });
  });

  it('candidatos y semilla se confirman con Intro; vaciarlos los quita; coma o punto decimal no cambia nada en enteros', () => {
    const store = createEditorStore(docWith({ global: {} }));
    const m = mountPanel(store);
    typeAndEnter(m, `${GLOBAL}/generated`, '120');
    typeAndEnter(m, `${GLOBAL}/seed`, '42');
    expect(nc(store)).toEqual({ global: { generated: 120, seed: 42 } });
    typeAndEnter(m, `${GLOBAL}/generated`, '2000');
    typeAndEnter(m, `${GLOBAL}/seed`, '9007199254740991');
    expect(nc(store)).toEqual({ global: { generated: 2000, seed: 9007199254740991 } });
    typeAndEnter(m, `${GLOBAL}/generated`, '50');
    typeAndEnter(m, `${GLOBAL}/seed`, '0');
    expect(nc(store)).toEqual({ global: { generated: 50, seed: 0 } });
    typeAndEnter(m, `${GLOBAL}/generated`, '');
    typeAndEnter(m, `${GLOBAL}/seed`, '');
    expect(nc(store)).toEqual({ global: {} });
  });

  it('fuera de rango o no entero: el campo se marca, el mensaje dice el rango y el documento no cambia', () => {
    const store = createEditorStore(docWith({ global: { generated: 100 } }));
    const m = mountPanel(store);
    const before = store.getState().doc;
    for (const [path, bad, msg] of [
      ['generated', '10', 'entre 50 y 2000'],
      ['generated', '2001', 'entre 50 y 2000'],
      ['generated', '60,5', 'entero'],
      ['generated', 'abc', 'número'],
      ['seed', '-1', 'entre 0 y 9007199254740991'],
      ['seed', '9007199254740992', 'entre 0 y 9007199254740991'],
      ['seed', '1,5', 'entero'],
    ] as const) {
      typeAndEnter(m, `${GLOBAL}/${path}`, bad);
      expect(m.byPath(`${GLOBAL}/${path}`).props['aria-invalid'], `${path}=${bad}`).toBe(true);
      expect(m.text(), `${path}=${bad}`).toContain(msg);
      expect(store.getState().doc, `${path}=${bad}`).toBe(before);
      expect(hasPendingDrafts(store)).toBe(true);
      type(m, `${GLOBAL}/${path}`, '');
    }
  });

  it('el pulido: desmarcarlo escribe polish: false; volver a marcarlo lo deja ausente (valor por defecto)', () => {
    const store = createEditorStore(docWith({ global: {} }));
    const m = mountPanel(store);
    check(m, `${GLOBAL}/polish`, false);
    expect(nc(store)).toEqual({ global: { polish: false } });
    expect(m.byPath(`${GLOBAL}/polish`).props.checked).toBe(false);
    check(m, `${GLOBAL}/polish`, true);
    expect(nc(store)).toEqual({ global: {} });
    expect(m.byPath(`${GLOBAL}/polish`).props.checked).toBe(true);
  });

  it('un documento con valores explícitos los muestra y no los reescribe al confirmar otro campo', () => {
    const store = createEditorStore(docWith({ seeds: 2, global: { algorithm: 'auto', generated: 500, seed: 0, polish: true } }));
    const m = mountPanel(store);
    expect(m.byPath(`${GLOBAL}/algorithm`).props.value).toBe('auto');
    expect(m.byPath(`${GLOBAL}/generated`).props.value).toBe('500');
    expect(m.byPath(`${GLOBAL}/seed`).props.value).toBe('0');
    expect(m.byPath(`${GLOBAL}/polish`).props.checked).toBe(true);
    const before = store.getState().doc;
    enter(m, `${GLOBAL}/generated`); // confirmar sin cambiar nada
    expect(store.getState().doc).toBe(before);
    typeAndEnter(m, `${P}/seeds`, '4');
    expect(nc(store)).toEqual({ seeds: 4, global: { algorithm: 'auto', generated: 500, seed: 0, polish: true } });
  });

  it('desmarcar la casilla quita global (y la versión guardada vuelve a 0.6); volver a marcarla empieza con global: {}', () => {
    const store = createEditorStore(docWith({ global: { algorithm: 'block', generated: 90 } }));
    const m = mountPanel(store);
    check(m, GLOBAL, false);
    expect(nc(store)).toEqual({});
    expect(has(m, `${GLOBAL}/algorithm`)).toBe(false);
    expect(saved(store).version).toBe('0.6');
    expect(saved(store).analysis.search.non_circular).toEqual({});
    check(m, GLOBAL, true);
    expect(nc(store)).toEqual({ global: {} });
    expect(m.byPath(`${GLOBAL}/generated`).props.value).toBe('');
  });

  it('desmarcar «Superficie no circular» quita también global', () => {
    const store = createEditorStore(docWith({ global: { seed: 3 } }));
    const m = mountPanel(store);
    check(m, P, false);
    expect(nc(store)).toBeUndefined();
    expect(has(m, GLOBAL)).toBe(false);
    expect(saved(store).version).toBe('0.2');
  });

  it('el borrador inválido se reinicia al abrir otro documento con la misma búsqueda (docEpoch)', () => {
    const doc = docWith({ global: { generated: 100 } });
    const store = createEditorStore(doc);
    const m = mountPanel(store);
    type(m, `${GLOBAL}/generated`, 'xx');
    expect(m.byPath(`${GLOBAL}/generated`).props.value).toBe('xx');
    expect(hasPendingDrafts(store)).toBe(true);
    store.dispatch({ type: 'doc/load', doc, fileName: 'otro.ogs.json' });
    expect(m.byPath(`${GLOBAL}/generated`).props.value).toBe('100');
    expect(hasPendingDrafts(store)).toBe(false);
  });

  it('Bishop sigue avisando con non_circular y el sub-bloque dice el costo', () => {
    const store = createEditorStore(docWith({ global: {} }, ['bishop', 'spencer']));
    const m = mountPanel(store);
    expect(m.find((n) => n.props['data-testid'] === 'non-circular-bishop-note')).toBeDefined();
    expect(m.text()).toMatch(/8\s000 evaluaciones/);
    const store2 = createEditorStore(docWith({ global: {} }));
    expect(mountPanel(store2).find((n) => n.props['data-testid'] === 'non-circular-bishop-note')).toBeUndefined();
  });

  it('cada control tiene data-path con los cuatro niveles', () => {
    const store = createEditorStore(docWith({ global: {} }));
    const m = mountPanel(store);
    for (const path of [GLOBAL, `${GLOBAL}/algorithm`, `${GLOBAL}/generated`, `${GLOBAL}/seed`, `${GLOBAL}/polish`]) {
      expect(has(m, path), path).toBe(true);
    }
  });
});
