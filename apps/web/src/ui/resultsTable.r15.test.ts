// R15B-08: ResultsTable rotula «Superficie crítica» cuando hay búsqueda (como el PDF) y resume
// las pasadas de Hoek-Brown y las estadísticas de la búsqueda no circular (semillas, evaluadas, seed_fos y polyline_fos).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { ResultsTable } from './ResultsTable';

const poly = (n: number) => ({ points: Array.from({ length: n }, (_, i): [number, number] => [i * 5, 10 - i]) });
const rep = (o: Partial<MethodReport>): MethodReport =>
  ({
    method: 'spencer',
    fos: 1.384,
    status: 'converged',
    iterations: 6,
    lambda: 0.25,
    surface: poly(9),
    slices: [],
    search: null,
    warnings: [],
    ...o,
  }) as MethodReport;

const render = (report: AnalysisReport, lengthUnit = 'm'): string =>
  renderToStaticMarkup(createElement(ResultsTable, { report, elapsedMs: 12.5, shownMethod: 'spencer', onShowMethod: () => undefined, lengthUnit }));

describe('R15B-08: tabla de resultados v0.6', () => {
  it('rotula «Superficie crítica» cuando hay búsqueda no circular y conserva «Superficie fija» sin búsqueda', () => {
    const ncReport: AnalysisReport = {
      engine: 'ogs-core 0.4.0',
      results: [
        rep({
          search: { evaluated: 4000, valid: 1200, non_circular: { seeds: 3, evaluated: 950, seed_fos: 1.402, polyline_fos: 1.384 } },
        }),
      ],
    };
    const htmlSearch = render(ncReport);
    expect(htmlSearch).toContain('<th scope="col">Superficie crítica</th>');
    expect(htmlSearch).not.toContain('<th scope="col">Superficie fija</th>');

    const fixedReport: AnalysisReport = { engine: 'ogs-core 0.4.0', results: [rep({ search: null })] };
    expect(render(fixedReport)).toContain('<th scope="col">Superficie fija</th>');
  });

  it('muestra el resumen no circular con semillas, evaluadas, seed_fos y polyline_fos (y caso sin polilínea admisible)', () => {
    const html = render({
      engine: 'ogs-core 0.4.0',
      results: [
        rep({
          method: 'spencer',
          search: { evaluated: 4000, valid: 1200, non_circular: { seeds: 3, evaluated: 421, seed_fos: 1.402, polyline_fos: 1.384 } },
        }),
        rep({
          method: 'janbu_simplified',
          fos: 1.31,
          lambda: null,
          surface: { xc: 10, yc: 20, r: 15 },
          search: { evaluated: 4000, valid: 1200, non_circular: { seeds: 2, evaluated: 0, seed_fos: 1.31 } },
        }),
      ],
    });
    expect(html).toContain('data-testid="non-circular-summary"');
    expect(html).toContain('Búsqueda no circular (refinamiento de semillas)');
    expect(html).toContain('1,402');
    expect(html).toContain('1,384');
    expect(html).toContain('421');
    expect(html).toContain('Polilínea');
    expect(html).toContain('Sin polilínea admisible');
    expect(html).toContain('Círculo');
  });

  it('muestra las pasadas del lazo de Hoek-Brown en la celda del método (singular y plural)', () => {
    const html = render({
      engine: 'ogs-core 0.4.0',
      results: [
        rep({
          method: 'bishop',
          lambda: null,
          surface: { xc: 10, yc: 20, r: 15 },
          strength: { passes: 11, slices: [{ index: 0, law: 'hoek_brown', normal_stress: 120 }] },
        }),
        rep({
          method: 'spencer',
          surface: { xc: 10, yc: 20, r: 15 },
          strength: { passes: 1, slices: [{ index: 0, law: 'hoek_brown', normal_stress: 120 }] },
        }),
      ],
    });
    expect(html).toContain('Hoek-Brown: 11 pasadas');
    expect(html).toContain('Hoek-Brown: 1 pasada');
  });
});
