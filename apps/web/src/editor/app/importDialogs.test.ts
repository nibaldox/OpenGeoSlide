// R7-03: los diálogos de importación usan <dialog> nativo (showModal gestiona foco, Esc e inercia del fondo).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../io/csv';
import { loadCaseDoc } from '../../report/fixtures';
import { CsvImportDialog, Modal, pickInitialFocus } from './ImportDialogs';

describe('pickInitialFocus (foco inicial del Modal, sin temporizadores)', () => {
  const title = { isConnected: true, id: 'titulo' };
  const button = { isConnected: true, id: 'boton' };
  it('sin elemento pedido, el foco va al título', () => {
    expect(pickInitialFocus(undefined, title)).toBe(title);
    expect(pickInitialFocus(null, title)).toBe(title);
  });
  it('con un elemento pedido y conectado, va a ese elemento', () => {
    expect(pickInitialFocus(button, title)).toBe(button);
  });
  it('si el elemento pedido ya no está en el documento, vuelve al título', () => {
    expect(pickInitialFocus({ isConnected: false, id: 'huerfano' }, title)).toBe(title);
  });
  it('sin título ni elemento, no hay a quién enfocar', () => {
    expect(pickInitialFocus(null, null)).toBeNull();
  });
});

describe('Modal', () => {
  it('es un <dialog> nativo con nombre accesible y sin role="dialog" artesanal ni telón propio', () => {
    const html = renderToStaticMarkup(createElement(Modal, { title: 'Importar algo', onCancel: () => {}, children: createElement('p', null, 'cuerpo') }));
    expect(html).toMatch(/^<dialog[^>]*aria-labelledby="[^"]+"/);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('ea-backdrop');
    expect(html).toContain('<h2');
    expect(html).toContain('cuerpo');
  });
});

describe('CsvImportDialog (UX-07)', () => {
  const doc = loadCaseDoc('V047a');
  const html = (csv: string): string =>
    renderToStaticMarkup(
      createElement(CsvImportDialog, {
        fileName: 'p.csv',
        result: parseCsv(csv),
        materials: doc.materials,
        units: doc.units,
        onCancel: () => {},
        onApplyRegions: () => {},
        onApplyPiezo: () => {},
      }),
    );

  it('con x no creciente, «Importar piezométrica» queda deshabilitado y el error se ve', () => {
    const out = html('x,y\n40,5\n20,6\n70,4\n');
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Importar piezométrica<\/button>/);
    expect(out).toContain('ea-issue-error');
    expect(out).toContain('estrictamente creciente');
  });
  it('con x creciente, el botón queda habilitado', () => {
    const out = html('x,y\n0,5\n20,6\n70,4\n');
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>Importar piezométrica<\/button>/);
  });
});
