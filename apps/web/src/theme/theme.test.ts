import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  createThemeController,
  nextTheme,
  parsePref,
  readPref,
  storePref,
  toggleLabel,
  type DocLike,
  type StorageLike,
  type WinLike,
} from './theme';

// ───────── Dobles mínimos (el entorno de pruebas es Node, sin DOM) ─────────

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  throws = false;
  getItem(k: string): string | null {
    if (this.throws) throw new Error('bloqueado');
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throws) throw new Error('bloqueado');
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    if (this.throws) throw new Error('bloqueado');
    this.data.delete(k);
  }
}

class FakeMeta {
  attrs = new Map<string, string>();
  constructor(attrs: Record<string, string>) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  get content(): string {
    return this.attrs.get('content') ?? '';
  }
}

function makeDoc(): { doc: DocLike; root: FakeMeta; scheme: FakeMeta; light: FakeMeta; dark: FakeMeta } {
  const root = new FakeMeta({});
  const scheme = new FakeMeta({ name: 'color-scheme', content: 'light dark' });
  const light = new FakeMeta({ name: 'theme-color', content: '#aaaaaa', 'data-scheme': 'light', 'data-color': '#aaaaaa' });
  const dark = new FakeMeta({ name: 'theme-color', content: '#111111', 'data-scheme': 'dark', 'data-color': '#111111' });
  const doc: DocLike = {
    documentElement: {
      setAttribute: (k, v) => root.setAttribute(k, v),
      removeAttribute: (k) => void root.attrs.delete(k),
    },
    querySelector: (sel) => (sel === 'meta[name="color-scheme"]' ? scheme : null),
    querySelectorAll: (sel) => (sel === 'meta[name="theme-color"]' ? [light, dark] : []),
  };
  return { doc, root, scheme, light, dark };
}

class FakeWin implements WinLike {
  private listeners: ((e: { key: string | null }) => void)[] = [];
  addEventListener(_t: 'storage', l: (e: { key: string | null }) => void): void {
    this.listeners.push(l);
  }
  removeEventListener(_t: 'storage', l: (e: { key: string | null }) => void): void {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  fire(key: string | null): void {
    this.listeners.forEach((l) => l({ key }));
  }
  get count(): number {
    return this.listeners.length;
  }
}

function setup(opts: { stored?: string } = {}) {
  const storage = new FakeStorage();
  if (opts.stored) storage.data.set(THEME_STORAGE_KEY, opts.stored);
  const d = makeDoc();
  const win = new FakeWin();
  const controller = createThemeController({ storage, doc: d.doc, win });
  return { storage, win, controller, ...d };
}

// ───────── Modelo de 2 estados (UA-D4) ─────────

describe('modelo de tema de 2 estados: oscuro por defecto', () => {
  it('parsePref: solo «light» es claro; cualquier otra cosa, incluida la ausencia, es oscuro', () => {
    expect(parsePref('light')).toBe('light');
    expect(parsePref('dark')).toBe('dark');
    for (const raw of [null, undefined, '', 'system', 'Light', 'auto', '{"a":1}']) expect(parsePref(raw), String(raw)).toBe('dark');
  });

  it('nextTheme y toggleLabel: el botón dice a qué tema cambia', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(toggleLabel('dark')).toBe('Cambiar a tema claro');
    expect(toggleLabel('light')).toBe('Cambiar a tema oscuro');
  });

  it('readPref/storePref: ambos valores se guardan; un almacenamiento bloqueado no lanza y rige oscuro', () => {
    const s = new FakeStorage();
    expect(readPref(s)).toBe('dark');
    expect(storePref(s, 'light')).toBe(true);
    expect(s.data.get(THEME_STORAGE_KEY)).toBe('light');
    expect(readPref(s)).toBe('light');
    expect(storePref(s, 'dark')).toBe(true);
    expect(s.data.get(THEME_STORAGE_KEY)).toBe('dark');
    s.data.set(THEME_STORAGE_KEY, 'system'); // valor de la versión de tres estados
    expect(readPref(s)).toBe('dark');
    s.throws = true;
    expect(readPref(s)).toBe('dark');
    expect(storePref(s, 'light')).toBe(false);
    expect(readPref(null)).toBe('dark');
    expect(storePref(null, 'dark')).toBe(false);
  });
});

describe('applyTheme: atributo, <meta color-scheme> y theme-color', () => {
  it('data-theme, color-scheme y ambos theme-color con el color del tema elegido', () => {
    const { doc, root, scheme, light, dark } = makeDoc();
    applyTheme('dark', doc);
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(scheme.content).toBe('dark');
    expect(light.content).toBe('#111111');
    expect(dark.content).toBe('#111111');
    applyTheme('light', doc);
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(scheme.content).toBe('light');
    expect(light.content).toBe('#aaaaaa');
    expect(dark.content).toBe('#aaaaaa');
  });
});

