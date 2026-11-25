// Atajos de teclado globales del editor. Función pura: del evento al nombre de la acción.

export type ShortcutAction = 'undo' | 'redo' | 'save' | 'open' | 'check' | 'tool:select' | 'tool:add_vertex' | 'tool:draw_region' | 'tool:split_region' | 'tool:pan';

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
  if (key === 'h') return 'tool:pan';
  return null;
}
