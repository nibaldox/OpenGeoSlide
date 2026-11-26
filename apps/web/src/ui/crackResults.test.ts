// F5.4 y F5.7: la grieta de tracción en los resultados (tabla bajo «Resultados») y en «Diagnósticos» (resumen), con resultados simulados que traen `tension_crack`.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { createFakeStore } from '../editor/canvas/fakeStore';
import { DiagnosticsPanel } from '../editor/panels/DiagnosticsPanel';
import { CrackSummary, CrackTable } from './CrackResults';
import { ResultsTable } from './ResultsTable';

const rep = (o: Partial<MethodReport> = {}): MethodReport =>
  ({ method: 'bishop', fos: 0.924, status: 'converged', iterations: 4, lambda: null, surface: { xc: 52, yc: 45, r: 24 }, slices: [], search: null, warnings: [], tension_crack: { x: 47.123, depth: 2.4, water_force: 28.2 }, ...o }) as MethodReport;
const report = (...r: MethodReport[]): AnalysisReport => ({ engine: 'ogs-core 0.5.0', results: r });

describe('CrackTable (resultados)', () => {
  it('una fila por método con grieta: x_c, profundidad, fracción de agua y Pw con unidades', () => {
    const html = renderToStaticMarkup(createElement(CrackTable, { report: report(rep(), rep({ method: 'spencer', tension_crack: { x: 47.123, depth: 2.4, water_force: 28.2 } })), tensionCrack: { depth: 2.4, water_fill: 1 }, units: 'SI' }));
    expect(html).toContain('data-testid="crack-results"');
    expect(html).toContain('>Grieta de tracción en la superficie final<');
    for (const h of ['x_c (m)', 'Profundidad (m)', 'Agua en la grieta', 'Pw (kN/m)']) expect(html).toContain(`>${h}<`);
    expect(html).toContain('>47,123<');
    expect(html).toContain('>100 % (llena)<');
    expect(html).toContain('>28,2<');
    expect((html.match(/<tr>/g) ?? []).length).toBe(3);
    expect(html).toContain('Sin sismo.');
  });
  it('sin grieta en los resultados no pinta nada; en imperial usa ft y lbf/ft', () => {
    expect(renderToStaticMarkup(createElement(CrackTable, { report: report(rep({ tension_crack: undefined })) }))).toBe('');
    const ft = renderToStaticMarkup(createElement(CrackTable, { report: report(rep()), units: 'imperial' }));
    expect(ft).toContain('x_c (ft)');
    expect(ft).toContain('Pw (lbf/ft)');
  });
  it('ResultsTable la incluye bajo la tabla de resultados y la omite sin grieta', () => {
    const base = { elapsedMs: 3, shownMethod: null, onShowMethod: () => {}, lengthUnit: 'm' } as const;
    expect(renderToStaticMarkup(createElement(ResultsTable, { ...base, report: report(rep()), tensionCrack: { depth: 'auto', water_fill: 0.5 } }))).toContain('>50 %<');
    expect(renderToStaticMarkup(createElement(ResultsTable, { ...base, report: report(rep({ tension_crack: undefined })) }))).not.toContain('crack-results');
  });
});

describe('CrackSummary (Diagnósticos)', () => {
  it('lista x_c, profundidad y Pw por método, con la fracción de agua del modelo', () => {
    const html = renderToStaticMarkup(createElement(CrackSummary, { report: report(rep()), tensionCrack: { depth: 2.4, water_fill: 0 }, units: 'SI' }));
    expect(html).toContain('Grieta de tracción en el resultado');
    expect(html).toContain('x_c = 47,12 m, profundidad = 2,4 m, Pw = 28,2 kN/m');
    expect(html).toContain('agua en la grieta: 0 % (seca)');
  });
  it('el panel Diagnósticos la muestra tras la lista de incidencias, sin contarla como incidencia', () => {
    const store = createFakeStore();
    const resultInfo = createElement(CrackSummary, { report: report(rep()), units: 'SI' });
    const html = renderToStaticMarkup(createElement(DiagnosticsPanel, { store, resultInfo }));
    expect(html).toContain('data-testid="crack-summary"');
    expect(html.indexOf('Sin incidencias')).toBeLessThan(html.indexOf('data-testid="crack-summary"'));
    expect(renderToStaticMarkup(createElement(DiagnosticsPanel, { store }))).not.toContain('crack-summary');
  });
});
