import { describe, expect, it } from 'vitest';
import { exportAvailability } from './reportInput';
import { visibleExportHint } from './exportHint';

const HINT = 'Pulse «Comprobar» para habilitar las exportaciones del modelo actual.';

describe('B-06: la pista de exportación no repite el estado vacío', () => {
  it('estado inicial (sin resultado): no se muestra, para que solo quede el mensaje del resumen', () => {
    const a = exportAvailability(null, false);
    expect(a.hint).toBe(HINT); // el texto existe…
    expect(visibleExportHint({ hint: a.hint, hasRun: false, current: false, attempted: false })).toBeUndefined(); // …pero no se ve
  });
  it('resultado obsoleto: se muestra', () => {
    const run = { report: { results: [] } } as never;
    const a = exportAvailability(run, false);
    expect(visibleExportHint({ hint: a.hint, hasRun: true, current: false, attempted: false })).toContain('El modelo cambió desde el último cálculo');
  });
  it('se intenta exportar sin resultado: se muestra', () => {
    expect(visibleExportHint({ hint: HINT, hasRun: false, current: false, attempted: true })).toBe(HINT);
  });
  it('resultado vigente pero sin superficie convergida: la pista explica por qué no se exporta la superficie', () => {
    const msg = 'Ningún método convergió: no hay una superficie crítica que exportar.';
    expect(visibleExportHint({ hint: msg, hasRun: true, current: true, attempted: false })).toBe(msg);
  });
  it('sin pista (todo exportable) no hay nada que mostrar, haya o no intento', () => {
    expect(visibleExportHint({ hint: undefined, hasRun: true, current: true, attempted: true })).toBeUndefined();
  });
});
