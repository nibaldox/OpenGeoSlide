// R15B-11: contador de segundos transcurridos (y método en curso si se informa) en ResultSummary y Casos de verificación.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCasesProgress } from '../../App';
import { ResultSummary, formatBusyText } from './ResultSummary';

describe('R15B-11: progreso en cálculos largos', () => {
  it('formatBusyText incluye segundos transcurridos y el método si se informa', () => {
    expect(formatBusyText(0)).toBe('Calculando… (0 s)');
    expect(formatBusyText(12.8)).toBe('Calculando… (12 s)');
    expect(formatBusyText(5, 'spencer')).toBe('Calculando Spencer… (5 s)');
    expect(formatBusyText(-2, 'janbu_corrected')).toBe('Calculando Janbu corregido… (0 s)');
  });

  it('ResultSummary ocupado muestra el contador de segundos y el método si se proporciona', () => {
    const htmlPlain = renderToStaticMarkup(
      createElement(ResultSummary, { run: null, current: false, busy: true, shownMethod: null, elapsedSeconds: 7 }),
    );
    expect(htmlPlain).toContain('data-testid="calc-progress"');
    expect(htmlPlain).toContain('Calculando… (7 s)');

    const htmlMethod = renderToStaticMarkup(
      createElement(ResultSummary, {
        run: null,
        current: false,
        busy: true,
        shownMethod: null,
        elapsedSeconds: 4,
        activeMethod: 'morgenstern_price',
      }),
    );
    expect(htmlMethod).toContain('Calculando Morgenstern-Price… (4 s)');
  });

  it('formatCasesProgress muestra segundos y método en Casos de verificación', () => {
    expect(formatCasesProgress(0)).toBe('Comprobando… (0 s)');
    expect(formatCasesProgress(9, 'spencer')).toBe('Comprobando Spencer… (9 s)');
  });
});
