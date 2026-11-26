// Panel «Análisis»: grieta de tracción (F5.7). Formulario puro (`crackToForm`, `crackFromForm`, `crackCommands`), render con store falso,
// nombres accesibles estables y únicos, punteros `data-path` y texto del panel «Agua» sobre el agua embalsada.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { baseDoc } from '../state/testFixtures';
import { applyCommand } from '../state/reducer';
import { createFakeStore } from './fakeStore';
import { AnalysisPanel, WaterPanel } from './index';
import { CRACK_DEFAULT_WATER_FILL, crackCommands, crackFromForm, crackToForm, type CrackForm } from './forms';

const doc = (over: Partial<ModelDoc['analysis']> = {}, extra: Partial<ModelDoc> = {}): ModelDoc => ({
  ...baseDoc(),
  ...extra,
  analysis: { ...baseDoc().analysis, ...over },
});
const html = (d: ModelDoc, panel = AnalysisPanel): string => renderToStaticMarkup(createElement(panel, { store: createFakeStore(d) }));
const text = (h: string): string => h.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

function names(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/<(?:input|select)\b[^>]*>/g)) {
    const tag = m[0];
    const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    const label = id ? new RegExp(`<label for="${id}">(.*?)</label>`).exec(markup)?.[1] : undefined;
    out.push(text(aria ?? label ?? ''));
  }
  return out;
}

describe('formulario de la grieta', () => {
  it('sin grieta: apagada, fracción de agua en 1 y profundidad vacía', () => {
    expect(crackToForm(doc())).toEqual({ enabled: false, auto: true, depth: '', water_fill: '1' });
    expect(CRACK_DEFAULT_WATER_FILL).toBe(1);
  });

  it('con grieta numérica o automática', () => {
    expect(crackToForm(doc({ tension_crack: { depth: 2.5, water_fill: 0.5 } }))).toEqual({ enabled: true, auto: false, depth: '2,5', water_fill: '0,5' });
    expect(crackToForm(doc({ tension_crack: { depth: 'auto', water_fill: 0 } }))).toEqual({ enabled: true, auto: true, depth: '', water_fill: '0' });
  });

  const ok = (f: Partial<CrackForm>) => crackFromForm({ enabled: true, auto: false, depth: '2', water_fill: '1', ...f });

  it('apagada da null y no valida los campos', () => {
    expect(crackFromForm({ enabled: false, auto: false, depth: 'xx', water_fill: '9' })).toEqual({ ok: true, value: null });
  });

  it('profundidad fija con coma o punto; automática ignora el texto', () => {
    expect(ok({ depth: '2,5' })).toEqual({ ok: true, value: { depth: 2.5, water_fill: 1 } });
    expect(ok({ depth: '2.5', water_fill: '0,25' })).toEqual({ ok: true, value: { depth: 2.5, water_fill: 0.25 } });
    expect(ok({ auto: true, depth: '' })).toEqual({ ok: true, value: { depth: 'auto', water_fill: 1 } });
    expect(ok({ water_fill: '0' })).toEqual({ ok: true, value: { depth: 2, water_fill: 0 } });
  });

  it('errores con el texto del motor: depth ≤ 0, vacía o no numérica; water_fill fuera de [0, 1] o vacía', () => {
    for (const depth of ['0', '-1']) {
      const r = ok({ depth });
      expect(r.ok ? null : r.errors.depth, depth).toContain('debe ser finito y mayor que 0 (o «Automática»)');
    }
    expect(ok({ depth: '' }).ok).toBe(false);
    const nan = ok({ depth: 'abc' });
    expect(nan.ok ? null : nan.errors.depth).toContain('escriba un número');
    for (const w of ['-0,1', '1,5']) {
      const r = ok({ water_fill: w });
      expect(r.ok ? null : r.errors.water_fill, w).toContain('debe ser finito y estar en [0, 1]');
    }
    expect(ok({ water_fill: '' }).ok).toBe(false);
    expect(ok({ water_fill: '1' }).ok).toBe(true);
  });

  it('crackCommands: encender crea la grieta; cambiar emite un solo patch; apagar la quita; sin cambios no emite nada', () => {
    const d = doc();
    expect(crackCommands(d, null)).toEqual([]);
    expect(crackCommands(d, { depth: 'auto', water_fill: 1 })).toEqual([{ type: 'analysis/patch', patch: { tension_crack: { depth: 'auto', water_fill: 1 } } }]);
    const withC = doc({ tension_crack: { depth: 2, water_fill: 1 } }, { version: '0.5' });
    expect(crackCommands(withC, { depth: 2, water_fill: 1 })).toEqual([]);
    expect(crackCommands(withC, { depth: 3, water_fill: 1 })).toEqual([{ type: 'analysis/patch', patch: { tension_crack: { depth: 3, water_fill: 1 } } }]);
    expect(crackCommands(withC, null)).toEqual([{ type: 'analysis/patch', patch: { tension_crack: undefined } }]);
    const cmd = crackCommands(d, { depth: 'auto', water_fill: 1 })[0];
    expect(cmd && applyCommand(d, cmd)?.version).toBe('0.5');
  });
});

