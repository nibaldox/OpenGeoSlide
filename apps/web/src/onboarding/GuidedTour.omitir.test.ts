// CM-W2: «Omitir» en la guía de primera visita. En la prueba a ciegas, un agente pulsó «Omitir» en el paso 2 y leyó «Paso 1 de 5» en la
// página: la guía se había cerrado (el estado vuelve a `initialTour`, índice 0), pero el cuadro seguía en el DOM, oculto, con el texto del
// paso 1 y sus botones. Reproducido en Chrome con un contexto limpio (1440 × 900, 780 × 437, 390 × 844): el clic en «Omitir» cierra en los
// 5 pasos, y el texto que queda es el del cuadro oculto. Cerrada, la guía no debe dejar nada en el DOM.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GuidedTour, type GuidedTourProps } from './GuidedTour';
import { TOUR_STEPS, initialTour, tourReducer } from './tour';

const noop = (): void => {};
const render = (over: Partial<GuidedTourProps>): string =>
  renderToStaticMarkup(createElement(GuidedTour, { open: false, index: 0, focusOnOpen: false, onNext: noop, onPrev: noop, onSkip: noop, fallbackFocus: () => null, ...over }));

describe('«Omitir» no deja el texto de un paso en la página', () => {
  it('cerrada: ni cuadro, ni anillo, ni «Paso 1 de 5», ni botones; solo la región viva (vacía)', () => {
    const html = render({ open: false, index: 0 });
    expect(html).not.toContain('guided-tour');
    expect(html).not.toContain('tour-ring');
    expect(html).not.toMatch(/Paso \d de \d/);
    expect(html).not.toContain('Omitir');
    expect(html).not.toContain('Anterior');
    expect(html).not.toContain('Siguiente');
    expect(html).toContain('data-testid="tour-live"');
  });

  it('abierta en el paso 2: «Paso 2 de 5» y los tres botones', () => {
    const html = render({ open: true, index: 1 });
    expect(html).toContain('Paso 2 de 5');
    expect(html).toContain(TOUR_STEPS[1]!.title);
    for (const b of ['Omitir', 'Anterior', 'Siguiente']) expect(html).toContain(b);
    expect(html).toContain('data-testid="guided-tour"');
  });

  it('«Omitir» desde cada paso lleva al estado cerrado, y cerrado no se pinta nada (aunque el índice vuelva a 0)', () => {
    for (let step = 0; step < TOUR_STEPS.length; step += 1) {
      let state = tourReducer(initialTour(), { type: 'open' });
      for (let i = 0; i < step; i += 1) state = tourReducer(state, { type: 'next' });
      expect(state).toEqual({ open: true, index: step });
      state = tourReducer(state, { type: 'skip' });
      expect(state.open).toBe(false);
      const html = render({ open: state.open, index: state.index });
      expect(html, `tras omitir en el paso ${step + 1}`).not.toMatch(/Paso \d de \d/);
    }
  });

  it('el último paso dice «Terminar» y sigue habiendo «Omitir»', () => {
    const html = render({ open: true, index: TOUR_STEPS.length - 1 });
    expect(html).toContain('Terminar');
    expect(html).toContain('Omitir');
  });
});
