import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  createThemeController,
  optionLabel,
  parsePref,
  readPref,
  resolveTheme,
  storePref,
  type DocLike,
  type MediaLike,
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

class FakeMedia implements MediaLike {
  matches: boolean;
  private listeners: (() => void)[] = [];
  constructor(matches: boolean) {
    this.matches = matches;
  }
  addEventListener(_t: 'change', l: () => void): void {
    this.listeners.push(l);
  }
  removeEventListener(_t: 'change', l: () => void): void {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  set(matches: boolean): void {
    this.matches = matches;
    this.listeners.forEach((l) => l());
  }
  get count(): number {
    return this.listeners.length;
  }
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

function setup(opts: { stored?: string; systemDark?: boolean } = {}) {
  const storage = new FakeStorage();
  if (opts.stored) storage.data.set(THEME_STORAGE_KEY, opts.stored);
  const d = makeDoc();
  const media = new FakeMedia(opts.systemDark ?? false);
  const win = new FakeWin();
  const controller = createThemeController({ storage, doc: d.doc, media, win });
  return { storage, media, win, controller, ...d };
}

// ───────── Modelo de 3 estados ─────────

describe('modelo de tema de 3 estados', () => {
  it('parsePref: solo «light» y «dark» son valores explícitos; lo demás es «system»', () => {
    expect(parsePref('light')).toBe('light');
    expect(parsePref('dark')).toBe('dark');
    expect(parsePref('system')).toBe('system');
    for (const raw of [null, undefined, '', 'Dark', 'auto', '{"a":1}']) expect(parsePref(raw)).toBe('system');
  });

  it('resolveTheme: «system» sigue al sistema; los explícitos lo ignoran', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('optionLabel: «Sistema» indica el tema resuelto', () => {
    expect(optionLabel('system', true)).toBe('Sistema (oscuro)');
    expect(optionLabel('system', false)).toBe('Sistema (claro)');
    expect(optionLabel('light', true)).toBe('Claro');
    expect(optionLabel('dark', false)).toBe('Oscuro');
  });

  it('readPref/storePref: «system» borra la clave; claro y oscuro la guardan; un almacenamiento bloqueado no lanza', () => {
    const s = new FakeStorage();
    expect(readPref(s)).toBe('system');
    expect(storePref(s, 'dark')).toBe(true);
    expect(s.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(readPref(s)).toBe('dark');
    expect(storePref(s, 'system')).toBe(true);
    expect(s.data.has(THEME_STORAGE_KEY)).toBe(false);
    s.throws = true;
    expect(readPref(s)).toBe('system');
    expect(storePref(s, 'light')).toBe(false);
    expect(readPref(null)).toBe('system');
    expect(storePref(null, 'dark')).toBe(false);
  });
});

describe('applyTheme: atributo, <meta color-scheme> y theme-color', () => {
  it('explícito: data-theme, color-scheme y ambos theme-color con el color del tema elegido', () => {
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

  it('«system»: sin data-theme, «light dark» y cada theme-color vuelve a su color', () => {
    const { doc, root, scheme, light, dark } = makeDoc();
    applyTheme('dark', doc);
    applyTheme('system', doc);
    expect(root.getAttribute('data-theme')).toBeNull();
    expect(scheme.content).toBe('light dark');
    expect(light.content).toBe('#aaaaaa');
    expect(dark.content).toBe('#111111');
  });
});

describe('controlador de tema', () => {
  it('arranca con lo guardado y aplica el tema al DOM', () => {
    const { controller, root } = setup({ stored: 'dark', systemDark: false });
    expect(controller.getState()).toEqual({ pref: 'dark', systemDark: false, resolved: 'dark' });
    controller.start();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('sin valor guardado sigue al sistema y refleja sus cambios (matchMedia change)', () => {
    const { controller, media, root } = setup({ systemDark: false });
    controller.start();
    const seen: string[] = [];
    controller.subscribe(() => seen.push(controller.getState().resolved));
    expect(controller.getState().resolved).toBe('light');
    media.set(true);
    expect(controller.getState()).toEqual({ pref: 'system', systemDark: true, resolved: 'dark' });
    expect(seen).toEqual(['dark']);
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('setPref persiste, aplica y notifica; «system» borra la clave', () => {
    const { controller, storage, root } = setup({ systemDark: false });
    controller.start();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setPref('dark');
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    controller.setPref('system');
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('NO borra el valor guardado cuando el sistema llega a coincidir con él (guía dark-mode-toggle)', () => {
    const { controller, storage, media } = setup({ systemDark: false });
    controller.start();
    controller.setPref('dark'); // el sistema está en claro: se guarda «dark»
    media.set(true); // el sistema pasa a oscuro y coincide
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(controller.getState().pref).toBe('dark');
    media.set(false); // vuelve a claro: la elección sigue vigente
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(controller.getState().resolved).toBe('dark');
    // El caso simétrico: guardar «dark» cuando el sistema YA es oscuro también se conserva.
    media.set(true);
    controller.setPref('dark');
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('el evento storage de otra pestaña actualiza la preferencia; claves ajenas se ignoran', () => {
    const { controller, storage, win, root } = setup({ systemDark: false });
    controller.start();
    const listener = vi.fn();
    controller.subscribe(listener);
    storage.data.set(THEME_STORAGE_KEY, 'dark');
    win.fire('otra-clave');
    expect(listener).not.toHaveBeenCalled();
    win.fire(THEME_STORAGE_KEY);
    expect(controller.getState().pref).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    storage.data.delete(THEME_STORAGE_KEY);
    win.fire(null); // localStorage.clear() en otra pestaña
    expect(controller.getState().pref).toBe('system');
    expect(root.getAttribute('data-theme')).toBeNull();
  });

  it('con almacenamiento bloqueado el tema se aplica igualmente en esta sesión', () => {
    const { controller, storage, root } = setup();
    controller.start();
    storage.throws = true;
    controller.setPref('dark');
    expect(controller.getState().pref).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('getState es estable entre cambios (useSyncExternalStore) y stop() retira los oyentes', () => {
    const { controller, media, win } = setup();
    controller.start();
    expect(controller.getState()).toBe(controller.getState());
    expect(media.count).toBe(1);
    expect(win.count).toBe(1);
    controller.stop();
    expect(media.count).toBe(0);
    expect(win.count).toBe(0);
  });
});

// ───────── El script de index.html y el modelo no se desincronizan ─────────

describe('index.html: arranque sin destello', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  it('declara color-scheme y el script en línea va justo después, sin type=module ni defer', () => {
    const iScheme = html.indexOf('<meta name="color-scheme" content="light dark"');
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

  it('ejecutado con «dark» guardado, fija data-theme y los metas ANTES de pintar; sin valor no toca nada', () => {
    const body = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    const run = (stored: string | null) => {
      const d = makeDoc();
      const storage = new FakeStorage();
      if (stored) storage.data.set(THEME_STORAGE_KEY, stored);
      new Function('document', 'localStorage', body)(d.doc, storage);
      return d;
    };
    const dark = run('dark');
    expect(dark.root.getAttribute('data-theme')).toBe('dark');
    expect(dark.scheme.content).toBe('dark');
    expect(dark.light.content).toBe('#111111');
    const none = run(null);
    expect(none.root.getAttribute('data-theme')).toBeNull();
    expect(none.scheme.content).toBe('light dark');
    // Almacenamiento bloqueado: sin excepción.
    const d = makeDoc();
    const bad = new FakeStorage();
    bad.throws = true;
    expect(() => new Function('document', 'localStorage', body)(d.doc, bad)).not.toThrow();
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
