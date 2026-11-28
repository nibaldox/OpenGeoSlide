// UA3-C2: HUD (B-03, A-12, A-04, A-03, compact y avisos del modelo de UA-E3 §3-§4). SSR más la lógica pura; el foco y las cajas se comprueban en Chrome.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import {
  INITIAL_HUD_FOLD,
  ResultSummary,
  advisoriesText,
  isHudCollapsed,
  pillLabel,
  pillParts,
  resetCompactChoice,
  toggleHudFold,
} from './ResultSummary';
import type { EngineRun } from './reportInput';

const result = (method: string, fos: number | null, status: 'converged' | 'not_converged' | 'invalid' = 'converged'): MethodReport =>
  ({ method, status: fos === null && status === 'converged' ? 'not_converged' : status, fos: fos ?? 0, lambda: null, iterations: 5, warnings: [], slices: [], surface: { xc: 0, yc: 0, r: 1 }, search: null }) as unknown as MethodReport;
const makeRun = (...results: MethodReport[]): EngineRun => ({
  revision: 1,
  doc: {} as never,
  json: '',
  sha256: 'a'.repeat(64),
  report: { engine: 'ogs-core 0.5.0', results } as unknown as AnalysisReport,
  elapsedMs: 5,
  checkedAt: '',
});
const render = (props: Record<string, unknown>): string => renderToStaticMarkup(createElement(ResultSummary, { current: true, busy: false, shownMethod: null, run: null, ...props } as never));
const below1 = makeRun(result('bishop', 0.985), result('spencer', 0.984), result('morgenstern_price', 0.984));
const above1 = makeRun(result('bishop', 1.403), result('janbu_corrected', 1.356));
const pillOf = (html: string): string => /<button[^>]*class="rs-pill"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
/** Texto visible de un fragmento: sin etiquetas ni íconos. */
const visibleText = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

describe('B-03: la píldora plegada lleva todo su texto visible en el nombre accesible (UA-E2, WCAG 2.5.3)', () => {
  it('con FS < 1: «FS mín. 0,984» y «FS < 1,0» están en la píldora y en su aria-label', () => {
    const pill = pillOf(render({ run: below1, compact: true }));
    expect(pill).toContain('aria-label="Mostrar resultado, FS mín. 0,984 FS &lt; 1,0"');
    expect(visibleText(pill)).toBe('FS mín. 0,984 FS &lt; 1,0');
    expect(pill).toContain('aria-expanded="false"');
  });

  it('con FS ≥ 1 no hay chip y el nombre es «Mostrar resultado, FS mín. 1,356»', () => {
    const pill = pillOf(render({ run: above1, compact: true }));
    expect(pill).toContain('aria-label="Mostrar resultado, FS mín. 1,356"');
    expect(pill).not.toContain('rs-pill-chip');
  });

  it('desactualizado (por modelo o por borradores): «Desactualizado» sigue en el texto y en el nombre; no se afirma «FS < 1,0»', () => {
    for (const patch of [{ current: false }, { hasPendingDrafts: true }]) {
      const pill = pillOf(render({ run: below1, compact: true, ...patch }));
      expect(pill).toContain('aria-label="Mostrar resultado, FS mín. 0,984 Desactualizado"');
      expect(visibleText(pill)).toBe('FS mín. 0,984 Desactualizado');
      expect(pill).not.toContain('FS &lt; 1,0');
    }
  });

  it('el nombre accesible contiene el texto visible, tal cual, en todos los estados', () => {
    for (const run of [below1, above1]) {
      for (const patch of [{}, { current: false }, { hasPendingDrafts: true }]) {
        const pill = pillOf(render({ run, compact: true, ...patch }));
        const label = /aria-label="([^"]*)"/.exec(pill)?.[1] ?? '';
        expect(label.endsWith(visibleText(pill))).toBe(true);
        expect(pill).not.toContain('aria-describedby');
      }
    }
  });

  it('pillParts y pillLabel (puras)', () => {
    expect(pillParts('0,984', true, true)).toEqual({ figure: 'FS mín. 0,984', status: 'FS < 1,0' });
    expect(pillParts('0,984', true, false)).toEqual({ figure: 'FS mín. 0,984', status: 'Desactualizado' });
    expect(pillParts('1,356', false, true).status).toBeNull();
    expect(pillLabel(pillParts('1,356', false, true))).toBe('Mostrar resultado, FS mín. 1,356');
  });
});

