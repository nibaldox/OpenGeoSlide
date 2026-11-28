import { useSyncExternalStore } from 'react';
import { createThemeController, type StorageLike, type ThemeController, type ThemeState } from './theme';

let instance: ThemeController | null = null;

function safeStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null; // datos del sitio bloqueados: el tema rige en la sesión, sin persistir
  }
}

/** Controlador único de la aplicación (creado la primera vez que se usa, ya en el navegador). */
export function getThemeController(): ThemeController {
  instance ??= createThemeController({ storage: safeStorage(), doc: document, win: window });
  return instance;
}

function subscribe(onChange: () => void): () => void {
  const controller = getThemeController();
  controller.start(); // idempotente: engancha `storage` con el primer suscriptor
  return controller.subscribe(onChange);
}

/** Estado del tema (preferencia y tema vigente); el componente se vuelve a dibujar al cambiar. */
export function useTheme(): ThemeState & { setPref: ThemeController['setPref']; toggle: ThemeController['toggle'] } {
  const state = useSyncExternalStore(subscribe, () => getThemeController().getState());
  return { ...state, setPref: (pref) => getThemeController().setPref(pref), toggle: () => getThemeController().toggle() };
}
