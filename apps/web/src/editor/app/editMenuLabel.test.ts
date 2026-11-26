import { describe, expect, it } from 'vitest';
import { editMenuLabel } from './editMenuLabel';

describe('editMenuLabel (R9-11b)', () => {
  it('con «Seleccionar» el disparador sigue siendo «Editar»', () => {
    expect(editMenuLabel('select', 'Seleccionar')).toBe('Editar');
  });
  it('con otra herramienta activa la nombra', () => {
    expect(editMenuLabel('draw_region', 'Dibujar región')).toBe('Editar · Dibujar región');
    expect(editMenuLabel('pan', 'Mover vista')).toBe('Editar · Mover vista');
  });
  it('sin nombre conocido no deja un separador colgando', () => {
    expect(editMenuLabel('pan', undefined)).toBe('Editar');
  });
});
