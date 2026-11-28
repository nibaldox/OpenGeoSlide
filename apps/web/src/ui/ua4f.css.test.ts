// UA4-F: invariantes de las hojas de estilo que corrigen los dos defectos de la regresión e2e (u3m_axe y u4p_targets).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Cuerpo (anidado) del primer `@media` cuya condición es exactamente `query`, con equilibrio de llaves. */
function media(css: string, query: string): string {
  const out: string[] = [];
  let from = 0;
  const head = `@media (${query}) {`;
  for (;;) {
    const at = css.indexOf(head, from);
    if (at < 0) break;
    let depth = 1;
    let i = at + head.length;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(at + head.length, i - 1));
    from = i;
  }
  if (!out.length) throw new Error(`no hay un @media (${query})`);
  return out.join('\n');
}
/** Cuerpos de las reglas cuyo selector (uno de la lista) es exactamente `selector`. */
function rule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]!.split(',').some((s) => s.trim() === selector)) bodies.push(m[2]!);
  }
  if (!bodies.length) throw new Error(`no hay una regla con el selector «${selector}»`);
  return bodies.join('\n');
}

describe('UA4-F: pie de acción móvil en una sola fila', () => {
  const mobile = media(read('../editor/app/shell/shell.css'), 'max-width: 760px');
  it('es fijo abajo, de una fila con relleno de 8 y conserva el borde superior del pie', () => {
    const r = rule(mobile, '.ua-actions');
    expect(r).toMatch(/position:\s*sticky/);
    expect(r).toMatch(/bottom:\s*0/);
    expect(r).toMatch(/display:\s*flex/);
    expect(r).toMatch(/padding:\s*8px 14px/);
    // El borde superior viene de la regla base y no se anula aquí.
    expect(r).not.toMatch(/border-top:\s*(0|none)/);
    expect(rule(read('../editor/app/shell/shell.css'), '.ua-actions')).toMatch(/border-top:\s*1px solid/);
  });
  it('«Comprobar» es flexible, los demás botones miden 40 y el aviso y la pista van en una línea de 12 px encima', () => {
    expect(rule(mobile, '.ua-actions .ua-check-wrap')).toMatch(/flex:\s*1 1 0/);
    const btn = rule(mobile, '.ua-actions .gs-btn');
    expect(btn).toMatch(/min-height:\s*40px/);
    expect(btn).toMatch(/height:\s*40px/);
    const lines = rule(mobile, '.ua-actions .ua-stale-chip');
    expect(lines).toMatch(/min-height:\s*0/);
    const both = rule(mobile, '.ua-actions .ea-export-hint');
    expect(both).toMatch(/flex:\s*0 0 100%/);
    expect(both).toMatch(/order:\s*-1/);
    expect(both).toMatch(/font-size:\s*12px/);
  });
  it('«Cancelar cálculo» y «Reiniciar el motor» reemplazan a «Informe PDF» en la fila', () => {
    expect(rule(mobile, ".ua-actions[data-swap='true'] .ua-report-btn")).toMatch(/display:\s*none/);
  });
  it('html reserva el alto del pie para que el foco no quede tapado (WCAG 2.4.11)', () => {
    expect(rule(mobile, 'html')).toMatch(/scroll-padding-bottom:\s*57px/);
  });
});

describe('UA4-F: lienzo móvil', () => {
  const shell = read('../editor/app/shell/shell.css');
  const mobile = media(shell, 'max-width: 760px');
  // UA-E6: el alto real lo escribe `useCanvasHeight` en línea; el `clamp` de UA4-F queda como respaldo del primer pintado.
  it('el respaldo en CSS es clamp(260px, …, 360px) y lo comparten el SVG y el estado vacío', () => {
    expect(rule(mobile, '.ua-canvas-card')).toMatch(/--ua-canvas-h:\s*clamp\(260px,[^;]+,\s*360px\)/);
    expect(rule(mobile, '.ua-canvas-card .ec-root > .ec-svg')).toMatch(/height:\s*var\(--ua-canvas-h\)/);
    expect(rule(mobile, '.ua-canvas-card .ec-empty')).toMatch(/height:\s*var\(--ua-canvas-h\)/);
  });
});

describe('UA4-F: casillas del panel de Geometría ≥ 24 px', () => {
  it('.gp-check tiene min-height: 24px', () => {
    expect(rule(read('../editor/panels/geometry.css'), '.gp-check')).toMatch(/min-height:\s*24px/);
  });
});

describe('UA-E6: orden del lienzo móvil', () => {
  const mobile = media(read('../editor/app/shell/shell.css'), 'max-width: 760px');
  const order = (selector: string): number => Number(/order:\s*(-?\d+)/.exec(rule(mobile, selector))?.[1]);
  it('lienzo → paleta → leyenda → HUD', () => {
    expect(rule(mobile, '.ua-canvas-card .ec-root > .ec-svg')).toMatch(/order:\s*0/);
    const palette = order('.ua-canvas-card .ec-palette');
    const legend = order('.ua-canvas-card > ul.legend[aria-label]');
    const hud = order('.ua-canvas-card > div.rs');
    expect(0 < palette && palette < legend && legend < hud).toBe(true);
  });
  it('conserva scroll-padding-bottom del pie y el alto del lienzo sale de --ua-canvas-h', () => {
    expect(rule(mobile, 'html')).toMatch(/scroll-padding-bottom:\s*57px/);
    expect(rule(mobile, '.ua-canvas-card .ec-root > .ec-svg')).toMatch(/height:\s*var\(--ua-canvas-h\)\s*!important/);
  });
});
