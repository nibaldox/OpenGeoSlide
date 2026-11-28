// CM-W3A · RCM-B-07 (E17f §1): la línea «Búsqueda global: …» del HUD. Lógica pura (`globalSearchLine`) y SSR de `ResultSummary`; las cajas, en Chrome.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GLOBAL_STATS_WINS, globalSearchFixture } from '../../report/globalFixtures';
import type { AnalysisReport, GlobalStats, MethodReport } from '../../engine/types';
import { ResultSummary } from './ResultSummary';
import type { EngineRun } from './reportInput';
import { globalSearchLine } from './resultSummary';

describe('RCM-B-07: la línea «Búsqueda global» del HUD (E17f §1)', () => {
  const report = (...results: MethodReport[]): AnalysisReport => ({ engine: 'ogs-core 0.7.0', results });
  const base = (): { spencer: MethodReport; mp: MethodReport } => {
    const [spencer, mp] = globalSearchFixture().report.results as [MethodReport, MethodReport];
    return { spencer, mp };
  };
  const stats = (patch: Partial<GlobalStats>): GlobalStats => ({ ...GLOBAL_STATS_WINS, ...patch });
  const only = (r: MethodReport, g: GlobalStats): MethodReport => ({ ...r, search: { ...r.search!, non_circular: { ...r.search!.non_circular!, global: g } } });

  it('sin `global` en ningún resultado: no hay línea', () => {
    const { spencer } = base();
    const plain = { ...spencer, warnings: [], search: { ...spencer.search!, non_circular: { ...spencer.search!.non_circular!, global: undefined } } } as MethodReport;
    expect(globalSearchLine(report(plain))).toBeNull();
    expect(globalSearchLine(report({ ...plain, search: null }))).toBeNull();
  });

  it('gana la global: «Búsqueda global: ganó (bloque)» o «(recocido)»', () => {
    const { spencer } = base();
    const one = (algorithm: 'block' | 'annealing') => globalSearchLine(report(only({ ...spencer, warnings: [] }, stats({ algorithm }))))!;
    expect(one('block').text).toBe('Búsqueda global: ganó (bloque)');
    expect(one('annealing').text).toBe('Búsqueda global: ganó (recocido)');
    expect(one('block').flagged).toBe(false);
  });

  it('gana el refinamiento con elegibles: «no mejoró el refinamiento»; con eligible = 0: «sin candidatos»', () => {
    const { spencer } = base();
    const clean = { ...spencer, warnings: [] };
    expect(globalSearchLine(report(only(clean, stats({ winner: 'refinement', eligible: 12 }))))!.text).toBe('Búsqueda global: no mejoró el refinamiento');
    expect(globalSearchLine(report(only(clean, stats({ winner: 'refinement', eligible: 0, global_fos: null }))))!.text).toBe('Búsqueda global: sin candidatos');
  });

  it('con la nota non_circular_global_tension_rejected lleva la marca de aviso (y la explicación en el título)', () => {
    const { spencer } = base();
    const line = globalSearchLine(report(only({ ...spencer, warnings: ['non_circular_global_tension_rejected'] }, stats({}))))!;
    expect(line.flagged).toBe(true);
    expect(line.title).toContain('guarda de tracción');
    expect(line.title).toContain('55 rechazados por tracción');
  });

  it('habla del método que rige y lo nombra cuando hay dos con etapa global (V051: Spencer por refinamiento, M-P por la global)', () => {
    const { spencer, mp } = base();
    const sp = only({ ...spencer, fos: 0.707, warnings: ['non_circular_global_tension_rejected'] }, stats({ winner: 'refinement', eligible: 116, global_fos: 0.729 }));
    const m = only({ ...mp, fos: 0.666, warnings: [] }, stats({ winner: 'global', eligible: 156 }));
    const line = globalSearchLine(report(sp, m))!;
    expect(line.text).toBe('Búsqueda global: ganó (bloque) · M-P');
    expect(line.flagged).toBe(false); // el aviso es de Spencer, que no rige
    // Si rige Spencer, la línea es la suya.
    const line2 = globalSearchLine(report({ ...sp, fos: 0.5 }, m))!;
    expect(line2.text).toBe('Búsqueda global: no mejoró el refinamiento · Spencer');
    expect(line2.flagged).toBe(true);
  });

  const run = (r: AnalysisReport): EngineRun => ({ revision: 1, doc: {} as never, json: '', sha256: 'a'.repeat(64), report: r, elapsedMs: 5, checkedAt: '' });
  const render = (props: Record<string, unknown>): string => renderToStaticMarkup(createElement(ResultSummary, { current: true, busy: false, shownMethod: null, run: null, ...props } as never));

  it('el HUD desplegado la dibuja en la parte desplegada y no en la píldora plegada', () => {
    const { spencer } = base();
    const r = run(report(only({ ...spencer, warnings: ['non_circular_global_tension_rejected'] }, stats({}))));
    const open = render({ run: r });
    expect(open).toContain('data-testid="rs-global"');
    expect(open).toContain('Búsqueda global: ganó (bloque)');
    expect(open).toContain('data-flagged="true"');
    // Plegado (320 px: `compact`): la píldora lleva la cifra y el método, no la línea global; la línea queda en el cuerpo oculto.
    const folded = render({ run: r, compact: true });
    const pill = /<button[^>]*class="rs-pill"[\s\S]*?<\/button>/.exec(folded)?.[0] ?? '';
    expect(pill).not.toContain('Búsqueda global');
    expect(pill).toContain('FS mín.');
    expect(folded).toMatch(/id="[^"]*" class="rs-body" hidden/);
  });

  it('sin `global`, el HUD es el de siempre (sin la línea)', () => {
    const { spencer } = base();
    const plain = { ...spencer, warnings: [], search: { ...spencer.search!, non_circular: { ...spencer.search!.non_circular!, global: undefined } } } as MethodReport;
    expect(render({ run: run(report(plain)) })).not.toContain('rs-global');
  });

  it('la regla del CSS: la línea se parte en renglones (nunca se corta) y no agrega anchos fijos', () => {
    const css = readFileSync(new URL('./resultSummary.css', import.meta.url), 'utf8');
    const rule = /\.rs \.rs-global \{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(rule).toContain('overflow-wrap: anywhere');
    expect(rule).not.toMatch(/white-space:\s*nowrap|width:/);
  });
});
