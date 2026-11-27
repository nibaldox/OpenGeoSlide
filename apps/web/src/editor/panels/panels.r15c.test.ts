// W-R15c (tarea 4): la alerta y la nota de Ito-Matsui con materiales no lineales ocupan el ancho completo (.ep-wide).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('W-R15c: alerta de Ito-Matsui a ancho completo (.ep-wide)', () => {
  const css = readFileSync(new URL('./panels.css', import.meta.url), 'utf8');
  const tsx = readFileSync(new URL('./ReinforcementsPanel.tsx', import.meta.url), 'utf8');

  it('panels.css extiende cualquier elemento .ep-wide por todas las columnas de .ep-grid', () => {
    // Regla general .ep-wide (no limitada a .ep-field.ep-wide), de modo que <p className="ep-error ep-wide"> abarque 1 / -1.
    expect(css).toMatch(/(?:^|[,\s])\.ep-wide(?:\s*,|\s*\{)[^}]*grid-column:\s*1\s*\/\s*-1/m);
    // Conserva compatibilidad con el selector .ep-field.ep-wide comprobado por ReinforcementsPanel.layout.test.ts.
    expect(css).toMatch(/\.ep-field\.ep-wide\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });

  it('ReinforcementsPanel aplica ep-wide tanto a la alerta (ep-error) como a la nota informativa (ep-note)', () => {
    expect(tsx).toContain("ito ? 'ep-error ep-wide' : 'ep-note small ep-wide'");
  });
});
