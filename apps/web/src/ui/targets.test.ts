// UX9-08: objetivos de al menos 24 px (WCAG 2.5.8). La medición real está en docs/fase2/ux/u4p-e2e/u4p_targets.mjs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./targets.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('targets.css', () => {
  it('casillas y botones de opción miden 24 × 24 px', () => {
    const rule = /input\[type='checkbox'\][^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/width:\s*24px/);
    expect(rule).toMatch(/height:\s*24px/);
  });
  it('el resumen de «Detalle técnico» y los enlaces de la ayuda tienen 24 px como mínimo', () => {
    expect(/summary\)\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/min-height:\s*24px/);
    expect(/\.help-scroll a\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/min-height:\s*24px/);
  });
  it('la aplicación importa la hoja', () => {
    expect(app).toContain("import './ui/targets.css'");
  });
});
