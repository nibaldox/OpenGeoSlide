import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STEP_ORDER, type StepState } from '../shellModel';
import type { PanelTabId } from '../issueNav';
import { ActionFoot, type ActionFootProps } from './ActionFoot';
import { PaletteTools } from './PaletteTools';
import { ReportView } from './ReportView';
import { StepList } from './StepList';
import { ViewTabs } from './ViewTabs';

const noop = (): void => undefined;

function states(): Record<PanelTabId, StepState> {
  const out = {} as Record<PanelTabId, StepState>;
  STEP_ORDER.forEach((id, i) => {
    out[id] = { summary: `Resumen ${i}`, status: i === 0 ? 'done' : i === 1 ? 'error' : i === 2 ? 'draft' : 'optional', errorCount: 0 };
  });
  return out;
}

describe('StepList (contrato §4.6)', () => {
  const html = renderToStaticMarkup(createElement(StepList, { order: STEP_ORDER, states: states(), active: 'materials', onSelect: noop, children: createElement('p', null, 'cuerpo del panel') }));
  it('el tablist vertical «Paneles del modelo» contiene solo las diez pestañas', () => {
    expect(html).toMatch(/role="tablist" aria-label="Paneles del modelo" aria-orientation="vertical"/);
    expect((html.match(/role="tab"/g) ?? []).length).toBe(10);
    const tablist = html.slice(html.indexOf('role="tablist"'), html.indexOf('role="tabpanel"'));
    expect((tablist.match(/<button/g) ?? []).length).toBe(10);
    expect(tablist).not.toContain('cuerpo del panel');
  });
  it('el panel es hermano del tablist (fuera de él) y cuelga de la pestaña activa', () => {
    expect(html).toMatch(/<div id="ea-tabpanel" class="ua-panel" role="tabpanel" aria-labelledby="ea-tab-materials" style="order:3">/);
    expect(html).toContain('id="ea-tab-materials"');
    expect(html).toMatch(/id="ea-tab-materials"[^>]*aria-selected="true"/);
    expect(html).toMatch(/<div class="ua-step-row" role="presentation" data-active="true" style="order:2">/);
    expect(html).toMatch(/id="ea-tab-geometry"[^>]*aria-selected="false"/);
    expect(html.match(/aria-controls="ea-tabpanel"/g)).toHaveLength(10);
  });
  it('UA-E2: el texto del botón es solo el título; insignia, resumen y chevron van en un hermano decorativo aria-hidden', () => {
    const row = html.slice(html.indexOf('<div class="ua-step-row"'), html.indexOf('id="ea-tab-materials"'));
    const button = row.slice(row.indexOf('<button'), row.indexOf('</button>') + 9);
    expect(button.replace(/<[^>]+>/g, '')).toBe('Geometría');
    expect(row).toMatch(/role="presentation"/);
    const deco = row.slice(row.indexOf('<div class="ua-step-deco"'));
    expect(deco).toMatch(/^<div class="ua-step-deco" aria-hidden="true">/);
    expect(deco).toContain('>Resumen 0<');
    expect(deco).toContain('>Completo<');
    expect(deco).toMatch(/class="gs-badge ua-badge" data-status="done"/);
    expect(deco).toContain('class="ua-step-chevron"');
    // El resumen llega al lector por aria-describedby (el resumen primero, luego el estado).
    const subId = /id="([^"]+-geometry-s)"/.exec(deco)?.[1];
    const statusId = /id="([^"]+-geometry-b)"/.exec(deco)?.[1];
    expect(subId).toBeTruthy();
    expect(button).toContain(`aria-describedby="${subId} ${statusId}"`);
  });
  it('estados: ✓ en SVG, «!» en SVG, punto en SVG y número del paso en los opcionales', () => {
    expect(html).toMatch(/data-status="error"><svg[^>]*><path d="M12 6v7"/);
    expect(html).toMatch(/data-status="optional">4</);
    expect(html).not.toMatch(/[✓✔⚠▾]/);
  });
});

