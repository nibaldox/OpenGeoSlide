// UA1-S: HUD de resultado (contrato §4.3). `fsMinimum` se sustituye por un doble para no depender de la implementación de UA1-M.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';

vi.mock('./shellModel', () => ({
  fsMinimum: (report: AnalysisReport) => {
    const ok = report.results.filter((r) => r.status === 'converged');
    const value = ok.length === 0 ? null : Math.min(...ok.map((r) => r.fos as number));
    const text = value === null ? '—' : value.toFixed(3).replace('.', ',');
    return {
      value,
      text,
      methods: value === null ? [] : ok.filter((r) => (r.fos as number).toFixed(3) === value.toFixed(3)).map((r) => r.method),
      below1: value !== null && value < 1,
      converged: ok.length,
      total: report.results.length,
    };
  },
}));

const { ResultSummary } = await import('./ResultSummary');
type EngineRun = import('./reportInput').EngineRun;

function result(method: string, fos: number | null, warnings: string[] = []): MethodReport {
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
const makeRun = (...results: MethodReport[]): EngineRun => ({
  revision: 1,
  doc: {} as never,
  json: '',
  sha256: 'a'.repeat(64),
  report: { engine: 'ogs-core 0.5.0', results } as unknown as AnalysisReport,
  elapsedMs: 5,
  checkedAt: '',
});

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(createElement(ResultSummary, { current: true, busy: false, shownMethod: null, run: null, ...props } as never));

describe('UA1-S: HUD de resultado', () => {
  const run = makeRun(result('bishop', 0.985), result('spencer', 0.984), result('morgenstern_price', 0.984), result('janbu_corrected', 1.1));

  it('muestra el eyebrow, la cifra mínima con su data-testid y los métodos que la dan', () => {
    const html = render({ run });
    expect(html).toContain('Factor de seguridad mínimo');
    expect(html).toMatch(/data-testid="fs-min"[^>]*>0,984</);
    expect(html).toContain('Spencer · M-P');
    expect(html).toContain('class="gs-eyebrow rs-eyebrow"');
  });

  it('el chip «FS < 1,0» sale solo bajo 1 y no hay chip de «seguro» sobre 1', () => {
    expect(render({ run })).toContain('FS &lt; 1,0');
    const safe = render({ run: makeRun(result('bishop', 1.35), result('spencer', 1.4)) });
    expect(safe).not.toContain('FS &lt; 1,0');
    expect(safe).not.toMatch(/data-tone="ok"/);
    expect(safe).not.toMatch(/data-tone="nok"/);
    expect(safe).toMatch(/data-testid="fs-min"[^>]*>1,350</);
  });

  it('conserva contenedor, lista, ítems, FS por método, avisos y enlace con sus clases y testids', () => {
    const html = render({ run: makeRun(result('bishop', 0.985, ['interslice_shear_exceeds_strength']), result('spencer', 0.984, ['interslice_shear_exceeds_strength'])), shownMethod: 'bishop' });
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Resumen del cálculo"');
    expect(html).toContain('data-testid="result-summary"');
    expect(html).toContain('data-state="current"');
    expect(html).toContain('class="rs-list"');
    expect(html).toMatch(/<li class="rs-item[^"]*rs-item-shown/);
    expect(html).toContain('class="rs-method"');
    expect(html).toMatch(/data-testid="fs-bishop"[^>]*><span class="rs-fs-label">FS<\/span> 0,985/);
    expect(html).toContain('data-testid="warn-bishop"');
    expect(html).toContain('data-testid="warn-spencer"');
    expect(html).toContain('class="rs-counts small"');
    expect(html).toContain('class="rs-table-link link-button"');
    expect(html).toContain('Ver tabla de resultados');
  });

  it('el aviso de método lleva IconWarning y «Con aviso», sin el emoji ⚠', () => {
    const html = render({ run: makeRun(result('bishop', 0.985, ['interslice_shear_exceeds_strength'])) });
    expect(html).toMatch(/class="rs-flag"[^>]*><svg[^>]*data-icon="warning"[\s\S]*<\/svg>Con aviso/);
    expect(html).not.toContain('⚠');
  });

  it('un método sin convergencia muestra «—» y su estado a la vista; los convergidos, un ✓ y el estado solo para lectores', () => {
    const html = render({ run: makeRun(result('bishop', 0.985), result('spencer', null)) });
    expect(html).toMatch(/data-testid="fs-spencer"[^>]*><span class="rs-fs-label">FS<\/span> —/);
    expect(html).toContain('<span class="rs-status">No convergió</span>');
    expect(html).toContain('<span class="rs-status visually-hidden">Convergió</span>');
    expect(html).toContain('data-icon="check"');
  });

  it('desactualizado: chip «Desactualizado», lista con rs-stale y cifra sin chip de falla', () => {
    const html = render({ run, current: false });
    expect(html).toContain('data-state="stale"');
    expect(html).toContain('class="rs-list rs-stale"');
    expect(html).toMatch(/class="gs-chip rs-chip" data-tone="warn">Desactualizado</);
    expect(html).not.toContain('FS &lt; 1,0');
    expect(html).toContain('data-testid="rs-stale-note"');
  });

  it('calculando: texto de avance con indicador, sin lista', () => {
    const html = render({ run, busy: true, elapsedSeconds: 4 });
    expect(html).toContain('data-state="busy"');
    expect(html).toContain('data-testid="calc-progress"');
    expect(html).toContain('gs-spinner');
    expect(html).toContain('Calculando… (4 s)');
    expect(html).not.toContain('rs-list');
  });

  it('vacío: texto compacto', () => {
    const html = render({ run: null });
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('class="rs-empty muted"');
    expect(html).not.toContain('fs-min');
  });

  it('el botón de plegar tiene nombre, aria-expanded y aria-controls que apunta al cuerpo', () => {
    const html = render({ run });
    const btn = /<button[^>]*class="gs-icon-btn gs-btn-ghost rs-toggle"[^>]*>/.exec(html)?.[0] ?? '';
    expect(btn).toContain('aria-label="Ocultar resultado"');
    expect(btn).toContain('aria-expanded="true"');
    const controls = /aria-controls="([^"]+)"/.exec(btn)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it('sin resultado vigente sigue sin aria-describedby salvo el de la nota de desactualizado', () => {
    expect(render({ run })).not.toContain('aria-describedby');
  });

  it('ni el emoji ⚠ ni otros dingbats en el marcado', () => {
    for (const html of [render({ run }), render({ run, current: false }), render({ run: null }), render({ run, busy: true })]) {
      expect(html).not.toMatch(/[⚠✓✕▾▶⏸]/u);
    }
  });
});
