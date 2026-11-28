import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import { ResultSummary } from './ResultSummary';
import { fsMinimum } from './shellModel';
import type { EngineRun } from './reportInput';
import { calcAnnouncement, governingMethodText, nextAnnouncement, summaryItems, warningCounts, warningCountsText } from './resultSummary';

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
      'Cálculo completado: Bishop FS 1,200; Spencer sin convergencia',
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

describe('R10B-09: «Con aviso» junto al FS de cada método con avisos de severidad «aviso»', () => {
  const E13K = 'interslice_shear_exceeds_strength';
  const r = report(result('bishop', 1.2, ['negative_effective_normal']), result('spencer', 130.578, [E13K, 'negative_effective_normal']));

  it('summaryItems cuenta los avisos (no las notas) de cada método', () => {
    const items = summaryItems(r);
    expect(items.map((i) => i.warnings)).toEqual([0, 1]);
    expect(items.map((i) => i.flagged)).toEqual([false, true]);
  });

  it('una nota sola no marca el método', () => {
    expect(summaryItems(report(result('bishop', 1.2, ['negative_effective_normal', 'load_outside_mass'])))[0]).toMatchObject({ warnings: 0, flagged: false });
  });

  it('cuenta códigos distintos una sola vez', () => {
    expect(summaryItems(report(result('spencer', 1.1, [E13K, E13K, 'air_gap_thrust'])))[0]!.warnings).toBe(2);
  });

  it('la franja muestra «Con aviso» solo junto al método afectado, con texto (no solo color) y nombre estable', () => {
    const run = { report: r, revision: 1 } as unknown as EngineRun;
    const html = renderToStaticMarkup(createElement(ResultSummary, { run, current: true, busy: false, shownMethod: 'spencer' }));
    expect(html.match(/Con aviso/g)).toHaveLength(1);
    expect(html).toContain('data-testid="warn-spencer"');
    expect(html).not.toContain('data-testid="warn-bishop"');
    // El FS sigue ahí: la marca no lo oculta.
    expect(html).toContain('130,578');
    expect(html.indexOf('130,578')).toBeLessThan(html.indexOf('Con aviso'));
    expect(html).toContain('Convergió');
  });

  it('la franja sin avisos no lleva la marca', () => {
    const run = { report: report(result('bishop', 1.2)), revision: 1 } as unknown as EngineRun;
    expect(renderToStaticMarkup(createElement(ResultSummary, { run, current: true, busy: false, shownMethod: null }))).not.toContain('Con aviso');
  });

  it('el anuncio para el lector de pantalla dice «con aviso» junto al FS afectado', () => {
    expect(calcAnnouncement(r)).toBe('Cálculo completado: Bishop FS 1,200; Spencer FS 130,578 con aviso; 1 aviso y 2 notas');
  });
});

// CM-W2: el HUD nombra el método que rige el FS mínimo (en la prueba a ciegas, los tres agentes tuvieron que leer otro texto para saberlo).
describe('governingMethodText', () => {
  it('con un solo método, su nombre completo', () => {
    expect(governingMethodText(['morgenstern_price'])).toBe('Morgenstern-Price');
    expect(governingMethodText(['janbu_corrected'])).toBe('Janbu corregido');
    expect(governingMethodText(['bishop'])).toBe('Bishop simplificado');
  });
  it('con un empate, los dos con la abreviatura de la tabla de resultados', () => {
    expect(governingMethodText(['spencer', 'morgenstern_price'])).toBe('Spencer · M-P');
    expect(governingMethodText(['bishop', 'janbu_corrected'])).toBe('Bishop · Janbu corr.');
  });
  it('`form` fuerza el nombre completo o la abreviatura', () => {
    expect(governingMethodText(['morgenstern_price'], 'short')).toBe('M-P');
    expect(governingMethodText(['spencer', 'morgenstern_price'], 'full')).toBe('Spencer · Morgenstern-Price');
    expect(governingMethodText([])).toBe('');
  });
  it('lo que da fsMinimum: sin empate un método; con empate a tres decimales, los dos', () => {
    const solo = report(result('bishop', 1.404), result('spencer', 1.401));
    expect(governingMethodText(fsMinimum(solo).methods)).toBe('Spencer');
    const empate = report(result('bishop', 1.9), result('spencer', 1.5684), result('morgenstern_price' as never, 1.5679));
    expect(fsMinimum(empate).methods).toEqual(['spencer', 'morgenstern_price']);
    expect(governingMethodText(fsMinimum(empate).methods)).toBe('Spencer · M-P');
  });
});

describe('HUD: el método junto a la cifra', () => {
  const run = (...results: MethodReport[]): never => ({ revision: 1, doc: {}, json: '', sha256: 'a'.repeat(64), report: report(...results), elapsedMs: 5, checkedAt: '' }) as never;
  const html = (r: never, extra: Record<string, unknown> = {}): string => renderToStaticMarkup(createElement(ResultSummary, { current: true, busy: false, shownMethod: null, run: r, ...extra } as never));
  it('desplegado: la cifra va con el nombre completo del método', () => {
    const out = html(run(result('bishop', 1.404), result('spencer', 1.401)));
    expect(out).toMatch(/data-testid="fs-min-method">Spencer</);
  });
  it('plegado: la píldora dice «FS mín. 1,401 · Spencer» y su nombre accesible lo repite', () => {
    const out = html(run(result('bishop', 1.404), result('spencer', 1.401)), { compact: true });
    expect(out).toContain('aria-label="Mostrar resultado, FS mín. 1,401 · Spencer"');
    expect(out).toMatch(/data-testid="rs-pill-method">· Spencer</);
  });
});
