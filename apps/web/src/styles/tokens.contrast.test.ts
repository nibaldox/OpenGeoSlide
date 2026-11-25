import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Contraste WCAG de los pares declarados en tokens.css, en claro y en oscuro (U1-T, R7-15, UX-06).
// Texto: 4,5:1 (WCAG 1.4.3). Elementos de interfaz y trazos esenciales del lienzo: 3:1 (WCAG 1.4.11).

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

type Rgba = [number, number, number, number];
type Theme = 'light' | 'dark';

/** Valores `light-dark(a, b)` del bloque `@supports`: la fuente de verdad de los dos temas. */
function parseLightDark(source: string): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {};
  const re = /(--[a-z0-9-]+):\s*light-dark\(\s*((?:rgb\([^)]*\)|#[0-9a-fA-F]+))\s*,\s*((?:rgb\([^)]*\)|#[0-9a-fA-F]+))\s*\)\s*;/g;
  for (const m of source.matchAll(re)) out[m[1].slice(2)] = { light: m[2], dark: m[3] };
  return out;
}

function parseColor(value: string): Rgba {
  const v = value.trim();
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 1];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/.exec(v);
  if (!m) throw new Error(`color no reconocido: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/** Compone `top` sobre `under` (opaco). */
function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const tokens = parseLightDark(css.slice(css.indexOf('@supports (color: light-dark')));

function colorOf(name: string, theme: Theme, base?: string): Rgba {
  const entry = tokens[name];
  if (!entry) throw new Error(`token inexistente: --${name}`);
  const c = parseColor(entry[theme]);
  // Los colores con alfa se componen sobre el fondo indicado (por defecto, el del lienzo).
  if (c[3] < 1) return over(c, colorOf(base ?? 'canvas-bg', theme));
  return c;
}

const MATS = [0, 1, 2, 3, 4, 5, 6].map((i) => `canvas-mat-${i}`).concat('canvas-mat-unknown');
const UI_SURFACES = ['ui-bg', 'ui-surface', 'ui-surface-subtle'];

/** [primer plano, fondo, mínimo, descripción]. */
type Pair = [string, string, number, string];
const TEXT = 4.5;
const UI = 3;

const PAIRS: Pair[] = [
  // Texto sobre superficies de la interfaz
  ...['ui-bg', 'ui-surface', 'ui-surface-subtle', 'ui-surface-hover', 'ui-surface-active', 'ui-row-selected', 'ui-row-warn', 'ui-input-err-bg'].map(
    (bg): Pair => ['ui-ink', bg, TEXT, 'texto principal'],
  ),
  ...['ui-bg', 'ui-surface', 'ui-surface-subtle', 'ui-surface-hover', 'ui-row-warn'].map(
    (bg): Pair => ['ui-ink-muted', bg, TEXT, 'texto atenuado (R7-15)'],
  ),
  ['ui-ink-on-accent', 'ui-accent', TEXT, 'botón primario'],
  ['ui-ink-on-accent', 'ui-accent-hover', TEXT, 'botón primario, hover'],
  ...['ui-bg', 'ui-surface', 'ui-surface-subtle', 'ui-surface-active'].map((bg): Pair => ['ui-accent', bg, TEXT, 'acento como texto']),
  ['ui-ok-ink', 'ui-ok-bg', TEXT, 'estado correcto'],
  ['ui-ok-ink', 'ui-surface', TEXT, 'estado correcto sobre panel'],
  ['ui-warn-ink', 'ui-warn-bg', TEXT, 'aviso'],
  ['ui-warn-ink', 'ui-surface', TEXT, 'aviso sobre panel'],
  ['ui-warn-ink', 'ui-row-warn', TEXT, 'aviso sobre fila'],
  ['ui-err-ink', 'ui-err-bg', TEXT, 'error'],
  ['ui-err-ink', 'ui-surface', TEXT, 'error sobre panel'],
  ['ui-err-ink', 'ui-input-err-bg', TEXT, 'error en campo'],
  ['ui-info-ink', 'ui-info-bg', TEXT, 'información'],
  ['ui-note-ink', 'ui-note-bg', TEXT, 'nota'],
  // Elementos de interfaz (3:1)
  ...UI_SURFACES.map((bg): Pair => ['ui-control-border', bg, UI, 'borde de control (UX-06)']),
  ...[...UI_SURFACES, 'ui-surface-active', 'canvas-bg'].map((bg): Pair => ['ui-focus', bg, UI, 'anillo de foco']),
  ['ui-err-border', 'ui-surface', UI, 'borde de campo inválido'],
  ['ui-err-border', 'ui-input-err-bg', UI, 'borde de campo inválido'],
  // Texto del lienzo (la etiqueta de los ejes y de las cargas)
  ['canvas-axis-text', 'canvas-bg', TEXT, 'etiquetas de los ejes'],
  ['canvas-axis', 'canvas-bg', TEXT, 'marco y rótulos de los ejes'],
  ['canvas-load', 'canvas-bg', TEXT, 'etiqueta de carga'],
  ['canvas-seismic', 'canvas-seismic-bg', TEXT, 'insignia sísmica'],
  // Trazos del lienzo sobre el fondo y sobre cada material (3:1)
  ...['canvas-surface', 'canvas-surface-unconverged', 'canvas-piezo', 'canvas-load', 'canvas-region-edge', 'canvas-selected', 'canvas-handle-ring'].flatMap(
    (stroke): Pair[] => ['canvas-bg', ...MATS].map((bg): Pair => [stroke, bg, UI, 'trazo esencial del lienzo']),
  ),
  // Tiradores: relleno y aro, y el tirador de la piezométrica
  ['canvas-handle-ring', 'canvas-handle-sel', UI, 'tirador seleccionado'],
  ['canvas-handle-ring', 'canvas-handle-snap', UI, 'tirador con imán'],
  ['canvas-handle-ring', 'canvas-handle-fill', UI, 'tirador'],
  ['canvas-handle-fill', 'canvas-piezo', UI, 'tirador de la piezométrica'],
];

describe('tokens.css: contraste WCAG en claro y en oscuro', () => {
  for (const theme of ['light', 'dark'] as const) {
    describe(theme === 'light' ? 'tema claro' : 'tema oscuro', () => {
      for (const [fg, bg, min, why] of PAIRS) {
        it(`${fg} sobre ${bg} ≥ ${min}:1 (${why})`, () => {
          const ratio = contrast(colorOf(fg, theme, bg.startsWith('canvas') ? 'canvas-bg' : bg), colorOf(bg, theme));
          expect(ratio, `${theme}: ${fg} sobre ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }

  it('el halo del lienzo coincide con el fondo del lienzo en ambos temas', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(tokens['canvas-halo'][theme]).toBe(tokens['canvas-bg'][theme]);
    }
  });

  it('el anillo de foco y el borde de control también cumplen sobre cada tema por separado (R7-15: claro ≥ 4,5 en el texto atenuado)', () => {
    expect(contrast(colorOf('ui-ink-muted', 'light'), colorOf('ui-bg', 'light'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colorOf('ui-ink-muted', 'light'), colorOf('ui-surface', 'light'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tokens.css: contrato y respaldos', () => {
  const required = [
    ...['bg', 'surface', 'surface-subtle', 'surface-hover', 'surface-active', 'backdrop'].map((n) => `ui-${n}`),
    ...['ink', 'ink-muted', 'ink-on-accent', 'border', 'control-border', 'focus', 'accent', 'accent-hover'].map((n) => `ui-${n}`),
    ...(['ok', 'warn', 'err'] as const).flatMap((s) => [`ui-${s}-bg`, `ui-${s}-ink`, `ui-${s}-border`]),
    'ui-info-bg',
    'ui-info-ink',
    'ui-note-bg',
    'ui-note-ink',
    'ui-row-selected',
    'ui-row-warn',
    'ui-input-err-bg',
    ...['bg', 'grid', 'axis', 'axis-text', 'halo', 'region-edge', 'selected', 'surface', 'surface-unconverged', 'piezo', 'load', 'seismic', 'seismic-bg'].map(
      (n) => `canvas-${n}`,
    ),
    'canvas-band-entry',
    'canvas-band-exit',
    'canvas-slice-fill',
    'canvas-slice-edge',
    ...['handle-fill', 'handle-sel', 'handle-snap', 'handle-ring'].map((n) => `canvas-${n}`),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => `canvas-mat-${i}`),
    'canvas-mat-unknown',
  ];

  it('define todos los tokens del contrato PLAN_UX', () => {
    expect(required.filter((n) => !tokens[n])).toEqual([]);
  });

  it('declara color-scheme, accent-color y scrollbar-color', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
    expect(css).toMatch(/accent-color:/);
    expect(css).toMatch(/scrollbar-color:/);
    expect(css).toMatch(/html\[data-theme='light'\]\s*\{\s*color-scheme:\s*light;/);
    expect(css).toMatch(/html\[data-theme='dark'\]\s*\{\s*color-scheme:\s*dark;/);
  });

  it('los respaldos sin light-dark() repiten los mismos valores (claro en :root, oscuro en @media y en data-theme)', () => {
    const plain = (block: string): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const m of block.matchAll(/(--[a-z0-9-]+):\s*((?:rgb\([^)]*\)|#[0-9a-fA-F]+))\s*;/g)) out[m[1].slice(2)] = m[2];
      return out;
    };
    const mediaAt = css.indexOf('\n@media (prefers-color-scheme: dark)');
    const rootLight = plain(css.slice(0, mediaAt));
    const mediaDark = plain(css.slice(mediaAt, css.indexOf('\n@supports (color: light-dark')));
    const notSupported = css.slice(css.indexOf('@supports not'));
    const forcedLight = plain(notSupported.slice(notSupported.indexOf("html[data-theme='light']"), notSupported.indexOf("html[data-theme='dark']")));
    const forcedDark = plain(notSupported.slice(notSupported.indexOf("html[data-theme='dark']")));
    for (const [name, { light, dark }] of Object.entries(tokens)) {
      expect(rootLight[name], `claro de respaldo ${name}`).toBe(light);
      expect(forcedLight[name], `data-theme=light sin light-dark ${name}`).toBe(light);
      expect(mediaDark[name], `@media oscuro ${name}`).toBe(dark);
      expect(forcedDark[name], `data-theme=dark sin light-dark ${name}`).toBe(dark);
    }
  });
});
