// UA3-C2: paleta compacta o con scroll visible (B-10c).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';
import { nextPaletteMode } from './paletteMode';

const css = readFileSync(new URL('./canvas.css', import.meta.url), 'utf8');

describe('B-10c: modo de la paleta', () => {
  it('cabe: se queda como está; no cabe: full → compact → scroll, y scroll es el final', () => {
    expect(nextPaletteMode('full', false)).toBe('full');
    expect(nextPaletteMode('full', true)).toBe('compact');
    expect(nextPaletteMode('compact', false)).toBe('compact');
    expect(nextPaletteMode('compact', true)).toBe('scroll');
    expect(nextPaletteMode('scroll', true)).toBe('scroll');
    expect(nextPaletteMode('scroll', false)).toBe('scroll');
  });

  it('el marcado inicial es el completo: sin data-compact ni data-scroll (con rótulos)', () => {
    const html = renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(makeDoc()) }));
    const nav = /<nav[^>]*class="ec-palette"[^>]*>/.exec(html)?.[0] ?? '';
    expect(nav).not.toContain('data-compact');
    expect(nav).not.toContain('data-scroll');
    expect(html).toContain('ec-palette-label');
  });

  it('hoja de estilos: la compacta mide 36 sin rótulos (solo desde 761 px) y el scroll tiene la barra fina con color propio', () => {
    const media = /@media \(min-width: 761px\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(media).toMatch(/\[data-compact='true'\] \.ec-palette-label\s*\{\s*display:\s*none/);
    expect(media).toMatch(/\.ec-tool\s*\{\s*width:\s*36px;\s*height:\s*36px/);
    const scroll = /\.ec-palette\[data-scroll='true'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/scrollbar-width:\s*thin/);
    expect(scroll).toMatch(/scrollbar-color:\s*var\(--ui-control-border\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
