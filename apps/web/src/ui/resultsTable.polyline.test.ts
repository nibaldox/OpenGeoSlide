// F3-W1f: la tabla de resultados con superficie polilínea, función de M-P y f₀ de Janbu corregido.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { ResultsTable } from './ResultsTable';

const poly = (n: number) => ({ points: Array.from({ length: n }, (_, i): [number, number] => [i * 5, 10 - i]) });
const rep = (o: Partial<MethodReport>): MethodReport =>
  ({ method: 'spencer', fos: 1.25, status: 'converged', iterations: 4, lambda: 0.3, surface: poly(5), slices: [], search: null, warnings: [], ...o }) as MethodReport;
const render = (report: AnalysisReport, lengthUnit?: string): string =>
  renderToStaticMarkup(createElement(ResultsTable, { report, elapsedMs: 3, shownMethod: null, onShowMethod: () => undefined, lengthUnit }));

describe('superficie polilínea', () => {
  const report: AnalysisReport = { engine: 'ogs-core', results: [rep({ method: 'spencer' }), rep({ method: 'janbu_simplified', lambda: null })] };
  it('una sola columna «Superficie fija» con «Polilínea (n puntos)»; sin centro ni radio', () => {
    const html = render(report, 'm');
    expect(html).toContain('<th scope="col">Superficie fija</th>');
    expect((html.match(/Polilínea \(5 puntos\)/g) ?? []).length).toBe(2);
    expect(html).not.toContain('Centro (xc');
    expect(html).not.toContain('Radio (');
    expect(html).not.toContain('NaN');
  });
  it('la columna aparece aunque no haya `lengthUnit` (no necesita unidad)', () => {
    expect(render(report)).toContain('Polilínea (5 puntos)');
  });
  it('el pie ocupa todas las columnas', () => {
    const cols = (html: string): number => (html.match(/<th scope="col"/g) ?? []).length;
    const html = render(report, 'm');
    expect(html).toContain(`colSpan="${cols(html) - 1}"`);
    // círculo con unidad: 10 columnas de cabecera → colSpan 9, como antes
    const circle = render({ engine: 'x', results: [rep({ surface: { xc: 1, yc: 2, r: 3 } })] }, 'm');
    expect(circle).toContain(`colSpan="${cols(circle) - 1}"`);
    expect(circle).toContain('colSpan="9"');
  });
  it('un informe mixto conserva centro y radio y pone la polilínea en la primera celda', () => {
    const html = render({ engine: 'x', results: [rep({ surface: { xc: 1, yc: 2, r: 3 } }), rep({})] }, 'm');
    expect(html).toContain('Centro (xc; yc) (m)');
    expect(html).toContain('Polilínea (5 puntos)');
  });
});

describe('función de M-P y f₀ de Janbu corregido', () => {
  it('Morgenstern-Price muestra su función y Janbu corregido f₀; el resto no muestra nada', () => {
    const html = render({
      engine: 'x',
      results: [
        rep({ method: 'morgenstern_price', interslice: { function: 'half_sine' } }),
        rep({ method: 'janbu_corrected', lambda: null, fos: 1.04, correction_factor: 1.0431 }),
        rep({ method: 'janbu_simplified', lambda: null, fos: 1.0 }),
        rep({ method: 'bishop', lambda: null, surface: { xc: 1, yc: 2, r: 3 } }),
      ],
    });
    expect(html).toContain('Función: Medio seno');
    expect(html).toContain('f₀ = 1,043');
    expect((html.match(/Función:/g) ?? []).length).toBe(1);
    expect((html.match(/f₀ =/g) ?? []).length).toBe(1);
  });
  it('M-P con puntos indica cuántos; sin convergencia no se muestra f₀', () => {
    const html = render({
      engine: 'x',
      results: [
        rep({ method: 'morgenstern_price', interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] } }),
        rep({ method: 'janbu_corrected', status: 'not_converged', correction_factor: 1.2 }),
      ],
    });
    expect(html).toContain('Función: Definida por puntos (3 puntos)');
    expect(html).not.toContain('f₀');
  });
  it('el detalle va dentro de la celda del método (se lee junto a su nombre)', () => {
    const html = render({ engine: 'x', results: [rep({ method: 'janbu_corrected', lambda: null, correction_factor: 1.1 })] });
    expect(html).toMatch(/<td>Janbu corregido<br\/><span class="muted small">f₀ = 1,100<\/span><\/td>/);
  });
});
