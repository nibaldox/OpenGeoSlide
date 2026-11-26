import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VerificationCheck } from '../engine/types';
import type { MethodReport } from '../engine/types';
import { CheckTable, type CheckRow } from './CheckTable';
import { checkRowFromResult } from './checkRow';

const check: VerificationCheck = { method: 'bishop', kind: 'fixed', published: 1.0, tolerance: 0.02 } as VerificationCheck;
const row = (ok: boolean): CheckRow => ({ check, fos: 1.01, errorRel: 0.01, ok });
const render = (rows: CheckRow[]): string => renderToStaticMarkup(createElement(CheckTable, { rows }));

describe('CheckTable', () => {
  it('R7-21: «Cumple» y «No cumple», como el PDF; «FALLA» significa rotura del talud en geotecnia', () => {
    const html = render([row(true), row(false)]);
    expect(html).toContain('>Cumple<');
    expect(html).toContain('>No cumple<');
    expect(html).not.toContain('FALLA');
    expect(html).not.toContain('>OK<');
  });
  it('UX-14: la tabla tiene <caption> con nombre accesible', () => {
    expect(render([row(true)])).toMatch(/<table[^>]*><caption[^>]*>Comprobación frente a los valores publicados<\/caption>/);
  });
});

describe('R10B-06: la vista Casos muestra los avisos y el estado real', () => {
  const result = (o: Partial<MethodReport>): MethodReport =>
    ({ method: 'bishop', fos: 1.01, status: 'converged', iterations: 4, lambda: null, surface: { xc: 0, yc: 0, r: 5 }, slices: [], search: null, warnings: [], ...o }) as MethodReport;

  it('un caso convergido y limpio es «Cumple» sin más', () => {
    const r = checkRowFromResult(check, result({}));
    expect(r).toMatchObject({ ok: true, fos: 1.01, warnings: [] });
    const html = render([r]);
    expect(html).toContain('>Cumple<');
    expect(html).not.toContain('con aviso');
  });

  it('con un aviso de severidad «aviso» no es «Cumple» sin más: «Cumple, con aviso» y el texto del aviso', () => {
    for (const code of ['interslice_shear_exceeds_strength', 'negative_effective_normal_major', 'air_gap_thrust', 'water_above_ground']) {
      const r = checkRowFromResult(check, result({ warnings: [code] }));
      expect(r.ok, code).toBe(true); // el FS está dentro de la tolerancia: el aviso no altera la comparación numérica
      const html = render([r]);
      expect(html, code).toContain('Cumple, con aviso');
      expect(html, code).not.toContain('>Cumple<');
      expect(html, code).toContain(r.warnings![0]!.text.slice(0, 40));
      expect(html, code).toContain('badge-warn');
    }
  });

  it('una nota (severidad «nota») se muestra, pero el caso sigue siendo «Cumple»', () => {
    const r = checkRowFromResult(check, result({ warnings: ['negative_effective_normal'] }));
    const html = render([r]);
    expect(html).toContain('>Cumple<');
    expect(html).toContain('Normal efectiva negativa');
  });

  it('un caso que no cumple conserva «No cumple» y también muestra sus avisos', () => {
    const r = checkRowFromResult(check, result({ fos: 1.5, warnings: ['air_gap_thrust'] }));
    expect(r.ok).toBe(false);
    const html = render([r]);
    expect(html).toContain('>No cumple<');
    expect(html).toContain('empuje a través de un tramo sin suelo');
  });

  it('invalid no se disfraza de falta de convergencia: dice el estado y el aviso real (polyline_outside_ground)', () => {
    const r = checkRowFromResult(check, result({ status: 'invalid', fos: null, warnings: ['polyline_outside_ground'] }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain('superficie válida');
    expect(r.message).not.toContain('no convergió');
    const html = render([r]);
    expect(html).toContain('>No cumple<');
    expect(html).toContain('pasa por encima del terreno');
  });

  it('not_converged sí se dice «no convergió» y no informa FS', () => {
    const r = checkRowFromResult(check, result({ status: 'not_converged', fos: 1.2, warnings: ['max_iterations'] }));
    expect(r).toMatchObject({ ok: false, fos: null });
    expect(r.message).toContain('no convergió');
    expect(render([r])).toContain('número máximo de iteraciones');
  });

  it('el texto de un aviso de polilínea usa el contexto de la superficie del caso (sin nombrar a Spencer)', () => {
    const r = checkRowFromResult(
      { ...check, method: 'morgenstern_price' } as VerificationCheck,
      result({ method: 'morgenstern_price', status: 'not_converged', fos: null, surface: { points: [[0, 0], [1, -1], [2, 0]] }, warnings: ['no_lambda_root'] }),
    );
    expect(r.warnings![0]!.text).toContain('compare con Janbu');
    expect(r.warnings![0]!.text).not.toMatch(/Spencer|Bishop/);
  });

  it('sin resultado del motor, un mensaje honesto', () => {
    expect(checkRowFromResult(check, undefined)).toMatchObject({ ok: false, fos: null, message: expect.stringContaining('no devolvió') });
  });

  it('los avisos tienen nombre accesible estable', () => {
    const html = render([checkRowFromResult(check, result({ warnings: ['air_gap_thrust'] }))]);
    expect(html).toContain('aria-label="Avisos de la comprobación de Bishop simplificado"');
  });
});
