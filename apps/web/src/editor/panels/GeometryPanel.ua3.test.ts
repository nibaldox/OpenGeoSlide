// UA3-C2 (B-13c): el texto de GeometryPanel nombra la paleta del lienzo (no «la barra del lienzo», que ya no existe en el armazón A).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeDoc } from '../canvas/fakeStore';
import { createEditorStore } from '../state';
import { GeometryPanel } from './GeometryPanel';

describe('GeometryPanel: texto de ayuda (B-13c)', () => {
  it('«Dibujar región» está «de la paleta del lienzo», no «de la barra del lienzo»', () => {
    const html = renderToStaticMarkup(createElement(GeometryPanel, { store: createEditorStore(makeDoc()) }));
    expect(html).toContain('de la paleta del lienzo');
    expect(html).not.toContain('barra del lienzo');
    expect(html).toContain('«Dibujar región» (tecla R)');
  });
});
