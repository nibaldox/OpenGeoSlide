// Lista de avisos del editor: máximo visible, sin repetidos y cierre automático de los informativos (UX-10).

export type NoticeKind = 'info' | 'aviso' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

/** Cuántos avisos como máximo se ven a la vez. */
export const MAX_NOTICES = 3;
/** Los avisos informativos se cierran solos a los 6 s; los avisos y errores esperan a que el usuario los cierre. */
export const INFO_LIFETIME_MS = 6000;

export function noticeLifetimeMs(kind: NoticeKind): number | null {
  return kind === 'info' ? INFO_LIFETIME_MS : null;
}

/**
 * Agrega un aviso: uno igual (mismo tipo y texto) se reemplaza en lugar de apilarse, y si se supera el máximo se
 * descartan los más antiguos (primero los informativos).
 */
export function pushNotice(list: readonly Notice[], notice: Notice, max: number = MAX_NOTICES): Notice[] {
  const next = [...list.filter((n) => !(n.kind === notice.kind && n.text === notice.text)), notice];
  while (next.length > max) {
    const info = next.findIndex((n) => n.kind === 'info');
    next.splice(info >= 0 && info < next.length - 1 ? info : 0, 1);
  }
  return next;
}
