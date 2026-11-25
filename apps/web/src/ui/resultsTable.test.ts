import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { formatNumber, ResultsTable } from './ResultsTable';

function methodReport(overrides: Partial<MethodReport>): MethodReport {
  return {
    method: 'bishop',
    fos: 1.25,
    status: 'converged',
    iterations: 4,
    lambda: null,
    surface: { xc: 120, yc: 90, r: 80 },
    slices: [],
    search: null,
    warnings: [],
    ...overrides,
  };
}

function render(report: AnalysisReport): string {
  return renderToStaticMarkup(
    createElement(ResultsTable, { report, elapsedMs: 3, shownMethod: null, onShowMethod: () => {} }),
  );
}

describe('ResultsTable', () => {
  it('muestra "—" en la columna FS cuando fos es null', () => {
    const html = render({
      engine: 'ogs-core 0.1.0',
      results: [methodReport({ fos: null, status: 'invalid', warnings: ['no_driving'] })],
    });
    expect(formatNumber(null)).toBe('—');
    expect(html).toContain('<td class="num">—</td>');
    expect(html).toContain('No válido');
  });

  it('muestra negative_effective_normal como nota y water_above_ground como aviso', () => {
    const html = render({
      engine: 'ogs-core 0.1.0',
      results: [methodReport({ warnings: ['negative_effective_normal', 'water_above_ground'] })],
    });
    expect(html).toContain('class="notes"');
    expect(html).toContain('Normal efectiva negativa en algunas dovelas');
    expect(html).toContain('class="warnings"');
    expect(html).toContain('El agua sobre el terreno se ignora');
    // La nota no se presenta como aviso.
    const avisosBlock = html.slice(html.indexOf('class="warnings"'));
    expect(avisosBlock).not.toContain('Normal efectiva negativa');
  });

  it('no muestra listas de avisos cuando no hay avisos', () => {
    const html = render({ engine: 'ogs-core 0.1.0', results: [methodReport({})] });
    expect(html).not.toContain('class="notes"');
    expect(html).not.toContain('class="warnings"');
  });
});