describe('AnalysisPanel: grieta de tracción', () => {
  it('sin grieta solo muestra la casilla, con nombre accesible estable', () => {
    const out = html(doc());
    expect(out).toContain('Grieta de tracción');
    expect(text(out)).toContain('Incluir grieta de tracción');
    expect(out).toContain('data-path="/analysis/tension_crack"');
    expect(out).not.toContain('data-path="/analysis/tension_crack/depth"');
    expect(out).not.toContain('data-path="/analysis/tension_crack/water_fill"');
  });

  it('con grieta fija muestra profundidad con unidad y fracción de agua; la casilla queda marcada', () => {
    const out = html(doc({ tension_crack: { depth: 2.5, water_fill: 0.5 } }, { version: '0.5' }));
    expect(out).toContain('data-path="/analysis/tension_crack/depth"');
    expect(out).toContain('value="2,5"');
    expect(out).toContain('data-path="/analysis/tension_crack/water_fill"');
    expect(out).toContain('value="0,5"');
    expect(out).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""[^>]*data-path="\/analysis\/tension_crack"|<input[^>]*data-path="\/analysis\/tension_crack"[^>]*checked=""/);
    expect(text(out)).toContain('Profundidad de la grieta (m)');
    expect(text(out)).toContain('Fracción de agua en la grieta');
    expect(text(out)).toContain('0 es seca y 1 es llena');
  });

  it('en un modelo imperial la profundidad lleva ft', () => {
    const out = html(doc({ tension_crack: { depth: 8, water_fill: 1 } }, { version: '0.5', units: 'imperial' }));
    expect(text(out)).toContain('Profundidad de la grieta (ft)');
  });

  it('con profundidad automática ofrece «Automática» seleccionada y no muestra el campo numérico', () => {
    const out = html(doc({ tension_crack: { depth: 'auto', water_fill: 1 } }, { version: '0.5' }));
    expect(out).toContain('Automática');
    expect(out).toMatch(/<option value="auto" selected="">Automática<\/option>/);
    expect(out).not.toContain('data-path="/analysis/tension_crack/depth"');
  });

  it('los nombres accesibles de la grieta son únicos y no chocan con los del resto del panel', () => {
    const out = html(doc({ tension_crack: { depth: 2, water_fill: 1 } }, { version: '0.5' }));
    const section = out.slice(out.indexOf('<legend>Grieta de tracción</legend>'), out.indexOf('</fieldset>', out.indexOf('<legend>Grieta de tracción</legend>')));
    const all = names(section);
    expect(all).toHaveLength(4);
    expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
    expect(all.every((n) => n !== '')).toBe(true);
    expect(all).toEqual(expect.arrayContaining(['Incluir grieta de tracción', 'Tipo de profundidad de la grieta', 'Profundidad de la grieta (m)', 'Fracción de agua en la grieta']));
  });

  it('usa solo tokens var(--ui-*) o clases del panel, sin colores literales en el marcado', () => {
    const out = html(doc({ tension_crack: { depth: 2, water_fill: 1 } }, { version: '0.5' }));
    expect(out).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });

  it('no usa voseo en el texto de la grieta', () => {
    const t = text(html(doc({ tension_crack: { depth: 2, water_fill: 1 } }, { version: '0.5' })));
    expect(t).not.toMatch(/\b(elegí|escribí|marcá|usá|ingresá|podés|tenés)\b/i);
  });
});

describe('WaterPanel: agua embalsada', () => {
  it('explica que el agua sobre el terreno se carga automáticamente, con peso y empuje horizontal y sin sismo', () => {
    for (const d of [doc(), doc({}, { water: { piezometric_line: [[0, 1], [5, 2]] } })]) {
      const t = text(html(d, WaterPanel));
      expect(t).toContain('agua embalsada');
      expect(t).toContain('automáticamente');
      expect(t).toContain('sin sismo');
    }
  });

  it('el texto está enlazado a la lista de puntos con una nota visible (no solo un title)', () => {
    const out = html(doc({}, { water: { piezometric_line: [[0, 1], [5, 2]] } }), WaterPanel);
    expect(out).toMatch(/<p class="muted small"[^>]*>[^<]*agua embalsada/);
  });
});
