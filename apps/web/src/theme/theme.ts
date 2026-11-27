// Tema de la interfaz: Oscuro (por defecto) / Claro (UA-D4, briefs/UA_CONTRATO.md §3.2).
//
// Modelo de 2 estados. La preferencia guardada «light» se respeta; cualquier otra cosa, incluida la ausencia, es oscuro. No se sigue
// a `prefers-color-scheme`. La elección se guarda en `localStorage` (`ogs.theme.v1`) y el DOM se actualiza con `data-theme` en <html>
// (que los tokens leen), el <meta name="color-scheme"> y los <meta name="theme-color">. El mismo cambio lo hace el script en línea de
// index.html antes de pintar, y siempre pone `data-theme`. Este módulo no toca `window` al importarse: todo entra por parámetros
// (pruebas en Node).

export type ThemePref = 'light' | 'dark';
export type ResolvedTheme = ThemePref;

export const THEME_STORAGE_KEY = 'ogs.theme.v1';
export const THEME_PREFS: readonly ThemePref[] = ['dark', 'light'];
export const DEFAULT_THEME: ThemePref = 'dark';

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

export interface WinLike {
  addEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
  removeEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void;
}

/** «light» es claro; cualquier otra cosa (incluidos «system», una clave vieja de la versión de tres estados, o la ausencia) es oscuro. */
export function parsePref(raw: string | null | undefined): ThemePref {
  return raw === 'light' ? 'light' : 'dark';
}

/** El tema al que lleva el botón. */
export function nextTheme(pref: ThemePref): ThemePref {
  return pref === 'dark' ? 'light' : 'dark';
}

/** Nombre accesible del botón de tema: dice a qué tema cambia. */
export function toggleLabel(pref: ThemePref): string {
  return pref === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
}

export function readPref(storage: StorageLike | null): ThemePref {
  try {
    return parsePref(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Guarda la elección. Devuelve false si no se pudo persistir. */
export function storePref(storage: StorageLike | null, pref: ThemePref): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, pref);
    return true;
  } catch {
    return false;
  }
}

/**
 * Refleja la preferencia en el documento. Ambos `theme-color` toman el color del tema elegido (su `media` seguiría al sistema,
 * no a la elección).
 */
export function applyTheme(pref: ThemePref, doc: DocLike): void {
  doc.documentElement.setAttribute('data-theme', pref);
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', pref);

  const metas = Array.from(doc.querySelectorAll('meta[name="theme-color"]'));
  const chosen = metas.find((m) => m.getAttribute('data-scheme') === pref)?.getAttribute('data-color');
  if (!chosen) return;
  for (const meta of metas) meta.setAttribute('content', chosen);
}

export interface ThemeState {
  pref: ThemePref;
  /** Tema vigente (igual a `pref`; se conserva el nombre porque el Canvas 2D de Casos lo lee). */
  resolved: ResolvedTheme;
}

export interface ThemeDeps {
  storage: StorageLike | null;
  doc: DocLike;
  win: WinLike | null;
}

export interface ThemeController {
  getState(): ThemeState;
  setPref(pref: ThemePref): void;
  /** Pasa al otro tema. */
  toggle(): void;
  subscribe(listener: () => void): () => void;
  /** Aplica el tema y empieza a escuchar `storage`. Idempotente. */
  start(): void;
  stop(): void;
}

export function createThemeController(deps: ThemeDeps): ThemeController {
  const { storage, doc, win } = deps;
  const listeners = new Set<() => void>();
  let started = false;

  const snapshot = (pref: ThemePref): ThemeState => ({ pref, resolved: pref });
  let state = snapshot(readPref(storage));

  function commit(pref: ThemePref): void {
    const changed = pref !== state.pref;
    if (changed) state = snapshot(pref);
    applyTheme(state.pref, doc);
    if (changed) listeners.forEach((l) => l());
  }

  const onStorage = (event: { key: string | null }): void => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    commit(readPref(storage));
  };

  const controller: ThemeController = {
    getState: () => state,
    setPref(pref) {
      storePref(storage, pref); // si el almacenamiento falla, la elección rige igualmente en esta sesión
      commit(pref);
    },
    toggle() {
      controller.setPref(nextTheme(state.pref));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return;
      started = true;
      win?.addEventListener('storage', onStorage);
      commit(readPref(storage));
    },
    stop() {
      if (!started) return;
      started = false;
      win?.removeEventListener('storage', onStorage);
    },
  };
  return controller;
}
