// Lista de avisos del editor: máximo visible, sin repetidos y cierre automático de los informativos (UX-10).

export type NoticeKind = 'info' | 'aviso' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
  /** Veces que llegó el mismo mensaje (UX9-06); ausente = 1. */
  count?: number;
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

/** Tope de avisos guardados (los visibles son `MAX_NOTICES`; el resto se ve con «ver más»). */
export const MAX_STORED_NOTICES = 50;

const RANK: Record<NoticeKind, number> = { error: 0, aviso: 1, info: 2 };

/**
 * Agrega un aviso (UX9-06): uno igual (mismo tipo y texto) no se apila, sino que sube el contador y pasa al final.
 * No se descartan errores por llegar más de `MAX_NOTICES`: eso lo resuelve `visibleNotices`. Solo si se supera el
 * tope de almacenamiento se descartan los informativos más antiguos y, si no quedan, los más antiguos.
 */
export function addNotice(list: readonly Notice[], notice: Notice, max: number = MAX_STORED_NOTICES): Notice[] {
  const same = list.find((n) => n.kind === notice.kind && n.text === notice.text);
  const count = (same?.count ?? (same ? 1 : 0)) + (notice.count ?? 1);
  const next = [...list.filter((n) => n !== same), count > 1 ? { ...notice, count } : notice];
  while (next.length > max) {
    const info = next.findIndex((n) => n.kind === 'info');
    next.splice(info >= 0 && info < next.length - 1 ? info : 0, 1);
  }
  return next;
}

/**
 * Los avisos que se ven y cuántos quedan ocultos tras «ver más». Con más de `max`, se ven antes los errores, luego los
 * avisos y luego lo más reciente; se muestran en el orden en que llegaron.
 */
export function visibleNotices(list: readonly Notice[], expanded: boolean, max: number = MAX_NOTICES): { shown: Notice[]; hidden: number } {
  if (expanded || list.length <= max) return { shown: [...list], hidden: 0 };
  const chosen = new Set(
    list
      .map((n, i) => ({ n, i }))
      .sort((a, b) => RANK[a.n.kind] - RANK[b.n.kind] || b.i - a.i)
      .slice(0, max)
      .map((x) => x.n),
  );
  return { shown: list.filter((n) => chosen.has(n)), hidden: list.length - max };
}
