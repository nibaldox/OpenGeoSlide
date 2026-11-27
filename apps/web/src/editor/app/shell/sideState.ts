// Estado plegado de la barra lateral «Modelo» (contrato UA §2): se guarda en `ogs.ui.side.v1`. Sin DOM: se prueba en Node.

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
