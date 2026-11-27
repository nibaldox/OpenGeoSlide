// UA-E3 §3: las pestañas de «Vistas» recortadas se muestran con un borde del lado que falta.
import { describe, expect, it } from 'vitest';
import { scrollToReveal, tabsEdges } from './tabsOverflow';

describe('tabsEdges', () => {
  it('si caben, sin bordes', () => expect(tabsEdges({ scrollLeft: 0, clientWidth: 413, scrollWidth: 413 })).toEqual({ start: false, end: false }));
  it('recortadas a la derecha (761 px: «Informe» no cabe)', () => expect(tabsEdges({ scrollLeft: 0, clientWidth: 413, scrollWidth: 520 })).toEqual({ start: false, end: true }));
  it('desplazadas hasta el final: el borde pasa al otro lado', () => expect(tabsEdges({ scrollLeft: 107, clientWidth: 413, scrollWidth: 520 })).toEqual({ start: true, end: false }));
  it('en medio, los dos', () => expect(tabsEdges({ scrollLeft: 50, clientWidth: 413, scrollWidth: 520 })).toEqual({ start: true, end: true }));
  it('un redondeo de subpíxel no cuenta', () => expect(tabsEdges({ scrollLeft: 0.4, clientWidth: 413, scrollWidth: 413.6 })).toEqual({ start: false, end: false }));
});

describe('scrollToReveal', () => {
  const box = { scrollLeft: 0, clientWidth: 400, scrollWidth: 520 };
  it('una pestaña a la vista no mueve nada', () => expect(scrollToReveal(box, { left: 10, width: 80 })).toBe(0));
  it('una pestaña recortada a la derecha se desplaza lo justo', () => expect(scrollToReveal(box, { left: 330, width: 120 })).toBe(50));
  it('una pestaña recortada a la izquierda', () => expect(scrollToReveal({ ...box, scrollLeft: 100 }, { left: 40, width: 80 })).toBe(40));
});
