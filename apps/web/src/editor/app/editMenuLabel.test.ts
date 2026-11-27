import { describe, expect, it } from 'vitest';
import { editMenuLabel } from './editMenuLabel';

describe('editMenuLabel (UA3 A-14)', () => {
  it('el disparador se llama siempre «Editar», con cualquier herramienta activa', () => {
    expect(editMenuLabel()).toBe('Editar');
    // Compatibilidad: una llamada con la firma anterior (herramienta y rótulo) tampoco añade el nombre de la herramienta.
    expect((editMenuLabel as (...args: unknown[]) => string)('draw_region', 'Dibujar región')).toBe('Editar');
  });
});
