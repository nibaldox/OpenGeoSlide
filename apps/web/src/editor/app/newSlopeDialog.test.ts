import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyCanvasState } from './EmptyCanvasState';
import { NewSlopeDialog } from './NewSlopeDialog';

describe('NewSlopeDialog', () => {
  const html = renderToStaticMarkup(createElement(NewSlopeDialog, { onCancel: () => undefined, onCreate: () => true }));
  it('es un <dialog> con título y todos los parámetros del talud', () => {
    expect(html).toContain('<dialog');
    expect(html).toContain('Talud simple');
    for (const label of ['Altura H', 'Ancho de corona', 'Ancho de pie', 'Profundidad bajo el pie', 'Ángulo β', 'Pendiente H:V', 'Peso unitario γ', 'Cohesión c', 'Ángulo de fricción φ', 'Línea piezométrica', 'Unidades']) {
      expect(html, label).toContain(label);
    }
  });
  it('ofrece la piezométrica en el pie y en la corona', () => {
    expect(html).toContain('En el pie');
    expect(html).toContain('En la corona');
  });
  it('con los valores por defecto se puede crear y hay vista previa del perfil', () => {
    expect(html).toContain('data-testid="slope-preview"');
    expect(html).toMatch(/<button type="submit" class="primary">Crear talud<\/button>/);
    expect(html).toContain('Cancelar');
  });
});

describe('EmptyCanvasState', () => {
  const html = renderToStaticMarkup(createElement(EmptyCanvasState, { onDraw: () => undefined, onExample: () => undefined }));
  it('invita a «Dibujar región» y «Abrir un ejemplo» y cita el DXF y el CSV', () => {
    expect(html).toContain('>Dibujar región<');
    expect(html).toContain('>Abrir un ejemplo<');
    expect(html).toContain('DXF');
    expect(html).toContain('CSV');
  });
  it('no repite los nombres de «Importar DXF» e «Importar CSV» del menú (solo texto)', () => {
    expect(html).not.toContain('Importar DXF');
    expect(html).not.toContain('Importar CSV');
  });
});
