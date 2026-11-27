import { describe, expect, it } from 'vitest';
import { keyActions } from '../editor/canvas/keys';
import { VP, makeDoc, makeState } from '../editor/canvas/fakeStore';
import { shortcutFor, type ShortcutAction } from '../editor/app/shortcuts';
import {
  GLOSSARY,
  HELP_LINKS,
  HELP_SECTIONS,
  LIMITATIONS,
  PROFESSIONAL_WARNING,
  QUICK_START,
  SHORTCUTS,
  glossaryTerms,
  type KeyProbe,
} from './helpContent';
import { TOUR_STEPS } from './tour';

const keyInput = (p: KeyProbe) => ({ key: p.key, ctrlKey: p.ctrl ?? false, metaKey: false, shiftKey: p.shift ?? false, altKey: false });

describe('atajos: lo que dice la ayuda es lo que hace la aplicación', () => {
  const global = SHORTCUTS.filter((s) => s.scope === 'global');
  const canvas = SHORTCUTS.filter((s) => s.scope === 'canvas');

  it('hay atajos globales y del lienzo', () => {
    expect(global.length).toBeGreaterThanOrEqual(8);
    expect(canvas.length).toBeGreaterThanOrEqual(8);
  });

  it.each(global.map((s) => [s.keys, s] as const))('global «%s» dispara la acción declarada', (_keys, s) => {
    expect(s.action).toBeTruthy();
    for (const p of s.probes) {
      const k = keyInput(p);
      expect(shortcutFor({ ...k, inField: false })).toBe(s.shortcutAction as ShortcutAction);
    }
  });

  it.each(canvas.map((s) => [s.keys, s] as const))('lienzo «%s» lo atiende el lienzo con un vértice seleccionado', (_keys, s) => {
    // Un vértice seleccionado y la vista fija: así todas las teclas del lienzo tienen algo que hacer.
    const state = makeState(makeDoc(), { selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 4 }, viewport: VP });
    for (const p of s.probes) {
      expect(keyActions(state, keyInput(p)).handled, `${s.keys}: ${p.key}`).toBe(true);
    }
  });

  it('cada atajo declara al menos una prueba (no hay texto sin comprobar)', () => {
    for (const s of SHORTCUTS) expect(s.probes.length, s.keys).toBeGreaterThan(0);
  });

  it('las teclas de herramienta de la barra (V, A, R, H) están en la ayuda', () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    for (const k of ['V', 'A', 'R', 'H']) expect(keys).toContain(k);
  });

  it('R es «Dibujar región»: la ayuda y shortcutFor coinciden', () => {
    const r = SHORTCUTS.find((s) => s.keys === 'R');
    expect(r?.scope).toBe('global');
    expect(r?.action).toContain('Dibujar región');
    expect(shortcutFor({ ...keyInput({ key: 'r' }), inField: false })).toBe('tool:draw_region');
  });

  it('cada acción que atiende shortcutFor (letra, Ctrl+letra o Ctrl+Intro) tiene su entrada en la ayuda', () => {
    // Recorre las teclas imprimibles y las combinaciones con Ctrl/Mayús: lo que `shortcutFor` resuelva debe estar documentado.
    const keys = [...'abcdefghijklmnopqrstuvwxyz0123456789', 'Enter'];
    const found = new Set<ShortcutAction>();
    for (const key of keys) {
      for (const ctrl of [false, true]) {
        for (const shift of [false, true]) {
          const a = shortcutFor({ key, ctrlKey: ctrl, metaKey: false, shiftKey: shift, altKey: false, inField: false });
          if (a) found.add(a);
        }
      }
    }
    const documented = new Set(SHORTCUTS.flatMap((s) => (s.scope === 'global' ? [s.shortcutAction] : [])));
    expect([...found].sort()).toEqual([...documented].sort());
    expect(found.has('tool:draw_region')).toBe(true);
  });

  it('no hay dos entradas con las mismas teclas y ámbito', () => {
    const ids = SHORTCUTS.map((s) => `${s.scope}:${s.keys}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('inicio rápido', () => {
  it('es la misma lista de 5 pasos de la guía: no se duplica el texto', () => {
    expect(QUICK_START).toBe(TOUR_STEPS);
    expect(QUICK_START).toHaveLength(5);
  });
});

describe('glosario', () => {
  const required = ['FS', 'Bishop simplificado', 'Spencer', 'λ', 'ru', 'piezométrica', 'kh y kv', 'm_α', 'dovela', 'superficie crítica', 'búsqueda'];
  it('incluye todos los términos del brief', () => {
    const terms = glossaryTerms();
    for (const r of required) expect(terms.some((t) => t.toLowerCase().includes(r.toLowerCase())), r).toBe(true);
  });
  it('cada término tiene una definición con contenido y un id único', () => {
    for (const g of GLOSSARY) expect(g.definition.length, g.term).toBeGreaterThan(40);
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });
  it('la búsqueda explica la entrada y la salida', () => {
    const g = GLOSSARY.find((x) => x.id === 'search');
    expect(g?.definition).toMatch(/entrada/i);
    expect(g?.definition).toMatch(/salida/i);
  });
  it('sin voseo', () => {
    const text = GLOSSARY.map((g) => g.definition).join(' ');
    expect(text).not.toMatch(/\b(pod[eé]s|ten[eé]s|hac[eé]s|elegí|pulsá)\b/i);
  });
});

describe('enlaces, advertencia y limitaciones', () => {
  it('apuntan al repositorio, a los Releases, a «Citar» y al README', () => {
    expect(HELP_LINKS.repo).toBe('https://github.com/nibaldox/OpenGeoSlide');
    expect(HELP_LINKS.releases).toBe('https://github.com/nibaldox/OpenGeoSlide/releases');
    expect(HELP_LINKS.cite).toMatch(/CITATION\.cff$/);
    expect(HELP_LINKS.limitations).toMatch(/^https:\/\/github\.com\/nibaldox\/OpenGeoSlide.*limitaciones-conocidas$/);
  });
  it('la advertencia profesional dice que no es una herramienta certificada', () => {
    expect(PROFESSIONAL_WARNING).toMatch(/no es una herramienta certificada/i);
    expect(PROFESSIONAL_WARNING).toMatch(/profesional competente/i);
  });
  it('hay limitaciones y no son vacías', () => {
    expect(LIMITATIONS.length).toBeGreaterThanOrEqual(4);
    for (const l of LIMITATIONS) expect(l.length).toBeGreaterThan(30);
  });
});

describe('índice interno', () => {
  it('cada sección tiene id único y título', () => {
    expect(new Set(HELP_SECTIONS.map((s) => s.id)).size).toBe(HELP_SECTIONS.length);
    expect(HELP_SECTIONS.map((s) => s.id)).toEqual(['quick-start', 'glossary', 'shortcuts', 'limits', 'warning', 'links']);
    for (const s of HELP_SECTIONS) expect(s.title.length).toBeGreaterThan(3);
  });
});

describe('R9-05b: la ayuda declara las convenciones de signo del motor', () => {
  const all = [...GLOSSARY.map((g) => g.definition), ...LIMITATIONS].join('\n');
  it('kh en el sentido del deslizamiento, kv positivo hacia abajo y solo sobre el peso del suelo', () => {
    expect(all).toContain('kh positivo actúa en el sentido del deslizamiento');
    expect(all).toContain('kv positivo actúa hacia abajo');
    expect(all).toContain('solo al peso del suelo W, no a las sobrecargas');
  });
  it('ángulo de la carga lineal desde la vertical, positivo hacia +x', () => {
    expect(GLOSSARY.find((g) => g.id === 'load-angle')?.definition).toContain('desde la vertical hacia abajo y es positivo hacia +x');
  });
  it('limitaciones: γsat, ru con piezométrica, extrapolación y γw imperial', () => {
    expect(all).toContain('manda ru');
    expect(all).toContain('se prolonga en horizontal');
    expect(all).toContain('explícito menor que 20 pcf'); // E15m-9: solo el valor explícito bloquea; vacío es 62,4 pcf
    expect(all).toContain('62,4 pcf');
  });
});
