import { describe, expect, it } from 'vitest';
import { NARROW_MAX_PX, NARROW_QUERY, toolbarLayout } from './useNarrow';

describe('B-09: barra estrecha', () => {
  it('con 480 px o menos, herramientas y Deshacer/Rehacer van a un menú «Editar»', () => {
    expect(NARROW_MAX_PX).toBe(480);
    expect(NARROW_QUERY).toBe('(max-width: 480px)');
    for (const w of [320, 390, 480]) expect(toolbarLayout(w).editMenu, `${w}`).toBe(true);
    for (const w of [481, 768, 1440]) expect(toolbarLayout(w).editMenu, `${w}`).toBe(false);
  });
});
