import { describe, expect, it } from 'vitest';
import { shouldRefocusTrigger } from './DropdownMenu';

describe('shouldRefocusTrigger', () => {
  it('foco perdido en <body>: vuelve al botón del menú', () => {
    expect(shouldRefocusTrigger({ isBody: true, insideMenu: false, connected: true })).toBe(true);
  });
  it('foco aún en un elemento del menú cerrado: vuelve al botón', () => {
    expect(shouldRefocusTrigger({ isBody: false, insideMenu: true, connected: true })).toBe(true);
  });
  it('elemento desconectado: vuelve al botón', () => {
    expect(shouldRefocusTrigger({ isBody: false, insideMenu: false, connected: false })).toBe(true);
  });
  it('si la acción llevó el foco a un diálogo o al lienzo, no se toca', () => {
    expect(shouldRefocusTrigger({ isBody: false, insideMenu: false, connected: true })).toBe(false);
  });
});
