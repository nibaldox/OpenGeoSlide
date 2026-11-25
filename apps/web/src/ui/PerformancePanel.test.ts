import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PerformancePanel } from './PerformancePanel';

const render = (summary: { runs: number; avg: number; min: number; max: number } | null): string =>
  renderToStaticMarkup(
    createElement(PerformancePanel, { summary, runs: 5, busy: false, onRunsChange: () => {}, onMeasure: () => {} }),
  );

describe('PerformancePanel: textos (R7-19)', () => {
  it('la ayuda explica qué se mide sin nombrar APIs internas del navegador', () => {
    const html = render(null);
    expect(html).toContain('Mide cuánto tarda el análisis en el motor de cálculo, repitiéndolo el número de veces indicado (tiempos en milisegundos).');
    expect(html).not.toMatch(/performance\.now|worker/i);
  });

  it('con resultados muestra repeticiones, promedio, mínimo y máximo en ms', () => {
    const html = render({ runs: 5, avg: 12.34, min: 10, max: 15 });
    for (const word of ['Repeticiones', 'Promedio', 'Mínimo', 'Máximo']) expect(html).toContain(word);
    expect(html).toContain('ms');
  });
});
