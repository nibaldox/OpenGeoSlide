// UA3 B-05: la superficie dibujada es la del FS mínimo del HUD, salvo que el usuario haya elegido otra.
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodKind } from '../../../engine/types';
import { pickShownMethod } from './shownMethod';

const row = (method: MethodKind, fos: number | null) =>
  ({ method, status: fos === null ? 'not_converged' : 'converged', fos: fos ?? 0, surface: { type: 'circle', cx: 0, cy: 0, r: 1 }, slices: [], warnings: [] }) as unknown as AnalysisReport['results'][number];
const report = (...rs: AnalysisReport['results']): AnalysisReport => ({ engine: 't', results: rs }) as AnalysisReport;

describe('pickShownMethod', () => {
  it('elige el método del FS mínimo, no results[0] (V049: Bishop 1,403 frente a Janbu corr. 1,356)', () => {
    const r = report(row('bishop', 1.403), row('janbu_corrected', 1.356));
    expect(pickShownMethod(r, null)).toBe('janbu_corrected');
  });
  it('con empate toma el primero del informe (V047a: Spencer y M-P 0,984)', () => {
    const r = report(row('bishop', 0.985), row('spencer', 0.984), row('morgenstern_price', 0.984));
    expect(pickShownMethod(r, null)).toBe('spencer');
  });
  it('si ninguno convergió, results[0]', () => {
    expect(pickShownMethod(report(row('bishop', null), row('spencer', null)), null)).toBe('bishop');
  });
  it('un método elegido por el usuario que sigue en el informe se respeta', () => {
    expect(pickShownMethod(report(row('bishop', 1.4), row('spencer', 1.3)), 'bishop')).toBe('bishop');
  });
  it('un método elegido que ya no está en el informe vuelve al del FS mínimo', () => {
    expect(pickShownMethod(report(row('bishop', 1.4), row('spencer', 1.3)), 'janbu_simplified')).toBe('spencer');
  });
  it('sin resultados, null', () => {
    expect(pickShownMethod(report(), null)).toBeNull();
  });
});
