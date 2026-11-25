import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// R7-24 residual: un solo verbo. El editor dice «Comprobar»; la vista de Casos, «Comprobar caso» (no «Calcular»).
describe('verbo de Casos de verificación', () => {
  const src = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  it('el botón y el texto de ayuda dicen «Comprobar caso»', () => {
    expect(src).toContain("'Comprobar caso'");
    expect(src).toContain('Pulse «Comprobar caso»');
  });
  it('no queda «Calcular» como nombre de botón ni en las instrucciones', () => {
    expect(src).not.toMatch(/'Calcular'|«Calcular»/);
    expect(src).not.toContain("'Calculando…'");
  });
});
