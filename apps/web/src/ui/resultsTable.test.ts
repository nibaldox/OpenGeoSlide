import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../engine/types';
import { formatNumber, METHOD_LABELS, ResultsTable } from './ResultsTable';

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

  it('muestra "—" en la columna FS cuando el método no convergió, aunque el motor dé un número (R4-06)', () => {
    const html = render({
      engine: 'ogs-core 0.1.0',
      results: [methodReport({ fos: 250.187978, status: 'not_converged', warnings: ['max_iterations'] })],
    });
    expect(html).toContain('<td class="num">—</td>');
    expect(html).not.toContain('250');
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

  it('asocia cada aviso al método que lo emitió (R2-09)', () => {
    const html = render({
      engine: 'ogs-core 0.1.0',
      results: [
        methodReport({ method: 'bishop', warnings: ['water_above_ground'] }),
        methodReport({ method: 'spencer', warnings: ['negative_effective_normal_major'] }),
      ],
    });
    const items = html.split('<li>').slice(1);
    const water = items.find((item) => item.includes('El agua sobre el terreno'));
    const major = items.find((item) => item.includes('Normal efectiva negativa en una parte importante'));
    expect(water).toBeDefined();
    expect(water).toContain(METHOD_LABELS.bishop);
    expect(water).not.toContain(METHOD_LABELS.spencer);
    expect(major).toBeDefined();
    expect(major).toContain(METHOD_LABELS.spencer);
    expect(major).not.toContain(METHOD_LABELS.bishop);
  });

  it('un mismo código emitido por los dos métodos aparece dos veces, cada una con su método', () => {
    const html = render({
      engine: 'ogs-core 0.1.0',
      results: [
        methodReport({ method: 'bishop', warnings: ['water_above_ground'] }),
        methodReport({ method: 'spencer', warnings: ['water_above_ground'] }),
      ],
    });
    const items = html.split('<li>').filter((item) => item.includes('El agua sobre el terreno'));
    expect(items).toHaveLength(2);
    expect(items[0]).toContain(METHOD_LABELS.bishop);
    expect(items[1]).toContain(METHOD_LABELS.spencer);
  });
});
