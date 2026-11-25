import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import { calcAnnouncement, nextAnnouncement, summaryItems, warningCounts, warningCountsText } from './resultSummary';

function result(method: 'bishop' | 'spencer', fos: number | null, warnings: string[] = []): MethodReport {
  return {
    method,
    status: fos === null ? 'not_converged' : 'converged',
    fos: fos ?? 0,
    lambda: null,
    iterations: 5,
    warnings,
    slices: [],
    surface: { xc: 0, yc: 0, r: 1 },
    search: null,
  } as unknown as MethodReport;
}
const report = (...results: MethodReport[]): AnalysisReport => ({ engine: 'ogs-core 0.1.0', results }) as unknown as AnalysisReport;

describe('summaryItems', () => {
  it('da el FS con coma decimal y «—» si no convergió', () => {
    const items = summaryItems(report(result('bishop', 0.9853), result('spencer', null)));
    expect(items.map((i) => i.fs)).toEqual(['0,985', '—']);
    expect(items.map((i) => i.converged)).toEqual([true, false]);
    expect(items[1]!.status).toBe('No convergió');
  });
});

describe('warningCounts', () => {
  it('cuenta avisos y notas por método (sin repetir códigos dentro de un método)', () => {
    const r = report(result('bishop', 1, ['negative_effective_normal', 'negative_effective_normal']), result('spencer', 1, ['negative_effective_normal', 'negative_effective_normal_major']));
    expect(warningCounts(r)).toEqual({ avisos: 1, notas: 2 });
  });
  it('redacta singular, plural y combinación', () => {
    expect(warningCountsText({ avisos: 0, notas: 0 })).toBeNull();
    expect(warningCountsText({ avisos: 0, notas: 2 })).toBe('2 notas');
    expect(warningCountsText({ avisos: 1, notas: 0 })).toBe('1 aviso');
    expect(warningCountsText({ avisos: 2, notas: 1 })).toBe('2 avisos y 1 nota');
  });
});

describe('calcAnnouncement', () => {
  it('resume el cálculo para el lector de pantalla', () => {
    const r = report(
      result('bishop', 0.985, ['negative_effective_normal']),
      result('spencer', 0.984, ['negative_effective_normal']),
    );
    expect(calcAnnouncement(r)).toBe('Cálculo completado: Bishop FS 0,985; Spencer FS 0,984; 2 notas');
  });
  it('sin avisos no añade el recuento y un método sin convergencia no lleva FS', () => {
    expect(calcAnnouncement(report(result('bishop', 1.2), result('spencer', null)))).toBe(
      'Cálculo completado: Bishop FS 1,2; Spencer sin convergencia',
    );
  });
});

describe('nextAnnouncement', () => {
  it('un mensaje nuevo se usa tal cual', () => {
    expect(nextAnnouncement('a', 'b')).toBe('b');
    expect(nextAnnouncement('', 'b')).toBe('b');
  });
  it('un mensaje repetido alterna un espacio de no separación para que se vuelva a anunciar', () => {
    const first = nextAnnouncement('', 'Guardado');
    const second = nextAnnouncement(first, 'Guardado');
    const third = nextAnnouncement(second, 'Guardado');
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
    expect(second.replace(/\u00a0/g, '')).toBe('Guardado');
  });
});
