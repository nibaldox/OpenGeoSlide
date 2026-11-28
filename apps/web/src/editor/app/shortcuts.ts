// Atajos de teclado globales del editor. Función pura: del evento al nombre de la acción.

export type ShortcutAction = 'undo' | 'redo' | 'save' | 'open' | 'check' | 'tool:select' | 'tool:add_vertex' | 'tool:draw_region' | 'tool:split_region' | 'tool:draw_reinforcement' | 'tool:pan';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented?: boolean;
  /** `true` si el foco está en un campo de texto, lista o botón editable. */
  inField?: boolean;
}

/** Etiqueta del elemento con foco → ¿es un campo donde se escribe? */
export function isEditableTag(tag: string | undefined, contentEditable = false): boolean {
  const t = (tag ?? '').toLowerCase();
  return contentEditable || t === 'input' || t === 'textarea' || t === 'select';
}

export function shortcutFor(e: KeyLike): ShortcutAction | null {
  if (e.defaultPrevented) return null;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && !e.altKey) {
    if (key === 'z' || key === 'y') {
      if (e.inField) return null; // en un campo, Ctrl+Z es del propio campo
      return key === 'y' || e.shiftKey ? 'redo' : 'undo';
    }
    if (key === 's') return 'save';
    if (key === 'o') return 'open';
    if (e.key === 'Enter') return 'check';
    return null;
  }
  if (mod || e.altKey || e.inField) return null;
  if (key === 'v') return 'tool:select';
  if (key === 'a') return 'tool:add_vertex';
  if (key === 'r') return 'tool:draw_region';
  if (key === 'd') return 'tool:split_region';
  // «F» es la tecla que anuncia el tooltip de la paleta (maqueta); «E» sigue activa y está en la ayuda.
  if (key === 'e' || key === 'f') return 'tool:draw_reinforcement';
  if (key === 'h') return 'tool:pan';
  return null;
}

/**
 * Ctrl/Cmd+Intro con el foco en un campo de texto: primero se confirma el campo (se saca el foco, como en `save`) y después se
 * comprueba. La confirmación y los registros de borradores se actualizan al repintar, así que, si había un campo enfocado, la
 * comprobación espera un turno: `check` lee entonces el estado ya actualizado (un valor inválido se rechaza con el aviso de los
 * borradores pendientes, no con un texto nuevo). Sin campo enfocado, comprueba de inmediato.
 */
export function runCheckShortcut(deps: {
  /** Saca el foco del campo enfocado (confirma su valor); `true` si había un campo. */
  commitFocused: () => boolean;
  check: () => void;
  /** Cómo esperar un turno; por defecto `setTimeout(0)`. */
  defer?: (run: () => void) => void;
}): void {
  const hadField = deps.commitFocused();
  if (!hadField) {
    deps.check();
    return;
  }
  (deps.defer ?? ((run) => void setTimeout(run, 0)))(deps.check);
}
