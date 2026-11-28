// R7-03: los diálogos de importación usan <dialog> nativo (showModal gestiona foco, Esc e inercia del fondo).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../io/csv';
import { loadCaseDoc } from '../../report/fixtures';
import { CsvImportDialog, DxfImportDialog, Modal, pickInitialFocus } from './ImportDialogs';
import { parseDxf } from '../../io/dxf';
import { readFileSync } from 'node:fs';
import type { ImportBase } from './importPlan';

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

describe('CM-WC: destino por defecto y archivos de ejemplo en los diálogos de importación', () => {
  const doc = loadCaseDoc('V047a');
  const dxfText = readFileSync(new URL('../../io/dxf/fixtures/terraplen.dxf', import.meta.url), 'utf8');
  const pristine: ImportBase = { regionCount: doc.regions.length, title: 'ACADS 1(a)', pristineStart: true };
  const edited: ImportBase = { ...pristine, pristineStart: false };
  const dxfHtml = (base?: ImportBase): string =>
    renderToStaticMarkup(
      createElement(DxfImportDialog, {
        fileName: 'terraplen.dxf',
        result: parseDxf(dxfText, { materials: doc.materials.map((m) => ({ id: m.id, name: m.name })) }),
        materials: doc.materials,
        units: doc.units,
        base,
        onCancel: () => {},
        onApply: () => {},
      }),
    );
  const csvHtml = (base?: ImportBase): string =>
    renderToStaticMarkup(
      createElement(CsvImportDialog, {
        fileName: 'r.csv',
        result: parseCsv('capa,x,y\nA,0,0\nA,10,0\nA,10,5\n'),
        materials: doc.materials,
        units: doc.units,
        base,
        onCancel: () => {},
        onApplyRegions: () => {},
        onApplyPiezo: () => {},
      }),
    );
  /** ¿Está marcado el radio cuyo rótulo empieza por `label`? */
  const checked = (html: string, label: string): boolean => new RegExp(`<input[^>]*checked=""[^>]*/> ${label}`).test(html) || new RegExp(`<input[^>]*checked=""[^>]*/>${label}`).test(html);

  it('DXF sobre el modelo de arranque sin cambios: «Reemplazar» marcado', () => {
    const html = dxfHtml(pristine);
    // CM-W2: con el modelo de arranque, «Reemplazar» dice que crea un modelo nuevo.
    expect(checked(html, 'Reemplazar: crea un modelo nuevo con este archivo')).toBe(true);
    expect(checked(html, 'Agregar a')).toBe(false);
  });
  it('DXF sobre un modelo con cambios, o sin saber cuál es: «Agregar» marcado, y nombra el modelo', () => {
    expect(checked(dxfHtml(edited), 'Agregar a (las \\d+ regiones|la región) de ACADS 1\\(a\\)')).toBe(true);
    expect(checked(dxfHtml(edited), 'Reemplazar')).toBe(false);
    expect(checked(dxfHtml(undefined), 'Agregar a las regiones actuales')).toBe(true);
  });
  it('CSV de regiones: la misma regla', () => {
    expect(checked(csvHtml(pristine), 'Reemplazar: crea un modelo nuevo con este archivo')).toBe(true);
    expect(checked(csvHtml(edited), 'Agregar a')).toBe(true);
    expect(checked(csvHtml(undefined), 'Agregar a las regiones actuales')).toBe(true);
  });
  it('el rótulo de «Agregar» dice a qué modelo se agrega', () => {
    const n = doc.regions.length;
    expect(dxfHtml(edited)).toContain(n === 1 ? 'Agregar a la región de ACADS 1(a)' : `Agregar a las ${n} regiones de ACADS 1(a)`);
    expect(dxfHtml({ ...edited, regionCount: 2 })).toContain('Agregar a las 2 regiones de ACADS 1(a)');
  });
  it('los dos diálogos traen el enlace para descargar un ejemplo, relativo a la base de la app', () => {
    const dxf = dxfHtml(pristine);
    expect(dxf).toMatch(/<a href="\/examples\/terraplen\.dxf" download="terraplen\.dxf">Descargar un DXF de ejemplo<\/a>/);
    const csv = csvHtml(pristine);
    expect(csv).toMatch(/<a href="\/examples\/regiones\.csv" download="regiones\.csv">Descargar un CSV de ejemplo<\/a>/);
  });
});
