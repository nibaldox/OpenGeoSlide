// W-R15c (tarea 2): mientras haya un borrador sin aplicar, ResultSummary marca los FS anteriores como desactualizados.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import { ResultSummary, STALE_DRAFTS_TEXT, STALE_MODEL_TEXT } from './ResultSummary';
import type { EngineRun } from './reportInput';

function makeRun(): EngineRun {
  const results: MethodReport[] = [
    {
      method: 'bishop',
      status: 'converged',
      fos: 0.985,
      lambda: null,
      iterations: 6,
      warnings: [],
      slices: [],
      surface: { xc: 0, yc: 10, r: 12 },
      search: null,
    } as unknown as MethodReport,
    {
      method: 'spencer',
      status: 'converged',
      fos: 0.984,
      lambda: 0.25,
      iterations: 8,
      warnings: [],
      slices: [],
      surface: { xc: 0, yc: 10, r: 12 },
      search: null,
    } as unknown as MethodReport,
  ];
  const report = { engine: 'ogs-core 0.5.0', results } as unknown as AnalysisReport;
  return { revision: 1, doc: {} as never, json: '', sha256: 'a'.repeat(64), report, elapsedMs: 12, checkedAt: '' };
}

describe('W-R15c: FS desactualizados con borradores sin aplicar', () => {
  const run = makeRun();

  it('con resultado vigente y sin borradores muestra data-state="current" sin marca de desactualizado', () => {
    const html = renderToStaticMarkup(
      createElement(ResultSummary, { run, current: true, hasPendingDrafts: false, busy: false, shownMethod: 'bishop' }),
    );
    expect(html).toContain('data-state="current"');
    expect(html).not.toContain('rs-stale');
    expect(html).not.toContain('rs-stale-note');
    expect(html).not.toContain('aria-describedby');
  });

  it('con un borrador sin aplicar atenúa los FS (rs-stale), enlaza aria-describedby y muestra el aviso accesible', () => {
    const html = renderToStaticMarkup(
      createElement(ResultSummary, { run, current: true, hasPendingDrafts: true, busy: false, shownMethod: 'bishop' }),
    );
    expect(html).toContain('data-state="stale"');
    expect(html).toContain('data-stale-reason="drafts"');
    expect(html).toContain('class="rs-list rs-stale"');
    expect(html).toContain('role="status"');
    expect(html).toContain('data-testid="rs-stale-note"');
    expect(html).toContain(STALE_DRAFTS_TEXT);
    expect(html).toContain('calculado antes de los cambios sin aplicar');
    // Los FS del cálculo anterior siguen visibles pero atenuados.
    expect(html).toContain('0,985');
    expect(html).toContain('0,984');
    // Asociación accesible aria-describedby -> id de la nota
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
  });

  it('con el modelo ya modificado (sin borradores) mantiene el aviso del modelo cambiado', () => {
    const html = renderToStaticMarkup(
      createElement(ResultSummary, { run, current: false, hasPendingDrafts: false, busy: false, shownMethod: 'bishop' }),
    );
    expect(html).toContain('data-state="stale"');
    expect(html).toContain('data-stale-reason="model"');
    expect(html).toContain('class="rs-list rs-stale"');
    expect(html).toContain(STALE_MODEL_TEXT);
  });

  it('si el modelo cambió y además hay borrador sin aplicar, prioriza el aviso de cambios sin aplicar', () => {
    const html = renderToStaticMarkup(
      createElement(ResultSummary, { run, current: false, hasPendingDrafts: true, busy: false, shownMethod: 'bishop' }),
    );
    expect(html).toContain('data-state="stale"');
    expect(html).toContain('data-stale-reason="drafts"');
    expect(html).toContain(STALE_DRAFTS_TEXT);
  });

  it('sin cálculo previo o durante un cálculo no muestra nota de desactualizado aunque haya borrador', () => {
    const emptyHtml = renderToStaticMarkup(
      createElement(ResultSummary, { run: null, current: false, hasPendingDrafts: true, busy: false, shownMethod: null }),
    );
    expect(emptyHtml).toContain('data-state="empty"');
    expect(emptyHtml).not.toContain('rs-stale-note');

    const busyHtml = renderToStaticMarkup(
      createElement(ResultSummary, { run, current: true, hasPendingDrafts: true, busy: true, shownMethod: null, elapsedSeconds: 3 }),
    );
    expect(busyHtml).toContain('data-state="busy"');
    expect(busyHtml).not.toContain('rs-stale-note');
  });

  it('EditorApp pasa hasPendingDrafts={hasDrafts} a ResultSummary', () => {
    const editorSrc = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
    expect(editorSrc).toMatch(/<ResultSummary[^>]*hasPendingDrafts=\{hasDrafts\}/);
  });
});
