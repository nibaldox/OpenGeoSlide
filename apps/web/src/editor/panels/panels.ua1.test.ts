// UA1-S: piel de los paneles (panels.css, geometry.css, project.css). Pruebas de contenido de las hojas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string): string => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
const panels = read('panels.css');
const geometry = read('geometry.css');
const project = read('project.css');

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

describe('UA1-S: piel de los paneles', () => {
  it('etiqueta encima en --ui-ink-2 de 12 px', () => {
    const body = rule(panels, '.ep-panel .ep-field > label');
    expect(body).toContain('var(--ui-ink-2');
    expect(body).toMatch(/font-size:\s*12px/);
  });

  it('controles de 32 de alto, fondo hundido y borde de control', () => {
    const sel = ".ep-panel input:not([type='checkbox'], [type='radio'], [type='file'], [type='range'])";
    const body = rule(panels, sel);
    expect(body).toMatch(/min-height:\s*32px/);
    expect(body).toContain('background: var(--ui-surface-sunken, var(--ui-surface))');
    expect(body).toContain('border: 1px solid var(--ui-control-border)');
    expect(rule(panels, sel)).toMatch(/height:\s*32px/);
  });

  it('los numéricos van en mono con cifras tabulares', () => {
    const body = rule(panels, ".ep-panel input[inputmode='decimal']");
    expect(body).toContain('var(--ui-font-mono');
    expect(body).toContain('tabular-nums');
  });

  it('foco con anillo de 2 px en --ui-accent-bright; invalidez con borde y texto de falla', () => {
    expect(rule(panels, '.ep-panel input:focus-visible')).toMatch(/outline:\s*2px solid var\(--ui-accent-bright/);
    expect(rule(panels, ".ep-panel input[aria-invalid='true']")).toContain('border-color: var(--ui-err-ink)');
    expect(rule(panels, '.ep-error')).toContain('color: var(--ui-err-ink)');
  });

  it('tarjetas .ep-card con radio 12 y leyendas de fieldset como eyebrow', () => {
    expect(rule(panels, '.ep-card')).toContain('var(--ui-radius-lg, 12px)');
    const legend = rule(panels, '.ep-panel fieldset legend');
    expect(legend).toMatch(/font-size:\s*11px/);
    expect(legend).toMatch(/font-weight:\s*600/);
    expect(legend).toMatch(/letter-spacing:\s*0\.08em/);
    expect(legend).toMatch(/text-transform:\s*uppercase/);
    // Las unidades entre paréntesis no se pasan a mayúsculas (m ≠ M).
    expect(rule(panels, '.ep-panel fieldset legend .muted')).toContain('text-transform: none');
  });

  it('las regiones de Geometría y las opciones de unidades usan el radio de tarjeta', () => {
    expect(rule(geometry, '.gp-region')).toContain('var(--ui-radius-lg, 12px)');
    expect(rule(project, '.pj-units-option')).toContain('var(--ui-radius-lg, 12px)');
  });

  it('todo token nuevo lleva respaldo', () => {
    const NEW = ['ink-2', 'surface-sunken', 'border-strong', 'border-dashed', 'accent-bright', 'accent-bg', 'shadow-float', 'font-mono', 'radius-sm', 'radius-md', 'radius-lg'];
    for (const css of [panels, geometry, project]) {
      for (const name of NEW) {
        for (const m of css.matchAll(new RegExp(`var\\(--ui-${name}(.)`, 'g'))) expect(m[1], `--ui-${name} sin respaldo`).toBe(',');
      }
    }
  });
});
