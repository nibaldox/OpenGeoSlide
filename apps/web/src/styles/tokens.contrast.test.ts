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

/** Fondo sobre el que se compone un color con alfa si el par no indica otro: el panel en la interfaz, el lienzo en el lienzo. */
const defaultBase = (name: string): string => (name.startsWith('canvas-') ? 'canvas-bg' : 'ui-surface');

/** `nombre` o `nombre@base`: la base solo cuenta si el color tiene alfa (p. ej. `ui-accent-bg@ui-bg`). */
function colorOf(spec: string, theme: Theme, base?: string): Rgba {
  const [name, at] = spec.split('@');
  const entry = tokens[name];
  if (!entry) throw new Error(`token inexistente: --${name}`);
  const c = parseColor(entry[theme]);
  if (c[3] < 1) return over(c, colorOf(at ?? base ?? defaultBase(name), theme));
  return c;
}

const MATS = [0, 1, 2, 3, 4, 5, 6].map((i) => `canvas-mat-${i}`).concat('canvas-mat-unknown');
const UI_SURFACES = ['ui-bg', 'ui-surface', 'ui-surface-subtle'];
/** Fondos con alfa (acento y estados) vistos sobre el panel y sobre el fondo de la app, que es el caso más oscuro del tema oscuro. */
const ON = (token: string): string[] => [`${token}@ui-surface`, `${token}@ui-bg`];

/** [primer plano, fondo, mínimo, descripción]. */
type Pair = [string, string, number, string];
const TEXT = 4.5;
const UI = 3;

