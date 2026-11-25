// Tema de la interfaz: Sistema / Claro / Oscuro (U1-T, guías dark-mode y dark-mode-toggle).
//
// Modelo de 3 estados. «system» (sin valor guardado) sigue a `prefers-color-scheme`; «light» y «dark» se guardan en
// `localStorage` (`ogs.theme.v1`) y fijan el esquema. Un valor guardado NUNCA se borra porque el sistema llegue a coincidir
// con él: solo se borra cuando el usuario elige «Sistema». El DOM se actualiza con `data-theme` en <html> (que los tokens
// leen), el <meta name="color-scheme"> y los <meta name="theme-color">. El mismo cambio lo hace el script en línea de
// index.html antes de pintar. Este módulo no toca `window` al importarse: todo entra por parámetros (pruebas en Node).

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ogs.theme.v1';
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ElementLike {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

export interface DocLike {
  documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

export interface MediaLike {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

export interface WinLike {
  addEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
  removeEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
}

/** Cualquier valor que no sea «light» o «dark» equivale a «system». */
export function parsePref(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

/** Texto de cada opción del selector; «Sistema» muestra el tema resuelto. */
export function optionLabel(pref: ThemePref, systemDark: boolean): string {
  if (pref === 'light') return 'Claro';
  if (pref === 'dark') return 'Oscuro';
  return `Sistema (${systemDark ? 'oscuro' : 'claro'})`;
}

export function readPref(storage: StorageLike | null): ThemePref {
  try {
    return parsePref(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/** Guarda la elección («system» borra la clave). Devuelve false si no se pudo persistir. */
export function storePref(storage: StorageLike | null, pref: ThemePref): boolean {
  if (!storage) return false;
  try {
    if (pref === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, pref);
    return true;
  } catch {
    return false;
  }
}

/**
 * Refleja la preferencia en el documento. Con una elección explícita, ambos `theme-color` toman el color del tema elegido
 * (el `media` de cada uno seguiría al sistema, no a la elección); con «system» cada uno recupera el suyo.
 */
export function applyTheme(pref: ThemePref, doc: DocLike): void {
  if (pref === 'system') doc.documentElement.removeAttribute('data-theme');
  else doc.documentElement.setAttribute('data-theme', pref);
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', pref === 'system' ? 'light dark' : pref);

  const metas = Array.from(doc.querySelectorAll('meta[name="theme-color"]'));
  const chosen = pref === 'system' ? null : metas.find((m) => m.getAttribute('data-scheme') === pref)?.getAttribute('data-color');
  for (const meta of metas) {
    const color = chosen ?? meta.getAttribute('data-color');
    if (color) meta.setAttribute('content', color);
  }
}

export interface ThemeState {
  pref: ThemePref;
  systemDark: boolean;
  resolved: ResolvedTheme;
}

export interface ThemeDeps {
  storage: StorageLike | null;
  doc: DocLike;
  media: MediaLike | null;
  win: WinLike | null;
}

export interface ThemeController {
  getState(): ThemeState;
  setPref(pref: ThemePref): void;
  subscribe(listener: () => void): () => void;
  /** Aplica el tema y empieza a escuchar `change` de matchMedia y `storage`. Idempotente. */
  start(): void;
  stop(): void;
}

export function createThemeController(deps: ThemeDeps): ThemeController {
  const { storage, doc, media, win } = deps;
  const listeners = new Set<() => void>();
  let started = false;

  const snapshot = (pref: ThemePref, systemDark: boolean): ThemeState => ({ pref, systemDark, resolved: resolveTheme(pref, systemDark) });
  let state = snapshot(readPref(storage), media?.matches ?? false);

  function commit(pref: ThemePref, systemDark: boolean): void {
    const next = snapshot(pref, systemDark);
    const same = next.pref === state.pref && next.systemDark === state.systemDark;
    if (!same) state = next;
    applyTheme(state.pref, doc);
    if (!same) listeners.forEach((l) => l());
  }

  const onMedia = (): void => commit(state.pref, media?.matches ?? false);
  const onStorage = (event: { key: string | null }): void => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    commit(readPref(storage), media?.matches ?? state.systemDark);
  };

  return {
    getState: () => state,
    setPref(pref) {
      storePref(storage, pref); // si el almacenamiento falla, la elección rige igualmente en esta sesión
      commit(pref, media?.matches ?? state.systemDark);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return;
      started = true;
      media?.addEventListener('change', onMedia);
      win?.addEventListener('storage', onStorage);
      commit(readPref(storage), media?.matches ?? false);
    },
    stop() {
      if (!started) return;
      started = false;
      media?.removeEventListener('change', onMedia);
      win?.removeEventListener('storage', onStorage);
    },
  };
}
