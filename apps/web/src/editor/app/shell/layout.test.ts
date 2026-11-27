import { describe, expect, it } from 'vitest';
import { DESKTOP_MIN_PX, DESKTOP_QUERY, fitInsetsFor, FIT_INSETS_DESKTOP, FIT_INSETS_MOBILE, hudWidth, MOBILE_MAX_PX, sideWidth, undoRedoInMenu, widthClass } from './layout';

describe('anchos del armazón (contrato §2)', () => {
  it('puntos de corte: 760 es móvil y 761 ya es escritorio', () => {
    expect(MOBILE_MAX_PX).toBe(760);
    expect(DESKTOP_MIN_PX).toBe(761);
    expect(DESKTOP_QUERY).toBe('(min-width: 761px)');
    expect([320, 390, 760].map(widthClass)).toEqual(['mobile', 'mobile', 'mobile']);
    expect([761, 768, 1024, 1099].map(widthClass)).toEqual(['compact', 'compact', 'compact', 'compact']);
    expect([1100, 1279].map(widthClass)).toEqual(['medium', 'medium']);
    expect([1280, 1440, 1920].map(widthClass)).toEqual(['wide', 'wide', 'wide']);
  });
  it('barra lateral: 340, y 300 entre 761 y 1099', () => {
    expect([320, 760].map(sideWidth)).toEqual([null, null]);
    expect([761, 1099].map(sideWidth)).toEqual([300, 300]);
    expect([1100, 1280, 1440].map(sideWidth)).toEqual([340, 340, 340]);
  });
  it('HUD: 330, 300 entre 1100 y 1279 y 280 entre 761 y 1099', () => {
    expect(hudWidth(390)).toBeNull();
    expect([761, 1024, 1099].map(hudWidth)).toEqual([280, 280, 280]);
    expect([1100, 1279].map(hudWidth)).toEqual([300, 300]);
    expect([1280, 1440].map(hudWidth)).toEqual([330, 330]);
  });
  it('fitInsets: los del contrato §4.2 desde 761 px y 16 por debajo', () => {
    expect(fitInsetsFor(1440)).toEqual({ top: 24, right: 92, bottom: 72, left: 24 });
    expect(fitInsetsFor(761)).toEqual({ top: 24, right: 92, bottom: 72, left: 24 });
    expect(fitInsetsFor(760)).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
    expect(fitInsetsFor(320)).toBe(FIT_INSETS_MOBILE);
    expect(fitInsetsFor(1280)).toBe(FIT_INSETS_DESKTOP); // identidad estable: el lienzo no reencuadra sin motivo
  });
  it('Deshacer y Rehacer se pliegan en «Editar» con 480 px o menos', () => {
    expect([320, 480].map(undoRedoInMenu)).toEqual([true, true]);
    expect([481, 760, 1440].map(undoRedoInMenu)).toEqual([false, false, false]);
  });
});
