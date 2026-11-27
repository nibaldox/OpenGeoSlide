// UA1-S: primitivas .gs-* de components.css (contrato §4.5). Pruebas de contenido de la hoja: clases, estados y reglas
// de accesibilidad que el contrato exige. Los colores literales los vigila no-hardcoded-colors.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./components.css', import.meta.url), 'utf8');

/** Cuerpos de todas las reglas que tienen `selector` como una de sus alternativas, unidos. */
function rule(selector: string): string {
  const bodies: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim());
    if (sels.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`sin regla para ${selector}`);
  return bodies.join('\n');
}

describe('UA1-S: components.css', () => {
  it('define todas las clases del contrato §4.5', () => {
    for (const sel of [
      '.gs-btn', '.gs-btn-primary', '.gs-btn-lg', '.gs-icon-btn', '.gs-chip', '.gs-eyebrow', '.gs-kbd', '.gs-mono',
      '.gs-tool', ".gs-tool[aria-pressed='true']", '.gs-tip', '.gs-badge', '.gs-spinner', '.gs-card',
    ]) {
      expect(css, sel).toContain(sel);
    }
    for (const tone of ['accent', 'ok', 'warn', 'nok']) expect(css).toContain(`.gs-chip[data-tone='${tone}']`);
    for (const status of ['done', 'error', 'draft', 'optional', 'empty']) expect(css).toContain(`.gs-badge[data-status='${status}']`);
  });

  it('medidas del contrato', () => {
    expect(rule('.gs-btn')).toMatch(/height:\s*32px/);
    expect(rule('.gs-btn')).toMatch(/font-size:\s*13px/);
    expect(rule('.gs-btn')).toMatch(/font-weight:\s*500/);
    expect(rule('.gs-btn')).toMatch(/border-radius:\s*var\(--ui-radius-md, 8px\)/);
    expect(rule('.gs-btn')).toMatch(/border:\s*1px solid var\(--ui-border-strong/);
    expect(rule('.gs-btn-lg')).toMatch(/height:\s*40px/);
    expect(rule('.gs-icon-btn')).toMatch(/width:\s*32px/);
    expect(rule('.gs-chip')).toMatch(/height:\s*24px/);
    expect(rule('.gs-chip')).toMatch(/border-radius:\s*999px/);
    expect(rule('.gs-chip')).toMatch(/font-size:\s*12px/);
    expect(rule('.gs-chip')).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule('.gs-chip')).toMatch(/white-space:\s*nowrap/);
    expect(rule('.gs-chip::before')).toMatch(/width:\s*7px/);
    expect(rule('.gs-eyebrow')).toMatch(/font-size:\s*11px/);
    expect(rule('.gs-eyebrow')).toMatch(/letter-spacing:\s*0\.08em/);
    expect(rule('.gs-eyebrow')).toMatch(/text-transform:\s*uppercase/);
    expect(rule('.gs-kbd')).toMatch(/font-size:\s*11px/);
    expect(rule('.gs-mono')).toMatch(/tabular-nums/);
    expect(rule('.gs-tool')).toMatch(/width:\s*42px/);
    expect(rule('.gs-tool')).toMatch(/height:\s*42px/);
    expect(rule('.gs-tool')).toMatch(/border-radius:\s*10px/);
    expect(rule('.gs-badge')).toMatch(/width:\s*28px/);
    expect(rule('.gs-card')).toMatch(/border-radius:\s*var\(--ui-radius-lg, 12px\)/);
  });

  it('el botón primario usa el acento, el texto sobre acento y --ui-accent-hover', () => {
    expect(rule('.gs-btn-primary')).toContain('background: var(--ui-accent)');
    expect(rule('.gs-btn-primary')).toContain('color: var(--ui-ink-on-accent)');
    expect(rule('.gs-btn-primary:hover:not(:disabled)')).toContain('--ui-accent-hover');
  });

  it('foco visible: anillo de 2 px en --ui-accent-bright con desplazamiento de 2', () => {
    const body = rule('.gs-btn:focus-visible');
    expect(body).toMatch(/outline:\s*2px solid var\(--ui-accent-bright/);
    expect(body).toMatch(/outline-offset:\s*2px/);
    expect(css).toContain('.gs-tool:focus-visible');
    expect(css).toContain('.gs-tool:focus-visible .gs-tip');
  });

  it('estados hover y deshabilitado; los hover pesan más que el `button:hover:not(…)` de App.css', () => {
    expect(css).toContain('.gs-btn:hover:not(:disabled)');
    expect(css).toContain('.gs-btn:disabled');
    expect(css).toContain('.gs-tool:hover:not(:disabled)');
    expect(rule('.gs-btn:disabled')).toMatch(/opacity:\s*1/);
  });

  it('hasta 760 px los botones y las herramientas miden al menos 40', () => {
    const block = /@media \(max-width: 760px\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\.gs-tool[\s\S]*min-height:\s*40px/);
    expect(block).toMatch(/\.gs-btn,[\s\S]*height:\s*40px/);
    expect(block).toMatch(/\.gs-icon-btn \{[^}]*width:\s*40px/);
    expect(block).toMatch(/\.gs-tool \{[^}]*width:\s*40px/);
  });

  it('prefers-reduced-motion: el indicador gira más lento y no hay transiciones', () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)$/.exec(css)?.[1] ?? '';
    expect(block).toContain('animation-duration: 2s');
    expect(block).toContain('transition: none');
    expect(css).toContain('@keyframes gs-spin');
  });

  it('todo token nuevo lleva respaldo a uno ya existente', () => {
    const NEW = ['ink-2', 'surface-sunken', 'border-strong', 'border-dashed', 'accent-bright', 'accent-bg', 'shadow-float', 'font-mono', 'radius-sm', 'radius-md', 'radius-lg'];
    for (const name of NEW) {
      for (const m of css.matchAll(new RegExp(`var\\(--ui-${name}(.)`, 'g'))) expect(m[1], `--ui-${name} sin respaldo`).toBe(',');
    }
  });
});
