import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIGHT_SECTION_PALETTE } from './lightPalette';

// La paleta clara por defecto del Canvas 2D (sin DOM) debe coincidir con los valores claros de tokens.css.
describe('LIGHT_SECTION_PALETTE', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const light = (token: string): string => {
    const m = new RegExp(`${token}:\\s*light-dark\\(([^,]+(?:\\([^)]*\\))?[^,]*),`).exec(css.slice(css.indexOf('@supports (color: light-dark')));
    if (!m) throw new Error(`sin token ${token}`);
    return m[1].trim();
  };
  const P = LIGHT_SECTION_PALETTE;

  it('coincide con el valor claro de cada token --canvas-*', () => {
    expect(P.bg).toBe(light('--canvas-bg'));
    expect(P.grid).toBe(light('--canvas-grid'));
    expect(P.axis).toBe(light('--canvas-axis'));
    expect(P.axisText).toBe(light('--canvas-axis-text'));
    expect(P.halo).toBe(light('--canvas-halo'));
    expect(P.regionEdge).toBe(light('--canvas-region-edge'));
    expect(P.surface).toBe(light('--canvas-surface'));
    expect(P.piezo).toBe(light('--canvas-piezo'));
    expect(P.sliceFill).toBe(light('--canvas-slice-fill'));
    expect(P.sliceEdge).toBe(light('--canvas-slice-edge'));
    expect(P.materialUnknown).toBe(light('--canvas-mat-unknown'));
    expect(P.materials).toHaveLength(7);
    P.materials.forEach((c, i) => expect(c).toBe(light(`--canvas-mat-${i}`)));
  });
});
