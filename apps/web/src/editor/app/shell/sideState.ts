// Estado plegado de la barra lateral «Modelo» (contrato UA §2): se guarda en `ogs.ui.side.v1`. Sin DOM: se prueba en Node.

import type { ViewId } from './views';

export const SIDE_KEY = 'ogs.ui.side.v1';

export interface SideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** `true` si la última preferencia guardada es «plegada». Sin almacenamiento o con otro valor: desplegada. */
export function readSideCollapsed(storage: SideStorage | null): boolean {
  try {
    return storage?.getItem(SIDE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

export function writeSideCollapsed(storage: SideStorage | null, collapsed: boolean): void {
  try {
    storage?.setItem(SIDE_KEY, collapsed ? 'collapsed' : 'open');
  } catch {
    /* sin almacenamiento: el estado vale solo para esta sesión */
  }
}

/** El `localStorage` del navegador, o `null` si no se puede leer (modo privado, política del navegador). */
export function browserSideStorage(): SideStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export interface SideLayout {
  /** El usuario ve la barra plegada: se ofrece «Mostrar panel» y las acciones de cálculo pasan a la cabecera del área. */
  collapsed: boolean;
  /** La barra «Modelo» y el pie de acción quedan `hidden` y el área principal ocupa el ancho (plegada, o vista Casos). */
  hidden: boolean;
}

/**
 * Qué se ve de la barra lateral (UA-E3 §1 y §2). La preferencia guardada solo cuenta desde 761 px (`desktop`): hasta 760 px la
 * barra no se puede plegar y se ignora `ogs.ui.side.v1`. En la vista Casos la barra y el pie se ocultan sin tocar la preferencia.
 */
export function sideLayout({ view, preference, desktop }: { view: ViewId; preference: boolean; desktop: boolean }): SideLayout {
  const cases = view === 'cases';
  const collapsed = preference && desktop && !cases;
  return { collapsed, hidden: collapsed || cases };
}
