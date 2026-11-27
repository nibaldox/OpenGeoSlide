// UA1-C: paleta flotante del lienzo (marcado), rejilla mayor, píldora de coordenadas y hoja de estilos.
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';

function render(props: Omit<Parameters<typeof EditorCanvas>[0], 'store'> = {}): string {
  return renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(makeDoc()), ...props }));
}

const css = readFileSync(new URL('./canvas.css', import.meta.url), 'utf8');

/** Lo que pasaría UA1-A: un grupo con un botón de herramienta. */
const tools: ReactNode = createElement(
  'div',
  { role: 'group', 'aria-label': 'Herramienta del lienzo', 'data-testid': 'probe-tools' },
  createElement('button', { type: 'button', 'aria-label': 'Seleccionar', 'aria-pressed': true, className: 'gs-tool' }, 'S'),
);

describe('paleta flotante: marcado', () => {
  it('nav.ec-palette «Herramientas del lienzo» dentro de .ec-root, con el grupo «Zoom y encuadre»', () => {
    const html = render();
    expect(html).toMatch(/<div class="ec-root">/);
    const nav = html.match(/<nav[^>]*class="ec-palette"[^>]*>([\s\S]*?)<\/nav>/);
    expect(nav).not.toBeNull();
    expect(nav![0]).toContain('aria-label="Herramientas del lienzo"');
    expect(nav![1]).toMatch(/role="group"[^>]*aria-label="Zoom y encuadre"/);
    // dentro de .ec-root, tras el svg del lienzo
    expect(html.indexOf('class="ec-svg"')).toBeLessThan(html.indexOf('class="ec-palette"'));
  });

  it('sin paletteTools solo trae el grupo «Vista»: sin rótulo «Herram.» ni divisor', () => {
    const html = render();
    expect(html).not.toContain('Herram.');
    expect(html).not.toContain('ec-palette-divider');
    expect(html).toMatch(/<span class="ec-palette-label" aria-hidden="true">Vista<\/span>/);
  });

  it('con paletteTools: «Herram.», las herramientas, el divisor y «Vista», en ese orden', () => {
    const html = render({ paletteTools: tools });
    const iTools = html.indexOf('Herram.');
    const iProbe = html.indexOf('data-testid="probe-tools"');
    const iDiv = html.indexOf('ec-palette-divider');
    const iView = html.indexOf('>Vista<');
    const iZoom = html.indexOf('aria-label="Zoom y encuadre"');
    expect(iTools).toBeGreaterThan(0);
    expect(iTools).toBeLessThan(iProbe);
    expect(iProbe).toBeLessThan(iDiv);
    expect(iDiv).toBeLessThan(iView);
    expect(iView).toBeLessThan(iZoom);
    // los rótulos y el divisor no entran en el árbol de accesibilidad
    expect(html).toMatch(/<span class="ec-palette-label" aria-hidden="true">Herram\.<\/span>/);
    expect(html).toMatch(/<div class="ec-palette-divider" aria-hidden="true">/);
  });

  it('Acercar, Alejar y Encuadrar conservan nombre, title y teclas; llevan ícono SVG y tooltip aria-hidden', () => {
    const html = render({ paletteTools: tools });
    const cases: Array<[string, string, string]> = [
      ['Acercar', 'Acercar (+)', '+'],
      ['Alejar', 'Alejar (−)', '-'],
      ['Encuadrar', 'Encuadrar el modelo (0)', '0'],
    ];
    for (const [name, title, key] of cases) {
      const m = html.match(new RegExp(`<button[^>]*aria-label="${name}"[^>]*>([\\s\\S]*?)</button>`));
      expect(m, name).not.toBeNull();
      expect(m![0]).toContain(`title="${title}"`);
      expect(m![0]).toContain(`aria-keyshortcuts="${key}"`);
      expect(m![0]).toMatch(/class="gs-tool ec-tool"/);
      expect(m![1]).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(m![1]).toMatch(new RegExp(`<span class="gs-tip" aria-hidden="true">${name} <kbd class="gs-kbd">.</kbd></span>`));
    }
  });
});

describe('rejilla mayor y rótulos de ejes', () => {
  it('hay líneas con var(--canvas-grid-major, var(--canvas-grid)) y líneas con var(--canvas-grid)', () => {
    const html = render();
    const grid = html.match(/<g data-layer="grid"[^>]*>[\s\S]*?<\/g><\/g>/)![0];
    expect(grid).toContain('class="ec-grid"');
    expect(grid).toContain('stroke="var(--canvas-grid-major, var(--canvas-grid))"');
    expect(grid).toContain('stroke="var(--canvas-grid)"');
  });

  it('los rótulos de los ejes van en la mono con cifras tabulares', () => {
    expect(css).toMatch(/\.ec-grid text\s*\{[^}]*font-family:\s*var\(--ui-font-mono[^}]*font-variant-numeric:\s*tabular-nums/);
  });
});

describe('píldora de coordenadas', () => {
  it('sigue siendo p.ec-cursor[data-testid=cursor-readout] aria-hidden y vacía al montar', () => {
    expect(render()).toContain('<p class="ec-cursor" aria-hidden="true" data-testid="cursor-readout"></p>');
  });

  it('la hoja de estilos la coloca a la izquierda (16), a 56 px del pie, en mono y píldora', () => {
    const rule = css.match(/\.ec-cursor\s*\{([^}]*)\}/)![1]!;
    expect(rule).toMatch(/left:\s*16px/);
    expect(rule).toMatch(/bottom:\s*56px/);
    expect(rule).toMatch(/border-radius:\s*999px/);
    expect(rule).toMatch(/font-family:\s*var\(--ui-font-mono/);
    expect(rule).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/\.ec-cursor:empty\s*\{\s*display:\s*none/);
  });
});

describe('hoja de estilos de la paleta', () => {
  it('medidas del contrato §2: 60 de ancho a 16 del borde, botones de 42, radio 14 y 10', () => {
    const pal = css.match(/\.ec-palette\s*\{([^}]*)\}/)![1]!;
    expect(pal).toMatch(/right:\s*16px/);
    expect(pal).toMatch(/top:\s*50%/);
    expect(pal).toMatch(/width:\s*60px/);
    expect(pal).toMatch(/padding:\s*10px 8px/);
    expect(pal).toMatch(/gap:\s*6px/);
    expect(pal).toMatch(/border-radius:\s*14px/);
    expect(pal).toMatch(/max-height:\s*calc\(100% - 24px\)/);
    const tool = css.match(/\.ec-tool\s*\{([^}]*)\}/)![1]!;
    expect(tool).toMatch(/width:\s*42px/);
    expect(tool).toMatch(/height:\s*42px/);
    expect(tool).toMatch(/border-radius:\s*10px/);
    expect(css).toMatch(/\.ec-palette\[data-scroll='true'\]\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('hasta 760 px la paleta va en fila al pie, con botones de 40', () => {
    const media = css.match(/@media \(max-width: 760px\) \{\s*\.ec-root \{[\s\S]*?\n\}\n/)![0];
    expect(media).toMatch(/\.ec-palette\s*\{[^}]*position:\s*static/);
    expect(media).toMatch(/\.ec-palette\s*\{[^}]*flex-direction:\s*row/);
    expect(media).toMatch(/width:\s*40px/);
    expect(media).toMatch(/height:\s*40px/);
  });

  it('solo usa tokens: ningún color literal', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgb|rgba|hsl)\(\s*\d/);
  });
});
