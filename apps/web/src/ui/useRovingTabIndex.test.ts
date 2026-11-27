// UA3 A-11: la parada de tabulación sigue a `aria-selected` cuando el foco no está en el grupo.
import { describe, expect, it } from 'vitest';
import { tabStopIndex } from './rovingTabIndex';
import { rememberedIndex } from './useRovingTabIndex';

const stopFor = (o: { focusInside: boolean; remembered: number; selected: number; enabled: boolean[] }): number => tabStopIndex(o.enabled, rememberedIndex(o));
const all4 = [true, true, true, true];

describe('rememberedIndex', () => {
  it('cambio programático (foco fuera del grupo): manda la pestaña seleccionada, no la última enfocada', () => {
    // «Editar título» abre Proyecto (3) y la última pestaña enfocada era Geometría (0).
    expect(stopFor({ focusInside: false, remembered: 0, selected: 3, enabled: all4 })).toBe(3);
  });
  it('sin pestaña recordada, también la seleccionada (antes: la primera habilitada)', () => {
    expect(stopFor({ focusInside: false, remembered: -1, selected: 2, enabled: all4 })).toBe(2);
  });
  it('con el foco dentro del grupo manda el último enfocado (flechas)', () => {
    expect(stopFor({ focusInside: true, remembered: 1, selected: 3, enabled: all4 })).toBe(1);
  });
  it('una pestaña seleccionada deshabilitada no se toma: cae al recordado o al primero habilitado', () => {
    expect(stopFor({ focusInside: false, remembered: 1, selected: 3, enabled: [true, true, true, false] })).toBe(1);
    expect(stopFor({ focusInside: false, remembered: -1, selected: 0, enabled: [false, true, true, true] })).toBe(1);
  });
  it('sin ninguna seleccionada (barra de herramientas), se conserva lo recordado', () => {
    expect(stopFor({ focusInside: false, remembered: 2, selected: -1, enabled: all4 })).toBe(2);
  });
});
