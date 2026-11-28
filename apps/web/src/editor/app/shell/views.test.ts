import { describe, expect, it } from 'vitest';
import type { ShortcutAction } from '../shortcuts';
import { canvasVisible, DEFAULT_VIEW, isDocumentAction, neighborView, shortcutActsIn, shortcutDisposition, VIEWS, viewDef, viewForIssueTarget, viewTitle, type ViewId } from './views';

const DOCUMENT: ShortcutAction[] = ['undo', 'redo', 'save', 'open', 'check'];
const TOOLS: ShortcutAction[] = ['tool:select', 'tool:add_vertex', 'tool:draw_region', 'tool:split_region', 'tool:draw_reinforcement', 'tool:pan'];

describe('VIEWS', () => {
  it('son cuatro, numeradas, con los nombres del contrato (UA-D3)', () => {
    expect(VIEWS.map((v) => [v.number, v.label])).toEqual([
      [1, 'Lienzo'],
      [2, 'Resultados'],
      [3, 'Casos de verificación'],
      [4, 'Informe'],
    ]);
  });
  it('los ids de pestaña y de panel son los del contrato §4.7', () => {
    expect(VIEWS.map((v) => [v.tabId, v.panelId])).toEqual([
      ['mode-edit', 'mode-edit-panel'],
      ['view-results', 'view-results-panel'],
      ['mode-cases', 'mode-cases-panel'],
      ['view-report', 'view-report-panel'],
    ]);
    expect(new Set(VIEWS.map((v) => v.tabId)).size).toBe(4);
  });
  it('se abre en Lienzo y el título de la vista es su nombre', () => {
    expect(DEFAULT_VIEW).toBe('canvas');
    expect(viewDef('report').label).toBe('Informe');
    expect(viewTitle('cases')).toBe('Casos de verificación');
  });
});

describe('shortcutActsIn', () => {
  it('en Lienzo actúan todos', () => {
    for (const a of [...DOCUMENT, ...TOOLS]) expect(shortcutActsIn('canvas', a), a).toBe(true);
  });
  it('en Resultados e Informe solo las acciones de documento', () => {
    for (const v of ['results', 'report'] as ViewId[]) {
      for (const a of DOCUMENT) expect(shortcutActsIn(v, a), `${v} ${a}`).toBe(true);
      for (const a of TOOLS) expect(shortcutActsIn(v, a), `${v} ${a}`).toBe(false);
    }
  });
  it('en Casos no actúa ninguno (R7-07)', () => {
    for (const a of [...DOCUMENT, ...TOOLS]) expect(shortcutActsIn('cases', a), a).toBe(false);
  });
  it('isDocumentAction separa documento y herramientas', () => {
    expect(DOCUMENT.every(isDocumentAction)).toBe(true);
    expect(TOOLS.some(isDocumentAction)).toBe(false);
  });
});

describe('navegación', () => {
  it('canvasVisible solo en Lienzo', () => {
    expect(VIEWS.filter((v) => canvasVisible(v.id)).map((v) => v.id)).toEqual(['canvas']);
  });
  it('neighborView da la vuelta', () => {
    expect(neighborView('canvas', -1)).toBe('report');
    expect(neighborView('report', 1)).toBe('canvas');
    expect(neighborView('results', 1)).toBe('cases');
  });
  it('una incidencia con destino en el lienzo vuelve a Lienzo; una con paso, no cambia de vista', () => {
    expect(viewForIssueTarget(null, 'results')).toBe('canvas');
    expect(viewForIssueTarget('materials', 'results')).toBe('results');
  });
});

describe('shortcutDisposition (UA-E3 §1)', () => {
  it('en Casos, un atajo de documento fuera de un campo se traga (preventDefault) sin actuar', () => {
    for (const a of DOCUMENT) expect(shortcutDisposition('cases', a, false), a).toBe('swallow');
  });
  it('en Casos, dentro de un campo de Casos el atajo sigue su camino, y las herramientas también', () => {
    for (const a of DOCUMENT) expect(shortcutDisposition('cases', a, true), a).toBe('ignore');
    for (const a of TOOLS) expect(shortcutDisposition('cases', a, false), a).toBe('ignore');
  });
  it('en las demás vistas actúa lo que corresponde y el resto se deja pasar', () => {
    expect(shortcutDisposition('canvas', 'undo', false)).toBe('run');
    expect(shortcutDisposition('results', 'save', false)).toBe('run');
    expect(shortcutDisposition('results', 'tool:pan', false)).toBe('ignore');
    expect(shortcutDisposition('report', 'tool:select', false)).toBe('ignore');
  });
});