describe('compact (UA-E3 §3) y la elección manual del usuario', () => {
  it('compact: el HUD sale plegado (píldora, data-collapsed y data-compact) y el cuerpo oculto', () => {
    const html = render({ run: below1, compact: true });
    expect(html).toContain('data-collapsed="true"');
    expect(html).toContain('data-compact="true"');
    expect(html).toContain('class="rs-pill"');
    expect(html).toMatch(/class="rs-body" hidden/);
    expect(html).not.toContain('Ocultar resultado');
  });

  it('sin compact (o compact falso) el HUD sale desplegado', () => {
    for (const html of [render({ run: below1 }), render({ run: below1, compact: false })]) {
      expect(html).not.toContain('data-collapsed');
      expect(html).not.toContain('data-compact');
      expect(html).toContain('aria-label="Ocultar resultado"');
    }
  });

  it('sin cálculo o calculando, compact no cambia nada (no hay nada que plegar)', () => {
    expect(render({ run: null, compact: true })).not.toContain('data-collapsed');
    expect(render({ run: below1, busy: true, compact: true })).not.toContain('data-collapsed');
  });

  it('el usuario despliega a mano con compact en true: se respeta hasta que compact vuelve a false', () => {
    let fold = INITIAL_HUD_FOLD;
    expect(isHudCollapsed(true, fold)).toBe(true);
    fold = toggleHudFold(true, fold); // despliega a mano
    expect(isHudCollapsed(true, fold)).toBe(false);
    expect(isHudCollapsed(true, toggleHudFold(true, fold))).toBe(true); // y puede volver a plegar
    // compact vuelve a false: se olvida el despliegue manual y manda la preferencia normal (desplegado)
    fold = resetCompactChoice(fold);
    expect(isHudCollapsed(false, fold)).toBe(false);
    // y la siguiente vez que compact sea true, empieza plegado otra vez
    expect(isHudCollapsed(true, fold)).toBe(true);
  });

  it('la elección manual fuera de compact no se pierde: plegado a mano sigue plegado al volver de compact', () => {
    let fold = toggleHudFold(false, INITIAL_HUD_FOLD); // pliega a mano
    expect(isHudCollapsed(false, fold)).toBe(true);
    fold = resetCompactChoice(fold);
    expect(isHudCollapsed(true, fold)).toBe(true);
    expect(isHudCollapsed(false, fold)).toBe(true);
    fold = toggleHudFold(false, fold);
    expect(isHudCollapsed(false, fold)).toBe(false);
  });

  it('el despliegue manual dentro de compact no toca la preferencia de fuera de compact', () => {
    const fold = toggleHudFold(true, INITIAL_HUD_FOLD);
    expect(fold).toEqual({ collapsed: false, expandedInCompact: true });
    expect(resetCompactChoice(fold)).toEqual(INITIAL_HUD_FOLD);
    expect(resetCompactChoice(INITIAL_HUD_FOLD)).toBe(INITIAL_HUD_FOLD);
  });
});

describe('avisos del modelo (UA-E3 §4): «N avisos del modelo» y «Ver avisos»', () => {
  it('con localAdvisories y manejador: la línea, el contador y el botón; sin avisos, nada', () => {
    const html = render({ run: above1, localAdvisories: 3, onShowAdvisories: () => undefined });
    expect(html).toContain('data-testid="rs-advisories"');
    expect(html).toContain('3 avisos del modelo');
    expect(html).toMatch(/<button[^>]*class="rs-advisories-link link-button"[^>]*>Ver avisos<\/button>/);
    expect(render({ run: above1 })).not.toContain('rs-advisories');
    expect(render({ run: above1, localAdvisories: 0, onShowAdvisories: () => undefined })).not.toContain('rs-advisories');
  });

  it('singular y sin manejador (no hay un botón que no hace nada)', () => {
    expect(advisoriesText(1)).toBe('1 aviso del modelo');
    const html = render({ run: above1, localAdvisories: 1 });
    expect(html).toContain('1 aviso del modelo');
    expect(html).not.toContain('Ver avisos');
  });

  it('también sin cálculo (los avisos del modelo existen antes de calcular), y no mientras calcula', () => {
    expect(render({ run: null, localAdvisories: 2, onShowAdvisories: () => undefined })).toContain('2 avisos del modelo');
    expect(render({ run: null, busy: true, localAdvisories: 2 })).not.toContain('avisos del modelo');
  });

  it('plegado, el cuerpo (con la línea) queda oculto pero montado', () => {
    const html = render({ run: above1, compact: true, localAdvisories: 2, onShowAdvisories: () => undefined });
    expect(html).toMatch(/class="rs-body" hidden/);
  });
});

