import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VerificationCheck } from '../engine/types';
import { CheckTable, type CheckRow } from './CheckTable';

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
