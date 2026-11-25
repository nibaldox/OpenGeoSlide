import { describe, expect, it } from 'vitest';
import { nextRovingIndex, tabStopIndex } from './rovingTabIndex';

const base = { count: 4, orientation: 'horizontal' as const };

describe('nextRovingIndex', () => {
  it('avanza y retrocede con las flechas horizontales y da la vuelta', () => {
    expect(nextRovingIndex({ ...base, key: 'ArrowRight', index: 0 })).toBe(1);
    expect(nextRovingIndex({ ...base, key: 'ArrowRight', index: 3 })).toBe(0);
    expect(nextRovingIndex({ ...base, key: 'ArrowLeft', index: 0 })).toBe(3);
    expect(nextRovingIndex({ ...base, key: 'ArrowLeft', index: 2 })).toBe(1);
  });
  it('Inicio y Fin van a los extremos', () => {
    expect(nextRovingIndex({ ...base, key: 'Home', index: 2 })).toBe(0);
    expect(nextRovingIndex({ ...base, key: 'End', index: 1 })).toBe(3);
  });
  it('sin vuelta se detiene en el extremo', () => {
    expect(nextRovingIndex({ ...base, key: 'ArrowRight', index: 3, wrap: false })).toBe(3);
    expect(nextRovingIndex({ ...base, key: 'ArrowLeft', index: 0, wrap: false })).toBe(0);
  });
  it('en horizontal no intercepta las flechas verticales; en vertical, no las horizontales', () => {
    expect(nextRovingIndex({ ...base, key: 'ArrowDown', index: 0 })).toBeNull();
    expect(nextRovingIndex({ count: 3, orientation: 'vertical', key: 'ArrowRight', index: 0 })).toBeNull();
    expect(nextRovingIndex({ count: 3, orientation: 'vertical', key: 'ArrowDown', index: 0 })).toBe(1);
    expect(nextRovingIndex({ count: 3, orientation: 'vertical', key: 'ArrowUp', index: 0 })).toBe(2);
  });
  it('no intercepta otras teclas (Tab, Intro, letras)', () => {
    for (const key of ['Tab', 'Enter', ' ', 'a', 'Escape']) expect(nextRovingIndex({ ...base, key, index: 1 })).toBeNull();
  });
  it('desde fuera de la lista, la flecha entra por el extremo correspondiente', () => {
    expect(nextRovingIndex({ ...base, key: 'ArrowRight', index: -1 })).toBe(0);
    expect(nextRovingIndex({ ...base, key: 'ArrowLeft', index: -1 })).toBe(3);
  });
  it('rtl invierte las flechas horizontales', () => {
    expect(nextRovingIndex({ ...base, key: 'ArrowRight', index: 2, rtl: true })).toBe(1);
  });
  it('sin elementos no hace nada', () => {
    expect(nextRovingIndex({ count: 0, orientation: 'both', key: 'Home', index: -1 })).toBeNull();
  });
});

describe('tabStopIndex', () => {
  it('conserva el recordado mientras esté habilitado', () => {
    expect(tabStopIndex([true, true, true], 2)).toBe(2);
  });
  it('si el recordado se deshabilitó, vuelve al primero habilitado', () => {
    expect(tabStopIndex([false, true, false], 2)).toBe(1);
    expect(tabStopIndex([true, true], -1)).toBe(0);
  });
  it('sin elementos habilitados devuelve -1', () => {
    expect(tabStopIndex([false, false], 0)).toBe(-1);
    expect(tabStopIndex([], 0)).toBe(-1);
  });
});
