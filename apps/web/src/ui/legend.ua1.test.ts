// UA1-S: piel de la leyenda (píldora) y de la tabla de casos. Pruebas de contenido de las hojas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const legend = readFileSync(new URL('./legend.css', import.meta.url), 'utf8');
const checks = readFileSync(new URL('./checkTable.css', import.meta.url), 'utf8');

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

describe('UA1-S: leyenda como píldora', () => {
  it('superficie al 88 %, borde, radio 8 y 12 px', () => {
    const body = rule(legend, 'ul.legend[aria-label]');
    expect(body).toContain('color-mix(in srgb, var(--ui-surface) 88%, transparent)');
    expect(body).toContain('border: 1px solid var(--ui-border)');
    expect(body).toContain('var(--ui-radius-md, 8px)');
    expect(body).toMatch(/font-size:\s*12px/);
    expect(body).toMatch(/padding:\s*7px 10px/);
  });

  it('la leyenda del editor flota a 16 px a la izquierda y a 14 abajo, sin pasar bajo la paleta, y se apila hasta 760 px', () => {
    const body = rule(legend, "ul.legend[aria-label='Leyenda de la sección']");
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/left:\s*16px/);
    expect(body).toMatch(/bottom:\s*14px/);
    expect(body).toContain('max-width: calc(100% - 108px)');
    expect(legend).toMatch(/@media \(max-width: 760px\) \{\s*ul\.legend\[aria-label='Leyenda de la sección'\] \{\s*position: static/);
  });

  it('conserva las muestras de leyenda de siempre', () => {
    for (const sel of ['.legend .swatch.slice', '.legend .swatch.line-blue-dotted', '.legend .swatch.pond', '.legend .swatch.line-crack', '.legend .swatch.mark-inactive']) {
      expect(legend, sel).toContain(sel);
    }
  });
});

describe('UA1-S: tabla de casos', () => {
  it('cabecera de 12 px en --ui-ink-2, cifras en mono tabular y chips con borde de estado', () => {
    expect(rule(checks, '.checks th')).toContain('var(--ui-ink-2');
    expect(rule(checks, '.checks td.num')).toContain('var(--ui-font-mono');
    expect(rule(checks, '.checks td.num')).toContain('tabular-nums');
    expect(rule(checks, '.checks .badge-ok')).toContain('border-color: var(--ui-ok-border)');
    expect(rule(checks, '.checks .badge-fail')).toContain('border-color: var(--ui-err-border)');
    expect(rule(checks, '.badge-warn')).toContain('border: 1px solid var(--ui-warn-border)');
    expect(rule(checks, '.checks .badge')).toMatch(/border-radius:\s*999px/);
  });
});
