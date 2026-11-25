// UX9-05: el FS se muestra siempre con 3 decimales y el resumen ofrece ir a la tabla completa.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import { ResultsTable } from '../../ui/ResultsTable';
import { ResultSummary } from './ResultSummary';
import type { EngineRun } from './reportInput';
import { calcAnnouncement, focusResultsTable, summaryItems } from './resultSummary';

const method = (m: 'bishop' | 'spencer', fos: number | null): MethodReport =>
  ({ method: m, status: fos === null ? 'not_converged' : 'converged', fos: fos ?? 0, lambda: m === 'spencer' ? 0.3 : null, iterations: 5, warnings: [], slices: [], surface: { xc: 0, yc: 0, r: 1 }, search: null }) as unknown as MethodReport;
const report = (...r: MethodReport[]): AnalysisReport => ({ engine: 'ogs-core 0.1.0', results: r }) as unknown as AnalysisReport;
const run = (rep: AnalysisReport): EngineRun => ({ revision: 1, doc: {} as never, json: '', sha256: 'a'.repeat(64), report: rep, elapsedMs: 3, checkedAt: '' });

describe('FS con 3 decimales', () => {
  it('el resumen no recorta los ceros: 1,2 se escribe 1,200 y 2 se escribe 2,000', () => {
    const items = summaryItems(report(method('bishop', 2), method('spencer', 1.2)));
    expect(items.map((i) => i.fs)).toEqual(['2,000', '1,200']);
    expect(summaryItems(report(method('bishop', 0.98532)))[0]!.fs).toBe('0,985');
    expect(summaryItems(report(method('bishop', 0.9996)))[0]!.fs).toBe('1,000');
    expect(summaryItems(report(method('spencer', null)))[0]!.fs).toBe('—');
  });

  it('el anuncio y la franja usan el mismo texto', () => {
    expect(calcAnnouncement(report(method('bishop', 1.2), method('spencer', 1.05)))).toBe('Cálculo completado: Bishop FS 1,200; Spencer FS 1,050');
    const html = renderToStaticMarkup(createElement(ResultSummary, { run: run(report(method('spencer', 1.2))), current: true, busy: false, shownMethod: null }));
    expect(html).toContain('data-testid="fs-spencer"');
    expect(html).toMatch(/FS<\/span> 1,200/);
  });

  it('la tabla de resultados también escribe el FS con 3 decimales', () => {
    const html = renderToStaticMarkup(createElement(ResultsTable, { report: report(method('spencer', 1.2)), elapsedMs: 3, shownMethod: null, onShowMethod: () => {} }));
    expect(html).toContain('<td class="num">1,200</td>');
  });
});

describe('«Ver tabla de resultados»', () => {
  it('aparece con resultados y no antes del primer cálculo', () => {
    const withRun = renderToStaticMarkup(createElement(ResultSummary, { run: run(report(method('bishop', 1.1))), current: true, busy: false, shownMethod: null }));
    expect(withRun).toContain('Ver tabla de resultados');
    expect(renderToStaticMarkup(createElement(ResultSummary, { run: null, current: false, busy: false, shownMethod: null }))).not.toContain('Ver tabla');
  });

  it('focusResultsTable desplaza y enfoca la tabla; false si no existe', () => {
    const calls: string[] = [];
    const table = { scrollIntoView: (o: unknown) => calls.push(`scroll ${JSON.stringify(o)}`), focus: (o: unknown) => calls.push(`focus ${JSON.stringify(o)}`) };
    const root = { querySelector: (sel: string) => (sel === '[data-results-table]' ? table : null) };
    expect(focusResultsTable(root as never)).toBe(true);
    expect(calls).toEqual(['scroll {"block":"start"}', 'focus {"preventScroll":true}']);
    expect(focusResultsTable({ querySelector: () => null } as never)).toBe(false);
  });

  it('la tabla se puede enfocar (tabindex -1) y lleva la marca que busca el botón', () => {
    const html = renderToStaticMarkup(createElement(ResultsTable, { report: report(method('bishop', 1.1)), elapsedMs: 3, shownMethod: null, onShowMethod: () => {} }));
    const tag = /<table[^>]*>/.exec(html)?.[0] ?? '';
    expect(tag).toContain('data-results-table');
    expect(tag).toContain('tabindex="-1"');
  });
});