describe('controlador de tema', () => {
  it('sin valor guardado arranca en oscuro y lo aplica al DOM', () => {
    const { controller, root } = setup();
    expect(controller.getState()).toEqual({ pref: 'dark', resolved: 'dark' });
    controller.start();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('arranca con «light» guardado', () => {
    const { controller, root } = setup({ stored: 'light' });
    expect(controller.getState()).toEqual({ pref: 'light', resolved: 'light' });
    controller.start();
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('la preferencia del sistema no cuenta: no hay matchMedia en el controlador', () => {
    const { controller } = setup();
    controller.start();
    expect(controller.getState().resolved).toBe('dark');
  });

  it('setPref persiste, aplica y notifica; no notifica si no cambia', () => {
    const { controller, storage, root } = setup();
    controller.start();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setPref('light');
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(controller.getState().resolved).toBe('light');
    expect(listener).toHaveBeenCalledTimes(1);
    controller.setPref('light');
    expect(listener).toHaveBeenCalledTimes(1);
    controller.setPref('dark');
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('toggle pasa de un tema al otro y vuelve', () => {
    const { controller, root } = setup();
    controller.start();
    controller.toggle();
    expect(controller.getState().pref).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    controller.toggle();
    expect(controller.getState().pref).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('el evento storage de otra pestaña actualiza la preferencia; claves ajenas se ignoran', () => {
    const { controller, storage, win, root } = setup();
    controller.start();
    const listener = vi.fn();
    controller.subscribe(listener);
    storage.data.set(THEME_STORAGE_KEY, 'light');
    win.fire('otra-clave');
    expect(listener).not.toHaveBeenCalled();
    win.fire(THEME_STORAGE_KEY);
    expect(controller.getState().pref).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(listener).toHaveBeenCalledTimes(1);
    storage.data.delete(THEME_STORAGE_KEY);
    win.fire(null); // localStorage.clear() en otra pestaña: vuelve el valor por defecto
    expect(controller.getState().pref).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('con almacenamiento bloqueado el tema se aplica igualmente en esta sesión', () => {
    const { controller, storage, root } = setup();
    controller.start();
    storage.throws = true;
    controller.setPref('light');
    expect(controller.getState().pref).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('getState es estable entre cambios (useSyncExternalStore) y stop() retira el oyente', () => {
    const { controller, win } = setup();
    controller.start();
    expect(controller.getState()).toBe(controller.getState());
    expect(win.count).toBe(1);
    controller.start(); // idempotente
    expect(win.count).toBe(1);
    controller.stop();
    expect(win.count).toBe(0);
  });
});

// ───────── El script de index.html y el modelo no se desincronizan ─────────

describe('index.html: arranque sin destello', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  it('declara color-scheme «dark» y el script en línea va justo después, sin type=module ni defer', () => {
    const iScheme = html.indexOf('<meta name="color-scheme" content="dark"');
    expect(iScheme).toBeGreaterThan(-1);
    const afterScheme = html.slice(iScheme);
    const script = /<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/.exec(afterScheme);
    expect(script).not.toBeNull();
    expect(script!.groups!.attrs).not.toMatch(/module|defer|async|src/);
    // Ningún otro <script> ni <link rel=stylesheet> entre el meta y el script en línea.
    expect(afterScheme.slice(0, script!.index)).not.toMatch(/<script|stylesheet/);
    expect(script!.groups!.body).toContain(THEME_STORAGE_KEY);
    expect(script!.groups!.body).toMatch(/try\s*\{/);
  });

  it('<html> sale ya con data-theme="dark": el primer fotograma es oscuro aunque el script no llegue a correr (UA-D4)', () => {
    expect(html).toMatch(/<html[^>]*\sdata-theme="dark"/);
  });

  it('el script SIEMPRE pone data-theme y decide igual que parsePref: «light» es claro y todo lo demás, oscuro', () => {
    const body = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    const run = (stored: string | null) => {
      const d = makeDoc();
      const storage = new FakeStorage();
      if (stored !== null) storage.data.set(THEME_STORAGE_KEY, stored);
      new Function('document', 'localStorage', body)(d.doc, storage);
      return d;
    };
    for (const stored of ['light', 'dark', 'system', '', 'Light', 'otra cosa', null]) {
      const expected = parsePref(stored);
      const d = run(stored);
      expect(d.root.getAttribute('data-theme'), `data-theme con ${String(stored)}`).toBe(expected);
      expect(d.scheme.content, `color-scheme con ${String(stored)}`).toBe(expected);
      const color = expected === 'light' ? '#aaaaaa' : '#111111';
      expect(d.light.content).toBe(color);
      expect(d.dark.content).toBe(color);
    }
    // Almacenamiento bloqueado: sin excepción y oscuro.
    const d = makeDoc();
    const bad = new FakeStorage();
    bad.throws = true;
    expect(() => new Function('document', 'localStorage', body)(d.doc, bad)).not.toThrow();
    expect(d.root.getAttribute('data-theme')).toBe('dark');
    expect(d.dark.content).toBe('#111111');
  });

  it('theme-color con media para claro y oscuro, con el mismo fondo que --ui-bg de tokens.css', () => {
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
    const bg = /--ui-bg:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(css)!;
    expect(html).toMatch(
      new RegExp(`<meta name="theme-color" content="${bg[1]}"[^>]*data-color="${bg[1]}"[^>]*media="\\(prefers-color-scheme: light\\)"`),
    );
    expect(html).toMatch(
      new RegExp(`<meta name="theme-color" content="${bg[2]}"[^>]*data-color="${bg[2]}"[^>]*media="\\(prefers-color-scheme: dark\\)"`),
    );
  });

  it('no hay CSP en index.html que bloquee el script en línea', () => {
    expect(html).not.toMatch(/Content-Security-Policy/i);
  });
});
