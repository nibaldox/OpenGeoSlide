// UA2-F: invariantes de las hojas de estilo y del disparador de menú que corrigen los hallazgos F2-F7 de la aceptación.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
/** Cuerpos de todas las reglas que listan exactamente `selector` (reunidos). */
function rule(css: string, selector: string): string {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp(`(?<=^|\\})\\s*([^{}]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{}]*)\\{([^}]*)\\}`, 'g');
  const bodies = [...flat.matchAll(re)].filter((m) => m[1]!.split(',').some((s) => s.trim() === selector)).map((m) => m[2]!);
  if (!bodies.length) throw new Error(`no hay una regla con el selector «${selector}»`);
  return bodies.join('\n');
}

describe('F2: el disparador de menú usa un ícono, no un dingbat', () => {
  const html = renderToStaticMarkup(createElement(DropdownMenu, { label: 'Archivo', children: createElement('button', { type: 'button' }, 'Nuevo') }));
  it('lleva un SVG aria-hidden y ningún glifo de flecha', () => {
    const trigger = html.slice(html.indexOf('<button'), html.indexOf('</button>'));
    expect(trigger).toContain('<svg');
    expect(trigger).toContain('aria-hidden="true"');
    expect(trigger).not.toMatch(/[▾▸▼↵✓✕⚠▶⏸]/u);
    expect(trigger.replace(/<[^>]+>/g, '').trim()).toBe('Archivo');
  });
});

describe('F3: objetivos de clic ≥ 24 px', () => {
  it('la etiqueta que envuelve casillas y botones de opción mide ≥ 24 de alto y centra su contenido, sin agrandar el control', () => {
    const panels = read('../editor/panels/panels.css');
    const r = rule(panels, '.ep-panel .ep-radios label');
    expect(r).toMatch(/min-height:\s*24px/);
    expect(r).toMatch(/align-items:\s*center/);
    expect(rule(panels, '.ep-panel .checkbox')).toMatch(/min-height:\s*24px/);
    expect(rule(panels, '.ep-panel .checkbox > label')).toMatch(/min-height:\s*24px/);
    // El control nativo conserva sus 16 px.
    expect(rule(panels, ".ep-panel input[type='checkbox']")).toMatch(/height:\s*16px/);
  });
  it('el selector «Ejemplos» del menú Archivo mide ≥ 24', () => {
    const m = /min-height:\s*(\d+)px/.exec(rule(read('../App.css'), '.dd-field select'));
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(24);
  });
});

describe('F4: tooltips ocultos de verdad (UA-E2 punto 4)', () => {
  for (const [file, hidden, shown] of [
    ['../styles/components.css', '.gs-tip', '.gs-tool:hover .gs-tip'],
    ['../editor/canvas/canvas.css', '.ec-palette .gs-tip', '.ec-palette .gs-tool:hover .gs-tip'],
  ] as const) {
    it(`${file}: visibility hidden con opacity 0, visibility en la transición y visible al mostrarse`, () => {
      const css = read(file);
      const base = rule(css, hidden);
      expect(base).toMatch(/opacity:\s*0\b/);
      expect(base).toMatch(/visibility:\s*hidden/);
      expect(base).toMatch(/transition:[^;]*visibility/);
      expect(rule(css, shown)).toMatch(/visibility:\s*visible/);
    });
  }
});

describe('F5: tabla de resultados', () => {
  const app = read('../App.css');
  it('«Dibujar» seleccionado usa el acento, no el rojo de error', () => {
    const r = rule(app, '.link-button.active');
    expect(r).toContain('--ui-accent-bg');
    expect(r).toContain('--ui-accent-bright');
    expect(r).not.toMatch(/--ui-err/);
  });
  it('las celdas numéricas y los nombres de método no se parten', () => {
    expect(rule(app, '.results td.num')).toMatch(/white-space:\s*nowrap/);
    expect(rule(app, '.results tbody td:first-child')).toMatch(/white-space:\s*nowrap/);
  });
});

describe('F6: la tecla decorativa de «Comprobar»', () => {
  it('se oculta hasta 1099 px y con puntero táctil', () => {
    const css = read('../editor/app/shell/shell.css');
    const m = /@media\s*\(max-width:\s*1099px\),\s*\(pointer:\s*coarse\)\s*\{\s*\.ua-check-wrap \.ua-kbd\s*\{\s*display:\s*none;/.exec(css);
    expect(m).not.toBeNull();
  });
});

describe('F7: --ui-info-border y limpieza', () => {
  it('existe en los cinco bloques de tokens y notices.css ya no trae respaldo', () => {
    const tokens = read('../styles/tokens.css');
    expect(tokens.match(/--ui-info-border:/g)).toHaveLength(5);
    expect(tokens).toMatch(/--ui-info-border:\s*light-dark\(#857ab5,\s*#7693b7\)/);
    expect(read('../editor/app/notices.css')).toContain('var(--ui-info-border)');
    expect(read('../editor/app/notices.css')).not.toMatch(/--ui-info-border,/);
  });
});
