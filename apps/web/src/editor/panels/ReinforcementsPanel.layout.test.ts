import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// R2-I2: las listas del panel «Refuerzos» (Aplicación, Dirección de la fuerza) tienen textos largos; en la rejilla de dos columnas se
// veían cortados («Pasiva (se moviliza con», «Tangente a la superfici»). Ocupan el ancho completo de la tarjeta.
describe('panel «Refuerzos»: listas a todo el ancho', () => {
  const css = readFileSync(new URL('./panels.css', import.meta.url), 'utf8');
  const tsx = readFileSync(new URL('./ReinforcementsPanel.tsx', import.meta.url), 'utf8');
  it('la lista lleva la clase ep-wide y el CSS la extiende por toda la rejilla', () => {
    expect(tsx).toMatch(/className="field ep-field ep-wide"/);
    expect(css).toMatch(/\.ep-field\.ep-wide\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
    expect(css).toMatch(/\.ep-wide select\s*\{[^}]*width:\s*100%/);
  });
});
