import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoticeList } from './NoticeList';
import { addNotice, type Notice } from './notices';

const render = (notices: Notice[]): string => renderToStaticMarkup(createElement(NoticeList, { notices, onDismiss: () => {}, onDismissAll: () => {} }));
const n = (id: number, kind: Notice['kind'], text = `Mensaje ${id}`): Notice => ({ id, kind, text });

describe('NoticeList (UX9-06)', () => {
  it('sin avisos no pinta nada', () => {
    expect(render([])).toBe('');
  });

  it('un aviso: sin «Cerrar todos» ni «ver más»', () => {
    const out = render([n(1, 'error')]);
    expect(out).not.toContain('Cerrar todos');
    expect(out).not.toContain('más');
    expect(out).toContain('aria-label="Cerrar mensaje"');
  });

  it('el mismo error repetido sale una vez con su contador', () => {
    let list: Notice[] = [];
    for (let i = 1; i <= 4; i++) list = addNotice(list, n(i, 'error', 'El archivo no es un JSON válido'));
    const out = render(list);
    expect(out.match(/<li /g)).toHaveLength(1);
    expect(out).toContain('4 veces');
  });

  it('con 5 avisos se ven 3, «Ver 2 más» y «Cerrar todos»; la lista solo contiene <li>', () => {
    const out = render([1, 2, 3, 4, 5].map((i) => n(i, 'error')));
    expect(out.match(/<li /g)).toHaveLength(3);
    expect(out).toContain('Ver 2 más');
    expect(out).toContain('Cerrar todos');
    const ul = /<ul[^>]*>(.*?)<\/ul>/.exec(out)?.[1] ?? '';
    expect(ul.replace(/<li[\s\S]*?<\/li>/g, '')).toBe('');
  });

  it('el botón se llama «Cerrar mensaje» (nombre estable) y cada uno apunta a su aviso con aria-describedby', () => {
    const out = render([1, 2, 3].map((i) => n(i, 'aviso')));
    const buttons = Array.from(out.matchAll(/<button[^>]*aria-label="Cerrar mensaje"[^>]*>/g), (m) => m[0]);
    expect(buttons).toHaveLength(3);
    const ids = buttons.map((b) => /aria-describedby="([^"]+)"/.exec(b)?.[1]);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(out).toContain(`id="${id}"`);
  });
});
