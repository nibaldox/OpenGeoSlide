import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EditorState } from '../types';
import { createEditorStore } from './store';
import { baseDoc } from './testFixtures';
import { shallowEqual, useEditorStore, useLocalIssues } from './useEditor';

describe('shallowEqual', () => {
  it('compara objetos y arreglos por sus elementos', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: [1] }, { a: [1] })).toBe(false); // superficial
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual(3, 3)).toBe(true);
  });
});

describe('useEditorStore / useLocalIssues (render en servidor, entorno node)', () => {
  it('useEditorStore lee el estado del store con el selector', () => {
    const store = createEditorStore(baseDoc());
    store.dispatch({ type: 'meta/patch', patch: { title: 'Título' } });
    const select = (s: EditorState): string | null | undefined => s.doc.meta.title;
    const Title = () => createElement('span', null, useEditorStore(store, select));
    expect(renderToString(createElement(Title))).toContain('Título');
  });

  it('un selector que devuelve objetos nuevos funciona con isEqual', () => {
    const store = createEditorStore(baseDoc());
    const select = (s: EditorState) => ({ rev: s.revision, tool: s.ui.tool });
    const View = () => {
      const v = useEditorStore(store, select, shallowEqual);
      return createElement('span', null, `${v.tool}:${v.rev}`);
    };
    expect(renderToString(createElement(View))).toContain('select:0');
  });

  it('useLocalIssues devuelve las incidencias del documento actual', () => {
    const store = createEditorStore({ ...baseDoc(), regions: [] });
    const View = () => createElement('span', null, String(useLocalIssues(store).length));
    expect(renderToString(createElement(View))).toContain('1');
  });
});