describe('A-03: error del motor en el HUD con «Ver diagnósticos»', () => {
  it('sin resultados: la línea de error sustituye al texto de «Sin resultados», con el texto completo en title y el botón', () => {
    const text = 'No hay ninguna superficie de deslizamiento válida para el modelo.';
    const html = render({ run: null, engineError: text, onShowAdvisories: () => undefined });
    expect(html).toContain('data-testid="rs-engine-error"');
    expect(html).toContain(`title="${text}"`);
    expect(html).toContain('Ver diagnósticos');
    expect(html).not.toContain('Sin resultados.');
    expect(html).toContain('data-state="empty"');
  });

  it('sin manejador no hay botón; sin error, el texto de siempre', () => {
    expect(render({ run: null, engineError: 'Falló' })).not.toContain('Ver diagnósticos');
    expect(render({ run: null, engineError: null })).toContain('Sin resultados.');
    expect(render({ run: null, engineError: '  ' })).toContain('Sin resultados.');
  });

  it('con un resultado anterior, el error va arriba del cuerpo', () => {
    const html = render({ run: below1, current: false, engineError: 'Falló', onShowAdvisories: () => undefined });
    expect(html.indexOf('rs-engine-error')).toBeGreaterThan(html.indexOf('class="rs-body"'));
    expect(html.indexOf('rs-engine-error')).toBeLessThan(html.indexOf('fs-min'));
  });

  it('el texto del error se escapa', () => {
    expect(render({ run: null, engineError: '<img src=x>' })).not.toContain('<img');
  });
});

describe('A-04: «No convergió» no se superpone (la disposición, no solo el color)', () => {
  const css = readFileSync(new URL('./resultSummary.css', import.meta.url), 'utf8');
  const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = (selector: string): string => [...css.matchAll(new RegExp(`${escapeRe(selector)}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join('\n');
  const column = (selector: string): string | null => /grid-column:\s*([^;]+);/.exec(rule(selector))?.[1].trim() ?? null;

  it('el estado, el FS y el método de una fila no convergida usan columnas distintas, y el estado no cae en la de 18 px', () => {
    expect(rule('.rs .rs-item-warn')).toContain('grid-template-columns: minmax(0, 1fr) auto auto 18px');
    const status = column('.rs .rs-item-warn .rs-status');
    const fs = column('.rs .rs-item-warn .rs-fs');
    expect(status).toBe('2');
    expect(fs).toBe('3');
    expect(column('.rs .rs-method')).toBe('1');
    expect(new Set([status, fs, '1']).size).toBe(3);
  });

  it('el marcado conserva «—», el estado a la vista y «Con aviso»', () => {
    const html = render({ run: makeRun(result('bishop', 0.985), result('spencer', null)) });
    expect(html).toMatch(/data-testid="fs-spencer"[^>]*><span class="rs-fs-label">FS<\/span> —/);
    expect(html).toContain('<span class="rs-status">No convergió</span>');
  });
});

describe('B-12(a): el FS por método usa el mismo texto que la cifra', () => {
  it('0,9997 no se ve «1,000» en la cifra ni en la lista', () => {
    const run = makeRun(result('bishop', 0.9997), result('spencer', 1.2));
    const html = render({ run });
    expect(html).toMatch(/data-testid="fs-min"[^>]*>0,9997</);
    expect(html).toMatch(/data-testid="fs-bishop"[^>]*><span class="rs-fs-label">FS<\/span> 0,9997/);
    expect(html).not.toContain('1,000');
  });
});