describe('ViewTabs (contrato §4.7)', () => {
  const html = renderToStaticMarkup(createElement(ViewTabs, { view: 'results', onChange: noop }));
  it('tablist «Vistas» con las cuatro pestañas y sus ids', () => {
    expect(html).toContain('role="tablist" aria-label="Vistas"');
    for (const [id, panel] of [
      ['mode-edit', 'mode-edit-panel'],
      ['view-results', 'view-results-panel'],
      ['mode-cases', 'mode-cases-panel'],
      ['view-report', 'view-report-panel'],
    ]) {
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*aria-controls="${panel}"`));
    }
    expect(html).toMatch(/id="view-results"[^>]*aria-selected="true"/);
  });
  it('UA-E2: el contador es un hermano decorativo del botón; el texto del botón es solo el nombre', () => {
    expect(html.match(/<\/button><span class="ua-view-n" aria-hidden="true">\d<\/span>/g)).toHaveLength(4);
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ''));
    expect(buttons).toEqual(['Lienzo', 'Resultados', 'Casos de verificación', 'Informe']);
  });
});

describe('PaletteTools', () => {
  const html = renderToStaticMarkup(createElement(PaletteTools, { tool: 'pan', onSelect: noop }));
  it('grupo «Herramienta del lienzo» con seis botones gs-tool, aria-label, aria-pressed y tooltip aria-hidden', () => {
    expect(html).toContain('role="group" aria-label="Herramienta del lienzo"');
    expect(html.match(/<button/g)).toHaveLength(6);
    for (const name of ['Seleccionar', 'Agregar vértice', 'Dibujar región', 'Dividir región', 'Dibujar refuerzo', 'Mover vista']) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/class="gs-tip" aria-hidden="true"/g)).toHaveLength(6);
    expect(html).toContain('<kbd class="gs-kbd">F</kbd>');
    expect(html).toContain('aria-keyshortcuts="F E"');
  });
});

const foot = (over: Partial<ActionFootProps> = {}): string =>
  renderToStaticMarkup(
    createElement(ActionFoot, {
      check: { label: 'Comprobar', disabled: false, title: 'Ctrl+Intro', onCheck: noop, variant: 'foot' },
      stale: false,
      busy: false,
      onCancel: noop,
      engineFailed: false,
      onRestartEngine: noop,
      reportBusy: false,
      reportDisabled: false,
      onReport: noop,
      hidden: false,
      ...over,
    }),
  );

describe('ActionFoot', () => {
  it('«Comprobar» con la tecla aria-hidden, «Informe PDF» y sin avisos de más', () => {
    const html = foot();
    expect(html).toContain('<span>Comprobar</span>');
    // UA-E2: la tecla es un hermano decorativo, fuera del botón.
    const button = html.slice(html.indexOf('<button'), html.indexOf('</button>') + 9);
    expect(button.replace(/<[^>]+>/g, '')).toBe('Comprobar');
    expect(html).toMatch(/<\/button><kbd class="gs-kbd ua-kbd" aria-hidden="true">Ctrl Intro<\/kbd>/);
    expect(html).toContain('Informe PDF');
    expect(html).not.toContain('Cancelar cálculo');
    expect(html).not.toContain('Reiniciar el motor');
    expect(html).not.toContain('Hay cambios sin calcular');
  });
  it('aviso de resultado desactualizado, cancelar y reiniciar solo cuando corresponden', () => {
    expect(foot({ stale: true })).toContain('Hay cambios sin calcular');
    expect(foot({ busy: true })).toContain('Cancelar cálculo');
    expect(foot({ engineFailed: true })).toContain('Reiniciar el motor');
  });
  it('la pista de exportación conserva su data-testid', () => {
    expect(foot({ exportHint: 'Pulse «Comprobar»' })).toMatch(/id="ea-export-hint"[^>]*data-testid="export-hint"/);
  });
  it('oculto con la barra plegada', () => {
    expect(foot({ hidden: true })).toContain(' hidden');
  });
});

describe('ReportView', () => {
  const view = (over: Record<string, unknown> = {}): string =>
    renderToStaticMarkup(
      createElement(ReportView, {
        title: 'ACADS 1(a)',
        contents: [
          { label: 'Resultados por método', included: true },
          { label: 'Refuerzos y fuerzas', included: false },
        ],
        hasRun: true,
        reportBusy: false,
        reportDisabled: false,
        onReport: noop,
        csvDisabled: false,
        onCsv: noop,
        onEditTitle: noop,
        ...over,
      }),
    );
  it('h2 «Informe técnico», título en solo lectura y los botones del contrato', () => {
    const html = view();
    expect(html).toContain('>Informe técnico</h2>');
    expect(html).toContain('ACADS 1(a)');
    for (const name of ['Editar título', 'Generar PDF', 'Exportar CSV de resultados']) expect(html).toContain(name);
  });
  it('✓ en SVG solo en lo que se incluye; lo demás lo dice', () => {
    const html = view();
    expect(html).not.toMatch(/[✓✔]/);
    expect(html.match(/data-included="true"/g)).toHaveLength(1);
    expect(html).toContain('Refuerzos y fuerzas (no aplica a este modelo)');
  });
  it('sin cálculo, la lista vacía lo explica; sin título, «Sin título»', () => {
    expect(view({ contents: [], hasRun: false, title: '  ' })).toMatch(/Calcule el modelo[\s\S]*Sin título|Sin título[\s\S]*Calcule el modelo/);
  });
  it('los botones bloqueados llevan disabled', () => {
    expect(view({ reportDisabled: true, csvDisabled: true }).match(/disabled/g)).toHaveLength(2);
  });
});