const PAIRS: Pair[] = [
  // Texto sobre superficies de la interfaz
  ...[
    'ui-bg',
    'ui-surface',
    'ui-surface-subtle',
    'ui-surface-sunken',
    'ui-surface-hover',
    ...ON('ui-surface-active'),
    'ui-row-selected',
    'ui-row-warn',
    'ui-input-err-bg',
  ].map((bg): Pair => ['ui-ink', bg, TEXT, 'texto principal']),
  // UA1-T: texto secundario (--ui-ink-2) y atenuado (R7-15), también sobre campos y sobre el acento de fondo
  ...['ui-bg', 'ui-surface', 'ui-surface-subtle', 'ui-surface-sunken', 'ui-surface-hover', ...ON('ui-accent-bg'), 'ui-row-warn'].flatMap((bg): Pair[] => [
    ['ui-ink-2', bg, TEXT, 'texto secundario (UA1-T)'],
    ['ui-ink-muted', bg, TEXT, 'texto atenuado (R7-15)'],
  ]),
  // Botón primario: texto blanco sobre el acento y sobre su hover (UA1-T)
  ['ui-ink-on-accent', 'ui-accent', TEXT, 'botón primario'],
  ['ui-ink-on-accent', 'ui-accent-hover', TEXT, 'botón primario, hover'],
  // Acento como texto (pestaña activa, paso activo, enlaces): --ui-accent-bright; sobre el panel, el fondo y el acento de fondo
  ...['ui-bg', 'ui-surface', 'ui-surface-subtle', 'ui-surface-hover', ...ON('ui-accent-bg')].map((bg): Pair => ['ui-accent-bright', bg, TEXT, 'acento como texto (UA1-T)']),
  // El acento sólido (herramienta activa, insignia, borde) no es texto: 3:1 contra las superficies
  ...[...UI_SURFACES, 'ui-surface-sunken'].flatMap((bg): Pair[] => [
    ['ui-accent', bg, UI, 'acento sólido (herramienta activa, borde)'],
    ['ui-accent-hover', bg, UI, 'acento sólido, hover'],
  ]),
  // Chips y avisos de estado, sobre su fondo (con alfa en oscuro: sobre el panel y sobre el fondo de la app), sobre el panel y sobre el fondo
  ...(['ok', 'warn', 'err', 'info'] as const).flatMap((s): Pair[] => [
    ...ON(`ui-${s}-bg`).map((bg): Pair => [`ui-${s}-ink`, bg, TEXT, `chip de estado «${s}»`]),
    [`ui-${s}-ink`, 'ui-surface', TEXT, `estado «${s}» sobre panel`],
    [`ui-${s}-ink`, 'ui-bg', TEXT, `estado «${s}» sobre el fondo`],
  ]),
  ['ui-warn-ink', 'ui-row-warn', TEXT, 'aviso sobre fila'],
  ['ui-err-ink', 'ui-input-err-bg', TEXT, 'error en campo'],
  ['ui-note-ink', 'ui-note-bg', TEXT, 'nota'],
  // Elementos de interfaz (3:1)
  ...[...UI_SURFACES, 'ui-surface-sunken'].map((bg): Pair => ['ui-control-border', bg, UI, 'borde de control (UX-06)']),
  ...[...UI_SURFACES, 'ui-surface-sunken', ...ON('ui-surface-active'), 'canvas-bg'].map((bg): Pair => ['ui-focus', bg, UI, 'anillo de foco']),
  ['ui-err-border', 'ui-surface', UI, 'borde de campo inválido'],
  ['ui-err-border', 'ui-surface-sunken', UI, 'borde de campo inválido'],
  ['ui-err-border', 'ui-input-err-bg', UI, 'borde de campo inválido'],
  // Texto del lienzo (la etiqueta de los ejes y de las cargas)
  ['canvas-axis-text', 'canvas-bg', TEXT, 'etiquetas de los ejes'],
  ['canvas-axis', 'canvas-bg', TEXT, 'marco y rótulos de los ejes'],
  ['canvas-load', 'canvas-bg', TEXT, 'etiqueta de carga'],
  ['canvas-reinforcement', 'canvas-bg', TEXT, 'rótulo de refuerzo y de su fuerza'],
  ['canvas-seismic', 'canvas-seismic-bg', TEXT, 'insignia sísmica'],
  // Agua embalsada (F5.3) y grieta de tracción (F5.4): los rótulos de la grieta (color de la superficie y de la piezométrica) y los ejes
  // se leen sobre el fondo y sobre el relleno `--canvas-pond`.
  ...['canvas-surface', 'canvas-piezo', 'canvas-axis-text', 'canvas-axis'].flatMap((fg): Pair[] => ['canvas-bg', 'canvas-pond'].map((bg): Pair => [fg, bg, TEXT, 'rótulo sobre el agua embalsada'])),
  // Trazos del lienzo sobre el fondo y sobre cada material (3:1)
  ...['canvas-surface', 'canvas-surface-unconverged', 'canvas-piezo', 'canvas-load', 'canvas-reinforcement', 'canvas-region-edge', 'canvas-selected', 'canvas-handle-ring'].flatMap(
    (stroke): Pair[] => ['canvas-bg', 'canvas-pond', ...MATS].map((bg): Pair => [stroke, bg, UI, 'trazo esencial del lienzo']),
  ),
  // Dovelas (UX9-07): el trazo se compone sobre cada material y sobre el panel, donde está la muestra de la leyenda
  // La muestra de la leyenda (B-05) es una línea con este mismo token sobre el panel: se cubren todas las superficies de la interfaz.
  ...['canvas-bg', ...UI_SURFACES, 'ui-row-warn', ...MATS].map((bg): Pair => ['canvas-slice-edge', bg, UI, 'trazo y muestra de «Dovelas»']),
  // Muestras de la leyenda (F5.3, F5.4): el borde del «Agua embalsada» y la línea de la «Grieta de tracción» sobre el panel.
  ...UI_SURFACES.flatMap((bg): Pair[] => ['canvas-piezo', 'canvas-surface'].map((fg): Pair => [fg, bg, UI, 'muestra de la leyenda (agua embalsada y grieta)'])),
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
          // Un primer plano con transparencia se compone sobre el propio fondo del par.
          const ratio = contrast(colorOf(fg, theme, bg), colorOf(bg, theme));
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
    ...['bg', 'surface', 'surface-subtle', 'surface-sunken', 'surface-hover', 'surface-active', 'backdrop'].map((n) => `ui-${n}`),
    ...['ink', 'ink-2', 'ink-muted', 'ink-on-accent', 'border', 'border-strong', 'border-dashed', 'control-border', 'focus'].map((n) => `ui-${n}`),
    ...['accent', 'accent-hover', 'accent-bright', 'accent-bg'].map((n) => `ui-${n}`),
    ...(['ok', 'warn', 'err'] as const).flatMap((s) => [`ui-${s}-bg`, `ui-${s}-ink`, `ui-${s}-border`]),
    'ui-info-bg',
    'ui-info-ink',
    'ui-note-bg',
    'ui-note-ink',
    'ui-row-selected',
    'ui-row-warn',
    'ui-input-err-bg',
    ...['bg', 'grid', 'grid-major', 'axis', 'axis-text', 'halo', 'region-edge', 'selected', 'surface', 'surface-unconverged', 'piezo', 'load', 'seismic', 'seismic-bg'].map(
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

  it('define todos los tokens del contrato PLAN_UX y del contrato UA (§3.1)', () => {
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

describe('tokens.css: identidad de la suite v1.1 (UA1-T)', () => {
  const value = (name: string, theme: Theme): string => tokens[name][theme];

  it('el acento es el azul acero de la suite con texto blanco en ambos temas (UA-D5)', () => {
    expect(value('ui-accent', 'dark')).toBe('#2c77c3');
    expect(value('ui-accent', 'light')).toBe('#2f6da8');
    expect(value('ui-ink-on-accent', 'dark')).toBe('#ffffff');
    expect(value('ui-ink-on-accent', 'light')).toBe('#ffffff');
    expect(value('ui-accent-hover', 'dark')).not.toBe(value('ui-accent', 'dark'));
    expect(value('ui-accent-hover', 'light')).not.toBe(value('ui-accent', 'light'));
  });

  it('las superficies, el texto y los bordes toman los valores de la suite (XA4 §3.1)', () => {
    const suite: Record<string, [string, string]> = {
      'ui-bg': ['#eceef1', '#0a0a0b'],
      'ui-surface': ['#f6f7f9', '#101011'],
      'ui-surface-subtle': ['#e1e5ea', '#18181b'],
      'ui-surface-sunken': ['#e4e7eb', '#060607'],
      'ui-surface-hover': ['#dde2e8', '#1d1d21'],
      'ui-ink': ['#1f2933', '#e6e9ee'],
      'ui-ink-2': ['#46525f', '#b3bcc8'],
      'ui-border': ['#d3d9e0', '#1d1d20'],
      'ui-control-border': ['#737d8a', '#5b6673'],
      'ui-focus': ['#275d91', '#6db3f2'],
      'ui-accent-bright': ['#275d91', '#6db3f2'],
      'canvas-bg': ['#f6f7f9', '#060607'],
      'canvas-grid': ['#e6e9ed', '#17171a'],
      'canvas-grid-major': ['#d3d9e0', '#232328'],
      'canvas-region-edge': ['#1f2933', '#d9dee5'],
      'canvas-handle-fill': ['#ffffff', '#0a0a0b'],
      'canvas-handle-ring': ['#1f2933', '#e6e9ee'],
    };
    for (const [name, [light, dark]] of Object.entries(suite)) {
      expect(value(name, 'light'), `claro ${name}`).toBe(light);
      expect(value(name, 'dark'), `oscuro ${name}`).toBe(dark);
    }
  });

  it('--ui-surface-active y --ui-accent-bg son el mismo color (acento con alfa)', () => {
    for (const theme of ['light', 'dark'] as const) expect(value('ui-surface-active', theme)).toBe(value('ui-accent-bg', theme));
  });

  it('los valores claros de --canvas-mat-0…6 no cambian: el PDF (report/palette.ts) está atado a ellos', () => {
    const light = ['#d8b77a', '#9cc29a', '#9fb9d9', '#dba5a5', '#c2a8d8', '#e3cf86', '#a9d4d0'];
    light.forEach((hex, i) => expect(value(`canvas-mat-${i}`, 'light')).toBe(hex));
  });

  it('declara las fuentes, los radios y la sombra de las capas flotantes (los de la sombra, con medidas distintas por tema)', () => {
    expect(css).toMatch(/--ui-font-sans:\s*'Outfit Variable',\s*system-ui/);
    expect(css).toMatch(/--ui-font-mono:\s*'JetBrains Mono Variable',\s*ui-monospace/);
    expect(css).toMatch(/--ui-radius-sm:\s*4px;/);
    expect(css).toMatch(/--ui-radius-md:\s*8px;/);
    expect(css).toMatch(/--ui-radius-lg:\s*12px;/);
    expect(css).toMatch(/html\[data-theme='dark'\]\s*\{[^}]*--ui-shadow-float:\s*0 12px 36px rgb\(0 0 0 \/ 0\.6\);/);
    expect(css).toMatch(/html\[data-theme='light'\]\s*\{[^}]*--ui-shadow-float:\s*0 12px 32px rgb\(15 23 42 \/ 0\.12\);/);
  });
});
