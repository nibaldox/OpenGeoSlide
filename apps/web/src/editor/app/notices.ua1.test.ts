// UA1-S: piel de los avisos (notices.css). Prueba de contenido de la hoja.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./notices.css', import.meta.url), 'utf8');

/** Cuerpos de las reglas con exactamente ese selector entre sus alternativas, unidos. */
function rule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').split(/,(?![^(]*\))/).map((s) => s.trim());
    if (sels.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`sin regla para ${selector}`);
  return bodies.join('\n');
}

describe('UA1-S: avisos', () => {
  it('cada aviso lleva radio 8, borde del tono del estado y 13 px', () => {
    expect(rule(css, '.ea-notice-bar .ea-notice')).toContain('var(--ui-radius-md, 8px)');
    expect(rule(css, '.ea-notice-bar .ea-notice')).toMatch(/font-size:\s*13px/);
    expect(rule(css, '.ea-notice-bar .ea-notice-aviso')).toContain('var(--ui-warn-border)');
    expect(rule(css, '.ea-notice-bar .ea-notice-error')).toContain('var(--ui-err-border)');
  });

  it('los botones llevan foco de 2 px y miden 40 hasta 760 px; «Cerrar» no se parte', () => {
    expect(rule(css, '.ea-notice-bar button:focus-visible')).toMatch(/outline:\s*2px solid var\(--ui-accent-bright/);
    expect(css).toMatch(/@media \(max-width: 760px\) \{\s*\.ea-notice-bar button \{\s*min-height: 40px/);
    expect(rule(css, '.ea-notice-bar .ea-notice button')).toContain('white-space: nowrap');
  });
});
